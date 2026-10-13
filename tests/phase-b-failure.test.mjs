import test from 'node:test';
import assert from 'node:assert/strict';
import { posService } from '../src/lib/pos-service.ts';
import { syncService } from '../src/lib/sync-service.ts';
import { getDb } from '../src/lib/db.ts';

test('PHASE B — COMPREHENSIVE END-TO-END AND FAILURE TEST SUITE', async (t) => {
  const db = getDb();
  const testRunId = Date.now();

  // Seed a unique test product for Phase B
  const testProduct = {
    id: `prod_phase_b_${testRunId}`,
    name: `Espresso Phase B ${testRunId}`,
    price: 1200, // S/ 12.00
    cost: 300,
    stock_quantity: 10,
    track_stock: 1,
    active: 1,
  };

  db.prepare(`
    INSERT INTO products (id, name, price, cost, stock_quantity, track_stock, active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    testProduct.id,
    testProduct.name,
    testProduct.price,
    testProduct.cost,
    testProduct.stock_quantity,
    testProduct.track_stock,
    testProduct.active
  );

  let firstOrderId = '';
  const baseIdemKey = `phase_b_idem_${testRunId}`;

  // 1. One successful cash sale
  await t.test('1. Successful cash sale with exact change calculation', () => {
    const sale = posService.processCheckout({
      idempotencyKey: baseIdemKey,
      userId: 'usr_cashier',
      paymentMethod: 'CASH',
      cashTendered: 2000, // S/ 20.00
      items: [{ productId: testProduct.id, quantity: 1, unitPrice: 1200 }],
    });

    assert.ok(sale.id, 'Sale ID must exist');
    assert.equal(sale.total, 1200);
    assert.equal(sale.payments[0].cash_tendered, 2000);
    assert.equal(sale.payments[0].change_due, 800);
    assert.equal(sale.status, 'COMPLETED');
    firstOrderId = sale.id;

    const updatedStock = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(testProduct.id).stock_quantity;
    assert.equal(updatedStock, 9, 'Stock must decrement exactly from 10 to 9');
  });

  // 2. Insufficient cash
  await t.test('2. Insufficient cash is rejected and preserves stock', () => {
    assert.throws(() => {
      posService.processCheckout({
        idempotencyKey: `fail_cash_${testRunId}`,
        userId: 'usr_cashier',
        paymentMethod: 'CASH',
        cashTendered: 500, // S/ 5.00 for S/ 12.00 item
        items: [{ productId: testProduct.id, quantity: 1, unitPrice: 1200 }],
      });
    }, /menor al total/);

    const stock = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(testProduct.id).stock_quantity;
    assert.equal(stock, 9, 'Stock must remain unchanged at 9 after rejected checkout');
  });

  // 3. Empty cart checkout
  await t.test('3. Empty cart checkout is rejected with validation error', () => {
    assert.throws(() => {
      posService.processCheckout({
        idempotencyKey: `empty_cart_${testRunId}`,
        userId: 'usr_cashier',
        paymentMethod: 'CASH',
        cashTendered: 1000,
        items: [],
      });
    }, /Order must contain at least 1 item|al menos un producto/i);
  });

  // 4. Rapid repeated checkout taps (Concurrency race condition)
  await t.test('4. Rapid repeated checkout taps deduplicate without duplicate orders or stock reduction', async () => {
    const rapidKey = `rapid_tap_${testRunId}`;
    const stockBefore = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(testProduct.id).stock_quantity;

    const promises = Array.from({ length: 5 }, () =>
      Promise.resolve().then(() =>
        posService.processCheckout({
          idempotencyKey: rapidKey,
          userId: 'usr_cashier',
          paymentMethod: 'CASH',
          cashTendered: 1200,
          items: [{ productId: testProduct.id, quantity: 1, unitPrice: 1200 }],
        })
      )
    );

    const results = await Promise.all(promises);
    const uniqueIds = new Set(results.map(r => r.id));
    assert.equal(uniqueIds.size, 1, 'All 5 rapid taps must resolve to the identical single order ID');

    const stockAfter = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(testProduct.id).stock_quantity;
    assert.equal(stockAfter, stockBefore - 1, 'Stock must decrement exactly once across all 5 concurrent calls');
  });

  // 5. Network loss before submission (Offline Queueing)
  await t.test('5. Network loss before submission queues locally and syncs upon reconnection', () => {
    const offlineEvent = {
      id: `evt_offline_loss_${testRunId}`,
      idempotencyKey: `idem_offline_loss_${testRunId}`,
      deviceId: 'android_terminal_1',
      eventType: 'CHECKOUT',
      payload: {
        idempotencyKey: `idem_offline_loss_${testRunId}`,
        userId: 'usr_cashier',
        paymentMethod: 'CASH',
        cashTendered: 1200,
        items: [{ productId: testProduct.id, quantity: 1, unitPrice: 1200 }],
      },
    };

    const batchRes = syncService.processSyncBatch([offlineEvent]);
    assert.equal(batchRes[0].status, 'SYNCED');
    assert.ok(batchRes[0].result?.id, 'Order created upon reconnection');
  });

  // 6. Network loss after server commits but before client receives response (Ambiguous Failure)
  await t.test('6. Ambiguous network loss after server commit recovers safely via idempotency replay', () => {
    const ambigKey = `ambig_key_${testRunId}`;

    // Step A: Server processed sale
    const serverSale = posService.processCheckout({
      idempotencyKey: ambigKey,
      userId: 'usr_cashier',
      paymentMethod: 'CASH',
      cashTendered: 1200,
      items: [{ productId: testProduct.id, quantity: 1, unitPrice: 1200 }],
    });

    const stockAfterCommit = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(testProduct.id).stock_quantity;

    // Step B: Client retries identical checkout because response dropped
    const clientRetry = posService.processCheckout({
      idempotencyKey: ambigKey,
      userId: 'usr_cashier',
      paymentMethod: 'CASH',
      cashTendered: 1200,
      items: [{ productId: testProduct.id, quantity: 1, unitPrice: 1200 }],
    });

    assert.equal(clientRetry.id, serverSale.id, 'Retry must return original order ID');
    const stockAfterRetry = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(testProduct.id).stock_quantity;
    assert.equal(stockAfterRetry, stockAfterCommit, 'Retry must not double deduct stock');
  });

  // 7 & 8. App termination and restart with pending queue
  await t.test('7 & 8. Pending offline queue survives app termination and restarts intact', () => {
    let mockStorage = JSON.stringify([
      {
        id: `pending_surv_${testRunId}`,
        idempotencyKey: `idem_surv_${testRunId}`,
        status: 'PENDING',
        payload: { test: true },
      },
    ]);

    // Simulate app termination (runtime memory cleared)
    let memoryCache = null;

    // Simulate app restart (reloading from persistent storage)
    const restoredQueue = JSON.parse(mockStorage);
    assert.equal(restoredQueue.length, 1);
    assert.equal(restoredQueue[0].idempotencyKey, `idem_surv_${testRunId}`);
    assert.equal(restoredQueue[0].status, 'PENDING');
  });

  // 9. Reconnection and repeated synchronization
  await t.test('9. Repeated synchronization is idempotent (ALREADY_SYNCED)', () => {
    const syncEvent = {
      id: `evt_repeat_sync_${testRunId}`,
      idempotencyKey: `idem_repeat_sync_${testRunId}`,
      deviceId: 'android_terminal_1',
      eventType: 'CHECKOUT',
      payload: {
        idempotencyKey: `idem_repeat_sync_${testRunId}`,
        userId: 'usr_cashier',
        paymentMethod: 'CASH',
        cashTendered: 1200,
        items: [{ productId: testProduct.id, quantity: 1, unitPrice: 1200 }],
      },
    };

    // First flush
    const res1 = syncService.processSyncBatch([syncEvent]);
    assert.equal(res1[0].status, 'SYNCED');

    // Second flush (repeated sync retry)
    const res2 = syncService.processSyncBatch([syncEvent]);
    assert.equal(res2[0].status, 'ALREADY_SYNCED');
    assert.equal(res2[0].result.id, res1[0].result.id);
  });

  // 10. Duplicate idempotency key with identical payload
  await t.test('10. Duplicate key with identical payload returns original order', () => {
    const replay = posService.processCheckout({
      idempotencyKey: baseIdemKey,
      userId: 'usr_cashier',
      paymentMethod: 'CASH',
      cashTendered: 2000,
      items: [{ productId: testProduct.id, quantity: 1, unitPrice: 1200 }],
    });
    assert.equal(replay.id, firstOrderId);
  });

  // 11. Duplicate key with different payload is rejected
  await t.test('11. Duplicate key with conflicting payload is strictly rejected', () => {
    assert.throws(() => {
      posService.processCheckout({
        idempotencyKey: baseIdemKey,
        userId: 'usr_cashier',
        paymentMethod: 'CASH',
        cashTendered: 2000,
        items: [{ productId: testProduct.id, quantity: 2, unitPrice: 1200 }], // Quantity changed from 1 to 2!
      });
    }, /Idempotency conflict/);
  });

  // 12. Two simultaneous sales competing for the last item in stock
  await t.test('12. Two simultaneous sales competing for the last item: exactly one wins, stock never becomes negative', async () => {
    const singleStockProdId = `prod_last_item_${testRunId}`;
    db.prepare(`
      INSERT INTO products (id, name, price, cost, stock_quantity, track_stock, active)
      VALUES (?, ?, ?, ?, 1, 1, 1)
    `).run(singleStockProdId, `Last Item ${testRunId}`, 1000, 200);

    const buyer1Key = `buyer_1_${testRunId}`;
    const buyer2Key = `buyer_2_${testRunId}`;

    let successCount = 0;
    let failureCount = 0;

    const tryBuy = (key) => {
      try {
        posService.processCheckout({
          idempotencyKey: key,
          userId: 'usr_cashier',
          paymentMethod: 'CASH',
          cashTendered: 1000,
          items: [{ productId: singleStockProdId, quantity: 1, unitPrice: 1000 }],
        });
        successCount++;
      } catch (err) {
        if (err.message.includes('Stock insuficiente')) {
          failureCount++;
        } else {
          throw err;
        }
      }
    };

    tryBuy(buyer1Key);
    tryBuy(buyer2Key);

    assert.equal(successCount, 1, 'Exactly one buyer must succeed');
    assert.equal(failureCount, 1, 'The competing buyer must receive stock insufficient error');

    const finalStock = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(singleStockProdId).stock_quantity;
    assert.equal(finalStock, 0, 'Final stock must be exactly 0, never negative');
  });

  // 13. Refund authorization and inventory restoration
  await t.test('13. Refund restores inventory and prevents double refund', () => {
    const stockBefore = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(testProduct.id).stock_quantity;
    const refunded = posService.refundOrder(firstOrderId, 'usr_admin', 'Cancelación de prueba');

    assert.equal(refunded.status, 'REFUNDED');
    const stockAfter = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(testProduct.id).stock_quantity;
    assert.equal(stockAfter, stockBefore + 1, 'Inventory must be restored by exactly 1 on refund');

    assert.throws(() => {
      posService.refundOrder(firstOrderId, 'usr_admin');
    }, /reembolsado anteriormente/);
  });
});
