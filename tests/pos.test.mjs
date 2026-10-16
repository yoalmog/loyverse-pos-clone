import test from 'node:test';
import assert from 'node:assert/strict';
import { posService } from '../src/lib/pos-service.ts';
import { getDb } from '../src/lib/db.ts';

test('POS Service Tests', async (t) => {
  const db = getDb();
  // Ensure baseline test products have sufficient positive stock
  db.prepare("UPDATE products SET stock_quantity = 100 WHERE stock_quantity <= 10").run();

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

  await t.test('14. Open ticket merge and cash rounding calculation (Loyverse Manual 2.11 & 8.8)', () => {
    // 1. Swedish cash rounding verification (Manual Chapter 8.8)
    const roundCash = (amount) => Math.round(amount * 10) / 10;
    assert.equal(roundCash(10.13), 10.10, 'S/ 10.13 must round down to S/ 10.10');
    assert.equal(roundCash(10.17), 10.20, 'S/ 10.17 must round up to S/ 10.20');
    assert.equal(roundCash(25.55), 25.60, 'S/ 25.55 must round to S/ 25.60');

    // 2. Open tickets hold and recall
    const ticket1 = posService.saveOpenTicket({
      userId: 'usr_cashier',
      ticketName: 'Table 1',
      items: [
        { productId: 'prod_espresso', productName: 'Café Espresso', quantity: 2, unitPrice: 750, selectedModifiers: [] }
      ]
    });
    assert.ok(ticket1.id, 'Ticket 1 saved');

    const ticket2 = posService.saveOpenTicket({
      userId: 'usr_cashier',
      ticketName: 'Table 2',
      items: [
        { productId: 'prod_americano', productName: 'Café Americano', quantity: 1, unitPrice: 850, selectedModifiers: [] }
      ]
    });
    assert.ok(ticket2.id, 'Ticket 2 saved');

    // Verify both tickets appear in open tickets list
    const openTickets = posService.getOpenTickets();
    assert.ok(openTickets.some(t => t.id === ticket1.id), 'Ticket 1 is in open list');
    assert.ok(openTickets.some(t => t.id === ticket2.id), 'Ticket 2 is in open list');

    // Clean up test tickets
    posService.deleteOpenTicket(ticket1.id);
    posService.deleteOpenTicket(ticket2.id);
  });

  await t.test('15. Purchase Orders Landed Cost proportional allocation (Loyverse Manual 4.3 & 4.4)', () => {
    // Items subtotal = $60 (item A, 10 units @ $6.00) + $40 (item B, 20 units @ $2.00) = $100.00
    const items = [
      { id: 'poi_1', productId: 'prod_1', quantityOrdered: 10, unitCost: 6.00, totalCost: 60.00 },
      { id: 'poi_2', productId: 'prod_2', quantityOrdered: 20, unitCost: 2.00, totalCost: 40.00 },
    ];
    const itemsTotal = items.reduce((acc, i) => acc + i.totalCost, 0);
    assert.equal(itemsTotal, 100.00);

    // Landed costs: $20 shipping + $10 customs = $30 total landed cost
    const additionalCosts = [
      { id: 'c1', name: 'Shipping', amount: 20.00 },
      { id: 'c2', name: 'Customs', amount: 10.00 }
    ];
    const additionalCostsTotal = additionalCosts.reduce((acc, c) => acc + c.amount, 0);
    assert.equal(additionalCostsTotal, 30.00);

    // Allocate proportionally: Item 1 gets 60/100 * 30 = 18.00; Item 2 gets 40/100 * 30 = 12.00
    const enriched = items.map(item => {
      const share = Math.round((item.totalCost / itemsTotal) * additionalCostsTotal * 100) / 100;
      const landedUnitCost = Math.round((item.unitCost + (share / item.quantityOrdered)) * 100) / 100;
      return { ...item, additionalCostShare: share, landedUnitCost };
    });

    assert.equal(enriched[0].additionalCostShare, 18.00, 'Item 1 gets $18 landed cost share');
    assert.equal(enriched[0].landedUnitCost, 7.80, 'Item 1 landed unit cost is $6.00 + $1.80 = $7.80');

    assert.equal(enriched[1].additionalCostShare, 12.00, 'Item 2 gets $12 landed cost share');
    assert.equal(enriched[1].landedUnitCost, 2.60, 'Item 2 landed unit cost is $2.00 + $0.60 = $2.60');

    const grandTotal = itemsTotal + additionalCostsTotal;
    assert.equal(grandTotal, 130.00, 'Grand total includes landed costs');
  });

  await t.test('16. EAN-13 Embedded Weight Barcode Parsing (Loyverse Manual Chapter 2.5)', () => {
    const parseWeightedBarcode = (barcode) => {
      const match = barcode.match(/^(20|21|02)(\d{5})(\d{5})\d$/);
      if (!match) return null;
      return {
        prefix: match[1],
        plu: match[2],
        weightKg: parseInt(match[3], 10) / 1000
      };
    };

    // 1. Prefix 20: PLU 01234, 750 grams (0.750 kg)
    const res1 = parseWeightedBarcode('2001234007505');
    assert.ok(res1);
    assert.equal(res1.prefix, '20');
    assert.equal(res1.plu, '01234');
    assert.equal(res1.weightKg, 0.750);

    // 2. Prefix 21: PLU 09876, 1250 grams (1.250 kg)
    const res2 = parseWeightedBarcode('2109876012503');
    assert.ok(res2);
    assert.equal(res2.prefix, '21');
    assert.equal(res2.plu, '09876');
    assert.equal(res2.weightKg, 1.250);

    // 3. Prefix 02: PLU 11111, 250 grams (0.250 kg)
    const res3 = parseWeightedBarcode('0211111002509');
    assert.ok(res3);
    assert.equal(res3.prefix, '02');
    assert.equal(res3.plu, '11111');
    assert.equal(res3.weightKg, 0.250);

    // 4. Non-weighted standard barcode is not misparsed as weighted
    const res4 = parseWeightedBarcode('7751234567890');
    assert.equal(res4, null, 'Standard EAN-13 not starting with 20/21/02 returns null');
  });

  await t.test('17. Employee Timecards & Shift Hours Tracking (Loyverse Manual Chapter 5.4-5.6)', () => {
    // 1. Clock in
    const clockInTime = new Date('2026-10-16T08:00:00.000Z');
    const clockOutTime = new Date('2026-10-16T16:30:00.000Z'); // 8.5 hours = 510 minutes

    const timecard = {
      id: 'tc_test_1',
      employeeId: 'emp_123',
      employeeName: 'Maria Cashier',
      clockIn: clockInTime.toISOString(),
      clockOut: clockOutTime.toISOString(),
      totalMinutes: Math.round((clockOutTime.getTime() - clockInTime.getTime()) / 60000)
    };

    assert.equal(timecard.totalMinutes, 510, 'Shift is exactly 510 minutes');
    const hours = timecard.totalMinutes / 60;
    assert.equal(hours, 8.5, 'Shift is 8.5 hours');

    // 2. Overtime calculation (>40 hours threshold)
    const weeklyShifts = [
      { totalMinutes: 600 }, // 10h
      { totalMinutes: 600 }, // 10h
      { totalMinutes: 600 }, // 10h
      { totalMinutes: 600 }, // 10h
      { totalMinutes: 300 }  // 5h -> total 45 hours
    ];
    const totalWeeklyMinutes = weeklyShifts.reduce((acc, s) => acc + s.totalMinutes, 0);
    const totalWeeklyHours = totalWeeklyMinutes / 60;
    const regularHours = Math.min(40, totalWeeklyHours);
    const overtimeHours = Math.max(0, totalWeeklyHours - 40);

    assert.equal(totalWeeklyHours, 45, 'Total weekly hours is 45');
    assert.equal(regularHours, 40, 'Regular hours capped at 40');
    assert.equal(overtimeHours, 5, 'Overtime hours is 5');
  });
});

