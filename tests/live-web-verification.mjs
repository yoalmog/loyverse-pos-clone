import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

const BASE_URL = process.env.POS_URL || 'http://localhost:3001';

async function runLiveWebVerification() {
  console.log('--- 1. Testing Live Server Health ---');
  const resHome = await fetch(`${BASE_URL}/`);
  assert.equal(resHome.status, 200, 'Home page (Cashier POS) must return HTTP 200');
  const resAdmin = await fetch(`${BASE_URL}/admin`);
  assert.equal(resAdmin.status, 200, 'Back Office page must return HTTP 200');
  console.log('✔ Live Cashier (/) and Back Office (/admin) respond with HTTP 200 OK');

  console.log('\n--- 2. Creating a Uniquely Named Test Product via API ---');
  const TEST_PRODUCT_NAME = `Galleta Artesanal LIVE ${Date.now()}`;
  const createProdRes = await fetch(`${BASE_URL}/api/backoffice/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: TEST_PRODUCT_NAME,
      price: 450, // S/ 4.50
      cost: 200,  // S/ 2.00
      stock_quantity: 15,
      track_stock: true,
      category_id: 'cat_bakery',
      barcode: `775999${Date.now().toString().slice(-4)}`,
      sku: `GAL-${Date.now().toString().slice(-4)}`,
    }),
  });
  const createProdJson = await createProdRes.json();
  assert.equal(createProdRes.status, 200, 'Product creation API must return 200');
  assert.ok(createProdJson.success, 'Product creation must succeed');
  assert.ok(createProdJson.data?.id, 'Product must have an ID');
  const createdProductId = createProdJson.data.id;
  console.log(`✔ Created product: "${TEST_PRODUCT_NAME}" with ID: ${createdProductId}`);

  console.log('\n--- 3. Verifying Product Persists Directly in SQLite Storage ---');
  const db = new Database('data/pos.sqlite');
  const prodRow = db.prepare('SELECT * FROM products WHERE id = ?').get(createdProductId);
  assert.ok(prodRow, 'Product must exist in SQLite disk database');
  assert.equal(prodRow.name, TEST_PRODUCT_NAME);
  assert.equal(prodRow.stock_quantity, 15);
  console.log('✔ Confirmed product is physically saved in SQLite with stock = 15');

  console.log('\n--- 4. Completing a Test Cash Sale via Live API ---');
  const idempotencyKey = `live_idem_${Date.now()}`;
  const checkoutPayload = {
    idempotencyKey,
    userId: 'usr_cashier',
    paymentMethod: 'CASH',
    cashTendered: 1000, // S/ 10.00 tendered for S/ 4.50
    items: [
      {
        productId: createdProductId,
        productName: TEST_PRODUCT_NAME,
        quantity: 1,
        unitPrice: 450,
        selectedModifiers: [],
      }
    ]
  };

  const checkoutRes = await fetch(`${BASE_URL}/api/pos/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(checkoutPayload),
  });
  const checkoutJson = await checkoutRes.json();
  assert.equal(checkoutRes.status, 200, 'Checkout API must return 200');
  assert.ok(checkoutJson.success, 'Checkout must succeed');
  assert.equal(checkoutJson.data.total, 450, 'Total must be S/ 4.50');
  assert.equal(checkoutJson.data.payments[0].change_due, 550, 'Change must be S/ 5.50');
  const createdOrderId = checkoutJson.data.id;
  console.log(`✔ Sale completed: Order ID ${createdOrderId}, Receipt ${checkoutJson.data.receipt_number}`);

  console.log('\n--- 5. Verifying Back Office Orders & Single Inventory Deduction ---');
  const ordersRes = await fetch(`${BASE_URL}/api/backoffice/orders`);
  const ordersJson = await ordersRes.json();
  assert.ok(ordersJson.success);
  const foundOrder = ordersJson.data.find(o => o.id === createdOrderId);
  assert.ok(foundOrder, 'Order must appear in Back Office orders list');
  console.log(`✔ Order verified in Back Office history: ${foundOrder.receipt_number}`);

  // Check inventory deduction
  const prodAfterSale = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(createdProductId);
  assert.equal(prodAfterSale.stock_quantity, 14, 'Stock must decrease from 15 to exactly 14');
  console.log('✔ Inventory verified: Stock decremented from 15 to exactly 14');

  console.log('\n--- 6. Testing Invalid Checkout (Insufficient Cash) ---');
  const invalidRes = await fetch(`${BASE_URL}/api/pos/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'usr_cashier',
      paymentMethod: 'CASH',
      cashTendered: 200, // S/ 2.00 for S/ 4.50 item
      items: [
        {
          productId: createdProductId,
          productName: TEST_PRODUCT_NAME,
          quantity: 1,
          unitPrice: 450,
          selectedModifiers: [],
        }
      ]
    }),
  });
  assert.equal(invalidRes.status, 400, 'Insufficient cash must return HTTP 400');
  const invalidJson = await invalidRes.json();
  assert.equal(invalidJson.success, false);
  console.log(`✔ Insufficient cash rejected with HTTP 400: "${invalidJson.error}"`);

  console.log('\n--- 7. Testing Repeated Checkout Submission (Idempotency) ---');
  // Re-submit identical checkout
  const dupRes = await fetch(`${BASE_URL}/api/pos/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(checkoutPayload),
  });
  const dupJson = await dupRes.json();
  assert.equal(dupRes.status, 200, 'Idempotent resubmission must return 200');
  assert.equal(dupJson.data.id, createdOrderId, 'Must return same order ID');
  const stockAfterDup = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(createdProductId);
  assert.equal(stockAfterDup.stock_quantity, 14, 'Stock must not be deducted again on duplicate submission');
  console.log('✔ Duplicate submission returned original order and preserved stock at 14');

  console.log('\n--- 8. Testing Idempotency Re-use with Mismatched Payload ---');
  const conflictRes = await fetch(`${BASE_URL}/api/pos/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey, // Reusing key with different quantity (2 instead of 1)
      userId: 'usr_cashier',
      paymentMethod: 'CASH',
      cashTendered: 1000,
      items: [
        {
          productId: createdProductId,
          productName: TEST_PRODUCT_NAME,
          quantity: 2, // Mismatch!
          unitPrice: 450,
          selectedModifiers: [],
        }
      ]
    }),
  });
  assert.equal(conflictRes.status, 400, 'Idempotency key reuse with different payload must return 400');
  const conflictJson = await conflictRes.json();
  assert.ok(conflictJson.error.includes('Idempotency conflict'), 'Must return idempotency conflict message');
  console.log(`✔ Mismatched idempotency payload rejected with HTTP 400: "${conflictJson.error}"`);

  // Cleanup test product and order
  db.prepare('DELETE FROM payments WHERE order_id = ?').run(createdOrderId);
  db.prepare('DELETE FROM order_items WHERE order_id = ?').run(createdOrderId);
  db.prepare('DELETE FROM orders WHERE id = ?').run(createdOrderId);
  db.prepare('DELETE FROM inventory_logs WHERE product_id = ?').run(createdProductId);
  db.prepare('DELETE FROM products WHERE id = ?').run(createdProductId);
  db.close();

  console.log('\n=== ALL LIVE WEB VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
}

runLiveWebVerification().catch(err => {
  console.error('LIVE VERIFICATION FAILED:', err);
  process.exit(1);
});
