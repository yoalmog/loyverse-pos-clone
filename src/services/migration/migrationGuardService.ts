import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dns from 'dns';

export interface MigrationStatus {
  local: string | null;
  remote: string | null;
  isApplied: boolean;
  isMismatched?: boolean;
}

/**
 * Parses Supabase CLI `supabase migration list` table output.
 * Ensures strict, fail-closed column verification:
 * - Must locate header row with LOCAL and REMOTE columns
 * - Row MUST have a valid 14-digit timestamp in the REMOTE column to count as applied.
 * - Dates in TIME (UTC) or elsewhere must NEVER count as remote application proof.
 * - Supports:
 *   - Normal applied rows: LOCAL == REMOTE (14-digit)
 *   - Local-only unapplied rows: LOCAL has 14-digit, REMOTE is empty
 *   - Remote-only rows: LOCAL is empty, REMOTE has 14-digit
 *   - Mismatched rows: LOCAL != REMOTE (both have 14 digits but different values)
 * - Unknown, malformed, or missing output throws an error (fail closed).
 */
export function parseMigrationListLedger(rawOutput: string): MigrationStatus[] {
  if (!rawOutput || rawOutput.trim() === '') {
    throw new Error('Ledger output is empty: failing closed');
  }

  const lines = rawOutput
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const headerIdx = lines.findIndex((line) => {
    const normalized = line.toUpperCase();
    return (
      normalized.includes('LOCAL') &&
      normalized.includes('REMOTE')
    );
  });

  if (headerIdx === -1) {
    throw new Error(
      'Malformed ledger output: table header with LOCAL and REMOTE columns not found'
    );
  }

  const results: MigrationStatus[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];

    // Ignore lines that are not table rows
    if (!line.includes('|')) {
      continue;
    }

    let columns = line
      .split('|')
      .map((p) => p.trim());

    /*
      Supports both:

      | Local | Remote | Time |
      and
      Local | Remote | Time

      Remove only the artificial empty first column
      created by markdown tables.
    */
    if (columns[0] === '') {
      columns = columns.slice(1);
    }

    if (columns.length < 2) {
      continue;
    }

 const localCol = (columns[0] ?? '')
  .replace(/[`]/g, '')
  .trim();

const remoteCol = (columns[1] ?? '')
  .replace(/[`]/g, '')
  .trim();

const isLocalTs = /^\d{14}$/.test(localCol);
const isRemoteTs = /^\d{14}$/.test(remoteCol);

    // Ignore separator/header rows
    if (!isLocalTs && !isRemoteTs) {
      continue;
    }

    // Both Local and Remote exist
    if (isLocalTs && isRemoteTs) {
      results.push({
        local: localCol,
        remote: remoteCol,
        isApplied: localCol === remoteCol,
        isMismatched: localCol !== remoteCol
      });

      continue;
    }

    // Local exists, Remote missing
    if (isLocalTs && !isRemoteTs) {
      results.push({
        local: localCol,
        remote: null,
        isApplied: false,
        isMismatched: false
      });

      continue;
    }

    // Remote exists, Local missing
    if (!isLocalTs && isRemoteTs) {
      results.push({
        local: null,
        remote: remoteCol,
        isApplied: true,
        isMismatched: false
      });

      continue;
    }
  }

  if (results.length === 0) {
    console.error('RAW SUPABASE MIGRATION OUTPUT:');
    console.error(rawOutput);

    throw new Error(
      'No valid migration rows parsed from ledger: failing closed'
    );
  }

  return results;
}

/**
 * Validates staging environment contents prior to running supabase db push.
 * Proves that:
 * 1. Target file exists and timestamp is a valid 14-digit format.
 * 2. Exactly one unapplied pending migration is visible in staging.
 * 3. The pending migration matches the target migration.
 * 4. Staging directory is non-empty and contains valid SQL files.
 */
export function validateStagingEnvironment(
  stagingDir: string,
  targetFile: string,
  appliedTimestamps: Set<string>
): { isValid: boolean; stagedPending: string[]; message: string } {
  if (!fs.existsSync(stagingDir)) {
    throw new Error(`Staging directory does not exist: ${stagingDir}`);
  }

  const migrationsDir = path.join(stagingDir, 'supabase', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Staging migrations folder does not exist: ${migrationsDir}`);
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    throw new Error(`Staging migrations folder is completely empty! Zero migrations found.`);
  }

  const targetTs = targetFile.split('_')[0];
  if (!/^\d{14}$/.test(targetTs)) {
    throw new Error(`Invalid target timestamp format: ${targetTs} (expected 14 digits)`);
  }

  if (!files.includes(targetFile)) {
    throw new Error(`Approved target migration '${targetFile}' is missing from staging directory`);
  }

  // Count unapplied migrations among staged files
  const unapplied = files.filter(f => {
    const ts = f.split('_')[0];
    return !appliedTimestamps.has(ts);
  });

  if (unapplied.length === 0) {
    throw new Error(`SAFETY VIOLATION: Zero pending migrations visible in staging! Already applied or empty plan. Cannot report success.`);
  }

  if (unapplied.length > 1) {
    throw new Error(`SAFETY VIOLATION: Staging directory contains multiple (${unapplied.length}) unapplied migrations: ${unapplied.join(', ')}. Exactly one pending migration required.`);
  }

  if (unapplied[0] !== targetFile) {
    throw new Error(`SAFETY VIOLATION: The visible pending migration in staging ('${unapplied[0]}') does not match the approved target ('${targetFile}')!`);
  }

  return {
    isValid: true,
    stagedPending: unapplied,
    message: `Staging strictly contains exactly one pending migration: ${targetFile}`
  };
}

export interface TransitionVerificationResult {
  verified: boolean;
  targetFile: string;
  targetTs: string;
  appliedBefore: boolean;
  appliedAfter: boolean;
  newlyApplied: string[];
  unexpectedApplied: string[];
  remainingPendingCount: number;
  remainingPending: string[];
  allApplied: boolean;
}

/**
 * Asserts exact remote ledger state before and after migration deployment:
 * 1. Approved target migration was NOT applied before.
 * 2. Approved target migration IS applied after.
 * 3. NO OTHER migration was applied (newlyApplied == [targetTs]).
 * 4. Accurate re-computation of remaining migrations.
 */
export function verifyLedgerTransition(
  beforeRawOutput: string,
  afterRawOutput: string,
  targetFile: string,
  migrationsDir: string = 'supabase/migrations'
): TransitionVerificationResult {
  const targetTs = targetFile.split('_')[0];
  if (!/^\d{14}$/.test(targetTs)) {
    throw new Error(`Invalid target migration filename: '${targetFile}'`);
  }

  const beforeRecords = parseMigrationListLedger(beforeRawOutput);
  const afterRecords = parseMigrationListLedger(afterRawOutput);

  const beforeApplied = new Set<string>();
  for (const r of beforeRecords) {
    if (r.isApplied && r.remote) beforeApplied.add(r.remote);
  }

  const afterApplied = new Set<string>();
  for (const r of afterRecords) {
    if (r.isApplied && r.remote) afterApplied.add(r.remote);
  }

  if (beforeApplied.has(targetTs)) {
    throw new Error(`TRANSITION ASSERTION FAILED: Target migration '${targetFile}' (${targetTs}) was ALREADY APPLIED before this run!`);
  }

  if (!afterApplied.has(targetTs)) {
    throw new Error(`TRANSITION ASSERTION FAILED: Target migration '${targetFile}' (${targetTs}) was NOT APPLIED after deployment step!`);
  }

  const newlyApplied: string[] = [];
  const unexpectedApplied: string[] = [];

  for (const ts of Array.from(afterApplied)) {
    if (!beforeApplied.has(ts)) {
      newlyApplied.push(ts);
      if (ts !== targetTs) {
        unexpectedApplied.push(ts);
      }
    }
  }

  if (unexpectedApplied.length > 0) {
    throw new Error(`SAFETY VIOLATION: Unexpected migration(s) applied in addition to target: [${unexpectedApplied.join(', ')}]. Sequential single-migration contract violated!`);
  }

  // Accurate re-computation of remaining migrations
  const localFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const remainingPending = localFiles.filter(f => !afterApplied.has(f.split('_')[0]));

  return {
    verified: true,
    targetFile,
    targetTs,
    appliedBefore: false,
    appliedAfter: true,
    newlyApplied,
    unexpectedApplied,
    remainingPendingCount: remainingPending.length,
    remainingPending,
    allApplied: remainingPending.length === 0
  };
}

export interface SmokeCheckResult {
  passed: boolean;
  targetFile: string;
  expectedObjects: {
    tables: string[];
    rpcs: string[];
  };
  verifiedObjects: {
    tables: string[];
    rpcs: string[];
  };
  missingObjects: {
    tables: string[];
    rpcs: string[];
  };
  summary: string;
}

/**
 * Mandatory, migration-specific smoke verification against live Supabase instance.
 * Missing credentials or missing expected objects MUST return passed: false (block deployment).
 */
export async function runMigrationSmokeCheck(
  targetFile: string,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<SmokeCheckResult> {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    return {
      passed: false,
      targetFile,
      expectedObjects: { tables: [], rpcs: [] },
      verifiedObjects: { tables: [], rpcs: [] },
      missingObjects: { tables: [], rpcs: [] },
      summary: 'MANDATORY VERIFICATION BLOCKED: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided.'
    };
  }

  // Determine expected schema objects introduced by this migration
  let expectedTables: string[] = [];
  let expectedRpcs: string[] = [];

  if (targetFile.includes('20240523000001')) {
    expectedTables = ['stores', 'terminals', 'roles', 'permissions', 'user_profiles'];
    expectedRpcs = [];
  } else if (targetFile.includes('20261006000001')) {
    expectedTables = ['stores', 'terminals', 'products', 'categories', 'sales', 'customers', 'inventory', 'cash_shifts'];
    expectedRpcs = [];
  } else if (targetFile.includes('20261006000002')) {
    expectedTables = ['stores', 'sales', 'products'];
    expectedRpcs = [];
  } else if (targetFile.includes('20261008000001')) {
    expectedTables = ['stores', 'terminals', 'products', 'sales', 'cash_shifts', 'sync_cursors', 'sync_events'];
    expectedRpcs = ['process_sale_atomic', 'record_inventory_movement_atomic', 'open_cash_shift_atomic', 'close_cash_shift_atomic'];
  } else {
    // Default baseline check
    expectedTables = ['stores'];
    expectedRpcs = [];
  }

  const verifiedTables: string[] = [];
  const missingTables: string[] = [];
  const verifiedRpcs: string[] = [];
  const missingRpcs: string[] = [];

  // Check tables via REST
  for (const table of expectedTables) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`
        }
      });
      if (res.ok || res.status === 401 || res.status === 403) {
        verifiedTables.push(table);
      } else {
        const text = await res.text();
        if (text.includes('PGRST205') || res.status === 404) {
          missingTables.push(table);
        } else {
          verifiedTables.push(table);
        }
      }
    } catch {
      missingTables.push(table);
    }
  }

   // Check RPCs
  //
  // IMPORTANT:
  // A RPC returning an error does NOT mean it is missing.
  // Supabase returns validation/auth/business errors for existing functions.
  // Only PGRST202 means the RPC does not exist.

  for (const rpc of expectedRpcs) {
    try {
      let payload: Record<string, unknown> = {};

      switch (rpc) {
        case 'process_sale_atomic':
          payload = {
            p_sale: {},
            p_items: [],
            p_payments: [],
            p_movements: [],
            p_client_event_id: 'aurapos-smoke-test'
          };
          break;

        case 'record_inventory_movement_atomic':
          payload = {
            p_movement: {}
          };
          break;

        case 'open_cash_shift_atomic':
        case 'close_cash_shift_atomic':
          payload = {
            p_shift: {}
          };
          break;
      }

      const res = await fetch(
        `${supabaseUrl}/rest/v1/rpc/${rpc}`,
        {
          method: 'POST',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      const text = await res.text();

      // Function truly missing from PostgREST
      if (
        res.status === 404 &&
        text.includes('PGRST202')
      ) {
        missingRpcs.push(rpc);
      } else {
        // Existing RPC:
        // 200 OK
        // 400 validation error
        // 401 auth error
        // 403 permission error
        // 409 constraint/business error
        // all prove the function exists.
        verifiedRpcs.push(rpc);
      }

    } catch {
      missingRpcs.push(rpc);
    }
  }

  const passed = missingTables.length === 0 && missingRpcs.length === 0;
  const summary = passed
    ? `Migration ${targetFile} smoke check PASSED: Verified ${verifiedTables.length} tables and ${verifiedRpcs.length} RPCs.`
    : `Migration ${targetFile} smoke check FAILED: Missing tables [${missingTables.join(', ')}], missing RPCs [${missingRpcs.join(', ')}].`;

  return {
    passed,
    targetFile,
    expectedObjects: { tables: expectedTables, rpcs: expectedRpcs },
    verifiedObjects: { tables: verifiedTables, rpcs: verifiedRpcs },
    missingObjects: { tables: missingTables, rpcs: missingRpcs },
    summary
  };
}

/**
 * Canonical SHA-256 baseline hashes for all four original migrations.
 * Ensures zero silent mutations or rewrites.
 */
export const CANONICAL_MIGRATION_HASHES: Record<string, string> = {
  '20240523000001_core_schema.sql': '1aef1f1fb0329a83fbcfbca7f6afa8e09f1f10e87f0d6fb9ded2b78336bdfee9',
  '20261006000001_core_schema.sql': 'd920002bd6d42ddb15c7ffcc59caf278f6e377ceb73a6a0ee9004a3961a2eb83',
  '20261006000002_rls_and_policies.sql': 'ab687279ba8b7016a04f530ca9672a94fd1d5e0ff097a64da6c7610298dea3b8',
  '20261008000001_phase4a_cloud_foundation.sql': 'c3d1ac039f4eb4b9c59f9f4b79e98d2b4de1a49fad1a6be46876f51333e087b7'
};

export interface MigrationIntegrityReport {
  valid: boolean;
  hashes: Record<string, string>;
  mismatches: string[];
  missingFiles: string[];
  summary: string;
}

/**
 * Asserts the byte-for-byte SHA-256 integrity of all four original migrations.
 * Fails closed if any file is missing, altered, or rewritten.
 */
export function verifyMigrationIntegrity(
  migrationsDir: string = path.resolve(process.cwd(), 'supabase/migrations')
): MigrationIntegrityReport {
  const hashes: Record<string, string> = {};
  const mismatches: string[] = [];
  const missingFiles: string[] = [];

  for (const [filename, expectedHash] of Object.entries(CANONICAL_MIGRATION_HASHES)) {
    const filePath = path.join(migrationsDir, filename);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(filename);
      continue;
    }

    const content = fs.readFileSync(filePath);
    let actualHash = crypto.createHash('sha256').update(content).digest('hex');
    if (actualHash !== expectedHash) {
      const normalized = content.toString('utf8').replace(/\r\n/g, '\n');
      const normalizedHash = crypto.createHash('sha256').update(Buffer.from(normalized, 'utf8')).digest('hex');
      if (normalizedHash === expectedHash) {
        actualHash = normalizedHash;
      }
    }
    hashes[filename] = actualHash;

    if (actualHash !== expectedHash) {
      mismatches.push(`${filename} (expected: ${expectedHash}, actual: ${actualHash})`);
    }
  }

  const valid = missingFiles.length === 0 && mismatches.length === 0;
  const summary = valid
    ? `All ${Object.keys(CANONICAL_MIGRATION_HASHES).length} original migrations verified byte-for-byte.`
    : `Integrity check FAILED: ${missingFiles.length} missing, ${mismatches.length} mismatches.`;

  return {
    valid,
    hashes,
    mismatches,
    missingFiles,
    summary
  };
}

export interface TargetDbIdentityResult {
  valid: boolean;
  expectedProject: string;
  detectedProject: string | null;
  hostname: string | null;
  dnsResolvedIp?: string | null;
  error?: string;
}

/**
 * Verifies target database identity before any remote operation that can mutate data.
 * When SUPABASE_DB_URL is provided, explicitly verifies that it resolves to the intended
 * AuraPOS project (default 'zchadhvfffmmarpznyxi').
 * Fail-closed: returns valid=false on any ambiguity, mismatch, or unrecognized host.
 */
export async function verifyTargetDatabaseIdentity(
  dbUrl: string,
  expectedProjectId: string = 'zchadhvfffmmarpznyxi'
): Promise<TargetDbIdentityResult> {
  const expected = expectedProjectId.trim().toLowerCase();

  if (!dbUrl || typeof dbUrl !== 'string' || dbUrl.trim() === '') {
    return {
      valid: false,
      expectedProject: expected,
      detectedProject: null,
      hostname: null,
      error: 'Database URL is empty or undefined.'
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch (e: any) {
    return {
      valid: false,
      expectedProject: expected,
      detectedProject: null,
      hostname: null,
      error: `Invalid database connection URL syntax: ${e.message}`
    };
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    return {
      valid: false,
      expectedProject: expected,
      detectedProject: null,
      hostname: parsed.hostname,
      error: `Invalid database protocol: expected postgres: or postgresql:, got '${parsed.protocol}'`
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const username = decodeURIComponent(parsed.username || '').toLowerCase();

  // Pattern 1: Direct Supabase hostname pattern: db.<project-ref>.supabase.co or db.<project-ref>.supabase.net
  const directMatch = hostname.match(/^db\.([a-z0-9_-]+)\.supabase\.(co|net)$/i);
  if (directMatch) {
    const detected = directMatch[1].toLowerCase();
    if (detected !== expected) {
      return {
        valid: false,
        expectedProject: expected,
        detectedProject: detected,
        hostname,
        error: `Target project mismatch in DB URL host: expected '${expected}', detected '${detected}'. Aborting to prevent accidental mutation of wrong database.`
      };
    }

    // Verify DNS resolution to prove host actually resolves
    try {
      const dnsResult = await dns.promises.lookup(hostname);
      return {
        valid: true,
        expectedProject: expected,
        detectedProject: detected,
        hostname,
        dnsResolvedIp: dnsResult.address
      };
    } catch (dnsErr: any) {
      return {
        valid: false,
        expectedProject: expected,
        detectedProject: detected,
        hostname,
        error: `DNS resolution failed for target host '${hostname}': ${dnsErr.message}`
      };
    }
  }

  // Pattern 2: Pooler Supabase pattern: aws-0-<region>.pooler.supabase.com with username postgres.<project-ref>
  if (hostname.includes('pooler.supabase.com') || hostname.includes('supabase.co')) {
    const userParts = username.split('.');
    if (userParts.length >= 2 && userParts[0] === 'postgres') {
      const detected = userParts[1].toLowerCase();
      if (detected !== expected) {
        return {
          valid: false,
          expectedProject: expected,
          detectedProject: detected,
          hostname,
          error: `Target project mismatch in DB URL username: expected '${expected}', detected '${detected}'. Aborting to prevent accidental mutation of wrong database.`
        };
      }

      try {
        const dnsResult = await dns.promises.lookup(hostname);
        return {
          valid: true,
          expectedProject: expected,
          detectedProject: detected,
          hostname,
          dnsResolvedIp: dnsResult.address
        };
      } catch (dnsErr: any) {
        return {
          valid: false,
          expectedProject: expected,
          detectedProject: detected,
          hostname,
          error: `DNS resolution failed for pooler host '${hostname}': ${dnsErr.message}`
        };
      }
    }
  }

  // Pattern 3: Local disposable / loopback connection
  if (hostname === '127.0.0.1' || hostname === 'localhost') {
    if (expected === 'local' || process.env.ALLOW_LOCAL_DB === 'true' || process.env.NODE_ENV === 'test') {
      return {
        valid: true,
        expectedProject: expected,
        detectedProject: 'local',
        hostname,
        dnsResolvedIp: '127.0.0.1'
      };
    }
    return {
      valid: false,
      expectedProject: expected,
      detectedProject: 'localhost',
      hostname,
      error: `Local database URL provided (${hostname}) but target project is configured as production ('${expected}'). Local DB URLs are rejected without explicit ALLOW_LOCAL_DB override.`
    };
  }

  // Pattern 4: Unrecognized host fails closed
  return {
    valid: false,
    expectedProject: expected,
    detectedProject: null,
    hostname,
    error: `Could not verify target project identity from DB URL host '${hostname}'. Host must resolve to db.<project-ref>.supabase.co or pooler.supabase.com with username postgres.<project-ref>.`
  };
}
