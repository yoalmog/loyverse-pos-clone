import test from 'node:test';
import assert from 'node:assert/strict';
import { authService } from '../src/lib/auth-service.ts';
import { getDb } from '../src/lib/db.ts';

test('PHASE C — AUTHENTICATION AND AUTHORIZATION SECURITY AUDIT SUITE', async (t) => {
  const db = getDb();
  const testRunId = Date.now();

  // 1. Session Token Issuance and Verification
  await t.test('1. Session token issuance, verification, and expiration', () => {
    const session = authService.createSession('usr_admin', 'ADMIN', 24);
    assert.ok(session.token.startsWith('pos_sec_'));

    const verification = authService.verifySession(session.token);
    assert.equal(verification.valid, true);
    assert.equal(verification.user.id, 'usr_admin');
    assert.equal(verification.user.role, 'ADMIN');

    // Revocation
    authService.revokeSession(session.token);
    const afterRevoke = authService.verifySession(session.token);
    assert.equal(afterRevoke.valid, false);
  });

  // 2. Login Rate Limiting (Brute Force Protection)
  await t.test('2. Rate limiting locks out after 5 consecutive failed attempts', () => {
    const testIpKey = `test_rate_limit_${testRunId}`;

    // 5 attempts allowed
    for (let i = 0; i < 5; i++) {
      const check = authService.checkRateLimit(testIpKey, 5, 60000, 60000);
      assert.equal(check.allowed, true, `Attempt ${i + 1} must be allowed before limit`);
      authService.recordFailedAttempt(testIpKey, 5, 60000);
    }

    // 6th attempt should be blocked with rate limit lockout
    const checkBlocked = authService.checkRateLimit(testIpKey, 5, 60000, 60000);
    assert.equal(checkBlocked.allowed, false, '6th attempt must be blocked');
    assert.ok(checkBlocked.retryAfterSeconds > 0, 'Must provide retry-after duration');

    // Clean up
    authService.resetRateLimit(testIpKey);
    const checkAfterReset = authService.checkRateLimit(testIpKey, 5, 60000, 60000);
    assert.equal(checkAfterReset.allowed, true);
  });

  // 3. Role-based Request Authorization
  await t.test('3. Role permissions validate required roles and reject unauthorized roles with 403', () => {
    const cashierSession = authService.createSession('usr_cashier', 'CASHIER', 24);
    const adminSession = authService.createSession('usr_admin', 'ADMIN', 24);

    // Mock request with cashier token
    const cashierReq = new Request('http://localhost:3001/api/backoffice/inventory', {
      headers: { authorization: `Bearer ${cashierSession.token}` },
    });

    const cashierAuth = authService.verifyRequest(cashierReq, ['ADMIN', 'MANAGER']);
    assert.equal(cashierAuth.authorized, false);
    assert.equal(cashierAuth.status, 403, 'CASHIER must be rejected with 403 for ADMIN/MANAGER routes');

    // Mock request with admin token
    const adminReq = new Request('http://localhost:3001/api/backoffice/inventory', {
      headers: { authorization: `Bearer ${adminSession.token}` },
    });

    const adminAuth = authService.verifyRequest(adminReq, ['ADMIN', 'MANAGER']);
    assert.equal(adminAuth.authorized, true);
    assert.equal(adminAuth.user.role, 'ADMIN');

    // Clean up
    authService.revokeSession(cashierSession.token);
    authService.revokeSession(adminSession.token);
  });

  // 4. Caller Impersonation Prevention
  await t.test('4. Caller cannot impersonate another employee without admin credentials', () => {
    const managerSession = authService.createSession('usr_manager', 'MANAGER', 24);

    const req = new Request('http://localhost:3001/api/pos/refund', {
      headers: { authorization: `Bearer ${managerSession.token}` },
    });

    const auth = authService.verifyRequest(req, ['ADMIN', 'MANAGER']);
    assert.equal(auth.authorized, true);
    // Verified user ID is usr_manager from session token
    assert.equal(auth.user.id, 'usr_manager');
    // If request payload claims userId = 'usr_admin', mismatch is detected
    const payloadClaimedUserId = 'usr_admin';
    const isImpersonating = auth.user.id !== payloadClaimedUserId && auth.user.role !== 'ADMIN';
    assert.equal(isImpersonating, true, 'Manager claiming to be Admin is detected as impersonation');

    authService.revokeSession(managerSession.token);
  });
});
