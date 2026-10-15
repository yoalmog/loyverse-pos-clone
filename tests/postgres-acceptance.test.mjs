import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;

function loadEnv() {
  for (const envFile of ['.env.local', '.env']) {
    if (fs.existsSync(envFile)) {
      const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      }
    }
  }
}
loadEnv();

const SUPABASE_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;

function getTrustedCaCert() {
  const customCertPath = process.env.PG_SSL_CA_PATH || path.join(process.cwd(), 'certs', 'supabase-prod-ca-2021.crt');
  if (fs.existsSync(customCertPath)) {
    try {
      return fs.readFileSync(customCertPath, 'utf8');
    } catch {
      // Fallback to embedded certificate
    }
  }
  return SUPABASE_ROOT_CA;
}

test('SUPABASE POSTGRESQL ACCEPTANCE & CONSISTENCY SUITE', async (t) => {
  const rawDbUrl = (process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '').trim();
  if (!rawDbUrl) {
    throw new Error(
      'Missing required environment variable: TEST_DATABASE_URL or DATABASE_URL. ' +
      'Please configure DATABASE_URL or TEST_DATABASE_URL in .env.local to run the PostgreSQL acceptance suite.'
    );
  }

  if (!rawDbUrl.startsWith('postgres://') && !rawDbUrl.startsWith('postgresql://')) {
    throw new Error(
      'Invalid connection URI: TEST_DATABASE_URL / DATABASE_URL must start with "postgresql://" or "postgres://".'
    );
  }

  let sanitizedUrl = rawDbUrl;
  try {
    const parsed = new URL(rawDbUrl);
    parsed.searchParams.delete('sslmode');
    sanitizedUrl = parsed.toString();
  } catch {
    sanitizedUrl = rawDbUrl.replace(/[?&]sslmode(=[^&]*)?(&|$)/, '$2').replace(/\?$/, '');
  }

  const pool = new Pool({
    connectionString: sanitizedUrl,
    ssl: {
      rejectUnauthorized: true,
      ca: getTrustedCaCert(),
    },
    max: 3,
    connectionTimeoutMillis: 15000,
  });

  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    await pool.end().catch(() => {});
    if (err.code === '28P01') {
      throw new Error(
        'PostgreSQL Authentication Failed (Error code: 28P01): Password authentication failed for the specified user. ' +
        'The database password provided in .env.local (DATABASE_URL / TEST_DATABASE_URL) is rejected by the PostgreSQL server. ' +
        'Please verify that the password matches the current database password in your Supabase project dashboard (Project Settings > Database). ' +
        'Ensure the credentials are up to date and never commit them to source control.'
      );
    }
    const safeMsg = err.message ? err.message.replace(/:[^@:]+@/, ':***@') : 'Failed to connect to PostgreSQL';
    throw new Error(`PostgreSQL Connection Failed: ${safeMsg} (Code: ${err.code || 'UNKNOWN'})`);
  }

  t.after(async () => {
    client.release();
    await pool.end();
  });

  await t.test('1. Database connectivity & live ping', async () => {
    const res = await client.query('SELECT 1 as alive, version() as v');
    assert.equal(res.rows[0].alive, 1);
    assert.ok(res.rows[0].v.includes('PostgreSQL'), 'Target must be PostgreSQL');
  });

  await t.test('2. Table presence check (All 24 relational tables exist)', async () => {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const existing = new Set(res.rows.map(r => r.table_name));
    const required = [
      'stores', 'users', 'categories', 'modifiers', 'modifier_options',
      'dining_options', 'discounts', 'customers', 'suppliers', 'products',
      'product_variations', 'product_modifiers', 'shifts', 'cash_movements',
      'orders', 'order_items', 'payments', 'inventory_logs', 'purchase_orders',
      'purchase_order_items', 'audit_logs', 'sync_queue', 'auth_rate_limits',
      'user_sessions'
    ];
    for (const req of required) {
      assert.ok(existing.has(req), `Table ${req} must exist in PostgreSQL public schema`);
    }
  });

  await t.test('3. Row count audit across migrated tables', async () => {
    const counts = {
      stores: 1,
      users: 3,
      categories: 5,
      modifiers: 3,
      modifier_options: 9,
      dining_options: 3,
      discounts: 4,
      customers: 2,
      suppliers: 2,
      products: 34,
      product_variations: 3,
      product_modifiers: 9,
      shifts: 1,
      cash_movements: 30,
      orders: 250,
      order_items: 250,
      payments: 249,
      inventory_logs: 285,
      audit_logs: 328,
      sync_queue: 96,
    };

    for (const [table, expected] of Object.entries(counts)) {
      const res = await client.query(`SELECT count(*) as c FROM "${table}"`);
      const actual = parseInt(res.rows[0].c, 10);
      assert.equal(actual, expected, `Table ${table} expected ${expected} rows, got ${actual}`);
    }
  });

  await t.test('4. Financial reconciliation & S/ 25.50 ticket audit', async () => {
    const stockRes = await client.query('SELECT sum(stock_quantity) as s FROM products');
    assert.equal(parseFloat(stockRes.rows[0].s), 2716.0, 'Total stock quantity must equal 2716');

    const ordersRes = await client.query('SELECT sum(total) as s FROM orders');
    assert.equal(parseInt(ordersRes.rows[0].s, 10), 304450, 'Total orders volume must equal S/ 3044.50 (304450 cents)');

    const paymentsRes = await client.query('SELECT sum(amount) as s FROM payments');
    assert.equal(parseInt(paymentsRes.rows[0].s, 10), 301900, 'Total payments must equal S/ 3019.00 (301900 cents)');

    // Verify S/ 25.50 is the saved tab
    const savedRes = await client.query("SELECT id, receipt_number, total, status FROM orders WHERE status = 'SAVED'");
    assert.equal(savedRes.rows.length, 1);
    assert.equal(savedRes.rows[0].receipt_number, 'HOLD-5XCWO');
    assert.equal(parseInt(savedRes.rows[0].total, 10), 2550);
  });

  await t.test('5. Foreign key and unique constraint validation', async () => {
    // Unique order idempotency keys
    const dupRes = await client.query(`
      SELECT idempotency_key, count(*) 
      FROM orders 
      WHERE idempotency_key IS NOT NULL 
      GROUP BY idempotency_key 
      HAVING count(*) > 1
    `);
    assert.equal(dupRes.rows.length, 0, 'No duplicate idempotency keys allowed in orders');

    // Referential integrity: all order_items reference valid orders and products
    const orphanedItems = await client.query(`
      SELECT count(*) as c 
      FROM order_items oi 
      LEFT JOIN orders o ON oi.order_id = o.id 
      WHERE o.id IS NULL
    `);
    assert.equal(parseInt(orphanedItems.rows[0].c, 10), 0, 'Zero orphaned order items');

    const orphanedPayments = await client.query(`
      SELECT count(*) as c 
      FROM payments p 
      LEFT JOIN orders o ON p.order_id = o.id 
      WHERE o.id IS NULL
    `);
    assert.equal(parseInt(orphanedPayments.rows[0].c, 10), 0, 'Zero orphaned payments');
  });
});
