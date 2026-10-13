# Loyverse POS Clone — Full-Stack Point of Sale & Back Office

A high-performance, responsive Point-of-Sale (POS) and Back Office administrative system inspired by the workflows and capabilities of **Loyverse POS** (reverse-engineered and mapped from `Loyverse POS-2.74.apk` using REA).

Built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, and **SQLite** with atomic ACID transactions, multi-channel payment handling, and real-time inventory management.

---

## 🌟 Key Features

### 🛒 1. Point of Sale (POS) Interface (`/`)
- **Product Grid**: Category pill navigation, fast search (by name, SKU, or barcode), visual color swatches, stock availability badges.
- **Product Variations & Modifiers**: Customizable options (e.g., sizes, milk choices, sweetness levels, extra espresso shots).
- **USB / Bluetooth Barcode Scanner Support**: Automatic keyboard-wedge barcode interception.
- **Cart Management**: Quantity increment/decrement, dining options (Dine-in, Takeout, Delivery), customer loyalty selection, and order notes.
- **Discounts & Taxes**: Flexible percentage or fixed discounts, Peruvian Sol (`PEN`, `S/`) default with configurable IGV (18% inclusive/exclusive).
- **Multi-Method Checkout**:
  - Cash with Quick Denomination buttons (`Exacto`, `S/ 10`, `S/ 20`, `S/ 50`, `S/ 100`) and live change calculation.
  - Credit/Debit Cards with authorization reference.
  - Mobile Digital Wallets (Yape, Plin, QR).
- **Thermal Receipt System**: 80mm and 58mm ESC/POS formatted receipt preview and instant printing (`window.print()`).
- **Hold / Save Tickets**: Park open tickets with table/customer identifiers and restore them anytime.
- **Shift & Cash Drawer Management**: Track opening cash float, record Pay In / Pay Out cash movements, and close shifts with discrepancy calculations (X/Z Report).
- **Cashier PIN Security**: Fast cashier switching via 4-digit PIN pad.

### 🏢 2. Back Office Administration (`/admin`)
- **Overview & Analytics**: Gross sales, net sales, average ticket, refund totals, top-selling products, and low stock warnings.
- **Product Catalog Management**: Full CRUD for items, prices, costs, categories, barcodes, SKUs, and stock tracking.
- **Inventory & Kardex**: Real-time stock counts, stock adjustments (receipts, physical counts, loss/spoilage), and audit logs.
- **Receipts & Refunds**: Complete transaction history with receipt preview and one-click refund processing (automatically restocks inventory).
- **Shift Audits**: Historical shift records showing expected vs. actual drawer cash and discrepancies.
- **Store Settings**: Business details (RUC, address, phone), tax rates (IGV), currency symbols, and custom receipt headers/footers.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Lucide Icons
- **Backend**: Next.js Server Route Handlers
- **Database**: SQLite via `better-sqlite3` with WAL mode and foreign key constraints enabled
- **Validation**: Zod schema validation
- **Testing**: Built-in Node test runner (`node --test`)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20 or higher
- npm 10 or higher

### Installation

1. Clone or navigate to the project directory:
   ```bash
   cd "loyverse pos clone"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser:
   - **Cashier POS Interface**: [http://localhost:3000](http://localhost:3000)
   - **Back Office Dashboard**: [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 🧪 Running Automated Tests

Run the unit and integration test suite:

```bash
npm test
```

Tests verify:
- Catalog and modifier hierarchy loading
- Active shift tracking
- Atomic checkout transactions with inventory deduction and change calculation
- Insufficient cash rejection
- Open ticket hold and recall
- Refund processing and inventory restoration
- Double refund prevention
- Cash movements (Pay In / Pay Out)

---

## 🔐 Default Demo Accounts & PINs

| Role | Name | Email | PIN |
|---|---|---|---|
| **Cashier** | Carlos Mendoza | carlos@cafedelparque.pe | `1234` |
| **Manager** | Mariana Lopez | mariana@cafedelparque.pe | `4321` |
| **Administrator** | Admin General | admin@cafedelparque.pe | `9999` |

---

## 📂 Project Structure

```
├── data/                      # Persistent SQLite database storage (pos.sqlite)
├── src/
│   ├── app/
│   │   ├── admin/page.tsx     # Back Office Dashboard & CRUD
│   │   ├── api/
│   │   │   ├── backoffice/    # Back Office API endpoints
│   │   │   └── pos/           # POS Cashier API endpoints
│   │   ├── globals.css        # Thermal print media queries & base styles
│   │   ├── layout.tsx         # Responsive tablet viewport setup
│   │   └── page.tsx           # Main POS Cashier tablet interface
│   └── lib/
│       ├── db.ts              # SQLite database initialization & seeding
│       └── pos-service.ts     # Core business logic service layer (ACID transactions)
├── tests/
│   └── pos.test.mjs           # Automated integration test suite
├── package.json
└── tsconfig.json
```
