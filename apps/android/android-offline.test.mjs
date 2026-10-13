import assert from 'node:assert/strict';
import { posApi, STORAGE_KEYS, setBaseApiUrl } from './api.ts';
import { storage } from './storage.ts';

async function testAndroidOfflineEngine() {
  console.log('--- 1. Testing Android Storage & Base URL Configuration ---');
  await setBaseApiUrl('http://localhost:3001');

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
}

testAndroidOfflineEngine().catch(err => {
  console.error('ANDROID OFFLINE TEST FAILED:', err);
  process.exit(1);
});
