# REA Investigation Log — Loyverse POS Analysis

## 1. Investigation Target & Session Metadata

- **Artifact Target**: `Loyverse POS-2.74.apk`
- **Path**: `c:\Users\Usuario\github repos\loyverse pos clone\Loyverse POS-2.74.apk`
- **File Size**: 92,911,208 bytes (92.9 MB)
- **SHA-256 Digest**: `af0d001f9d0a847696556a20fb0b14661981f41a6c8cf364a932480ae0f3ae05`
- **Tool Protocol**: Reverse Engineering Anything (REA) via Model Context Protocol (MCP)
- **Session Identification**: Retained Evidence ID `ev_7e2a82588267bd4f33f7d479cedcd1195ee0367f73383ed26de2fa2f99f4bd3c`
- **Exported Bundle Size**: 21,607,330 bytes

---

## 2. REA Execution Trail

### Step 1: Open Target Binary
Executed REA `open_binary`:
```json
{
  "path": "c:/Users/Usuario/github repos/loyverse pos clone/Loyverse POS-2.74.apk"
}
```
**Observation**: Recognized format `apk`, kind `archive`.

### Step 2: Capability & Session Assessment
Executed `binary_session` and observed:
- `inspect_artifact`: Supported for full nested package inventory.
- Java/DEX bytecode engines: Confirmed `io.requery` as the primary local persistence ORM.
- Stripe Terminal integration: `libcots-android-native.so` and `com.stripe.offlinemode.storage.OfflineDatabase` schemas (versions 1 through 7).
- Sunmi LCD Customer Display: `SunmiLcdCustomerDisplay` driver classes.

### Step 3: Evidence Retention
Session evidence was retained and exported to the session scratch directory as `apk_evidence.json` (21.6 MB).

---

## 3. Discovered Domain Models & Architecture

Across 15 DEX files in the Loyverse package (`com.loyverse`), the following core entity groups were identified:

1. **Menu & Product Model**:
   - `ProductRequery`: Core item attributes (name, barcode, SKU, price, color, composite flag).
   - `ProductCategoryRequery`: Visual categorization and tab arrangement.
   - `ProductVariationRequery`: Multi-attribute variations (e.g. Regular, Mediano, Grande).
   - `ModifierRequery` & `ModifierOptionRequery`: Additive customizations.
2. **Sales, Tickets & Dining**:
   - `OpenReceiptServerResultParser`: Open tickets and server synchronization.
   - `DiningOptionRequery` & `TaxDependencyOnDiningOptionRequery`: Modal tax and dining rates.
   - `ReceiptHistoryParser`: Transaction archival format.
3. **Shifts & Cash Management**:
   - `CurrentShiftRequery`: Active shift tracking.
   - `PayInOutEventRequery`: Cash float adjustments (Pay In / Pay Out).
   - `CloseShiftEventRequery`: X/Z Report cash balancing.
4. **Offline Synchronization**:
   - `OfflineDatabase`, `offline_api_request`, `upload_queue`: Durable queue mechanisms with backoff and retry.
