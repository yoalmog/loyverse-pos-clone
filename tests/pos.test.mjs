import test from 'node:test';
import assert from 'node:assert/strict';
import { posService } from '../src/lib/pos-service.ts';
import { getDb } from '../src/lib/db.ts';

test('POS Service Tests', async (t) => {
  const db = getDb();

  await t.test('1. Catalog retrieval', () => {
    const catalog = posService.getCatalog();
    assert.ok(catalog.products.length >= 10, 'Catalog should load at least 10 products');
    assert.ok(catalog.categories.length >= 4, 'Catalog should have categories');
    assert.equal(catalog.store.currency_code, 'PEN');
    
    // Verify product with variations
    const cappuccino = catalog.products.find(p => p.id === 'prod_cappuccino');
    assert.ok(cappuccino, 'Cappuccino should exist');
    assert.ok(cappuccino.variations.length >= 3, 'Cappuccino should have 3 variations');
    assert.ok(cappuccino.modifiers.length >= 2, 'Cappuccino should have modifiers');
  });

  await t.test('2. Current shift check', () => {
    const shift = posService.getCurrentShift();
    assert.ok(shift, 'Initial demo shift should be open');
    assert.equal(shift.status, 'OPEN');
    assert.equal(shift.opening_cash, 20000); // S/ 200.00
  });

  await t.test('3. Atomic checkout with stock deduction and change calculation', () => {
    // Check initial stock of Espresso
    const prodBefore = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_espresso');
    const shiftBefore = posService.getCurrentShift();

    const result = posService.processCheckout({
      userId: 'usr_cashier',
      shiftId: shiftBefore.id,
      paymentMethod: 'CASH',
      cashTendered: 2000, // S/ 20.00 given for S/ 15.00 purchase
      items: [
        {
          productId: 'prod_espresso',
          productName: 'Café Espresso',
          quantity: 2,
          unitPrice: 750, // S/ 7.50 each => S/ 15.00 total
          selectedModifiers: [],
        }
      ]
    });

    assert.ok(result, 'Order should be created');
    assert.equal(result.total, 1500, 'Total should be S/ 15.00 (1500 cents)');
    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.payments[0].change_due, 500, 'Change should be S/ 5.00 (500 cents)');
    assert.ok(result.receipt_number.startsWith('REC-'), 'Receipt number should start with REC-');

    // Check stock was deducted by exactly 2
    const prodAfter = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_espresso');
    assert.equal(prodAfter.stock_quantity, prodBefore.stock_quantity - 2, 'Stock quantity should decrease by 2');

    // Check shift expected cash increased by 1500
    const shiftAfter = posService.getCurrentShift();
    assert.equal(shiftAfter.expected_cash, shiftBefore.expected_cash + 1500, 'Shift cash should increase by 1500');

    // Check inventory log
    const log = db.prepare('SELECT * FROM inventory_logs WHERE reference_id = ?').get(result.id);
    assert.ok(log, 'Inventory log must exist');
    assert.equal(log.change_amount, -2);
    assert.equal(log.reason, 'SALE');
  });

  await t.test('4. Checkout failure when cash tendered is insufficient', () => {
    assert.throws(() => {
      posService.processCheckout({
        userId: 'usr_cashier',
        paymentMethod: 'CASH',
        cashTendered: 500, // Only S/ 5.00 provided for S/ 9.00 item
        items: [
          {
            productId: 'prod_americano',
            productName: 'Café Americano',
            quantity: 1,
            unitPrice: 900,
            selectedModifiers: [],
          }
        ]
      });
    }, /Monto recibido/);
  });

  await t.test('5. Modifiers and item discounts in cart calculation', () => {
    const result = posService.processCheckout({
      userId: 'usr_cashier',
      paymentMethod: 'CARD',
      referenceNumber: 'OP-998822',
      items: [
        {
          productId: 'prod_americano',
          productName: 'Café Americano',
          quantity: 1,
          unitPrice: 900,
          discountAmount: 100, // S/ 1.00 line discount
          selectedModifiers: [
            {
              modifierId: 'mod_extras',
              modifierName: 'Extras & Toppings',
              optionId: 'opt_extra_espresso',
              optionName: 'Extra Shot Espresso',
              price: 350, // S/ 3.50
            }
          ]
        }
      ]
    });

    // 900 + 350 = 1250 subtotal - 100 discount = 1150 total
    assert.equal(result.total, 1150);
    assert.equal(result.items[0].selectedModifiers.length, 1);
    assert.equal(result.payments[0].payment_method, 'CARD');
    assert.equal(result.payments[0].reference_number, 'OP-998822');
  });

  await t.test('6. Hold / Save ticket and recall/delete', () => {
    const saved = posService.saveOpenTicket({
      userId: 'usr_cashier',
      ticketName: 'Mesa 4 Terraza',
      items: [
        {
          productId: 'prod_croissant',
          productName: 'Croissant de Mantequilla',
          quantity: 3,
          unitPrice: 850,
          selectedModifiers: [],
        }
      ]
    });

    assert.ok(saved);
    assert.equal(saved.status, 'SAVED');
    assert.equal(saved.ticket_name, 'Mesa 4 Terraza');

    const openTickets = posService.getOpenTickets();
    const found = openTickets.find(t => t.id === saved.id);
    assert.ok(found, 'Saved ticket must appear in open tickets list');

    // Complete the saved order
    const completed = posService.processCheckout({
      savedOrderId: saved.id,
      userId: 'usr_cashier',
      paymentMethod: 'CASH',
      cashTendered: 3000,
      items: [
        {
          productId: 'prod_croissant',
          productName: 'Croissant de Mantequilla',
          quantity: 3,
          unitPrice: 850,
          selectedModifiers: [],
        }
      ]
    });

    assert.equal(completed.status, 'COMPLETED');
    const remainingOpen = posService.getOpenTickets();
    assert.ok(!remainingOpen.some(t => t.id === saved.id), 'Completed ticket should no longer be open');
  });

  await t.test('7. Order refund and inventory restoration', () => {
    // 1. Make purchase
    const stockBefore = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_muffin').stock_quantity;
    const sale = posService.processCheckout({
      userId: 'usr_cashier',
      paymentMethod: 'CASH',
      cashTendered: 1000,
      items: [
        {
          productId: 'prod_muffin',
          productName: 'Muffin de Arándanos',
          quantity: 1,
          unitPrice: 950,
          selectedModifiers: [],
        }
      ]
    });

    const stockAfterSale = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_muffin').stock_quantity;
    assert.equal(stockAfterSale, stockBefore - 1);

    // 2. Refund purchase
    const refunded = posService.refundOrder(sale.id, 'usr_cashier', 'Cliente solicitó cambio');
    assert.equal(refunded.status, 'REFUNDED');

    // Verify stock restored
    const stockAfterRefund = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_muffin').stock_quantity;
    assert.equal(stockAfterRefund, stockBefore, 'Stock must be restored on refund');

    // 3. Double refund prevention
    assert.throws(() => {
      posService.refundOrder(sale.id, 'usr_cashier');
    }, /reembolsado/);
  });

  await t.test('8. Cash movements (Pay In / Pay Out)', () => {
    const shiftBefore = posService.getCurrentShift();
    const cashOut = posService.recordCashMovement({
      shiftId: shiftBefore.id,
      userId: 'usr_cashier',
      type: 'PAY_OUT',
      amount: 1500, // S/ 15.00 for cleaning supplies
      reason: 'Compra de servilletas'
    });

    assert.ok(cashOut);
    const shiftAfter = posService.getCurrentShift();
    assert.equal(shiftAfter.expected_cash, shiftBefore.expected_cash - 1500);
  });

  await t.test('9. Idempotent checkout prevents duplicate sale & double stock deduction', () => {
    const key = `idem_${Date.now()}_test_suite`;
    const stockBefore = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_espresso').stock_quantity;

    const payload = {
      idempotencyKey: key,
      userId: 'usr_cashier',
      paymentMethod: 'CASH',
      cashTendered: 1000,
      items: [
        {
          productId: 'prod_espresso',
          productName: 'Café Espresso',
          quantity: 1,
          unitPrice: 750,
          selectedModifiers: [],
        }
      ]
    };

    // First attempt
    const sale1 = posService.processCheckout(payload);
    assert.ok(sale1);
    const stockAfter1 = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_espresso').stock_quantity;
    assert.equal(stockAfter1, stockBefore - 1);

    // Duplicate attempt with same idempotency key
    const sale2 = posService.processCheckout(payload);
    assert.ok(sale2);
    assert.equal(sale2.id, sale1.id, 'Duplicate checkout must return original order ID');
    assert.equal(sale2.receipt_number, sale1.receipt_number, 'Duplicate checkout must return original receipt');

    // Stock must NOT be deducted again
    const stockAfter2 = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_espresso').stock_quantity;
    assert.equal(stockAfter2, stockAfter1, 'Stock must not be deducted on duplicate request');

    // Total orders count in DB matching this idempotency_key must be exactly 1
    const orderRows = db.prepare('SELECT COUNT(*) as count FROM orders WHERE idempotency_key = ?').get(key).count;
    assert.equal(orderRows, 1, 'Only one order record must exist for this idempotency key');
  });

  await t.test('10. Failed checkout does not leave partial transactions', () => {
    const ordersCountBefore = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
    const itemsCountBefore = db.prepare('SELECT COUNT(*) as count FROM order_items').get().count;
    const paymentsCountBefore = db.prepare('SELECT COUNT(*) as count FROM payments').get().count;
    const invLogsCountBefore = db.prepare('SELECT COUNT(*) as count FROM inventory_logs').get().count;
    const stockBefore = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_espresso').stock_quantity;

    // Execute checkout that throws due to insufficient tender
    assert.throws(() => {
      posService.processCheckout({
        userId: 'usr_cashier',
        paymentMethod: 'CASH',
        cashTendered: 100, // S/ 1.00 for S/ 7.50 item
        items: [
          {
            productId: 'prod_espresso',
            productName: 'Café Espresso',
            quantity: 1,
            unitPrice: 750,
            selectedModifiers: [],
          }
        ]
      });
    }, /Monto recibido/);

    // Verify zero orphaned records were created
    const ordersCountAfter = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
    const itemsCountAfter = db.prepare('SELECT COUNT(*) as count FROM order_items').get().count;
    const paymentsCountAfter = db.prepare('SELECT COUNT(*) as count FROM payments').get().count;
    const invLogsCountAfter = db.prepare('SELECT COUNT(*) as count FROM inventory_logs').get().count;
    const stockAfter = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_espresso').stock_quantity;

    assert.equal(ordersCountAfter, ordersCountBefore, 'No order row should remain on failure');
    assert.equal(itemsCountAfter, itemsCountBefore, 'No order_item row should remain on failure');
    assert.equal(paymentsCountAfter, paymentsCountBefore, 'No payment row should remain on failure');
    assert.equal(invLogsCountAfter, invLogsCountBefore, 'No inventory_log should remain on failure');
    assert.equal(stockAfter, stockBefore, 'Stock must remain unchanged on failure');
  });

  await t.test('11. Back Office displays consistent order and inventory state', () => {
    const history = posService.getOrdersHistory(10);
    assert.ok(Array.isArray(history));
    assert.ok(history.length > 0);

    // Latest order in history matches DB
    const latest = history[0];
    assert.ok(latest.receipt_number);
    assert.ok(latest.total > 0);

    // Single order query returns matching data with line items
    const fetched = posService.getOrderById(latest.id);
    assert.ok(fetched);
    assert.equal(fetched.id, latest.id);
    assert.ok(fetched.items.length > 0);
    assert.ok(fetched.payments.length > 0);
  });

  await t.test('12. Reusing an idempotency key with a different order payload is rejected', () => {
    const key = `idem_conflict_${Date.now()}`;

    // Original sale: 1 Espresso
    const sale1 = posService.processCheckout({
      idempotencyKey: key,
      userId: 'usr_cashier',
      paymentMethod: 'CASH',
      cashTendered: 1000,
      items: [
        {
          productId: 'prod_espresso',
          productName: 'Café Espresso',
          quantity: 1,
          unitPrice: 750,
          selectedModifiers: [],
        }
      ]
    });
    assert.ok(sale1);

    // Mismatched sale with same key: 2 Americanos instead of 1 Espresso
    assert.throws(() => {
      posService.processCheckout({
        idempotencyKey: key,
        userId: 'usr_cashier',
        paymentMethod: 'CASH',
        cashTendered: 2000,
        items: [
          {
            productId: 'prod_americano',
            productName: 'Café Americano',
            quantity: 2,
            unitPrice: 900,
            selectedModifiers: [],
          }
        ]
      });
    }, /Idempotency conflict/);
  });

  await t.test('13. Concurrent duplicate checkout requests do not create duplicate sales or double-deduct stock', async () => {
    const concurrentKey = `idem_concurrent_${Date.now()}`;
    const stockBefore = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_espresso').stock_quantity;

    const payload = {
      idempotencyKey: concurrentKey,
      userId: 'usr_cashier',
      paymentMethod: 'CASH',
      cashTendered: 1000,
      items: [
        {
          productId: 'prod_espresso',
          productName: 'Café Espresso',
          quantity: 1,
          unitPrice: 750,
          selectedModifiers: [],
        }
      ]
    };

    // Trigger concurrent checkouts
    const [res1, res2] = await Promise.all([
      Promise.resolve().then(() => posService.processCheckout(payload)),
      Promise.resolve().then(() => posService.processCheckout(payload)),
    ]);

    assert.equal(res1.id, res2.id, 'Both concurrent calls must yield the same order ID');
    assert.equal(res1.receipt_number, res2.receipt_number, 'Both concurrent calls must yield the same receipt');

    const stockAfter = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_espresso').stock_quantity;
    assert.equal(stockAfter, stockBefore - 1, 'Stock must only be deducted once despite concurrent calls');

    const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE idempotency_key = ?').get(concurrentKey).count;
    assert.equal(totalOrders, 1, 'Exactly one order row must exist in the database');
  });
});
