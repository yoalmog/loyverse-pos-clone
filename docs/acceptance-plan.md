# Acceptance Plan — Loyverse POS Platform

## 1. Quality & Verification Gates

Every stage of the Loyverse POS platform must pass the following criteria before being considered complete:

1. **Static Analysis & Type Integrity**:
   - `npx tsc --noEmit` must pass with zero TypeScript errors.
2. **Automated Test Suite**:
   - All unit, integration, and API tests must pass without skips or mocks hiding real behavior.
3. **Database Consistency**:
   - Atomic transactions must guarantee that no order is recorded without corresponding stock movements and payment logs.
4. **Idempotency & Double-Charge Protection**:
   - Retried checkout requests with the same idempotency key must not create duplicate orders or deduct inventory twice.
5. **Offline Queue Recovery**:
   - Orders recorded while disconnected must sync faithfully when connectivity returns.

---

## 2. Test Verification Matrix

| Test Suite | File Location | Scope |
|---|---|---|
| **Catalog & Menu** | `tests/pos.test.mjs` | Categories, products, variations, modifiers |
| **Shift Management** | `tests/pos.test.mjs` | Opening cash, Pay In, Pay Out, Z-Report |
| **Checkout & Math** | `tests/pos.test.mjs` | Cents calculations, IGV 18%, discounts, change |
| **Stock Deductions** | `tests/pos.test.mjs` | Real-time inventory deduction & Kardex logging |
| **Hold / Open Tickets** | `tests/pos.test.mjs` | Saving, listing, and completing parked orders |
| **Refunds & Restock** | `tests/pos.test.mjs` | Status update, full inventory restock, duplicate guard |
| **Offline Sync Queue** | `tests/sync.test.mjs` | Queue storage, retry processing, idempotency |
| **Production Build** | `npm run build` | Next.js full static & dynamic route compilation |
