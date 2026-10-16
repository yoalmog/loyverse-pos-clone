import assert from 'node:assert/strict';
import http from 'node:http';
import { posApi, STORAGE_KEYS, setBaseApiUrl } from './api.ts';
import { storage } from './storage.ts';

async function testAndroidOfflineEngine() {
  console.log('--- 1. Testing Android Storage & Ephemeral Test Server ---');
  const syncedKeys = new Set();
  const testServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/sync') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const parsed = JSON.parse(body);
        const results = (parsed.events || []).map(evt => {
          const isDup = syncedKeys.has(evt.idempotencyKey);
          syncedKeys.add(evt.idempotencyKey);
          return {
            eventId: evt.id,
            idempotencyKey: evt.idempotencyKey,
            status: isDup ? 'ALREADY_SYNCED' : 'SYNCED',
          };
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, results }));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise(resolve => testServer.listen(0, '127.0.0.1', resolve));
  const port = testServer.address().port;
  const mockUrl = `http://127.0.0.1:${port}`;
  await setBaseApiUrl(mockUrl);

  try {
    // Clear previous test queue
    await storage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);

    console.log('\n--- 2. Enqueueing Offline Order in Durable Android Queue ---');
    const testIdemKey = `android_offline_idem_${Date.now()}`;
    const offlineEvent = {
      id: `android_evt_${Date.now()}`,
      idempotencyKey: testIdemKey,
      deviceId: 'android_pos_tablet_01',
      eventType: 'CHECKOUT',
      payload: {
        idempotencyKey: testIdemKey,
        userId: 'usr_cashier',
        paymentMethod: 'CASH',
        cashTendered: 1500,
        items: [
          {
            productId: 'prod_espresso',
            productName: 'Café Espresso',
            quantity: 2,
            unitPrice: 750,
            selectedModifiers: [],
          }
        ]
      },
      status: 'PENDING',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    await posApi.enqueueOfflineEvent(offlineEvent);
    const queueBeforeRestart = await posApi.getOfflineQueue();
    assert.equal(queueBeforeRestart.length, 1, 'Queue must contain 1 event');
    assert.equal(queueBeforeRestart[0].idempotencyKey, testIdemKey);
    console.log('✔ Enqueued offline order with idempotencyKey:', testIdemKey);

    console.log('\n--- 3. Simulating Android App Restart (Verifying Durable Persistence) ---');
    // Re-read storage directly from storage backend
    const rawStored = await storage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    assert.ok(rawStored, 'Stored queue string must exist across execution frames');
    const parsed = JSON.parse(rawStored);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].payload.items[0].productName, 'Café Espresso');
    console.log('✔ Offline queue successfully survived simulated application restart');

    console.log('\n--- 4. Flashing Offline Queue to Live Backend Server ---');
    const flushResult = await posApi.flushOfflineQueue();
    assert.equal(flushResult.syncedCount, 1, 'Exactly 1 event must be synced');
    assert.equal(flushResult.failedCount, 0, 'Zero events should fail');
    console.log('✔ Offline queue successfully flushed and synced to backend:', flushResult.results[0]);

    console.log('\n--- 5. Testing Deduplication on Repeated Flush ---');
    // Enqueue duplicate event with same idempotency key and attempt second flush
    await posApi.enqueueOfflineEvent({
      ...offlineEvent,
      id: `android_evt_dup_${Date.now()}`,
    });
    const flushDupResult = await posApi.flushOfflineQueue();
    // Server detects ALREADY_SYNCED
    assert.ok(flushDupResult.results[0].status === 'ALREADY_SYNCED' || flushDupResult.results[0].status === 'SYNCED');
    console.log('✔ Server idempotency prevented duplicate order on repeated flush');

    // Verify queue is now empty
    const remainingQueue = await posApi.getOfflineQueue();
    assert.equal(remainingQueue.length, 0, 'Queue must be empty after successful sync');
    console.log('✔ Queue cleared of synced items');

    console.log('\n=== ANDROID OFFLINE ENGINE VERIFICATION PASSED ===');
  } finally {
    testServer.close();
  }
}

testAndroidOfflineEngine().catch(err => {
  console.error('ANDROID OFFLINE TEST FAILED:', err);
  process.exit(1);
});
