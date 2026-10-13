import test from 'node:test';
import assert from 'node:assert/strict';
import { syncService } from '../src/lib/sync-service.ts';
import { getDb } from '../src/lib/db.ts';

test('Offline Sync Queue & Idempotency Tests', async (t) => {
  const db = getDb();

  await t.test('1. Enqueue and process offline checkout', () => {
    const idempotencyKey = `idemp_${Date.now()}_test1`;
    const deviceId = 'android_pos_tablet_01';

    // Stock before
    const stockBefore = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_orange_juice').stock_quantity;

    const event = {
      id: `evt_${Date.now()}`,
      idempotencyKey,
      deviceId,
      eventType: 'CHECKOUT',
      payload: {
        userId: 'usr_cashier',
        paymentMethod: 'CASH',
        cashTendered: 1500,
        items: [
          {
            productId: 'prod_orange_juice',
            productName: 'Jugo de Naranja Natural',
            quantity: 1,
            unitPrice: 1100,
            selectedModifiers: [],
          }
        ]
      }
    };

    const batchResults = syncService.processSyncBatch([event]);
    assert.equal(batchResults.length, 1);
    assert.equal(batchResults[0].status, 'SYNCED');
    assert.ok(batchResults[0].result);
    assert.equal(batchResults[0].result.total, 1100);

    // Stock after
    const stockAfter = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_orange_juice').stock_quantity;
    assert.equal(stockAfter, stockBefore - 1);
  });

  await t.test('2. Idempotency guard prevents duplicate order on retry', () => {
    const idempotencyKey = `idemp_${Date.now()}_duplicate_test`;
    const deviceId = 'android_pos_tablet_01';

    const stockBefore = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_espresso').stock_quantity;

    const event = {
      id: `evt_${Date.now()}`,
      idempotencyKey,
      deviceId,
      eventType: 'CHECKOUT',
      payload: {
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
      }
    };

    // First attempt -> SYNCED
    const res1 = syncService.processSyncBatch([event]);
    assert.equal(res1[0].status, 'SYNCED');
    const orderId = res1[0].result.id;

    const stockAfterFirst = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_espresso').stock_quantity;
    assert.equal(stockAfterFirst, stockBefore - 1);

    // Second attempt with SAME idempotency key -> ALREADY_SYNCED
    const res2 = syncService.processSyncBatch([event]);
    assert.equal(res2[0].status, 'ALREADY_SYNCED');
    assert.equal(res2[0].result.id, orderId, 'Must return the original order result');

    // Stock MUST NOT be deducted again!
    const stockAfterSecond = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get('prod_espresso').stock_quantity;
    assert.equal(stockAfterSecond, stockAfterFirst, 'Stock must not be double deducted on retry');
  });

  await t.test('3. Failed event error tracking and retry count', () => {
    const idempotencyKey = `idemp_${Date.now()}_fail_test`;
    const event = {
      id: `evt_fail_${Date.now()}`,
      idempotencyKey,
      deviceId: 'android_pos_tablet_01',
      eventType: 'CHECKOUT',
      payload: {
        userId: 'usr_cashier',
        paymentMethod: 'CASH',
        cashTendered: 100, // Insufficient cash (1.00 for 10.00 item)
        items: [
          {
            productId: 'prod_espresso',
            productName: 'Café Espresso',
            quantity: 1,
            unitPrice: 750,
            selectedModifiers: [],
          }
        ]
      }
    };

    const res = syncService.processSyncBatch([event]);
    assert.equal(res[0].status, 'FAILED');
    assert.ok(res[0].error);

    const stored = syncService.getEventById(event.id);
    assert.ok(stored);
    assert.equal(stored.status, 'FAILED');
    assert.equal(stored.retryCount, 1);
  });

  await t.test('4. Queue status aggregation', () => {
    const status = syncService.getSyncStatus();
    assert.ok(status.total_events >= 3);
    assert.ok(status.synced_count >= 2);
  });
});
