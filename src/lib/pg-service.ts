import { queryPg, queryPgOne, withPgTransaction } from './pg-db';
import crypto from 'crypto';
import { z } from 'zod';

const CartItemInputSchema = z.object({
  productId: z.string(),
  variationId: z.string().nullable().optional(),
  productName: z.string().optional(),
  variationName: z.string().nullable().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  selectedModifiers: z.array(z.object({
    modifierId: z.string(),
    modifierName: z.string(),
    optionId: z.string(),
    optionName: z.string(),
    price: z.number().nonnegative(),
  })).optional().default([]),
});

const CheckoutSchema = z.object({
  idempotencyKey: z.string().optional(),
  savedOrderId: z.string().optional(),
  ticketName: z.string().optional(),
  shiftId: z.string().nullable().optional(),
  userId: z.string(),
  customerId: z.string().nullable().optional(),
  diningOptionId: z.string().nullable().optional(),
  items: z.array(CartItemInputSchema).min(1, 'El carrito no puede estar vacío'),
  overallDiscountAmount: z.number().nonnegative().optional().default(0),
  discountId: z.string().nullable().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'WALLET', 'OTHER']),
  cashTendered: z.number().nonnegative().optional(),
  referenceNumber: z.string().optional(),
  orderNote: z.string().optional(),
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;

export interface CashMovementInput {
  shiftId: string;
  userId: string;
  type: 'PAY_IN' | 'PAY_OUT';
  amount: number;
  reason?: string;
}

export interface UserSession {
  token: string;
  userId: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

async function generateReceiptNumber(client?: any): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `REC-${today}`;
  const sql = `SELECT receipt_number FROM orders WHERE receipt_number LIKE $1 ORDER BY receipt_number DESC LIMIT 1`;
  const res = client ? await client.query(sql, [`${prefix}%`]) : { rows: await queryPg(sql, [`${prefix}%`]) };
  const row = res.rows ? res.rows[0] : (res as any)[0];
  let nextSeq = 1;
  if (row?.receipt_number) {
    const parts = row.receipt_number.split('-');
    if (parts.length >= 3) {
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }
  }
  return `${prefix}-${String(nextSeq).padStart(4, '0')}`;
}

export const posPgService = {
  async getCatalog() {
    const categories = await queryPg('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
    const products = await queryPg(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.active = 1
      ORDER BY p.name ASC
    `);

    const variations = await queryPg('SELECT * FROM product_variations ORDER BY price ASC');
    const variationsByProduct: Record<string, any[]> = {};
    for (const v of variations) {
      if (!variationsByProduct[v.product_id]) variationsByProduct[v.product_id] = [];
      variationsByProduct[v.product_id].push({
        ...v,
        price: parseInt(v.price, 10),
        stock_quantity: parseFloat(v.stock_quantity) || 0,
      });
    }

    const modifiers = await queryPg('SELECT * FROM modifiers ORDER BY name ASC');
    const modifierOptions = await queryPg('SELECT * FROM modifier_options ORDER BY price ASC');
    const productModifiers = await queryPg('SELECT * FROM product_modifiers');

    const optionsByModifier: Record<string, any[]> = {};
    for (const opt of modifierOptions) {
      if (!optionsByModifier[opt.modifier_id]) optionsByModifier[opt.modifier_id] = [];
      optionsByModifier[opt.modifier_id].push({
        ...opt,
        price: parseInt(opt.price, 10),
      });
    }

    const modifiersWithOpts = modifiers.map((m: any) => ({
      ...m,
      options: optionsByModifier[m.id] || [],
    }));

    const modifiersByProduct: Record<string, any[]> = {};
    for (const pm of productModifiers) {
      if (!modifiersByProduct[pm.product_id]) modifiersByProduct[pm.product_id] = [];
      const found = modifiersWithOpts.find((m: any) => m.id === pm.modifier_id);
      if (found) modifiersByProduct[pm.product_id].push(found);
    }

    const enrichedProducts = products.map((p: any) => ({
      ...p,
      price: parseInt(p.price, 10),
      cost: parseInt(p.cost, 10),
      stock_quantity: parseFloat(p.stock_quantity) || 0,
      low_stock_threshold: parseFloat(p.low_stock_threshold) || 5,
      variations: variationsByProduct[p.id] || [],
      modifiers: modifiersByProduct[p.id] || [],
    }));

    const discounts = await queryPg('SELECT * FROM discounts WHERE active = 1 ORDER BY name ASC');
    const diningOptions = await queryPg('SELECT * FROM dining_options WHERE active = 1 ORDER BY is_default DESC');
    const customers = await queryPg('SELECT * FROM customers ORDER BY name ASC');
    const store = await queryPgOne('SELECT * FROM stores LIMIT 1');
    const currentShift = await queryPgOne("SELECT * FROM shifts WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1");
    const cashiers = await queryPg('SELECT id, name, role, email FROM users WHERE active = 1');

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

  async getCurrentShift() {
    const shift = await queryPgOne("SELECT * FROM shifts WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1");
    if (!shift) return null;

    const user = await queryPgOne('SELECT id, name, role FROM users WHERE id = $1', [shift.user_id]);
    const movements = await queryPg('SELECT * FROM cash_movements WHERE shift_id = $1 ORDER BY created_at DESC', [shift.id]);
    const orderStats = await queryPgOne(`
      SELECT 
        COUNT(o.id) as orders_count,
        COALESCE(SUM(o.total), 0) as total_sales,
        COALESCE(SUM(CASE WHEN p.payment_method = 'CASH' THEN p.amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN p.payment_method = 'CARD' THEN p.amount ELSE 0 END), 0) as card_sales,
        COALESCE(SUM(CASE WHEN p.payment_method = 'WALLET' THEN p.amount ELSE 0 END), 0) as wallet_sales
      FROM orders o
      LEFT JOIN payments p ON o.id = p.order_id
      WHERE o.shift_id = $1 AND o.status = 'COMPLETED'
    `, [shift.id]);

    return {
      ...shift,
      opening_cash: parseInt(shift.opening_cash, 10),
      expected_cash: parseInt(shift.expected_cash || '0', 10),
      user,
      movements: movements.map((m: any) => ({ ...m, amount: parseInt(m.amount, 10) })),
      stats: {
        orders_count: parseInt(orderStats?.orders_count || '0', 10),
        total_sales: parseInt(orderStats?.total_sales || '0', 10),
        cash_sales: parseInt(orderStats?.cash_sales || '0', 10),
        card_sales: parseInt(orderStats?.card_sales || '0', 10),
        wallet_sales: parseInt(orderStats?.wallet_sales || '0', 10),
      },
    };
  },

  async openShift(userId: string, openingCashCents: number, note?: string) {
    const existing = await queryPgOne("SELECT id FROM shifts WHERE status = 'OPEN'");
    if (existing) {
      throw new Error('A shift is already open. Please close the active shift first.');
    }

    const shiftId = `shift_${Date.now()}`;
    const now = new Date().toISOString();

    await withPgTransaction(async (client) => {
      await client.query(`
        INSERT INTO shifts (id, user_id, opened_at, opening_cash, expected_cash, status, note)
        VALUES ($1, $2, $3, $4, $5, 'OPEN', $6)
      `, [shiftId, userId, now, openingCashCents, openingCashCents, note || '']);

      await client.query(`
        INSERT INTO cash_movements (id, shift_id, user_id, type, amount, reason)
        VALUES ($1, $2, $3, 'PAY_IN', $4, 'Fondo de apertura de caja')
      `, [`cm_${Date.now()}`, shiftId, userId, openingCashCents]);

      await client.query(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, 'SHIFT_OPEN', 'shift', $3, $4)
      `, [`aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, userId, shiftId, JSON.stringify({ openingCashCents })]);
    });

    return this.getCurrentShift();
  },

  async closeShift(shiftId: string, actualCashCents: number, note?: string) {
    const shift = await queryPgOne('SELECT * FROM shifts WHERE id = $1', [shiftId]);
    if (!shift) throw new Error('Shift not found');
    if (shift.status !== 'OPEN') throw new Error('Shift is already closed');

    const expectedCash = parseInt(shift.expected_cash || '0', 10);
    const difference = actualCashCents - expectedCash;
    const now = new Date().toISOString();

    await withPgTransaction(async (client) => {
      await client.query(`
        UPDATE shifts 
        SET closed_at = $1, actual_cash = $2, cash_difference = $3, status = 'CLOSED', note = $4
        WHERE id = $5
      `, [now, actualCashCents, difference, note || shift.note || '', shiftId]);

      await client.query(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, 'SHIFT_CLOSE', 'shift', $3, $4)
      `, [`aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, shift.user_id, shiftId, JSON.stringify({ expectedCash, actualCashCents, difference })]);
    });

    return queryPgOne('SELECT * FROM shifts WHERE id = $1', [shiftId]);
  },

  async recordCashMovement(input: CashMovementInput) {
    const shift = await queryPgOne("SELECT * FROM shifts WHERE id = $1 AND status = 'OPEN'", [input.shiftId]);
    if (!shift) throw new Error('Cannot record cash movement on a closed or nonexistent shift');

    const movementId = `cm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const multiplier = input.type === 'PAY_IN' ? 1 : -1;
    const currentExpected = parseInt(shift.expected_cash || '0', 10);
    const newExpected = currentExpected + (input.amount * multiplier);

    await withPgTransaction(async (client) => {
      await client.query(`
        INSERT INTO cash_movements (id, shift_id, user_id, type, amount, reason)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [movementId, input.shiftId, input.userId, input.type, input.amount, input.reason || null]);

      await client.query('UPDATE shifts SET expected_cash = $1 WHERE id = $2', [newExpected, input.shiftId]);

      await client.query(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, 'CASH_MOVEMENT', 'cash_movements', $3, $4)
      `, [`aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, input.userId, movementId, JSON.stringify(input)]);
    });

    return queryPgOne('SELECT * FROM cash_movements WHERE id = $1', [movementId]);
  },

  async processCheckout(rawInput: CheckoutInput) {
    const input = CheckoutSchema.parse(rawInput);

    if (input.idempotencyKey) {
      const existing = await queryPgOne('SELECT id FROM orders WHERE idempotency_key = $1', [input.idempotencyKey]);
      if (existing) {
        const existingOrder = await this.getOrderById(existing.id);
        if (existingOrder) {
          const sameItemCount = existingOrder.items.length === input.items.length;
          const sameItems = sameItemCount && input.items.every(item => {
            const match = existingOrder.items.find((ei: any) => ei.product_id === item.productId);
            return match && match.quantity === item.quantity;
          });
          if (!sameItems) {
            throw new Error(`Idempotency conflict: Clave "${input.idempotencyKey}" ya fue utilizada con un pedido diferente.`);
          }
          return existingOrder;
        }
      }
    }

    const orderId = input.savedOrderId || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    let subtotalCents = 0;
    const processedItems: any[] = [];

    for (const item of input.items) {
      const p = await queryPgOne('SELECT id, name, price, stock_quantity, track_stock FROM products WHERE id = $1', [item.productId]);
      if (!p) throw new Error(`Producto no encontrado: ${item.productId}`);

      let modifiersExtra = 0;
      const mods = item.selectedModifiers || [];
      for (const mod of mods) {
        modifiersExtra += mod.price;
      }

      const basePrice = item.unitPrice !== undefined ? item.unitPrice : parseInt(p.price, 10);
      const itemBasePrice = basePrice + modifiersExtra;
      const itemSubtotal = Math.round(itemBasePrice * item.quantity);
      const itemDiscount = item.discountAmount || 0;
      const itemTotal = Math.max(0, itemSubtotal - itemDiscount);

      subtotalCents += itemTotal;

      processedItems.push({
        id: `oi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        orderId,
        productId: item.productId,
        variationId: item.variationId || null,
        productName: item.productName || p.name,
        variationName: item.variationName || null,
        quantity: item.quantity,
        unitPrice: itemBasePrice,
        subtotal: itemSubtotal,
        discountAmount: itemDiscount,
        total: itemTotal,
        selectedModifiersJson: JSON.stringify(mods),
      });
    }

    const overallDiscount = input.overallDiscountAmount || 0;
    const finalSubtotal = Math.max(0, subtotalCents - overallDiscount);

    const store = await queryPgOne('SELECT tax_rate, tax_type FROM stores LIMIT 1');
    const taxRate = store ? parseFloat(store.tax_rate) : 0.18;
    const taxType = store?.tax_type ?? 'INCLUDED';

    let taxTotalCents = 0;
    let grandTotalCents = finalSubtotal;

    if (taxType === 'INCLUDED') {
      taxTotalCents = Math.round(finalSubtotal - (finalSubtotal / (1 + taxRate)));
      grandTotalCents = finalSubtotal;
    } else {
      taxTotalCents = Math.round(finalSubtotal * taxRate);
      grandTotalCents = finalSubtotal + taxTotalCents;
    }

    let changeDueCents = 0;
    if (input.paymentMethod === 'CASH') {
      const tendered = input.cashTendered ?? grandTotalCents;
      if (tendered < grandTotalCents) {
        throw new Error(`Monto recibido (S/ ${(tendered / 100).toFixed(2)}) es menor al total a pagar (S/ ${(grandTotalCents / 100).toFixed(2)})`);
      }
      changeDueCents = tendered - grandTotalCents;
    }

    let receiptNumber = '';

    await withPgTransaction(async (client) => {
      receiptNumber = await generateReceiptNumber(client);

      if (input.savedOrderId) {
        await client.query('DELETE FROM order_items WHERE order_id = $1', [input.savedOrderId]);
        await client.query('DELETE FROM orders WHERE id = $1', [input.savedOrderId]);
      }

      await client.query(`
        INSERT INTO orders (
          id, idempotency_key, receipt_number, shift_id, user_id, customer_id, dining_option_id,
          subtotal, discount_total, tax_total, total, status, note, ticket_name, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'COMPLETED', $12, $13, $14, $15)
      `, [
        orderId,
        input.idempotencyKey || null,
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
        now,
      ]);

      for (const item of processedItems) {
        await client.query(`
          INSERT INTO order_items (
            id, order_id, product_id, variation_id, product_name, variation_name,
            quantity, unit_price, subtotal, discount_amount, total, selected_modifiers_json
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
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
          item.selectedModifiersJson,
        ]);

        const prodRes = await client.query('SELECT track_stock, stock_quantity FROM products WHERE id = $1 FOR UPDATE', [item.productId]);
        const prod = prodRes.rows[0];
        if (prod && parseInt(prod.track_stock, 10) === 1) {
          if (item.variationId) {
            const variRes = await client.query('SELECT stock_quantity FROM product_variations WHERE id = $1 FOR UPDATE', [item.variationId]);
            const vari = variRes.rows[0];
            const prev = parseFloat(vari?.stock_quantity) || 0;
            if (prev < item.quantity) {
              throw new Error(`Stock insuficiente para la variante: disponible ${prev}, solicitado ${item.quantity}`);
            }
            const next = prev - item.quantity;
            await client.query('UPDATE product_variations SET stock_quantity = stock_quantity - $1 WHERE id = $2', [item.quantity, item.variationId]);
            await client.query(`
              INSERT INTO inventory_logs (id, product_id, variation_id, change_amount, previous_stock, new_stock, reason, reference_id, user_id)
              VALUES ($1, $2, $3, $4, $5, $6, 'SALE', $7, $8)
            `, [`inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, item.productId, item.variationId, -item.quantity, prev, next, orderId, input.userId]);
          } else {
            const prev = parseFloat(prod.stock_quantity) || 0;
            if (prev < item.quantity) {
              throw new Error(`Stock insuficiente para el producto "${item.productName || item.productId}": disponible ${prev}, solicitado ${item.quantity}`);
            }
            const next = prev - item.quantity;
            await client.query('UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = $2 WHERE id = $3', [item.quantity, now, item.productId]);
            await client.query(`
              INSERT INTO inventory_logs (id, product_id, variation_id, change_amount, previous_stock, new_stock, reason, reference_id, user_id)
              VALUES ($1, $2, NULL, $3, $4, $5, 'SALE', $6, $7)
            `, [`inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, item.productId, -item.quantity, prev, next, orderId, input.userId]);
          }
        }
      }

      await client.query(`
        INSERT INTO payments (
          id, order_id, payment_method, amount, cash_tendered, change_due, reference_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        orderId,
        input.paymentMethod,
        grandTotalCents,
        input.paymentMethod === 'CASH' ? (input.cashTendered ?? grandTotalCents) : null,
        changeDueCents,
        input.referenceNumber || null,
      ]);

      if (input.paymentMethod === 'CASH' && input.shiftId) {
        await client.query('UPDATE shifts SET expected_cash = expected_cash + $1 WHERE id = $2', [grandTotalCents, input.shiftId]);
      }

      if (input.customerId) {
        const pointsEarned = Math.floor(grandTotalCents / 1000);
        if (pointsEarned > 0) {
          await client.query('UPDATE customers SET points = points + $1 WHERE id = $2', [pointsEarned, input.customerId]);
        }
      }

      await client.query(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, 'CHECKOUT', 'orders', $3, $4)
      `, [`aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, input.userId, orderId, JSON.stringify({ receiptNumber, grandTotalCents, paymentMethod: input.paymentMethod })]);
    });

    return this.getOrderById(orderId);
  },

  async saveOpenTicket(rawInput: Omit<CheckoutInput, 'paymentMethod'> & { ticketName: string }) {
    const orderId = rawInput.savedOrderId || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const receiptNumber = `HOLD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const now = new Date().toISOString();

    let subtotalCents = 0;
    for (const item of rawInput.items) {
      let modPrice = 0;
      for (const m of item.selectedModifiers || []) modPrice += m.price;
      subtotalCents += Math.round(((item.unitPrice || 0) + modPrice) * item.quantity);
    }

    await withPgTransaction(async (client) => {
      if (rawInput.savedOrderId) {
        await client.query('DELETE FROM order_items WHERE order_id = $1', [rawInput.savedOrderId]);
        await client.query('DELETE FROM orders WHERE id = $1', [rawInput.savedOrderId]);
      }

      await client.query(`
        INSERT INTO orders (
          id, receipt_number, shift_id, user_id, customer_id, dining_option_id,
          subtotal, discount_total, tax_total, total, status, note, ticket_name, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, $8, 'SAVED', $9, $10, $11, $12)
      `, [
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
        now,
      ]);

      for (const item of rawInput.items) {
        let modPrice = 0;
        for (const m of item.selectedModifiers || []) modPrice += m.price;
        const total = Math.round(((item.unitPrice || 0) + modPrice) * item.quantity);
        await client.query(`
          INSERT INTO order_items (
            id, order_id, product_id, variation_id, product_name, variation_name,
            quantity, unit_price, subtotal, discount_amount, total, selected_modifiers_json
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11)
        `, [
          `oi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          orderId,
          item.productId,
          item.variationId || null,
          item.productName || '',
          item.variationName || null,
          item.quantity,
          (item.unitPrice || 0) + modPrice,
          total,
          total,
          JSON.stringify(item.selectedModifiers || []),
        ]);
      }
    });

    return this.getOrderById(orderId);
  },

  async getOpenTickets() {
    const orders = await queryPg(`
      SELECT o.*, u.name as cashier_name, c.name as customer_name, d.name as dining_option_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN dining_options d ON o.dining_option_id = d.id
      WHERE o.status = 'SAVED'
      ORDER BY o.created_at DESC
    `);

    const result = [];
    for (const ord of orders) {
      const items = await queryPg('SELECT * FROM order_items WHERE order_id = $1', [ord.id]);
      result.push({
        ...ord,
        subtotal: parseInt(ord.subtotal, 10),
        total: parseInt(ord.total, 10),
        items: items.map((i: any) => ({
          ...i,
          quantity: parseFloat(i.quantity) || 1,
          unit_price: parseInt(i.unit_price, 10),
          total: parseInt(i.total, 10),
        })),
      });
    }
    return result;
  },

  async deleteOpenTicket(orderId: string) {
    await withPgTransaction(async (client) => {
      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
      await client.query('DELETE FROM orders WHERE id = $1', [orderId]);
    });
    return { success: true };
  },

  async refundOrder(orderId: string, userId: string, reason?: string) {
    const user = await queryPgOne('SELECT id, role, active FROM users WHERE id = $1', [userId]);
    if (!user || user.active !== 1) {
      throw new Error('Usuario no autorizado para ejecutar reembolsos');
    }

    const order = await queryPgOne('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (!order) throw new Error('Comprobante no encontrado');
    if (order.status === 'REFUNDED') throw new Error('El comprobante ya fue reembolsado anteriormente');

    const items = await queryPg('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    const payments = await queryPg('SELECT * FROM payments WHERE order_id = $1', [orderId]);
    const now = new Date().toISOString();

    await withPgTransaction(async (client) => {
      await client.query("UPDATE orders SET status = 'REFUNDED', updated_at = $1 WHERE id = $2", [now, orderId]);

      for (const item of items) {
        const qty = parseFloat(item.quantity) || 1;
        if (item.variation_id) {
          const v = await queryPgOne('SELECT stock_quantity FROM product_variations WHERE id = $1', [item.variation_id]);
          const prev = parseFloat(v?.stock_quantity) || 0;
          const next = prev + qty;
          await client.query('UPDATE product_variations SET stock_quantity = stock_quantity + $1 WHERE id = $2', [qty, item.variation_id]);
          await client.query(`
            INSERT INTO inventory_logs (id, product_id, variation_id, change_amount, previous_stock, new_stock, reason, reference_id, user_id)
            VALUES ($1, $2, $3, $4, $5, $6, 'REFUND', $7, $8)
          `, [`inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, item.product_id, item.variation_id, qty, prev, next, orderId, userId]);
        } else {
          const p = await queryPgOne('SELECT stock_quantity FROM products WHERE id = $1', [item.product_id]);
          const prev = parseFloat(p?.stock_quantity) || 0;
          const next = prev + qty;
          await client.query('UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = $2 WHERE id = $3', [qty, now, item.product_id]);
          await client.query(`
            INSERT INTO inventory_logs (id, product_id, variation_id, change_amount, previous_stock, new_stock, reason, reference_id, user_id)
            VALUES ($1, $2, NULL, $3, $4, $5, 'REFUND', $6, $7)
          `, [`inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, item.product_id, qty, prev, next, orderId, userId]);
        }
      }

      const cashPayment = payments.find((p: any) => p.payment_method === 'CASH');
      if (cashPayment && order.shift_id) {
        await client.query('UPDATE shifts SET expected_cash = expected_cash - $1 WHERE id = $2 AND status = \'OPEN\'', [parseInt(cashPayment.amount, 10), order.shift_id]);
      }

      await client.query(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, 'REFUND', 'orders', $3, $4)
      `, [`aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, userId, orderId, JSON.stringify({ reason: reason || 'Devolución de venta', amount: order.total })]);
    });

    return this.getOrderById(orderId);
  },

  async getOrderById(orderId: string) {
    const order = await queryPgOne(`
      SELECT o.*, u.name as cashier_name, c.name as customer_name, c.phone as customer_phone, c.tax_number as customer_tax_number, d.name as dining_option_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN dining_options d ON o.dining_option_id = d.id
      WHERE o.id = $1
    `, [orderId]);

    if (!order) return null;

    const items = await queryPg('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    const payments = await queryPg('SELECT * FROM payments WHERE order_id = $1', [orderId]);
    const store = await queryPgOne('SELECT * FROM stores LIMIT 1');

    return {
      ...order,
      subtotal: parseInt(order.subtotal, 10),
      discount_total: parseInt(order.discount_total || '0', 10),
      tax_total: parseInt(order.tax_total || '0', 10),
      total: parseInt(order.total, 10),
      items: items.map((i: any) => ({
        ...i,
        quantity: parseFloat(i.quantity) || 1,
        unit_price: parseInt(i.unit_price, 10),
        subtotal: parseInt(i.subtotal, 10),
        total: parseInt(i.total, 10),
        selectedModifiers: i.selected_modifiers_json ? JSON.parse(i.selected_modifiers_json) : [],
      })),
      payments: payments.map((p: any) => ({
        ...p,
        amount: parseInt(p.amount, 10),
        cash_tendered: p.cash_tendered ? parseInt(p.cash_tendered, 10) : null,
        change_due: p.change_due ? parseInt(p.change_due, 10) : null,
      })),
      store,
    };
  },

  async getOrdersHistory(limit = 50) {
    const orders = await queryPg(`
      SELECT o.*, u.name as cashier_name, c.name as customer_name, p.payment_method
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN payments p ON o.id = p.order_id
      ORDER BY o.created_at DESC
      LIMIT $1
    `, [limit]);

    return orders.map((o: any) => ({
      ...o,
      subtotal: parseInt(o.subtotal, 10),
      discount_total: parseInt(o.discount_total || '0', 10),
      tax_total: parseInt(o.tax_total || '0', 10),
      total: parseInt(o.total, 10),
    }));
  },

  async getDashboardStats() {
    const totals = await queryPgOne(`
      SELECT 
        COUNT(id) as total_orders,
        COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total ELSE 0 END), 0) as gross_sales,
        COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN subtotal - discount_total ELSE 0 END), 0) as net_sales,
        COALESCE(SUM(CASE WHEN status = 'REFUNDED' THEN total ELSE 0 END), 0) as refunded_sales
      FROM orders
    `);

    const topItems = await queryPg(`
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
    `);

    const lowStockItems = await queryPg(`
      SELECT id, name, sku, stock_quantity, low_stock_threshold
      FROM products
      WHERE track_stock = 1 AND stock_quantity <= low_stock_threshold AND active = 1
      ORDER BY stock_quantity ASC
    `);

    const recentShifts = await queryPg(`
      SELECT s.*, u.name as cashier_name
      FROM shifts s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.opened_at DESC
      LIMIT 5
    `);

    return {
      totals: {
        total_orders: parseInt(totals?.total_orders || '0', 10),
        gross_sales: parseInt(totals?.gross_sales || '0', 10),
        net_sales: parseInt(totals?.net_sales || '0', 10),
        refunded_sales: parseInt(totals?.refunded_sales || '0', 10),
      },
      topItems: topItems.map((i: any) => ({
        ...i,
        quantity_sold: parseFloat(i.quantity_sold) || 0,
        total_revenue: parseInt(i.total_revenue, 10),
      })),
      lowStockItems: lowStockItems.map((p: any) => ({
        ...p,
        stock_quantity: parseFloat(p.stock_quantity) || 0,
      })),
      recentShifts,
    };
  },

  async adjustStock(productId: string, variationId: string | null, changeAmount: number, reason: string, userId: string) {
    const now = new Date().toISOString();

    await withPgTransaction(async (client) => {
      if (variationId) {
        const v = await queryPgOne('SELECT stock_quantity FROM product_variations WHERE id = $1', [variationId]);
        const prev = parseFloat(v?.stock_quantity) || 0;
        const next = prev + changeAmount;
        await client.query('UPDATE product_variations SET stock_quantity = $1 WHERE id = $2', [next, variationId]);
        await client.query(`
          INSERT INTO inventory_logs (id, product_id, variation_id, change_amount, previous_stock, new_stock, reason, user_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [`inv_${Date.now()}`, productId, variationId, changeAmount, prev, next, reason, userId]);
      } else {
        const p = await queryPgOne('SELECT stock_quantity FROM products WHERE id = $1', [productId]);
        const prev = parseFloat(p?.stock_quantity) || 0;
        const next = prev + changeAmount;
        await client.query('UPDATE products SET stock_quantity = $1, updated_at = $2 WHERE id = $3', [next, now, productId]);
        await client.query(`
          INSERT INTO inventory_logs (id, product_id, variation_id, change_amount, previous_stock, new_stock, reason, user_id)
          VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)
        `, [`inv_${Date.now()}`, productId, changeAmount, prev, next, reason, userId]);
      }
    });

    return { success: true };
  },
};

export const authPgService = {
  async checkRateLimit(key: string, maxAttempts = 5, windowMs = 60000, lockoutMs = 60000): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
    const now = Date.now();
    const record = await queryPgOne('SELECT * FROM auth_rate_limits WHERE key = $1', [key]);

    if (!record) return { allowed: true };

    const lockedUntil = parseInt(record.locked_until || '0', 10);
    if (lockedUntil > now) {
      return { allowed: false, retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000) };
    }

    const firstAttemptAt = parseInt(record.first_attempt_at || '0', 10);
    if (now - firstAttemptAt > windowMs) {
      await queryPg('DELETE FROM auth_rate_limits WHERE key = $1', [key]);
      return { allowed: true };
    }

    if (record.attempts >= maxAttempts) {
      const lockTime = now + lockoutMs;
      await queryPg('UPDATE auth_rate_limits SET locked_until = $1 WHERE key = $2', [lockTime, key]);
      return { allowed: false, retryAfterSeconds: Math.ceil(lockoutMs / 1000) };
    }

    return { allowed: true };
  },

  async recordFailedAttempt(key: string, maxAttempts = 5, lockoutMs = 60000) {
    const now = Date.now();
    const record = await queryPgOne('SELECT * FROM auth_rate_limits WHERE key = $1', [key]);
    if (!record) {
      await queryPg('INSERT INTO auth_rate_limits (key, attempts, first_attempt_at, locked_until) VALUES ($1, 1, $2, 0)', [key, now]);
    } else {
      const nextAttempts = record.attempts + 1;
      const lockedUntil = nextAttempts >= maxAttempts ? now + lockoutMs : 0;
      await queryPg('UPDATE auth_rate_limits SET attempts = $1, locked_until = $2 WHERE key = $3', [nextAttempts, lockedUntil, key]);
    }
  },

  async resetRateLimit(key: string) {
    await queryPg('DELETE FROM auth_rate_limits WHERE key = $1', [key]);
  },

  async createSession(userId: string, role: string, durationHours = 24): Promise<UserSession> {
    const token = `tok_${crypto.randomBytes(32).toString('hex')}`;
    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();
    const createdAt = new Date().toISOString();

    await queryPg(`
      INSERT INTO user_sessions (token, user_id, role, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [token, userId, role, expiresAt, createdAt]);

    return { token, userId, role, expiresAt, createdAt };
  },

  async verifySession(token: string): Promise<UserSession | null> {
    if (!token) return null;
    const session = await queryPgOne('SELECT * FROM user_sessions WHERE token = $1', [token]);
    if (!session) return null;

    if (new Date(session.expires_at).getTime() < Date.now()) {
      await queryPg('DELETE FROM user_sessions WHERE token = $1', [token]);
      return null;
    }

    return {
      token: session.token,
      userId: session.user_id,
      role: session.role,
      expiresAt: session.expires_at,
      createdAt: session.created_at,
    };
  },

  async verifyRequest(request: Request, allowedRoles?: string[]): Promise<{ authorized: boolean; user?: any; status: number; error?: string }> {
    const authHeader = request.headers.get('authorization') || request.headers.get('x-pos-session');
    if (!authHeader) {
      return { authorized: false, status: 401, error: 'Token de sesión requerido' };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const session = await this.verifySession(token);
    if (!session) {
      return { authorized: false, status: 401, error: 'Sesión expirada o inválida' };
    }

    const user = await queryPgOne('SELECT id, name, role, active FROM users WHERE id = $1', [session.userId]);
    if (!user || user.active !== 1) {
      return { authorized: false, status: 403, error: 'Usuario inactivo o suspendido' };
    }

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return { authorized: false, status: 403, error: `Rol insuficiente. Requerido: ${allowedRoles.join(', ')}` };
    }

    return { authorized: true, user, status: 200 };
  },

  async authenticatePin(pin: string): Promise<any | null> {
    return queryPgOne('SELECT id, name, email, role FROM users WHERE pin = $1 AND active = 1', [pin]);
  },
};

export const syncPgService = {
  async getSyncStatus() {
    const counts = await queryPg(`
      SELECT 
        status, 
        COUNT(id) as count 
      FROM sync_queue 
      GROUP BY status
    `);
    const statusMap: Record<string, number> = { PENDING: 0, SYNCING: 0, SYNCED: 0, FAILED: 0 };
    for (const row of counts) {
      statusMap[row.status] = parseInt(row.count, 10);
    }
    const recentFailed = await queryPg(`
      SELECT id, idempotency_key, event_type, retry_count, error_message, created_at
      FROM sync_queue
      WHERE status = 'FAILED'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    return {
      summary: statusMap,
      pendingCount: statusMap.PENDING + statusMap.SYNCING,
      failedEvents: recentFailed,
    };
  },

  async processSyncBatch(events: any[]) {
    const results = [];
    for (const evt of events) {
      try {
        const existing = await queryPgOne('SELECT id, status, result_json FROM sync_queue WHERE idempotency_key = $1', [evt.idempotencyKey]);
        if (existing && existing.status === 'SYNCED') {
          results.push({
            eventId: evt.id,
            idempotencyKey: evt.idempotencyKey,
            status: 'ALREADY_SYNCED',
            result: existing.result_json ? JSON.parse(existing.result_json) : null,
          });
          continue;
        }

        let orderResult = null;
        if (evt.eventType === 'CHECKOUT') {
          orderResult = await posPgService.processCheckout({
            ...evt.payload,
            idempotencyKey: evt.idempotencyKey,
          });
        }

        const now = new Date().toISOString();
        if (existing) {
          await queryPg(`
            UPDATE sync_queue 
            SET status = 'SYNCED', result_json = $1, synced_at = $2, error_message = NULL
            WHERE id = $3
          `, [JSON.stringify(orderResult), now, existing.id]);
        } else {
          await queryPg(`
            INSERT INTO sync_queue (id, idempotency_key, device_id, event_type, payload_json, status, result_json, synced_at)
            VALUES ($1, $2, $3, $4, $5, 'SYNCED', $6, $7)
          `, [
            evt.id || `sync_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            evt.idempotencyKey,
            evt.deviceId || 'device_unknown',
            evt.eventType,
            JSON.stringify(evt.payload),
            JSON.stringify(orderResult),
            now,
          ]);
        }

        results.push({
          eventId: evt.id,
          idempotencyKey: evt.idempotencyKey,
          status: 'SUCCESS',
          result: orderResult,
        });
      } catch (err: any) {
        results.push({
          eventId: evt.id,
          idempotencyKey: evt.idempotencyKey,
          status: 'FAILED',
          error: err.message,
        });
      }
    }
    return results;
  },
};

export const backofficePgService = {
  async getInventory() {
    const inventory = await queryPg(`
      SELECT p.id, p.name, p.sku, p.barcode, p.stock_quantity, p.low_stock_threshold, p.track_stock, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.active = 1
      ORDER BY p.stock_quantity ASC
    `);

    const logs = await queryPg(`
      SELECT l.*, p.name as product_name, u.name as user_name
      FROM inventory_logs l
      JOIN products p ON l.product_id = p.id
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT 50
    `);

    return {
      inventory: inventory.map((p: any) => ({
        ...p,
        stock_quantity: parseFloat(p.stock_quantity) || 0,
        low_stock_threshold: parseFloat(p.low_stock_threshold) || 5,
      })),
      logs: logs.map((l: any) => ({
        ...l,
        change_amount: parseFloat(l.change_amount) || 0,
        previous_stock: parseFloat(l.previous_stock) || 0,
        new_stock: parseFloat(l.new_stock) || 0,
      })),
    };
  },

  async getProducts() {
    const products = await queryPg(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.name ASC
    `);

    const categories = await queryPg('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
    return {
      products: products.map((p: any) => ({
        ...p,
        price: parseInt(p.price, 10),
        cost: parseInt(p.cost, 10),
        stock_quantity: parseFloat(p.stock_quantity) || 0,
      })),
      categories,
    };
  },

  async createProduct(body: any) {
    const id = body.id || `prod_${Date.now()}`;
    const now = new Date().toISOString();

    await queryPg(`
      INSERT INTO products (
        id, category_id, name, description, price, cost, sku, barcode, color,
        track_stock, stock_quantity, low_stock_threshold, is_composite, active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, 1, $13, $14)
    `, [
      id,
      body.category_id || null,
      body.name,
      body.description || '',
      Math.round(Number(body.price) || 0),
      Math.round(Number(body.cost) || 0),
      body.sku || null,
      body.barcode || null,
      body.color || '#10b981',
      body.track_stock !== false ? 1 : 0,
      Number(body.stock_quantity) || 0,
      Number(body.low_stock_threshold) || 5,
      now,
      now,
    ]);

    return { id, ...body };
  },

  async deleteProduct(id: string) {
    await queryPg('UPDATE products SET active = 0 WHERE id = $1', [id]);
    return { success: true };
  },

  async updateProduct(body: any) {
    const now = new Date().toISOString();
    await queryPg(`
      UPDATE products SET
        category_id = $1,
        name = $2,
        description = $3,
        price = $4,
        cost = $5,
        sku = $6,
        barcode = $7,
        color = $8,
        track_stock = $9,
        stock_quantity = $10,
        low_stock_threshold = $11,
        active = $12,
        updated_at = $13
      WHERE id = $14
    `, [
      body.category_id || null,
      body.name,
      body.description || '',
      Math.round(body.price),
      Math.round(body.cost || 0),
      body.sku || null,
      body.barcode || null,
      body.color || '#10b981',
      body.track_stock ? 1 : 0,
      Number(body.stock_quantity || 0),
      Number(body.low_stock_threshold || 5),
      body.active === false ? 0 : 1,
      now,
      body.id,
    ]);
    return { success: true };
  },

  async getSettings() {
    const store = await queryPgOne('SELECT * FROM stores LIMIT 1');
    const users = await queryPg('SELECT id, name, email, role, active, created_at FROM users');
    const categories = await queryPg('SELECT * FROM categories ORDER BY sort_order ASC');
    const discounts = await queryPg('SELECT * FROM discounts ORDER BY name ASC');
    const diningOptions = await queryPg('SELECT * FROM dining_options ORDER BY name ASC');

    return { store, users, categories, discounts, diningOptions };
  },

  async updateSettings(body: any) {
    await queryPg(`
      UPDATE stores SET
        name = $1,
        legal_name = $2,
        tax_id = $3,
        address = $4,
        phone = $5,
        email = $6,
        currency_code = $7,
        currency_symbol = $8,
        tax_rate = $9,
        tax_name = $10,
        tax_type = $11,
        receipt_header = $12,
        receipt_footer = $13
      WHERE id = 'store_default'
    `, [
      body.name,
      body.legal_name || '',
      body.tax_id || '',
      body.address || '',
      body.phone || '',
      body.email || '',
      body.currency_code || 'PEN',
      body.currency_symbol || 'S/',
      Number(body.tax_rate),
      body.tax_name || 'IGV',
      body.tax_type || 'INCLUDED',
      body.receipt_header || '',
      body.receipt_footer || '',
    ]);

    return { success: true };
  },
};
