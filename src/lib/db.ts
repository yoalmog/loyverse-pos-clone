import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  // Strict guard: Disallow silent fallback to ephemeral SQLite in production
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
    throw new Error(
      '[CRITICAL PRODUCTION SAFETY GUARD] SQLite fallback is strictly forbidden in production. ' +
      'All POS, Back Office, and Sync operations must use PostgreSQL when deployed. ' +
      'DATABASE_URL must be configured and services must connect to PostgreSQL.'
    );
  }

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'pos.sqlite');
  const db = new Database(dbPath);

  // Enable WAL mode and foreign keys for high performance and integrity
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  initSchema(db);
  seedInitialData(db);

  dbInstance = db;
  return dbInstance;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      legal_name TEXT,
      tax_id TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      currency_code TEXT NOT NULL DEFAULT 'PEN',
      currency_symbol TEXT NOT NULL DEFAULT 'S/',
      tax_rate REAL NOT NULL DEFAULT 0.18,
      tax_name TEXT NOT NULL DEFAULT 'IGV',
      tax_type TEXT NOT NULL DEFAULT 'INCLUDED',
      receipt_header TEXT,
      receipt_footer TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      role TEXT NOT NULL DEFAULT 'CASHIER',
      pin TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      category_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL DEFAULT 0,
      cost INTEGER NOT NULL DEFAULT 0,
      sku TEXT UNIQUE,
      barcode TEXT UNIQUE,
      image_url TEXT,
      color TEXT DEFAULT '#10b981',
      track_stock INTEGER NOT NULL DEFAULT 1,
      stock_quantity REAL NOT NULL DEFAULT 0,
      low_stock_threshold REAL DEFAULT 5,
      is_composite INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS product_variations (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT,
      barcode TEXT,
      price INTEGER NOT NULL DEFAULT 0,
      stock_quantity REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS modifiers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS modifier_options (
      id TEXT PRIMARY KEY,
      modifier_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (modifier_id) REFERENCES modifiers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_modifiers (
      product_id TEXT NOT NULL,
      modifier_id TEXT NOT NULL,
      PRIMARY KEY (product_id, modifier_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (modifier_id) REFERENCES modifiers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      tax_number TEXT,
      address TEXT,
      points INTEGER DEFAULT 0,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS discounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'PERCENTAGE',
      value REAL NOT NULL DEFAULT 0,
      is_restricted INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dining_options (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      opening_cash INTEGER NOT NULL DEFAULT 0,
      expected_cash INTEGER DEFAULT 0,
      actual_cash INTEGER,
      cash_difference INTEGER,
      status TEXT NOT NULL DEFAULT 'OPEN',
      note TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS cash_movements (
      id TEXT PRIMARY KEY,
      shift_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shift_id) REFERENCES shifts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT UNIQUE,
      receipt_number TEXT UNIQUE NOT NULL,
      shift_id TEXT,
      user_id TEXT NOT NULL,
      customer_id TEXT,
      dining_option_id TEXT,
      subtotal INTEGER NOT NULL DEFAULT 0,
      discount_total INTEGER NOT NULL DEFAULT 0,
      tax_total INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      note TEXT,
      ticket_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shift_id) REFERENCES shifts(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (dining_option_id) REFERENCES dining_options(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variation_id TEXT,
      product_name TEXT NOT NULL,
      variation_name TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price INTEGER NOT NULL DEFAULT 0,
      cost_price INTEGER NOT NULL DEFAULT 0,
      subtotal INTEGER NOT NULL DEFAULT 0,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      selected_modifiers_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      amount INTEGER NOT NULL,
      cash_tendered INTEGER,
      change_due INTEGER,
      reference_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_logs (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      variation_id TEXT,
      change_amount REAL NOT NULL,
      previous_stock REAL NOT NULL,
      new_stock REAL NOT NULL,
      reason TEXT NOT NULL,
      reference_id TEXT,
      user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      po_number TEXT UNIQUE NOT NULL,
      supplier_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'RECEIVED',
      total_amount INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id TEXT PRIMARY KEY,
      purchase_order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_cost INTEGER NOT NULL,
      total_cost INTEGER NOT NULL,
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes for ultra-fast POS lookups
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id);
    CREATE INDEX IF NOT EXISTS idx_orders_receipt ON orders(receipt_number);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
  `);

  // Migration: ensure idempotency_key exists on existing databases
  try {
    db.exec('ALTER TABLE orders ADD COLUMN idempotency_key TEXT');
  } catch {}
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key);');
}

function seedInitialData(db: Database.Database) {
  const storeCount = db.prepare('SELECT COUNT(*) as count FROM stores').get() as { count: number };
  if (storeCount.count > 0) return;

  const now = new Date().toISOString();

  // 1. Store
  db.prepare(`
    INSERT INTO stores (id, name, legal_name, tax_id, address, phone, email, currency_code, currency_symbol, tax_rate, tax_name, tax_type, receipt_header, receipt_footer)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'store_default',
    'Cafe Del Parque - POS',
    'Inversiones Gourmet Del Parque S.A.C.',
    '20601234567',
    'Av. Larco 456, Miraflores, Lima',
    '+51 1 445-8920',
    'contacto@cafedelparque.pe',
    'PEN',
    'S/',
    0.18,
    'IGV',
    'INCLUDED',
    '¡Bienvenidos a Cafe Del Parque!\nBoleta de Venta Electrónica',
    'Gracias por su preferencia\nConserve su comprobante para cualquier reclamo'
  );

  // 2. Users (Admin and Cashier)
  const insertUser = db.prepare('INSERT INTO users (id, name, email, role, pin) VALUES (?, ?, ?, ?, ?)');
  insertUser.run('usr_admin', 'Administrador General', 'admin@cafedelparque.pe', 'ADMIN', '9999');
  insertUser.run('usr_manager', 'Mariana Lopez (Encargada)', 'mariana@cafedelparque.pe', 'MANAGER', '4321');
  insertUser.run('usr_cashier', 'Carlos Mendoza (Cajero)', 'carlos@cafedelparque.pe', 'CASHIER', '1234');

  // 3. Dining Options
  const insertDining = db.prepare('INSERT INTO dining_options (id, name, is_default) VALUES (?, ?, ?)');
  insertDining.run('dining_dine_in', 'Para comer aquí', 1);
  insertDining.run('dining_takeout', 'Para llevar', 0);
  insertDining.run('dining_delivery', 'Delivery', 0);

  // 4. Discounts
  const insertDiscount = db.prepare('INSERT INTO discounts (id, name, type, value, is_restricted) VALUES (?, ?, ?, ?, ?)');
  insertDiscount.run('disc_5pct', 'Descuento 5%', 'PERCENTAGE', 5, 0);
  insertDiscount.run('disc_10pct', 'Descuento 10%', 'PERCENTAGE', 10, 0);
  insertDiscount.run('disc_staff', 'Descuento Empleado 20%', 'PERCENTAGE', 20, 1);
  insertDiscount.run('disc_promo_5sol', 'Cupón S/ 5.00', 'FIXED', 500, 0);

  // 5. Categories
  const insertCategory = db.prepare('INSERT INTO categories (id, name, color, sort_order) VALUES (?, ?, ?, ?)');
  insertCategory.run('cat_coffee', 'Cafetería & Bebidas Calientes', '#854d0e', 1);
  insertCategory.run('cat_cold', 'Bebidas Frías & Jugos', '#0284c7', 2);
  insertCategory.run('cat_bakery', 'Panadería & Pasteles', '#d97706', 3);
  insertCategory.run('cat_sandwiches', 'Sandwiches & Salados', '#16a34a', 4);
  insertCategory.run('cat_desserts', 'Postres & Dulces', '#db2777', 5);

  // 6. Modifiers
  const insertMod = db.prepare('INSERT INTO modifiers (id, name) VALUES (?, ?)');
  insertMod.run('mod_milk', 'Tipo de Leche');
  insertMod.run('mod_sugar', 'Nivel de Dulzura');
  insertMod.run('mod_extras', 'Extras & Toppings');

  const insertModOpt = db.prepare('INSERT INTO modifier_options (id, modifier_id, name, price) VALUES (?, ?, ?, ?)');
  insertModOpt.run('opt_milk_whole', 'mod_milk', 'Leche Entera', 0);
  insertModOpt.run('opt_milk_almond', 'mod_milk', 'Leche de Almendras', 250);
  insertModOpt.run('opt_milk_oat', 'mod_milk', 'Leche de Avena', 300);

  insertModOpt.run('opt_sugar_standard', 'mod_sugar', 'Azúcar Normal', 0);
  insertModOpt.run('opt_sugar_low', 'mod_sugar', 'Poco Azúcar', 0);
  insertModOpt.run('opt_sugar_stevia', 'mod_sugar', 'Stevia', 50);

  insertModOpt.run('opt_extra_espresso', 'mod_extras', 'Extra Shot Espresso', 350);
  insertModOpt.run('opt_extra_syrup', 'mod_extras', 'Sirope de Vainilla', 200);
  insertModOpt.run('opt_extra_caramel', 'mod_extras', 'Salsa de Caramelo', 200);

  // 7. Products
  const insertProduct = db.prepare(`
    INSERT INTO products (id, category_id, name, description, price, cost, sku, barcode, color, track_stock, stock_quantity, low_stock_threshold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVariation = db.prepare(`
    INSERT INTO product_variations (id, product_id, name, sku, barcode, price, stock_quantity)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertProdMod = db.prepare('INSERT INTO product_modifiers (product_id, modifier_id) VALUES (?, ?)');

  // Product 1: Espresso
  insertProduct.run('prod_espresso', 'cat_coffee', 'Café Espresso', 'Doble shot de espresso premium blend peruano', 750, 200, 'CF-ESP-01', '7750001001', '#78350f', 1, 150, 20);

  // Product 2: Americano
  insertProduct.run('prod_americano', 'cat_coffee', 'Café Americano', 'Espresso rebajado con agua caliente filtrada', 900, 220, 'CF-AME-01', '7750001002', '#92400e', 1, 200, 30);
  insertProdMod.run('prod_americano', 'mod_sugar');
  insertProdMod.run('prod_americano', 'mod_extras');

  // Product 3: Cappuccino (With Variations)
  insertProduct.run('prod_cappuccino', 'cat_coffee', 'Cappuccino Clásico', 'Espresso, leche vaporizada y espuma cremosa', 1200, 350, 'CF-CAP-01', '7750001003', '#b45309', 1, 120, 15);
  insertVariation.run('var_cap_reg', 'prod_cappuccino', 'Regular (8 oz)', 'CF-CAP-8', '77500010031', 1200, 80);
  insertVariation.run('var_cap_med', 'prod_cappuccino', 'Mediano (12 oz)', 'CF-CAP-12', '77500010032', 1450, 50);
  insertVariation.run('var_cap_gra', 'prod_cappuccino', 'Grande (16 oz)', 'CF-CAP-16', '77500010033', 1700, 40);
  insertProdMod.run('prod_cappuccino', 'mod_milk');
  insertProdMod.run('prod_cappuccino', 'mod_sugar');
  insertProdMod.run('prod_cappuccino', 'mod_extras');

  // Product 4: Latte
  insertProduct.run('prod_latte', 'cat_coffee', 'Café Latte', 'Espresso suave con abundante leche emulsionada', 1300, 380, 'CF-LAT-01', '7750001004', '#d97706', 1, 95, 15);
  insertProdMod.run('prod_latte', 'mod_milk');
  insertProdMod.run('prod_latte', 'mod_sugar');
  insertProdMod.run('prod_latte', 'mod_extras');

  // Product 5: Jugo de Naranja
  insertProduct.run('prod_orange_juice', 'cat_cold', 'Jugo de Naranja Natural', 'Recién exprimido 100% natural', 1100, 300, 'COLD-OJ-01', '7750002001', '#f59e0b', 1, 45, 10);

  // Product 6: Iced Caramel Macchiato
  insertProduct.run('prod_iced_caramel', 'cat_cold', 'Iced Caramel Macchiato', 'Café frío con leche, hielo y jarabe de caramelo', 1650, 480, 'COLD-MAC-01', '7750002002', '#0284c7', 1, 35, 8);
  insertProdMod.run('prod_iced_caramel', 'mod_milk');

  // Product 7: Croissant de Mantequilla
  insertProduct.run('prod_croissant', 'cat_bakery', 'Croissant de Mantequilla', 'Hojaldre artesanal francés horneado diariamente', 850, 250, 'BAK-CRO-01', '7750003001', '#d97706', 1, 28, 5);

  // Product 8: Muffin de Arándanos
  insertProduct.run('prod_muffin', 'cat_bakery', 'Muffin de Arándanos', 'Bizcocho suave con arándanos frescos del valle', 950, 280, 'BAK-MUF-01', '7750003002', '#b45309', 1, 18, 5);

  // Product 9: Sandwich Butifarra Limeña
  insertProduct.run('prod_butifarra', 'cat_sandwiches', 'Butifarra Tradicional', 'Jamón del país con sarsa criolla en pan francés', 1850, 650, 'SND-BUT-01', '7750004001', '#15803d', 1, 22, 5);

  // Product 10: Sandwich Triple Clásico
  insertProduct.run('prod_triple', 'cat_sandwiches', 'Triple Palta, Huevo y Tomate', 'Pan de molde suave en tres pisos con mayonesa artesanal', 1350, 420, 'SND-TRP-01', '7750004002', '#16a34a', 1, 30, 8);

  // Product 11: Tarta de Queso (Cheesecake)
  insertProduct.run('prod_cheesecake', 'cat_desserts', 'Cheesecake de Frutos Rojos', 'Porción cremosa con coulis de fresa y moras', 1600, 520, 'DES-CHK-01', '7750005001', '#db2777', 1, 14, 3);

  // Product 12: Brownie con Helado
  insertProduct.run('prod_brownie', 'cat_desserts', 'Brownie con Nuez', 'Chocolate bitter 70% cacao con nueces tostadas', 1200, 360, 'DES-BRW-01', '7750005002', '#9d174d', 1, 25, 5);

  // 8. Customers
  const insertCustomer = db.prepare('INSERT INTO customers (id, name, email, phone, tax_number, address, points) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertCustomer.run('cust_1', 'Juan Pérez', 'juan.perez@gmail.com', '987654321', '10456789012', 'Calle Los Pinos 123, Miraflores', 120);
  insertCustomer.run('cust_2', 'Empresa Soluciones Tech S.A.C.', 'facturacion@solucionestech.pe', '998877665', '20554433221', 'Av. Pardo 800 Of. 402, Miraflores', 450);

  // 9. Suppliers
  const insertSupplier = db.prepare('INSERT INTO suppliers (id, name, contact_name, email, phone, address) VALUES (?, ?, ?, ?, ?, ?)');
  insertSupplier.run('sup_coffee', 'Tostaduría Café Chanchamayo', 'Guillermo Quispe', 'ventas@chanchamayocafe.pe', '+51 987112233', 'Villa Rica, Pasco');
  insertSupplier.run('sup_dairy', 'Distribuidora Lácteos del Sur', 'Carla Morales', 'pedidos@lacteosdelsur.pe', '+51 944556677', 'Ate, Lima');

  // 10. Open Initial Shift for Carlos Mendoza
  db.prepare(`
    INSERT INTO shifts (id, user_id, opened_at, opening_cash, expected_cash, status, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('shift_current_demo', 'usr_cashier', now, 20000, 20000, 'OPEN', 'Turno mañana caja principal');

  // Initial cash float log
  db.prepare(`
    INSERT INTO cash_movements (id, shift_id, user_id, type, amount, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('cm_initial_float', 'shift_current_demo', 'usr_cashier', 'PAY_IN', 20000, 'Fondo de apertura de caja');
}
