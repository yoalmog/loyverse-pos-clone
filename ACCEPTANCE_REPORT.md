# Acceptance & Delivery Report — Loyverse-Style POS System

## 1. Project Verification Summary

- **Framework & Runtimes**: Next.js 14.2.35 (App Router), TypeScript, Tailwind CSS, Node.js v24.21.0, React Native 0.74.5, Expo SDK 51
- **Database**: SQLite with WAL mode & Foreign Keys enabled via `better-sqlite3` (`data/pos.sqlite`)
- **Build Status**: Production build `npm run build` completed successfully (17/17 routes generated, Exit code 0)
- **TypeScript Check**: `npx tsc --noEmit` exited with code 0 across root and `apps/android`
- **Automated Test Suite**: `npm test` executed 45 tests across 5 test suites (**45 PASS, 0 FAIL**):
  - `tests/pos.test.mjs` (13 tests: catalog, shifts, atomic checkout, cash validation, modifiers, held tickets, refunds, cash movements, idempotency, failure atomicity, Back Office consistency, payload conflict rejection, concurrent checkout protection)
  - `tests/phase-b-failure.test.mjs` (13 comprehensive failure tests: change calculation, insufficient cash, empty cart, rapid repeated taps, network loss before submission, ambiguous commit loss, app termination/restart, repeated sync, competing buyers for last item in stock, refund restoration)
  - `tests/phase-c-security.test.mjs` (4 security tests: session token issuance/expiry/revocation, PIN brute-force rate limiting, role-based 403 authorization, caller impersonation prevention)
  - `tests/sync.test.mjs` (4 tests: queue enqueue, batch sync, idempotency guard, retry tracking)
  - `tests/e2e-acceptance.test.mjs` (7 end-to-end acceptance tests: complete checkout, inventory deduction, persistent disk restart, duplicate retry prevention, offline queue deduplication)
  - `tests/backoffice-operational.mjs` (Operational readiness: settings, products, inventory logs, dashboard stats, live SQLite backup verification)
- **Standalone Android APK**: `apps/android/android/app/build/outputs/apk/release/app-release.apk` (**62,343,445 bytes / 59.46 MB**, signed release APK)

---

## 2. Standalone Android APK Artifact Details (Task 7 Verified)

| Property | Value |
|---|---|
| **Artifact Path** | `apps/android/android/app/build/outputs/apk/release/app-release.apk` |
| **File Format** | Standalone Android Application Package (`.apk`) |
| **Exact File Size** | **62,343,445 bytes (59.46 MB)** |
| **SHA-256 Checksum** | `8c12cf16c29c8021836ddec655fd263e1768a58b83ccbc15a9d7c34c755cc8b3` |
| **Package Identifier** | `com.loyverse.pos.clone` |
| **Version Code / Name** | `1` / `1.0.0` |
| **Minimum SDK** | `23` (Android 6.0 Marshmallow) |
| **Target SDK** | `34` (Android 14) |
| **JavaScript Bundle** | Verified present: `assets/index.android.bundle` (Hermes bytecode) |
| **DEX Compilation** | Multi-dex: `classes.dex`, `classes2.dex`, `classes3.dex` |
| **Signature Schemes** | **v1 Scheme (JAR signing): TRUE**<br>**v2 Scheme (APK Signature Scheme v2): TRUE** |
| **Signing Certificate** | RSA 2048-bit (`CN=Android Debug, OU=Android, C=US`)<br>SHA-256 Digest: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |
| **Signing Key Location** | `apps/android/android/app/debug.keystore` (suitable for pilot sideloading & USB ADB testing) |
| **Active Permissions** | `INTERNET`, `ACCESS_NETWORK_STATE`, `BLUETOOTH`, `BLUETOOTH_ADMIN`, `VIBRATE`<br>*(Removed debug-only `SYSTEM_ALERT_WINDOW`)* |
| **Network Security Config** | `android:usesCleartextTraffic="true"` on `<application>` and `@xml/network_security_config` configured for LAN testing (`192.168.1.50`, `localhost`, `10.0.2.2`); HTTPS enforced for production domains with system trust anchors. |

---

## 3. Strict Pilot Status Matrix

*Evaluated strictly against: **PASS** (directly verified), **FAIL** (tested and failed), **BLOCKED** (cannot execute due to environment/hardware), **NOT IMPLEMENTED** (feature not implemented).*

| # | Inspection / Capability Area | Status | Verification Evidence / Reason |
|---|---|---|---|
| **1** | **Standalone APK Artifact Existence & Integrity** | **PASS** | File verified at `apps/android/android/app/build/outputs/apk/release/app-release.apk` (62,343,445 bytes, SHA-256 `8c12cf16c29c...`). Contains `assets/index.android.bundle`. |
| **2** | **APK Signature Verification** | **PASS** | `apksigner verify --verbose` confirmed v1 and v2 signature schemes valid. Clean install supported. |
| **3** | **Automated Root Test Suite Execution** | **PASS** | `npm test` returned Exit code 0 (45 tests passed, 0 failed). |
| **4** | **Next.js Production Build** | **PASS** | `npm run build` returned Exit code 0 (17 routes compiled). |
| **5** | **Android TypeScript Static Analysis** | **PASS** | `npx tsc --noEmit` in `apps/android` returned Exit code 0 (0 errors). |
| **6** | **Backend URL Resolution & Dynamic Persistence** | **PASS** | `api.ts` checks `@react-native-async-storage/async-storage` (`STORAGE_KEYS.API_URL`), falling back to environment or LAN IP. Session credentials cleared upon host switch. |
| **7** | **Connection Testing & Request Timeouts** | **PASS** | `posApi.testConnection` performs 5s ping to `/api/pos/catalog`, calculates round-trip latency (`ms`), and distinguishes HTTPS vs HTTP. `fetchWithTimeout` aborts stalled requests to prevent app freeze. |
| **8** | **Android Cleartext HTTP & Network Security** | **PASS** | `network_security_config.xml` and `android:usesCleartextTraffic="true"` configured to allow local LAN testing without Android 9-14 OS-level HTTP rejections. |
| **9** | **Zero Hardcoded Secrets in APK** | **PASS** | Code audit confirmed zero hardcoded staff PINs, database credentials, or secret keys embedded in client bundle. |
| **10** | **Physical Device Connection (ADB)** | **BLOCKED** | `adb devices -l` returned empty list. No physical Android phone attached via USB debugging. |
| **11** | **Android Emulator Execution** | **BLOCKED** | Host PC BIOS has Intel VT-x hardware virtualization disabled (`Virtualization Enabled In Firmware: No`), preventing x86_64 AVD execution. |
| **12** | **On-Device Cashier Workflow Verification** | **BLOCKED** | On-device startup, touch catalog, on-device cart, and cash checkout blocked pending physical device attachment. |
| **13** | **Offline Queue & Idempotent Sync Recovery** | **PASS** | Automated in `tests/phase-b-failure.test.mjs` and `tests/sync.test.mjs`. Tests confirm queue survives app restart, duplicate syncs return `ALREADY_SYNCED`, and conflicting keys are rejected. |
| **14** | **Concurrent Last-Item Contention** | **PASS** | Automated in `tests/phase-b-failure.test.mjs` test #12. Two simultaneous requests competing for last unit: exactly one succeeds, stock never becomes negative. |
| **15** | **Server-Side PIN Rate Limiting & Auth Audit** | **PASS** | Automated in `tests/phase-c-security.test.mjs`. 5 consecutive failed PIN attempts trigger lockout; role authorization enforces 403. |
| **16** | **SQLite WAL Live Database Backup Procedure** | **PASS** | Verified live SQLite backup procedure using SQLite WAL-safe backup API to `data/backup_pos.sqlite`. |
| **17** | **Receipt Thermal ESC/POS Socket Printing** | **NOT IMPLEMENTED** | In-app receipts render visually on screen; web Cashier uses CSS `@media print` (`window.print()`). Direct native ESC/POS socket/Bluetooth thermal printer driver is NOT implemented. |
| **18** | **Card / Digital Wallet Live Merchant Integration** | **NOT IMPLEMENTED** | Simulated cash tender, simulated card reference, and manual Yape/Plin confirmation exist. Real payment gateway APIs (e.g. Niubiz, Culqi, Stripe) are NOT implemented. |

---

## 4. Backend Connectivity, Security & Network Configuration

### Host IP & Firewall Setup
- **Host PC IPv4**: `192.168.1.50` (Ethernet adapter `Ethernet 2`, subnet `255.255.255.0`).
- **Dev Server Port**: `3001` (listening on all interfaces `0.0.0.0` / `::`).
- **Verified Reachable Route**: `http://192.168.1.50:3001/api/pos/catalog` returns HTTP 200 OK.
- **Windows Firewall**: Port 3001 inbound must be allowed for private networks:
  ```powershell
  New-NetFirewallRule -DisplayName "Loyverse POS Server (3001)" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
  ```

### Production vs Development Protocol
- **Local Testing**: Permitted via HTTP on local private subnets (`192.168.*`, `10.*`, `172.16-31.*`, `localhost`).
- **Production**: Must configure an HTTPS backend with valid TLS certificates (e.g., `https://pos.yourstore.com`). System trust anchors are strictly enforced in `network_security_config.xml`.

---

## 5. Offline Queue & Data Safety Architecture

1. **Transaction Lifecycle**:
   - `PENDING`: Stored in `@react-native-async-storage/async-storage` (`STORAGE_KEYS.OFFLINE_QUEUE`) with client UUID and idempotency key when offline or when server times out (>7s).
   - `SYNCING`: Sent in batch payload to `POST /api/sync`.
   - `SYNCED` / `ALREADY_SYNCED`: Server acknowledged; removed from local retry queue.
   - `FAILED`: Business validation rejection (e.g. invalid item ID); retained with `errorMessage` and incremented `retryCount`. Never dropped prematurely.
2. **Ambiguous Network Drops**: If the server commits the checkout but the response packet drops before reaching the client, the client retries with the identical `Idempotency-Key`. The server returns the previously committed order without creating duplicate orders or double-deducting stock.
3. **App Termination**: Queue is persisted to disk storage after every mutation, surviving application kills and reboots.

---

## 6. Server Database Backup & Rollback Procedures

### Live Backup (SQLite WAL Mode)
Because SQLite runs in Write-Ahead Logging (WAL) mode (`journal_mode = WAL`), simply copying `pos.sqlite` while writers are active can lead to incomplete data. Use the verified backup method:

```powershell
# Using SQLite CLI online backup API
sqlite3 data/pos.sqlite ".backup 'data/backup_pos_$(Get-Date -Format 'yyyyMMdd_HHmmss').sqlite'"
```

### Restore / Rollback Procedure
1. Stop the application server: `npm run dev` or production process.
2. Replace database files:
   ```powershell
   Copy-Item "data/backup_pos_<timestamp>.sqlite" "data/pos.sqlite" -Force
   Remove-Item "data/pos.sqlite-wal" -ErrorAction SilentlyContinue
   Remove-Item "data/pos.sqlite-shm" -ErrorAction SilentlyContinue
   ```
3. Restart server: `npm run dev` or `npm start`.

---

## 7. Pilot Device Installation & Testing Guide

### Option A: Via USB Debugging (Recommended)
1. Enable **Developer Options** and **USB Debugging** on your Android device.
2. Connect device via USB. Run:
   ```powershell
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r "apps\android\android\app\build\outputs\apk\release\app-release.apk"
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:3001 tcp:3001
   ```
3. Launch app:
   ```powershell
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" shell am start -n com.loyverse.pos.clone/.MainActivity
   ```

### Option B: Direct Sideloading (Over Wi-Fi)
1. Transfer `app-release.apk` to device (via USB, Google Drive, or shared folder).
2. Install APK (allow "Install unknown apps").
3. Ensure device is on the same Wi-Fi network as the host PC (`192.168.1.50`).
4. On the login screen, tap **⚙ Ajustes de Servidor / Red**, select **Wi-Fi LAN (192.168.1.50)**, tap **🔍 Probar Conexión** (should show green checkmark with latency), then tap **Guardar y Reconectar**.
5. Log in with PIN **1234** (Carlos - Cashier) or **9999** (Admin).

---

## 8. Pilot Test Checklist (To execute upon device connection)

- [ ] **Step 1: First Launch & Permissions**: App opens in landscape orientation; splash screen dismisses smoothly.
- [ ] **Step 2: Server Connection**: Tap Settings gear, enter backend URL, tap "Probar Conexión", verify green status.
- [ ] **Step 3: Cashier Login**: Enter PIN `1234`, verify welcome greeting and register interface.
- [ ] **Step 4: Shift Float**: Enter opening cash float (`S/ 200.00`) and tap "Abrir Turno".
- [ ] **Step 5: Catalog Navigation**: Filter categories, search products, verify item prices and stock badges.
- [ ] **Step 6: Cart & Modifiers**: Add items, adjust quantity, select modifiers, verify dynamic tax calculation.
- [ ] **Step 7: Cash Checkout**: Tap "Cobrar", select Cash, tender exact or higher cash, verify change calculation and receipt.
- [ ] **Step 8: Offline Test**: Put phone in Airplane Mode, complete a sale, verify "OFF-REC" offline receipt issued.
- [ ] **Step 9: Sync Reconnection**: Disable Airplane Mode, tap "Sincronizar", verify offline order uploads to Back Office.
- [ ] **Step 10: Stock Audit**: Check Back Office (`http://localhost:3001/admin`) to confirm inventory decremented exactly once.

---

## 9. Cloud PostgreSQL Migration & Render Deployment (Task 8 & 9 Verified)

### A. Supabase PostgreSQL Data Migration Summary
- **Source Database**: Local SQLite authoritative backup (`pos_backup_20261013_140257.sqlite` — 1,567 records, 806,912 bytes, PRAGMA integrity_check: `ok`).
- **Target Database**: Supabase Free PostgreSQL (Hosted on AWS US-East-2, connection pooled with SSL).
- **Execution Script**: `scripts/migrate-to-postgres.mjs` (transactional, idempotent with `ON CONFLICT DO NOTHING`).
- **Tables Migrated (24/24)**:
  `stores` (1), `users` (3), `categories` (5), `modifiers` (3), `modifier_options` (9), `dining_options` (3), `discounts` (4), `customers` (2), `suppliers` (2), `products` (34), `product_variations` (3), `product_modifiers` (9), `shifts` (1), `cash_movements` (30), `orders` (250), `order_items` (250), `payments` (249), `inventory_logs` (285), `purchase_orders` (0), `purchase_order_items` (0), `audit_logs` (328), `sync_queue` (96), `auth_rate_limits` (0), `user_sessions` (0).
- **Total Records Migrated**: **1,567 records** (100% data integrity verified).

### B. Financial & Stock Consistency Reconciliation
- **Total Catalog Stock**: SQLite = `2,716.0` | PostgreSQL = `2,716.0` (**MATCH: TRUE**)
- **Total Orders Sum**: SQLite = `304,450` cents (S/ 3,044.50) | PostgreSQL = `304,450` cents (**MATCH: TRUE**)
- **Total Captured Payments**: SQLite = `301,900` cents (S/ 3,019.00) | PostgreSQL = `301,900` cents (**MATCH: TRUE**)
- **Reconciliation Audit (S/ 25.50)**:
  Orders total exceeds Payments total by exactly `2,550` cents (S/ 25.50).
  Investigation confirmed this is **100% expected**: Exactly 1 open parked ticket exists in the database (`HOLD-5XCWO` for "Mesa 4 Terraza", status `'SAVED'`), which has zero captured payments. All 249 completed/refunded orders match payment records exactly to the cent.

### C. Automated Validation & Build Health
- **Automated Test Suite**: **51 tests passed, 0 failed** across 6 suites (including `tests/postgres-acceptance.test.mjs`).
- **Next.js Production Build**: `npm run build` completed with Exit code 0 (17/17 routes compiled).
- **Health Check**: `/api/health` tests live PostgreSQL ping with connection latency logging and automatic fallback.

### D. Render Blueprint (`render.yaml`)
- Configured for zero-cost deployment on Render's Free Web Service tier (Node.js runtime, Oregon region).
- Automated health check pinging `/api/health`.
- Manual secret attachment for `DATABASE_URL` via Render dashboard to ensure zero credential leakage in Git.

