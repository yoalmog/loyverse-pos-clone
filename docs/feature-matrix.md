# Feature Matrix — Loyverse POS Platform

| Capability Domain | Sub-Feature | Implementation Status | Component Responsible |
|---|---|---|---|
| **Catalog** | Categories & Color Coding | Implemented | `categories`, POS UI, Back Office |
| **Catalog** | Products, SKU, Barcode | Implemented | `products`, Scanner listener, Back Office |
| **Catalog** | Product Variations (Sizes) | Implemented | `product_variations`, Customizer Modal |
| **Catalog** | Modifiers & Options (Milk, Sugar) | Implemented | `modifiers`, `modifier_options`, Modal |
| **POS Sales** | Fast Product Grid & Search | Implemented | `src/app/page.tsx` & Android App |
| **POS Sales** | USB/Bluetooth Barcode Scanner | Implemented | Debounced Keydown Listener |
| **POS Sales** | Cart Quantity & Line Removal | Implemented | Cart Stepper |
| **POS Sales** | Discounts (% and Fixed Value) | Implemented | `discounts`, Cart calculations |
| **POS Sales** | Taxes (IGV 18% Inc/Exc) | Implemented | `stores.tax_rate`, Math engine |
| **POS Sales** | Dining Options (Dine-In, Takeout) | Implemented | `dining_options`, Checkout payload |
| **Checkout** | Cash Tender & Change Calculation | Implemented | Quick denominations, Math engine |
| **Checkout** | Card & Digital Wallet (Yape/Plin)| Implemented | Payment reference tracking |
| **Checkout** | Atomic Checkout Transaction | Implemented | `posService.processCheckout` |
| **Checkout** | Idempotency & Duplicate Guard | Implemented | Transactional locks, Idempotency Keys |
| **Tickets** | Hold / Save Open Order | Implemented | `orders.status = 'SAVED'`, Tickets modal |
| **Receipts** | 80mm / 58mm Thermal Print | Implemented | `@media print`, ESC/POS structure |
| **Refunds** | Refund & Auto-Restock Inventory | Implemented | `posService.refundOrder`, Back Office |
| **Shifts** | Cash Drawer Float (Opening) | Implemented | `shifts.opening_cash` |
| **Shifts** | Pay In / Pay Out Movements | Implemented | `cash_movements` |
| **Shifts** | Shift Close & Discrepancy (Z-Report)| Implemented | `shifts.cash_difference` |
| **Auth** | Cashier 4-Digit PIN Security | Implemented | `users.pin`, PIN modal |
| **Inventory** | Real-Time Stock Deductions | Implemented | `products.stock_quantity`, `inventory_logs` |
| **Inventory** | Manual Stock Adjustments | Implemented | `posService.adjustStock`, Back Office |
| **Inventory** | Low-Stock Threshold Alerts | Implemented | `products.low_stock_threshold` |
| **Back Office**| Real-Time KPI Dashboard | Implemented | `src/app/admin/page.tsx` |
| **Back Office**| Product Catalog CRUD | Implemented | Back Office Products Tab |
| **Back Office**| Inventory Kardex History | Implemented | Back Office Inventory Tab |
| **Back Office**| Sales & Receipts History | Implemented | Back Office Orders Tab |
| **Back Office**| Shift History Audit | Implemented | Back Office Shifts Tab |
| **Back Office**| Store & Tax Configuration | Implemented | Back Office Settings Tab |
| **Offline** | SQLite Sync Queue | Implemented | Client Queue & Sync Processor |
