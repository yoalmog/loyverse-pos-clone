-- Migration 001: Initial PostgreSQL Schema for Loyverse POS Clone
-- Dialect: PostgreSQL (Supabase Compatible)

-- 1. Stores
CREATE TABLE IF NOT EXISTS stores (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    tax_id VARCHAR(64),
    address TEXT,
    phone VARCHAR(64),
    email VARCHAR(255),
    currency_code VARCHAR(10) NOT NULL DEFAULT 'PEN',
    currency_symbol VARCHAR(10) NOT NULL DEFAULT 'S/',
    tax_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.18,
    tax_name VARCHAR(64) NOT NULL DEFAULT 'IGV',
    tax_type VARCHAR(32) NOT NULL DEFAULT 'INCLUDED',
    receipt_header TEXT,
    receipt_footer TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users (Cashiers, Managers, Admins)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    role VARCHAR(32) NOT NULL DEFAULT 'CASHIER',
    pin VARCHAR(64) NOT NULL,
    active SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Categories
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(32) DEFAULT '#3b82f6',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Modifiers
CREATE TABLE IF NOT EXISTS modifiers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Modifier Options
CREATE TABLE IF NOT EXISTS modifier_options (
    id VARCHAR(64) PRIMARY KEY,
    modifier_id VARCHAR(64) NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Dining Options
CREATE TABLE IF NOT EXISTS dining_options (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    is_default SMALLINT NOT NULL DEFAULT 0,
    active SMALLINT NOT NULL DEFAULT 1
);

-- 7. Discounts
CREATE TABLE IF NOT EXISTS discounts (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'PERCENTAGE',
    value NUMERIC(10, 2) NOT NULL DEFAULT 0,
    is_restricted SMALLINT NOT NULL DEFAULT 0,
    active SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. Customers
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(64),
    tax_number VARCHAR(64),
    address TEXT,
    points INTEGER DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(64),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. Products
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    category_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    cost INTEGER NOT NULL DEFAULT 0,
    sku VARCHAR(128) UNIQUE,
    barcode VARCHAR(128) UNIQUE,
    image_url TEXT,
    color VARCHAR(32) DEFAULT '#10b981',
    track_stock SMALLINT NOT NULL DEFAULT 1,
    stock_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
    low_stock_threshold NUMERIC(12, 3) DEFAULT 5,
    is_composite SMALLINT NOT NULL DEFAULT 0,
    active SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. Product Variations
CREATE TABLE IF NOT EXISTS product_variations (
    id VARCHAR(64) PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(128),
    barcode VARCHAR(128),
    price INTEGER NOT NULL DEFAULT 0,
    stock_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. Product Modifiers Join Table
CREATE TABLE IF NOT EXISTS product_modifiers (
    product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    modifier_id VARCHAR(64) NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, modifier_id)
);

-- 13. Shifts
CREATE TABLE IF NOT EXISTS shifts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    opened_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMPTZ,
    opening_cash INTEGER NOT NULL DEFAULT 0,
    expected_cash INTEGER DEFAULT 0,
    actual_cash INTEGER,
    cash_difference INTEGER,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    note TEXT
);

-- 14. Cash Movements
CREATE TABLE IF NOT EXISTS cash_movements (
    id VARCHAR(64) PRIMARY KEY,
    shift_id VARCHAR(64) NOT NULL REFERENCES shifts(id),
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    type VARCHAR(32) NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 15. Orders
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    idempotency_key VARCHAR(128) UNIQUE,
    receipt_number VARCHAR(64) UNIQUE NOT NULL,
    shift_id VARCHAR(64) REFERENCES shifts(id),
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    customer_id VARCHAR(64) REFERENCES customers(id),
    dining_option_id VARCHAR(64) REFERENCES dining_options(id),
    subtotal INTEGER NOT NULL DEFAULT 0,
    discount_total INTEGER NOT NULL DEFAULT 0,
    tax_total INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
    note TEXT,
    ticket_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 16. Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id),
    variation_id VARCHAR(64),
    product_name VARCHAR(255) NOT NULL,
    variation_name VARCHAR(255),
    quantity NUMERIC(12, 3) NOT NULL DEFAULT 1,
    unit_price INTEGER NOT NULL DEFAULT 0,
    cost_price INTEGER NOT NULL DEFAULT 0,
    subtotal INTEGER NOT NULL DEFAULT 0,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    selected_modifiers_json TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 17. Payments
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_method VARCHAR(32) NOT NULL,
    amount INTEGER NOT NULL,
    cash_tendered INTEGER,
    change_due INTEGER,
    reference_number VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 18. Inventory Logs
CREATE TABLE IF NOT EXISTS inventory_logs (
    id VARCHAR(64) PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id),
    variation_id VARCHAR(64),
    change_amount NUMERIC(12, 3) NOT NULL,
    previous_stock NUMERIC(12, 3) NOT NULL,
    new_stock NUMERIC(12, 3) NOT NULL,
    reason VARCHAR(64) NOT NULL,
    reference_id VARCHAR(64),
    user_id VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 19. Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id VARCHAR(64) PRIMARY KEY,
    po_number VARCHAR(64) UNIQUE NOT NULL,
    supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id),
    status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED',
    total_amount INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 20. Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id VARCHAR(64) PRIMARY KEY,
    purchase_order_id VARCHAR(64) NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id),
    quantity NUMERIC(12, 3) NOT NULL,
    unit_cost INTEGER NOT NULL,
    total_cost INTEGER NOT NULL
);

-- 21. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64),
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 22. Sync Queue
CREATE TABLE IF NOT EXISTS sync_queue (
    id VARCHAR(64) PRIMARY KEY,
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    device_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload_json TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    result_json TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMPTZ
);

-- 23. Auth Rate Limits
CREATE TABLE IF NOT EXISTS auth_rate_limits (
    key VARCHAR(128) PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 1,
    first_attempt_at BIGINT NOT NULL,
    locked_until BIGINT DEFAULT 0
);

-- 24. User Sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    token VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id);
CREATE INDEX IF NOT EXISTS idx_orders_receipt ON orders(receipt_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON inventory_logs(product_id);
