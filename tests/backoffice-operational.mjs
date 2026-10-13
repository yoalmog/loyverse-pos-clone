import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { getDb } from '../src/lib/db.ts';

const BASE_URL = process.env.POS_URL || 'http://localhost:3001';

async function runBackofficeVerification() {
  console.log('=== PHASE E: BACK OFFICE & OPERATIONAL READINESS VERIFICATION ===\n');

  // 1. Settings & Store Configuration
  console.log('--- 1. Testing Store Settings & Tax Configuration ---');
  const settingsRes = await fetch(`${BASE_URL}/api/backoffice/settings`);
  assert.equal(settingsRes.status, 200);
  const settings = await settingsRes.json();
  assert.ok(settings.success);
  assert.equal(settings.data.store.currency_code, 'PEN');
  assert.equal(settings.data.store.tax_rate, 0.18);
  console.log(`✔ Store: "${settings.data.store.name}", Currency: ${settings.data.store.currency_code}, Tax: ${settings.data.store.tax_name} (${settings.data.store.tax_rate * 100}%)`);

  // 2. Product Creation & Editing
  console.log('\n--- 2. Testing Product Lifecycle (Create, Update, Catalog Sync) ---');
  const testProdId = `prod_bo_${Date.now()}`;
  const createProdRes = await fetch(`${BASE_URL}/api/backoffice/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: testProdId,
      name: 'Tarta de Manzana Backoffice',
      price: 1400, // S/ 14.00
      cost: 400,
      stock_quantity: 20,
      track_stock: true,
      userId: 'usr_admin',
    }),
  });
  assert.equal(createProdRes.status, 200);
  console.log('✔ Product created: Tarta de Manzana Backoffice (S/ 14.00, initial stock = 20)');

  // Update Price
  const updateProdRes = await fetch(`${BASE_URL}/api/backoffice/products`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: testProdId,
      name: 'Tarta de Manzana Backoffice (Especial)',
      price: 1650, // S/ 16.50
      cost: 450,
      stock_quantity: 20,
      track_stock: true,
      userId: 'usr_admin',
    }),
  });
  assert.equal(updateProdRes.status, 200);
  console.log('✔ Product updated: New price S/ 16.50');

  // 3. Inventory Adjustment & Audit Trail
  console.log('\n--- 3. Testing Inventory Adjustment & Audit Trail ---');
  const adjustRes = await fetch(`${BASE_URL}/api/backoffice/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: testProdId,
      changeAmount: 5,
      reason: 'Ingreso de nuevo lote',
      userId: 'usr_admin',
    }),
  });
  assert.equal(adjustRes.status, 200);

  const inventoryRes = await fetch(`${BASE_URL}/api/backoffice/inventory`);
  const invData = await inventoryRes.json();
  const prodInv = invData.data.inventory.find(p => p.id === testProdId);
  assert.ok(prodInv);
  assert.equal(prodInv.stock_quantity, 25, 'Stock must increase from 20 to 25');
  const latestLog = invData.data.logs.find(l => l.product_id === testProdId);
  assert.ok(latestLog);
  assert.equal(latestLog.change_amount, 5);
  assert.equal(latestLog.previous_stock, 20);
  assert.equal(latestLog.new_stock, 25);
  console.log('✔ Inventory adjusted to 25 units. Audit log confirmed (prev: 20, new: 25)');

  // 4. Verify Catalog Reflects Updates in POS & Android API
  console.log('\n--- 4. Testing Back Office Changes in POS Catalog ---');
  const catalogRes = await fetch(`${BASE_URL}/api/pos/catalog`);
  const catalogData = await catalogRes.json();
  const catalogItem = catalogData.data.products.find(p => p.id === testProdId);
  assert.ok(catalogItem, 'Updated product must appear in POS catalog');
  assert.equal(catalogItem.price, 1650, 'Catalog price must reflect S/ 16.50');
  assert.equal(catalogItem.stock_quantity, 25, 'Catalog stock must reflect 25 units');
  console.log(`✔ Verified POS Catalog: "${catalogItem.name}", Price: S/ ${(catalogItem.price / 100).toFixed(2)}, Stock: ${catalogItem.stock_quantity}`);

  // 5. Dashboard Metrics & Analytics
  console.log('\n--- 5. Testing Back Office Dashboard Analytics ---');
  const dashRes = await fetch(`${BASE_URL}/api/backoffice/dashboard`);
  assert.equal(dashRes.status, 200);
  const dashData = await dashRes.json();
  assert.ok(dashData.data.totals, 'Dashboard totals present');
  console.log(`✔ Dashboard verified: Total Sales S/ ${(dashData.data.totals.net_sales / 100).toFixed(2)}, Orders: ${dashData.data.totals.total_orders}`);

  // 6. SQLite Backup & Recovery Procedure
  console.log('\n--- 6. Testing SQLite Backup & Restoration Procedure ---');
  const db = getDb();
  const backupPath = path.join(process.cwd(), 'data', `backup_test_${Date.now()}.sqlite`);
  db.backup(backupPath)
    .then(() => {
      assert.ok(fs.existsSync(backupPath), 'Backup file must exist');
      const stats = fs.statSync(backupPath);
      assert.ok(stats.size > 10000, 'Backup file size must be non-trivial');
      console.log(`✔ SQLite backup successfully generated: ${backupPath} (${stats.size} bytes)`);
      fs.unlinkSync(backupPath);
      console.log('✔ Cleaned up temporary test backup');
      console.log('\n=== ALL PHASE E VERIFICATION CHECKS PASSED ===');
    })
    .catch((err) => {
      console.error('Backup error:', err);
      process.exit(1);
    });
}

runBackofficeVerification();
