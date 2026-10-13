# Platform Architecture — Loyverse POS System

## 1. System Overview

The Loyverse-style POS Platform is structured as a multi-tier, modular solution engineered for high reliability, offline tolerance, and transactional consistency:

```
+-------------------------------------------------------------------+
|                        PRESENTATION LAYER                         |
|                                                                   |
|   +-----------------------------+   +-------------------------+   |
|   |   Native Android Cashier    |   |     Web Back Office     |   |
|   |  (React Native / Android)   |   |   (Next.js Dashboard)   |   |
|   |     - Touch UI Grid         |   |    - Analytics & Sales  |   |
|   |     - Local SQLite Queue    |   |    - Inventory Control  |   |
|   |     - Offline-First Engine  |   |    - Catalog & Settings |   |
|   +--------------+--------------+   +------------+------------+   |
|                  |                               |                |
+------------------|-------------------------------|----------------+
                   |                               |
                   v                               v
+-------------------------------------------------------------------+
|                  SHARED BACKEND & API SERVICES                    |
|                                                                   |
|   - Restful Endpoints (/api/pos/*, /api/backoffice/*)              |
|   - Authentication & Role-Based Permissions                       |
|   - Atomic Checkout Transaction Engine (ACID)                     |
|   - Idempotency & Offline Sync Queue Processor                    |
|   - Tax, Discount & Currency Engine (PEN / S/ / Configurable)     |
|   - Inventory Movement (Kardex) & Stock Deductions                |
+-------------------------------------------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------+
|                          DATA PERSISTENCE                         |
|                                                                   |
|   Server Production Database: SQLite / PostgreSQL (WAL Mode)      |
|   Client Android Device Database: Local SQLite Engine             |
|   - Strict Foreign Key Enforcements                              |
|   - Safe Integer Minor-Units (Cents) for all Monetary Calculations|
+-------------------------------------------------------------------+
```

---

## 2. Core Architectural Principles

1. **Transactional Integrity**:
   Every sale checkout commits atomically in a single transaction:
   - Order creation
   - Immutable Order Item snapshots
   - Payment record creation
   - Inventory deduction and `inventory_logs` entry
   - Shift expected cash increment
2. **Offline-First & Durable Sync Queue**:
   When offline, the Android POS records sales into a local SQLite queue with client-generated UUIDs and idempotency keys. Once connection resumes, pending sync payloads are processed idempotently by the backend without duplicate transactions.
3. **Monetary Safety**:
   All monetary amounts are stored as integer minor units (cents). For Peruvian Soles (`PEN`), `S/ 12.50` is stored as `1250`. Tax (IGV 18%) is calculated with deterministic integer rounding.
4. **Hardware Interfacing**:
   - Keyboard-wedge barcode scanners are captured via debounced key-event buffering.
   - Thermal receipt printing supports 80mm and 58mm ESC/POS compatible output via native print services or `@media print`.
