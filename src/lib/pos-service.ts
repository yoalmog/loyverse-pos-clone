import { getDb } from './db.ts';
import { z } from 'zod';

export interface ModifierOptionSelection {
  modifierId: string;
  modifierName: string;
  optionId: string;
  optionName: string;
  price: number; // in cents
}

export interface CartItemInput {
  productId: string;
  variationId?: string | null;
  productName: string;
  variationName?: string | null;
  quantity: number;
  unitPrice: number; // base price in cents
  discountAmount?: number; // in cents
  selectedModifiers: ModifierOptionSelection[];
  note?: string;
}

export interface CheckoutInput {
  shiftId?: string | null;
  userId: string;
  customerId?: string | null;
  diningOptionId?: string | null;
  items: CartItemInput[];
  overallDiscountId?: string | null;
  overallDiscountAmount?: number; // in cents
  paymentMethod: 'CASH' | 'CARD' | 'WALLET' | 'OTHER';
  cashTendered?: number; // in cents (for cash payments)
  referenceNumber?: string | null;
  ticketName?: string | null;
  orderNote?: string | null;
  savedOrderId?: string | null; // if completing a previously saved/open ticket
}

export interface CashMovementInput {
  shiftId: string;
  userId: string;
  type: 'PAY_IN' | 'PAY_OUT';
  amount: number; // in cents
  reason: string;
}

export const CheckoutSchema = z.object({
  shiftId: z.string().nullable().optional(),
  userId: z.string(),
  customerId: z.string().nullable().optional(),
  diningOptionId: z.string().nullable().optional(),
  items: z.array(z.object({
    productId: z.string(),
    variationId: z.string().nullable().optional(),
    productName: z.string(),
    variationName: z.string().nullable().optional(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    discountAmount: z.number().nonnegative().optional(),
    selectedModifiers: z.array(z.object({
      modifierId: z.string(),
      modifierName: z.string(),
      optionId: z.string(),
      optionName: z.string(),
      price: z.number().nonnegative(),
    })).default([]),
    note: z.string().optional(),
  })).min(1, 'Order must contain at least 1 item'),
  overallDiscountId: z.string().nullable().optional(),
  overallDiscountAmount: z.number().nonnegative().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'WALLET', 'OTHER']),
  cashTendered: z.number().nonnegative().optional(),
  referenceNumber: z.string().nullable().optional(),
  ticketName: z.string().nullable().optional(),
  orderNote: z.string().nullable().optional(),
  savedOrderId: z.string().nullable().optional(),
});

/**
 * Generates an incrementing sequential receipt number: e.g. "1-0001" or "REC-YYYYMMDD-XXXX"
 */
function generateReceiptNumber(): string {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `REC-${today}`;
  const row = db.prepare(`
    SELECT receipt_number FROM orders 
    WHERE receipt_number LIKE ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get(`${prefix}%`) as { receipt_number: string } | undefined;

  let nextSeq = 1;
  if (row && row.receipt_number) {
    const parts = row.receipt_number.split('-');
    if (parts.length === 3) {
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }
  }

  return `${prefix}-${String(nextSeq).padStart(4, '0')}`;
}

export const posService = {
  getStoreConfig() {
    const db = getDb();
    return db.prepare('SELECT * FROM stores LIMIT 1').get() as any;
  },

  getCatalog() {
    const db = getDb();
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all();
    
    // Get all products with their active status
    const products = db.prepare(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.active = 1 
      ORDER BY p.name ASC
    `).all() as any[];

    // Load variations
    const variations = db.prepare('SELECT * FROM product_variations ORDER BY price ASC').all() as any[];
    const variationsByProduct: Record<string, any[]> = {};
    for (const v of variations) {
      if (!variationsByProduct[v.product_id]) variationsByProduct[v.product_id] = [];
      variationsByProduct[v.product_id].push(v);
    }

    // Load modifiers and options
    const modifiers = db.prepare('SELECT * FROM modifiers ORDER BY name ASC').all() as any[];
    const modifierOptions = db.prepare('SELECT * FROM modifier_options ORDER BY price ASC').all() as any[];
    const productModifiers = db.prepare('SELECT * FROM product_modifiers').all() as any[];

    const optionsByModifier: Record<string, any[]> = {};
    for (const opt of modifierOptions) {
      if (!optionsByModifier[opt.modifier_id]) optionsByModifier[opt.modifier_id] = [];
      optionsByModifier[opt.modifier_id].push(opt);
    }

    const modifiersWithOpts = modifiers.map(m => ({
      ...m,
      options: optionsByModifier[m.id] || [],
    }));

    const modifiersByProduct: Record<string, any[]> = {};
    for (const pm of productModifiers) {
      if (!modifiersByProduct[pm.product_id]) modifiersByProduct[pm.product_id] = [];
      const found = modifiersWithOpts.find(m => m.id === pm.modifier_id);
      if (found) modifiersByProduct[pm.product_id].push(found);
    }

    // Attach variations and modifiers to products
    const enrichedProducts = products.map(p => ({
      ...p,
      variations: variationsByProduct[p.id] || [],
      modifiers: modifiersByProduct[p.id] || [],
    }));

    const discounts = db.prepare('SELECT * FROM discounts WHERE active = 1 ORDER BY name ASC').all();
    const diningOptions = db.prepare('SELECT * FROM dining_options WHERE active = 1 ORDER BY is_default DESC').all();
    const customers = db.prepare('SELECT * FROM customers ORDER BY name ASC').all();
    const store = db.prepare('SELECT * FROM stores LIMIT 1').get();
    const currentShift = db.prepare("SELECT * FROM shifts WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1").get();
    const cashiers = db.prepare('SELECT id, name, role, email FROM users WHERE active = 1').all();

    return {
      store,
      categories,
      products: enrichedProducts,
      discounts,
      diningOptions,
      customers,
      currentShift,
      cashiers,
    };
  },

  getCurrentShift() {
    const db = getDb();
    const shift = db.prepare("SELECT * FROM shifts WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1").get() as any;
    if (!shift) return null;

    const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(shift.user_id) as any;
    const movements = db.prepare('SELECT * FROM cash_movements WHERE shift_id = ? ORDER BY created_at DESC').all(shift.id);
    const orderStats = db.prepare(`
      SELECT 
        COUNT(o.id) as orders_count,
        COALESCE(SUM(o.total), 0) as total_sales,
        COALESCE(SUM(CASE WHEN p.payment_method = 'CASH' THEN p.amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN p.payment_method = 'CARD' THEN p.amount ELSE 0 END), 0) as card_sales,
        COALESCE(SUM(CASE WHEN p.payment_method = 'WALLET' THEN p.amount ELSE 0 END), 0) as wallet_sales
      FROM orders o
      LEFT JOIN payments p ON o.id = p.order_id
      WHERE o.shift_id = ? AND o.status = 'COMPLETED'
    `).get(shift.id) as any;

    return {
      ...shift,
      user,
      movements,
      stats: orderStats,
    };
  },

  openShift(userId: string, openingCashCents: number, note?: string) {
    const db = getDb();
    // Check if an open shift already exists
    const existing = db.prepare("SELECT id FROM shifts WHERE status = 'OPEN'").get();
    if (existing) {
      throw new Error('A shift is already open. Please close the active shift first.');
    }

    const shiftId = `shift_${Date.now()}`;
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(`
        INSERT INTO shifts (id, user_id, opened_at, opening_cash, expected_cash, status, note)
        VALUES (?, ?, ?, ?, ?, 'OPEN', ?)
      `).run(shiftId, userId, now, openingCashCents, openingCashCents, note || '');

      db.prepare(`
        INSERT INTO cash_movements (id, shift_id, user_id, type, amount, reason)
        VALUES (?, ?, ?, 'PAY_IN', ?, 'Fondo de apertura de caja')
      `).run(`cm_${Date.now()}`, shiftId, userId, openingCashCents);

      db.prepare(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES (?, ?, 'SHIFT_OPEN', 'shift', ?, ?)
      `).run(`aud_${Date.now()}`, userId, shiftId, JSON.stringify({ openingCashCents }));
    })();

    return this.getCurrentShift();
  },

  closeShift(shiftId: string, actualCashCents: number, note?: string) {
    const db = getDb();
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId) as any;
    if (!shift) throw new Error('Shift not found');
    if (shift.status !== 'OPEN') throw new Error('Shift is already closed');

    const expectedCash = shift.expected_cash || 0;
    const difference = actualCashCents - expectedCash;
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(`
        UPDATE shifts 
        SET closed_at = ?, actual_cash = ?, cash_difference = ?, status = 'CLOSED', note = ?
        WHERE id = ?
      `).run(now, actualCashCents, difference, note || shift.note || '', shiftId);

      db.prepare(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES (?, ?, 'SHIFT_CLOSE', 'shift', ?, ?)
      `).run(`aud_${Date.now()}`, shift.user_id, shiftId, JSON.stringify({ expectedCash, actualCashCents, difference }));
    })();

    return db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);
  },

  recordCashMovement(input: CashMovementInput) {
    const db = getDb();
    const shift = db.prepare("SELECT * FROM shifts WHERE id = ? AND status = 'OPEN'").get(input.shiftId) as any;
    if (!shift) throw new Error('Cannot record cash movement on a closed or nonexistent shift');

    const movementId = `cm_${Date.now()}`;
    const multiplier = input.type === 'PAY_IN' ? 1 : -1;
    const newExpected = (shift.expected_cash || 0) + (input.amount * multiplier);

    db.transaction(() => {
      db.prepare(`
        INSERT INTO cash_movements (id, shift_id, user_id, type, amount, reason)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(movementId, input.shiftId, input.userId, input.type, input.amount, input.reason);

      db.prepare('UPDATE shifts SET expected_cash = ? WHERE id = ?').run(newExpected, input.shiftId);

      db.prepare(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES (?, ?, 'CASH_MOVEMENT', 'cash_movements', ?, ?)
      `).run(`aud_${Date.now()}`, input.userId, movementId, JSON.stringify(input));
    })();

    return db.prepare('SELECT * FROM cash_movements WHERE id = ?').get(movementId);
  },

  /**
   * Executes atomic checkout with stock reduction, receipt generation, and payment registration
   */
  processCheckout(rawInput: CheckoutInput) {
    const input = CheckoutSchema.parse(rawInput);
    const db = getDb();

    const orderId = input.savedOrderId || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const receiptNumber = generateReceiptNumber();
    const now = new Date().toISOString();

    // 1. Calculate line items and subtotals
    let subtotalCents = 0;
    const processedItems: any[] = [];

    for (const item of input.items) {
      // Calculate modifier additions
      let modifiersExtra = 0;
      for (const mod of item.selectedModifiers) {
        modifiersExtra += mod.price;
      }

      const itemBasePrice = item.unitPrice + modifiersExtra;
      const itemSubtotal = Math.round(itemBasePrice * item.quantity);
      const itemDiscount = item.discountAmount || 0;
      const itemTotal = Math.max(0, itemSubtotal - itemDiscount);

      subtotalCents += itemTotal;

      processedItems.push({
        id: `oi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        orderId,
        productId: item.productId,
        variationId: item.variationId || null,
        productName: item.productName,
        variationName: item.variationName || null,
        quantity: item.quantity,
        unitPrice: itemBasePrice,
        subtotal: itemSubtotal,
        discountAmount: itemDiscount,
        total: itemTotal,
        selectedModifiersJson: JSON.stringify(item.selectedModifiers),
      });
    }

    // 2. Calculate cart overall discount & taxes
    const overallDiscount = input.overallDiscountAmount || 0;
    const finalSubtotal = Math.max(0, subtotalCents - overallDiscount);

    const store = db.prepare('SELECT tax_rate, tax_type FROM stores LIMIT 1').get() as { tax_rate: number; tax_type: string };
    const taxRate = store?.tax_rate ?? 0.18;
    const taxType = store?.tax_type ?? 'INCLUDED';

    let taxTotalCents = 0;
    let grandTotalCents = finalSubtotal;

    if (taxType === 'INCLUDED') {
      // Peruvian IGV inclusive formula: Total = Net + IGV => IGV = Total - (Total / (1 + rate))
      taxTotalCents = Math.round(finalSubtotal - (finalSubtotal / (1 + taxRate)));
      grandTotalCents = finalSubtotal;
    } else {
      // Added tax
      taxTotalCents = Math.round(finalSubtotal * taxRate);
      grandTotalCents = finalSubtotal + taxTotalCents;
    }

    // Validate payment
    let changeDueCents = 0;
    if (input.paymentMethod === 'CASH') {
      const tendered = input.cashTendered ?? grandTotalCents;
      if (tendered < grandTotalCents) {
        throw new Error(`Monto recibido (S/ ${(tendered / 100).toFixed(2)}) es menor al total a pagar (S/ ${(grandTotalCents / 100).toFixed(2)})`);
      }
      changeDueCents = tendered - grandTotalCents;
    }

    // ATOMIC TRANSACTION: Order + Items + Payment + Stock deduction + Shift update
    const executeTx = db.transaction(() => {
      // A. If this was a saved order being completed, delete previous items
      if (input.savedOrderId) {
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(input.savedOrderId);
        db.prepare('DELETE FROM orders WHERE id = ?').run(input.savedOrderId);
      }

      // B. Insert Order
      db.prepare(`
        INSERT INTO orders (
          id, receipt_number, shift_id, user_id, customer_id, dining_option_id,
          subtotal, discount_total, tax_total, total, status, note, ticket_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?)
      `).run(
        orderId,
        receiptNumber,
        input.shiftId || null,
        input.userId,
        input.customerId || null,
        input.diningOptionId || null,
        subtotalCents,
        overallDiscount,
        taxTotalCents,
        grandTotalCents,
        input.orderNote || null,
        input.ticketName || null,
        now,
        now
      );

      // C. Insert Order Items & Deduct Inventory
      const insertItemStmt = db.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, variation_id, product_name, variation_name,
          quantity, unit_price, subtotal, discount_amount, total, selected_modifiers_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const getProductStmt = db.prepare('SELECT track_stock, stock_quantity FROM products WHERE id = ?');
      const updateProductStockStmt = db.prepare('UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = ? WHERE id = ?');
      const getVariationStmt = db.prepare('SELECT stock_quantity FROM product_variations WHERE id = ?');
      const updateVariationStockStmt = db.prepare('UPDATE product_variations SET stock_quantity = stock_quantity - ? WHERE id = ?');
      const insertInventoryLog = db.prepare(`
        INSERT INTO inventory_logs (id, product_id, variation_id, change_amount, previous_stock, new_stock, reason, reference_id, user_id)
        VALUES (?, ?, ?, ?, ?, ?, 'SALE', ?, ?)
      `);

      for (const item of processedItems) {
        insertItemStmt.run(
          item.id,
          item.orderId,
          item.productId,
          item.variationId,
          item.productName,
          item.variationName,
          item.quantity,
          item.unitPrice,
          item.subtotal,
          item.discountAmount,
          item.total,
          item.selectedModifiersJson
        );

        // Deduct inventory
        const prod = getProductStmt.get(item.productId) as { track_stock: number; stock_quantity: number } | undefined;
        if (prod && prod.track_stock === 1) {
          if (item.variationId) {
            const vari = getVariationStmt.get(item.variationId) as { stock_quantity: number } | undefined;
            const prev = vari?.stock_quantity ?? 0;
            const next = prev - item.quantity;
            updateVariationStockStmt.run(item.quantity, item.variationId);
            insertInventoryLog.run(`inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, item.productId, item.variationId, -item.quantity, prev, next, orderId, input.userId);
          } else {
            const prev = prod.stock_quantity;
            const next = prev - item.quantity;
            updateProductStockStmt.run(item.quantity, now, item.productId);
            insertInventoryLog.run(`inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, item.productId, null, -item.quantity, prev, next, orderId, input.userId);
          }
        }
      }

      // D. Insert Payment
      db.prepare(`
        INSERT INTO payments (
          id, order_id, payment_method, amount, cash_tendered, change_due, reference_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `pay_${Date.now()}`,
        orderId,
        input.paymentMethod,
        grandTotalCents,
        input.paymentMethod === 'CASH' ? (input.cashTendered ?? grandTotalCents) : null,
        changeDueCents,
        input.referenceNumber || null
      );

      // E. Update shift expected cash if paid with cash and active shift
      if (input.paymentMethod === 'CASH' && input.shiftId) {
        db.prepare('UPDATE shifts SET expected_cash = expected_cash + ? WHERE id = ?')
          .run(grandTotalCents, input.shiftId);
      }

      // F. Award customer loyalty points (1 point per S/ 10 spent)
      if (input.customerId) {
        const pointsEarned = Math.floor(grandTotalCents / 1000);
        if (pointsEarned > 0) {
          db.prepare('UPDATE customers SET points = points + ? WHERE id = ?').run(pointsEarned, input.customerId);
        }
      }

      // G. Audit Log
      db.prepare(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES (?, ?, 'CHECKOUT', 'orders', ?, ?)
      `).run(`aud_${Date.now()}`, input.userId, orderId, JSON.stringify({ receiptNumber, grandTotalCents, paymentMethod: input.paymentMethod }));
    });

    executeTx();

    return this.getOrderById(orderId);
  },

  /**
   * Save an open ticket (hold order) for later recall
   */
  saveOpenTicket(rawInput: Omit<CheckoutInput, 'paymentMethod'> & { ticketName: string }) {
    const db = getDb();
    const orderId = rawInput.savedOrderId || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const receiptNumber = `HOLD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const now = new Date().toISOString();

    let subtotalCents = 0;
    for (const item of rawInput.items) {
      let modPrice = 0;
      for (const m of item.selectedModifiers) modPrice += m.price;
      subtotalCents += Math.round((item.unitPrice + modPrice) * item.quantity);
    }

    db.transaction(() => {
      if (rawInput.savedOrderId) {
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(rawInput.savedOrderId);
        db.prepare('DELETE FROM orders WHERE id = ?').run(rawInput.savedOrderId);
      }

      db.prepare(`
        INSERT INTO orders (
          id, receipt_number, shift_id, user_id, customer_id, dining_option_id,
          subtotal, discount_total, tax_total, total, status, note, ticket_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 'SAVED', ?, ?, ?, ?)
      `).run(
        orderId,
        receiptNumber,
        rawInput.shiftId || null,
        rawInput.userId,
        rawInput.customerId || null,
        rawInput.diningOptionId || null,
        subtotalCents,
        subtotalCents,
        rawInput.orderNote || null,
        rawInput.ticketName,
        now,
        now
      );

      const insertItemStmt = db.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, variation_id, product_name, variation_name,
          quantity, unit_price, subtotal, discount_amount, total, selected_modifiers_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `);

      for (const item of rawInput.items) {
        let modPrice = 0;
        for (const m of item.selectedModifiers) modPrice += m.price;
        const total = Math.round((item.unitPrice + modPrice) * item.quantity);
        insertItemStmt.run(
          `oi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          orderId,
          item.productId,
          item.variationId || null,
          item.productName,
          item.variationName || null,
          item.quantity,
          item.unitPrice + modPrice,
          total,
          total,
          JSON.stringify(item.selectedModifiers)
        );
      }
    })();

    return this.getOrderById(orderId);
  },

  getOpenTickets() {
    const db = getDb();
    const orders = db.prepare(`
      SELECT o.*, u.name as cashier_name, c.name as customer_name, d.name as dining_option_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN dining_options d ON o.dining_option_id = d.id
      WHERE o.status = 'SAVED'
      ORDER BY o.created_at DESC
    `).all() as any[];

    return orders.map(ord => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(ord.id);
      return { ...ord, items };
    });
  },

  deleteOpenTicket(orderId: string) {
    const db = getDb();
    db.transaction(() => {
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
      db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
    })();
    return { success: true };
  },

  /**
   * Process refund for an existing order and restore inventory
   */
  refundOrder(orderId: string, userId: string, reason?: string) {
    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) throw new Error('Comprobante no encontrado');
    if (order.status === 'REFUNDED') throw new Error('El comprobante ya fue reembolsado anteriormente');

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
    const payments = db.prepare('SELECT * FROM payments WHERE order_id = ?').all(orderId) as any[];
    const now = new Date().toISOString();

    db.transaction(() => {
      // 1. Mark order as REFUNDED
      db.prepare("UPDATE orders SET status = 'REFUNDED', updated_at = ? WHERE id = ?").run(now, orderId);

      // 2. Restore inventory
      const restoreStock = db.prepare('UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?');
      const restoreVarStock = db.prepare('UPDATE product_variations SET stock_quantity = stock_quantity + ? WHERE id = ?');
      const logInventory = db.prepare(`
        INSERT INTO inventory_logs (id, product_id, variation_id, change_amount, previous_stock, new_stock, reason, reference_id, user_id)
        VALUES (?, ?, ?, ?, ?, ?, 'REFUND', ?, ?)
      `);

      for (const item of items) {
        if (item.variation_id) {
          const v = db.prepare('SELECT stock_quantity FROM product_variations WHERE id = ?').get(item.variation_id) as any;
          const prev = v?.stock_quantity ?? 0;
          const next = prev + item.quantity;
          restoreVarStock.run(item.quantity, item.variation_id);
          logInventory.run(`inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, item.product_id, item.variation_id, item.quantity, prev, next, orderId, userId);
        } else {
          const p = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(item.product_id) as any;
          const prev = p?.stock_quantity ?? 0;
          const next = prev + item.quantity;
          restoreStock.run(item.quantity, now, item.product_id);
          logInventory.run(`inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, item.product_id, null, item.quantity, prev, next, orderId, userId);
        }
      }

      // 3. Adjust cash drawer expected_cash if refunded in current open shift
      const cashPayment = payments.find(p => p.payment_method === 'CASH');
      if (cashPayment && order.shift_id) {
        db.prepare('UPDATE shifts SET expected_cash = expected_cash - ? WHERE id = ? AND status = \'OPEN\'')
          .run(cashPayment.amount, order.shift_id);
      }

      // 4. Audit log
      db.prepare(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES (?, ?, 'REFUND', 'orders', ?, ?)
      `).run(`aud_${Date.now()}`, userId, orderId, JSON.stringify({ reason: reason || 'Devolución de venta', amount: order.total }));
    })();

    return this.getOrderById(orderId);
  },

  getOrderById(orderId: string) {
    const db = getDb();
    const order = db.prepare(`
      SELECT o.*, u.name as cashier_name, c.name as customer_name, c.phone as customer_phone, c.tax_number as customer_tax_number, d.name as dining_option_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN dining_options d ON o.dining_option_id = d.id
      WHERE o.id = ?
    `).get(orderId) as any;

    if (!order) return null;

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
    const payments = db.prepare('SELECT * FROM payments WHERE order_id = ?').all(orderId);
    const store = db.prepare('SELECT * FROM stores LIMIT 1').get();

    return {
      ...order,
      items: items.map(i => ({
        ...i,
        selectedModifiers: i.selected_modifiers_json ? JSON.parse(i.selected_modifiers_json) : [],
      })),
      payments,
      store,
    };
  },

  getOrdersHistory(limit = 50) {
    const db = getDb();
    const orders = db.prepare(`
      SELECT o.*, u.name as cashier_name, c.name as customer_name, p.payment_method
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN payments p ON o.id = p.order_id
      ORDER BY o.created_at DESC
      LIMIT ?
    `).all(limit) as any[];

    return orders;
  },

  getDashboardStats() {
    const db = getDb();
    const totals = db.prepare(`
      SELECT 
        COUNT(id) as total_orders,
        COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total ELSE 0 END), 0) as gross_sales,
        COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN subtotal - discount_total ELSE 0 END), 0) as net_sales,
        COALESCE(SUM(CASE WHEN status = 'REFUNDED' THEN total ELSE 0 END), 0) as refunded_sales
      FROM orders
    `).get() as any;

    const topItems = db.prepare(`
      SELECT 
        oi.product_name,
        SUM(oi.quantity) as quantity_sold,
        SUM(oi.total) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'COMPLETED'
      GROUP BY oi.product_id, oi.product_name
      ORDER BY quantity_sold DESC
      LIMIT 5
    `).all();

    const lowStockItems = db.prepare(`
      SELECT id, name, sku, stock_quantity, low_stock_threshold
      FROM products
      WHERE track_stock = 1 AND stock_quantity <= low_stock_threshold AND active = 1
      ORDER BY stock_quantity ASC
    `).all();

    const recentShifts = db.prepare(`
      SELECT s.*, u.name as cashier_name
      FROM shifts s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.opened_at DESC
      LIMIT 5
    `).all();

    return {
      totals,
      topItems,
      lowStockItems,
      recentShifts,
    };
  },

  adjustStock(productId: string, variationId: string | null, changeAmount: number, reason: string, userId: string) {
    const db = getDb();
    const now = new Date().toISOString();

    db.transaction(() => {
      if (variationId) {
        const v = db.prepare('SELECT stock_quantity FROM product_variations WHERE id = ?').get(variationId) as any;
        const prev = v?.stock_quantity ?? 0;
        const next = prev + changeAmount;
        db.prepare('UPDATE product_variations SET stock_quantity = ? WHERE id = ?').run(next, variationId);
        db.prepare(`
          INSERT INTO inventory_logs (id, product_id, variation_id, change_amount, previous_stock, new_stock, reason, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(`inv_${Date.now()}`, productId, variationId, changeAmount, prev, next, reason, userId);
      } else {
        const p = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(productId) as any;
        const prev = p?.stock_quantity ?? 0;
        const next = prev + changeAmount;
        db.prepare('UPDATE products SET stock_quantity = ?, updated_at = ? WHERE id = ?').run(next, now, productId);
        db.prepare(`
          INSERT INTO inventory_logs (id, product_id, variation_id, change_amount, previous_stock, new_stock, reason, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(`inv_${Date.now()}`, productId, null, changeAmount, prev, next, reason, userId);
      }
    })();

    return { success: true };
  }
};
