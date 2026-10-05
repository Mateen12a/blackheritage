const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables without echoing secrets
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5050';
const SECRET = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock_secret_for_suite';

let passed = 0;
let failed = 0;

function ok(title, condition, extra = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${title} ${extra ? '(' + extra + ')' : ''}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${title} ${extra ? '(' + extra + ')' : ''}`);
    failed++;
  }
}

async function run() {
  console.log('Running Paystack payment flow and security tests against ' + BASE + '...');

  // Database isolation guard: refuse to run test against production DB
  const mongoUri = process.env.MONGODB_URI || '';
  if (mongoUri) {
    const dbMatch = mongoUri.match(/\/([^/?]+)(\?|$)/);
    const dbName = dbMatch ? dbMatch[1] : '';
    if (dbName && !dbName.endsWith('_dev') && !dbName.endsWith('_verify')) {
      console.error(`[test guard] Refusing to run tests: database "${dbName}" does not end in _dev or _verify. Live database protected.`);
      process.exit(1);
    }
  }

  // Ensure server is up
  try {
    const health = await fetch(BASE + '/api/events');
    if (!health.ok) throw new Error(`Server returned ${health.status}`);
  } catch (err) {
    console.error(`Cannot connect to ${BASE}. Please make sure the dev server is running.`);
    process.exit(1);
  }

  // Fetch an event to test with
  const eventsRes = await fetch(BASE + '/api/events');
  const events = await eventsRes.json();
  const event = events.find(e => {
    try {
      const tiers = JSON.parse(e.ticketTypes || '[]');
      return tiers.length > 0 && tiers.some(t => t.price > 0);
    } catch {
      return false;
    }
  });

  if (!event) {
    console.error('No suitable event with paid ticket tiers found for testing.');
    process.exit(1);
  }

  const tiers = JSON.parse(event.ticketTypes);
  const paidTier = tiers.find(t => t.price > 0);
  console.log(`Using test event: "${event.title}" (${event._id || event.id}) with tier "${paidTier.name}" @ ₦${paidTier.price / 100 || paidTier.price}`);

  // 1. Signature Check - Valid Signature
  console.log('\n1. Testing Paystack HMAC-SHA512 Signature Verification:');
  const dummyPayload = JSON.stringify({
    event: 'charge.success',
    data: { reference: 'NON_EXISTENT_REF', amount: 500000, status: 'success' }
  });
  const validSig = crypto.createHmac('sha512', SECRET).update(dummyPayload).digest('hex');
  const validRes = await fetch(BASE + '/api/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': validSig },
    body: dummyPayload
  });
  ok('Valid HMAC signature accepted', validRes.status === 200, `status=${validRes.status}`);

  // 2. Signature Check - Invalid Signature Rejected
  const invalidSig = 'bad_deadbeef_signature_' + '0'.repeat(100);
  const invalidRes = await fetch(BASE + '/api/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': invalidSig },
    body: dummyPayload
  });
  ok('Invalid signature rejected with 401', invalidRes.status === 401, `status=${invalidRes.status}`);

  // 3. Initiate a Real Booking (Server-computed amount)
  console.log('\n2. Testing Server-side Amount Calculation & Initiation:');
  const initRes = await fetch(BASE + '/api/bookings/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventId: String(event._id || event.id),
      tierName: paidTier.name,
      quantity: 2,
      name: 'Test QA Attendee',
      email: 'qa@example.com'
    })
  });
  const initData = await initRes.json();
  ok('Booking initiated successfully (201)', initRes.status === 201 && initData.reference, `ref=${initData.reference}`);
  const expectedTotalKobo = initData.totalKobo;
  const testRef = initData.reference;
  const bookingId = initData.bookingId;

  // 4. Tampered Amount Rejected
  console.log('\n3. Testing Tampered Webhook Amount Protection:');
  const tamperedAmount = expectedTotalKobo - 10000; // Underpay by 100 NGN
  const tamperedPayload = JSON.stringify({
    event: 'charge.success',
    data: { reference: testRef, amount: tamperedAmount, status: 'success' }
  });
  const tamperedSig = crypto.createHmac('sha512', SECRET).update(tamperedPayload).digest('hex');
  const tamperedRes = await fetch(BASE + '/api/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': tamperedSig },
    body: tamperedPayload
  });
  ok('Tampered amount rejected with 400', tamperedRes.status === 400, `status=${tamperedRes.status}`);

  // Verify booking is still pending, not fulfilled
  const checkPendingRes = await fetch(BASE + `/api/bookings/${bookingId}/tickets`);
  const checkPendingTickets = await checkPendingRes.json();
  ok('Zero tickets issued on tampered payment', checkPendingTickets.length === 0, `ticket_count=${checkPendingTickets.length}`);

  // 5. Successful Webhook Fulfillment
  console.log('\n4. Testing Legitimate Webhook Fulfillment:');
  const correctPayload = JSON.stringify({
    event: 'charge.success',
    data: {
      id: 998877,
      reference: testRef,
      amount: expectedTotalKobo,
      status: 'success',
      paid_at: new Date().toISOString()
    }
  });
  const correctSig = crypto.createHmac('sha512', SECRET).update(correctPayload).digest('hex');
  const correctRes = await fetch(BASE + '/api/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': correctSig },
    body: correctPayload
  });
  ok('Correct webhook accepted (200)', correctRes.status === 200);

  // Verify tickets are now issued
  const checkTicketsRes = await fetch(BASE + `/api/bookings/${bookingId}/tickets`);
  const tickets = await checkTicketsRes.json();
  ok('Tickets minted upon webhook fulfillment', tickets.length === 2, `tickets=${tickets.length}`);

  // 6. Duplicate Webhook Idempotency
  console.log('\n5. Testing Duplicate Webhook Idempotency:');
  const dupRes = await fetch(BASE + '/api/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': correctSig },
    body: correctPayload
  });
  const dupData = await dupRes.json();
  ok('Duplicate webhook handled idempotently', dupRes.status === 200 && dupData.status === 'already_paid', `resp=${JSON.stringify(dupData)}`);

  const checkDupTicketsRes = await fetch(BASE + `/api/bookings/${bookingId}/tickets`);
  const dupTickets = await checkDupTicketsRes.json();
  ok('Ticket count invariant after duplicate webhook', dupTickets.length === 2, `tickets=${dupTickets.length}`);

  // 7. Abandoned / Failed Payment Handling
  console.log('\n6. Testing Abandoned / Failed Payment Handling:');
  const initFailRes = await fetch(BASE + '/api/bookings/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventId: String(event._id || event.id),
      tierName: paidTier.name,
      quantity: 1,
      name: 'Abandoned Buyer',
      email: 'abandoned@example.com'
    })
  });
  const initFailData = await initFailRes.json();
  const failRef = initFailData.reference;
  const failBookingId = initFailData.bookingId;

  const failPayload = JSON.stringify({
    event: 'charge.failed',
    data: { reference: failRef, status: 'failed' }
  });
  const failSig = crypto.createHmac('sha512', SECRET).update(failPayload).digest('hex');
  const failWebRes = await fetch(BASE + '/api/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': failSig },
    body: failPayload
  });
  ok('Failed/abandoned payment webhook processed', failWebRes.status === 200);

  // Final Summary
  console.log(`\nTest results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    console.error('Some tests failed!');
    process.exit(1);
  }
  console.log('All Paystack payment security, idempotency, and fulfillment tests PASSED!');
}

run().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
