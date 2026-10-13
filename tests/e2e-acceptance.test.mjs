import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { posService } from '../src/lib/pos-service.ts';
import { syncService } from '../src/lib/sync-service.ts';
import { getDb } from '../src/lib/db.ts';

test('PHASE D — END-TO-END ACCEPTANCE TEST SUITE', async (t) => {
  const db = getDb();

  // 1. Setup isolated test environment fixtures
  const TEST_PROD_ID = `prod_test_coffee_${Date.now()}`;
  const TEST_IDEM_KEY = `idem_e2e_coffee_${Date.now()}`;
  const storeBefore = db.prepare('SELECT tax_rate, tax_type FROM stores LIMIT 1').get();

  // Configure store tax = 0 for this test scenario to verify pure S/ 10.00 subtotal & total
  db.prepare("UPDATE stores SET tax_rate = 0, tax_type = 'INCLUDED'").run();

  // Insert "Test Coffee" with initial stock 10
  db.prepare(`
    INSERT INTO products (id, name, price, cost, track_stock, stock_quantity, low_stock_threshold, active)
    VALUES (?, 'Test Coffee', 1000, 400, 1, 10, 2, 1)
  `).run(TEST_PROD_ID);

  let orderResult = null;

  try {
    await t.test('Step 1: Execute Cash Checkout (Test Coffee, Price S/ 10.00, Cash S/ 20.00)', () => {
      const shift = posService.getCurrentShift();
      orderResult = posService.processCheckout({
        idempotencyKey: TEST_IDEM_KEY,
        userId: 'usr_cashier',
        shiftId: shift?.id || null,
        paymentMethod: 'CASH',
        cashTendered: 2000, // S/ 20.00
        items: [
          {
            productId: TEST_PROD_ID,
            productName: 'Test Coffee',
            quantity: 1,
            unitPrice: 1000, // S/ 10.00
            selectedModifiers: [],
          }
        ]
      });

      assert.ok(orderResult, 'Order must be created');
      assert.equal(orderResult.subtotal, 1000, 'Subtotal must be S/ 10.00 (1000 cents)');
      assert.equal(orderResult.total, 1000, 'Total must be S/ 10.00 (1000 cents)');
      assert.equal(orderResult.tax_total, 0, 'Tax must be zero for this scenario');
      assert.equal(orderResult.payments[0].cash_tendered, 2000, 'Cash tendered must be S/ 20.00 (2000 cents)');
      assert.equal(orderResult.payments[0].change_due, 1000, 'Change due must be S/ 10.00 (1000 cents)');
      assert.equal(orderResult.status, 'COMPLETED');
    });

    await t.test('Step 2: Verify Inventory Decrements Exactly From 10 to 9', () => {
      const prod = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(TEST_PROD_ID);
      assert.equal(prod.stock_quantity, 9, 'Inventory must be exactly 9');

      const log = db.prepare('SELECT * FROM inventory_logs WHERE product_id = ? AND reference_id = ?').get(TEST_PROD_ID, orderResult.id);
      assert.ok(log, 'Inventory audit log must exist');
      assert.equal(log.previous_stock, 10);
      assert.equal(log.new_stock, 9);
      assert.equal(log.change_amount, -1);
    });

    await t.test('Step 3: Verify Exactly One Completed Test Sale Exists', () => {
      const count = db.prepare('SELECT COUNT(*) as count FROM orders WHERE id = ?').get(orderResult.id).count;
      assert.equal(count, 1, 'Exactly one order must exist for this sale ID');
    });

    await t.test('Step 4: Verify Order Appears in Back Office', () => {
      const history = posService.getOrdersHistory(10);
      const found = history.find(o => o.id === orderResult.id);
      assert.ok(found, 'Order must appear in Back Office order history');
      assert.equal(found.receipt_number, orderResult.receipt_number);
      assert.equal(found.total, 1000);
    });

    await t.test('Step 5: Verify Restarting Application / Re-opening DB Preserves Order & Stock', () => {
      // Simulate app restart by opening a new, independent SQLite connection to the physical database file
      const newDb = new Database('data/pos.sqlite');
      const persistedOrder = newDb.prepare('SELECT * FROM orders WHERE id = ?').get(orderResult.id);
      assert.ok(persistedOrder, 'Order must remain in persistent disk storage across restarts');
      assert.equal(persistedOrder.total, 1000);

      const persistedProd = newDb.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(TEST_PROD_ID);
      assert.equal(persistedProd.stock_quantity, 9, 'Stock of 9 must persist across restarts');
      newDb.close();
    });

    await t.test('Step 6: Retrying Same Checkout Does Not Create Second Sale or Deduct Stock Again', () => {
      const retried = posService.processCheckout({
        idempotencyKey: TEST_IDEM_KEY,
        userId: 'usr_cashier',
        paymentMethod: 'CASH',
        cashTendered: 2000,
        items: [
          {
            productId: TEST_PROD_ID,
            productName: 'Test Coffee',
            quantity: 1,
            unitPrice: 1000,
            selectedModifiers: [],
          }
        ]
      });

      assert.equal(retried.id, orderResult.id, 'Must return same order instance');
      const prodAfterRetry = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(TEST_PROD_ID);
      assert.equal(prodAfterRetry.stock_quantity, 9, 'Stock must remain 9 after duplicate retry');
    });

    await t.test('Step 7: Offline Synchronization Queue Does Not Duplicate Order', () => {
      // Queue duplicate event via offline sync queue
      const batchResult = syncService.processSyncBatch([
        {
          id: `sync_dup_${Date.now()}`,
          idempotencyKey: TEST_IDEM_KEY,
          deviceId: 'android_test_dev',
          eventType: 'CHECKOUT',
          payload: {
            idempotencyKey: TEST_IDEM_KEY,
            userId: 'usr_cashier',
            paymentMethod: 'CASH',
            cashTendered: 2000,
            items: [{ productId: TEST_PROD_ID, productName: 'Test Coffee', quantity: 1, unitPrice: 1000, selectedModifiers: [] }]
          }
        }
      ]);

      assert.ok(batchResult.length === 1);
      // Because orders table already has TEST_IDEM_KEY, checkout idempotency returns original order
      const prodAfterSync = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(TEST_PROD_ID);
      assert.equal(prodAfterSync.stock_quantity, 9, 'Stock must remain 9 after sync batch');
    });

  } finally {
    // Teardown: Restore original store tax config and cleanly remove test records
    db.prepare('UPDATE stores SET tax_rate = ?, tax_type = ?').run(storeBefore.tax_rate, storeBefore.tax_type);
    if (orderResult && orderResult.id) {
      db.prepare('DELETE FROM payments WHERE order_id = ?').run(orderResult.id);
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderResult.id);
      db.prepare('DELETE FROM orders WHERE id = ?').run(orderResult.id);
    }
    db.prepare('DELETE FROM inventory_logs WHERE product_id = ?').run(TEST_PROD_ID);
    db.prepare('DELETE FROM sync_queue WHERE idempotency_key = ?').run(TEST_IDEM_KEY);
    db.prepare('DELETE FROM products WHERE id = ?').run(TEST_PROD_ID);
  }
});
