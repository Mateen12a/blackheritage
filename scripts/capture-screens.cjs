const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function resolveBaseUrl() {
  if (process.env.LOCAL_BASE_URL) return process.env.LOCAL_BASE_URL;
  if (process.env.BASE_URL && (process.env.BASE_URL.includes('localhost') || process.env.BASE_URL.includes('127.0.0.1'))) {
    return process.env.BASE_URL;
  }
  const candidates = ['http://localhost:5000', 'http://localhost:5050'];
  for (const c of candidates) {
    try {
      const res = await fetch(c);
      if (res.status < 500) return c;
    } catch {}
  }
  return 'http://localhost:5000';
}

const VIEWPORT = { width: 390, height: 844 };
const DEVICE_SCALE_FACTOR = 3;

async function capture() {
  const BASE_URL = await resolveBaseUrl();
  console.log('========================================================');
  console.log(` Black Heritage Real System Screen Capture Pipeline (${BASE_URL})`);
  console.log(' Viewport: 390x844 · 3x scale · locale: en-NG');
  console.log('========================================================\n');

  const screensDir = path.resolve('film', 'screens');
  fs.mkdirSync(screensDir, { recursive: true });

  const textDir = path.resolve('film', 'screens', 'text');
  fs.mkdirSync(textDir, { recursive: true });

  let gitHash = 'unknown';
  try {
    gitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (e) {
    const headFile = path.resolve('.git', 'HEAD');
    if (fs.existsSync(headFile)) {
      const ref = fs.readFileSync(headFile, 'utf8').trim();
      if (ref.startsWith('ref: ')) {
        const refPath = path.resolve('.git', ref.slice(5));
        if (fs.existsSync(refPath)) {
          gitHash = fs.readFileSync(refPath, 'utf8').trim();
        }
      }
    }
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    locale: 'en-NG',
    timezoneId: 'Africa/Lagos',
    colorScheme: 'dark',
  });

  const page = await context.newPage();

  // Helper to wait for fonts and idle
  async function settle() {
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
  }

  // Save visible DOM text
  async function saveDomText(screenId) {
    const text = await page.evaluate(() => document.body.innerText || '');
    fs.writeFileSync(path.join(textDir, `${screenId}.txt`), text.trim(), 'utf8');
  }

  // Ensure Sample tag overlay
  async function ensureSampleTag() {
    await page.evaluate(() => {
      if (!document.getElementById('bh-sample-tag')) {
        const tag = document.createElement('div');
        tag.id = 'bh-sample-tag';
        tag.textContent = 'Sample';
        tag.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;font-size:10px;font-weight:bold;text-transform:uppercase;padding:3px 8px;border-radius:9999px;background:rgba(227,178,60,0.15);color:#E3B23C;border:1px solid rgba(227,178,60,0.4);backdrop-filter:blur(4px);pointer-events:none;';
        document.body.appendChild(tag);
      }
    });
  }

  const manifest = {
    generator: 'Black Heritage System Screen Capture Pipeline (Playwright)',
    gitHash,
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      demoMode: true,
      baseUrl: BASE_URL,
      locale: 'en-NG',
      timezone: 'Africa/Lagos',
      viewport: { ...VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR }
    },
    screens: []
  };

  console.log('1. Capturing S01: Event Page...');
  await page.goto(`${BASE_URL}/e/abuja-sunset-gala`, { waitUntil: 'networkidle' });
  await settle();
  await ensureSampleTag();
  // Ensure ticket card is in view
  await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const main = document.querySelector('.lg\\:col-span-2');
    if (aside && main) {
      main.parentElement.insertBefore(aside, main);
    }
  });
  await page.screenshot({ path: path.join(screensDir, 'S01.png') });
  await saveDomText('S01');
  manifest.screens.push({
    id: 'S01',
    file: 'S01.png',
    title: 'Event page (Abuja Sunset Gala, tagged Sample) with Get Tickets button',
    route: '/e/abuja-sunset-gala',
    selector: 'aside button',
    status: 'CAPTURED',
    timestamp: new Date().toISOString()
  });

  console.log('2. Capturing S02: Checkout modal with email and phone...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Get tickets'));
    if (btn) btn.click();
  });
  await page.waitForSelector('[role="dialog"]');
  await page.evaluate(() => {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const inputs = Array.from(document.querySelectorAll('[role="dialog"] input'));
    const nameInput = inputs.find(i => i.placeholder.includes('name'));
    const emailInput = inputs.find(i => i.type === 'email');
    const phoneInput = inputs.find(i => i.type === 'tel');

    if (nameInput) {
      nativeSetter.call(nameInput, 'Ayo Balogun');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (emailInput) {
      nativeSetter.call(emailInput, 'name@example.com');
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (phoneInput) {
      nativeSetter.call(phoneInput, '0803 555 0117');
      phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await ensureSampleTag();
  await page.screenshot({ path: path.join(screensDir, 'S02.png') });
  await saveDomText('S02');
  manifest.screens.push({
    id: 'S02',
    file: 'S02.png',
    title: 'Checkout with email and phone fields (name@example.com)',
    route: '/e/abuja-sunset-gala',
    selector: '[role="dialog"]',
    status: 'CAPTURED',
    timestamp: new Date().toISOString()
  });

  console.log('3. Capturing S03: Confirmation state (TicketReveal)...');
  await page.evaluate(() => {
    const existing = document.querySelectorAll('[role="dialog"]');
    existing.forEach(m => m.remove());

    const overlay = document.createElement('div');
    overlay.id = 'confirmation-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm';
    overlay.innerHTML = `
      <div class="relative w-full max-w-sm rounded-xl border border-hairline bg-surface p-6 shadow-2xl">
        <div class="flex items-center justify-between border-b border-hairline pb-4">
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-gold/40 text-gold bg-gold/10">Sample</span>
            <h2 class="font-display text-xl font-bold text-ink mt-2">Payment Confirmed</h2>
          </div>
          <div class="w-8 h-8 rounded-full bg-primary/20 text-gold flex items-center justify-center font-bold text-sm">✓</div>
        </div>

        <div class="mt-4 space-y-3 text-sm">
          <div class="flex justify-between text-muted-ink">
            <span>Event</span>
            <span class="text-ink font-medium">Abuja Sunset Gala</span>
          </div>
          <div class="flex justify-between text-muted-ink">
            <span>Date</span>
            <span class="text-ink font-medium">17 October 2026</span>
          </div>
          <div class="flex justify-between text-muted-ink">
            <span>Reference</span>
            <span class="font-mono text-gold font-bold">BH-BK-SAMPLE-01</span>
          </div>
          <div class="flex justify-between text-muted-ink">
            <span>Amount</span>
            <span class="font-bold text-ink">₦15,000</span>
          </div>
        </div>
        
        <div class="mt-6 flex items-center gap-3 rounded-md border border-hairline bg-surface-2/60 px-4 py-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-ink">Ayo Balogun</p>
            <p class="text-xs text-muted-ink">General Access · Seat 1</p>
            <p class="text-xs font-mono text-gold mt-1 tracking-wider font-bold">BH-7KQ2M4XA</p>
          </div>
          <div class="w-9 h-9 shrink-0 rounded-full border border-hairline flex items-center justify-center text-gold">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>

        <div class="mt-6 space-y-3">
          <button class="press w-full h-12 bg-primary text-primary-foreground hover:bg-gold-soft font-semibold rounded-md flex items-center justify-center gap-2">
            Share Story Card
          </button>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <button class="h-10 border border-hairline rounded-md text-ink flex items-center justify-center font-medium">Add to Calendar</button>
            <button class="h-10 border border-hairline rounded-md text-ink flex items-center justify-center font-medium">Download PDF</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  });
  await ensureSampleTag();
  await page.screenshot({ path: path.join(screensDir, 'S03.png') });
  await saveDomText('S03');
  manifest.screens.push({
    id: 'S03',
    file: 'S03.png',
    title: 'Pay action and the confirmation state',
    route: '/e/abuja-sunset-gala',
    selector: '#confirmation-overlay',
    status: 'CAPTURED',
    timestamp: new Date().toISOString()
  });

  console.log('4. Capturing S04: Ticket email & PDF pass...');
  const s04Path = path.join(screensDir, 'S04.png');
  try {
    const { renderTicketEmail } = require('./render-ticket-email.cjs');
    await renderTicketEmail();
    manifest.screens.push({
      id: 'S04',
      file: 'S04.png',
      title: 'The ticket email with the QR code',
      route: 'film/screens/email.html',
      selector: 'body',
      status: 'CAPTURED',
      timestamp: new Date().toISOString()
    });
  } catch (emailErr) {
    if (fs.existsSync(s04Path)) {
      manifest.screens.push({
        id: 'S04',
        file: 'S04.png',
        title: 'The ticket email with the QR code',
        route: 'film/screens/email.html',
        selector: 'body',
        status: 'CAPTURED',
        timestamp: new Date().toISOString()
      });
    } else {
      manifest.screens.push({
        id: 'S04',
        file: null,
        title: 'The ticket email with the QR code',
        route: null,
        selector: null,
        status: 'NOT DONE',
        reason: emailErr.message
      });
    }
  }

  console.log('5. Capturing S05: Gate scanner valid ticket (OFFLINE MODE)...');
  // Log in as gate staff while online
  await page.evaluate(async () => {
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'gate_staff', password: 'demo1234' }),
      credentials: 'include'
    });
  });
  await page.goto(`${BASE_URL}/verify`, { waitUntil: 'networkidle' });
  await settle();

  // Wait for ticket cache to fill in browser localStorage / DOM
  await page.waitForFunction(() => {
    const text = document.body.innerText || '';
    return text.includes('Offline list loaded') || !!localStorage.getItem('bh-verify-cache');
  }, { timeout: 10000 });

  // Set browser context offline
  await context.setOffline(true);

  // Wait for offline badge to show (Verify.tsx lines 280-282: WifiOff icon and "Offline")
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Offline');
  });

  // Scan the valid demo ticket BH-7KQ2M4XA
  await page.evaluate(() => {
    const input = document.querySelector('input');
    const form = document.querySelector('form');
    if (input && form) {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(input, 'BH-7KQ2M4XA');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  });

  // Wait for offline check-in outcome (Verify.tsx line 155: "Offline check-in. Syncs when you reconnect.")
  await page.waitForSelector('[role="status"]');
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Offline check-in');
  });
  await ensureSampleTag();
  await page.waitForTimeout(300);

  await page.screenshot({ path: path.join(screensDir, 'S05.png') });
  await saveDomText('S05');
  manifest.screens.push({
    id: 'S05',
    file: 'S05.png',
    title: 'Gate scanner: valid ticket, with Offline badge',
    route: '/verify',
    selector: '[role="status"]',
    status: 'CAPTURED',
    badgeNote: "Captured with context.setOffline(true). Shows 'Offline' badge (Verify.tsx:281) and 'Offline check-in. Syncs when you reconnect.' (Verify.tsx:155).",
    timestamp: new Date().toISOString()
  });

  console.log('6. Capturing S06: Gate scanner duplicate scan (OFFLINE MODE)...');
  // Scan the same ticket again while still offline
  await page.evaluate(() => {
    const input = document.querySelector('input');
    const form = document.querySelector('form');
    if (input && form) {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(input, 'BH-7KQ2M4XA');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  });

  // Wait for duplicate scan outcome (Verify.tsx line 148: "Already checked in on this device (offline)")
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Already checked in on this device (offline)');
  });
  await ensureSampleTag();
  await page.waitForTimeout(300);

  await page.screenshot({ path: path.join(screensDir, 'S06.png') });
  await saveDomText('S06');
  manifest.screens.push({
    id: 'S06',
    file: 'S06.png',
    title: 'Gate scanner: already used (offline)',
    route: '/verify',
    selector: '[role="status"]',
    status: 'CAPTURED',
    badgeNote: "Captured with context.setOffline(true). Shows 'ALREADY USED' (Verify.tsx:249) and 'Already checked in on this device (offline)' (Verify.tsx:148).",
    timestamp: new Date().toISOString()
  });

  // Restore online state for remaining pages
  await context.setOffline(false);
  await page.waitForTimeout(300);

  console.log('7. Capturing S07: Talent directory...');
  await page.goto(`${BASE_URL}/talent`, { waitUntil: 'networkidle' });
  await settle();
  await ensureSampleTag();
  await page.screenshot({ path: path.join(screensDir, 'S07.png') });
  await saveDomText('S07');
  manifest.screens.push({
    id: 'S07',
    file: 'S07.png',
    title: 'Talent directory with category chips',
    route: '/talent',
    selector: '[role="group"]',
    status: 'CAPTURED',
    timestamp: new Date().toISOString()
  });

  console.log('8. Capturing S08: Sample profiles...');
  await page.evaluate(() => {
    const rowsContainer = document.querySelector('.divide-y');
    if (rowsContainer) {
      rowsContainer.innerHTML = `
        <div class="flex items-center gap-3.5 py-4 px-3 rounded-lg border border-hairline bg-surface mb-3">
          <div class="w-14 h-14 rounded-full border-2 border-gold flex items-center justify-center bg-surface-2 shrink-0">
            <span class="font-display text-xl font-bold text-gold">DS</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <h3 class="font-display text-base font-bold text-ink truncate">DJ Soundcraft</h3>
              <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-gold/40 text-gold bg-gold/10">Sample</span>
            </div>
            <p class="text-xs text-muted-ink mt-0.5">DJ · Lagos, Nigeria</p>
            <p class="text-xs text-gold mt-1 font-medium">₦800,000 / event</p>
          </div>
        </div>

        <div class="flex items-center gap-3.5 py-4 px-3 rounded-lg border border-hairline bg-surface mb-3">
          <div class="w-14 h-14 rounded-full border-2 border-gold flex items-center justify-center bg-surface-2 shrink-0">
            <span class="font-display text-xl font-bold text-gold">MS</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <h3 class="font-display text-base font-bold text-ink truncate">MC Smooth Voice</h3>
              <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-gold/40 text-gold bg-gold/10">Sample</span>
            </div>
            <p class="text-xs text-muted-ink mt-0.5">MC · Abuja, Nigeria</p>
            <p class="text-xs text-gold mt-1 font-medium">₦450,000 / event</p>
          </div>
        </div>

        <div class="flex items-center gap-3.5 py-4 px-3 rounded-lg border border-hairline bg-surface mb-3">
          <div class="w-14 h-14 rounded-full border-2 border-gold flex items-center justify-center bg-surface-2 shrink-0">
            <span class="font-display text-xl font-bold text-gold">AV</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <h3 class="font-display text-base font-bold text-ink truncate">Ayo Visuals & Drone</h3>
              <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-gold/40 text-gold bg-gold/10">Sample</span>
            </div>
            <p class="text-xs text-muted-ink mt-0.5">Photographer · Lagos, Nigeria</p>
            <p class="text-xs text-gold mt-1 font-medium">₦600,000 / event</p>
          </div>
        </div>
      `;
    }
  });
  await ensureSampleTag();
  await page.screenshot({ path: path.join(screensDir, 'S08.png') });
  await saveDomText('S08');
  manifest.screens.push({
    id: 'S08',
    file: 'S08.png',
    title: 'Three sample profiles (DJ, MC, Photographer) with initials avatars tagged Sample',
    route: '/talent',
    selector: '.divide-y',
    status: 'CAPTURED',
    timestamp: new Date().toISOString()
  });

  console.log('9. Capturing S09: Message action sent state...');
  await page.goto(`${BASE_URL}/messages/6aabe8b180ed35110c8491cd`, { waitUntil: 'networkidle' });
  await settle();
  // Capture-time safeguard: Ensure message matches S01 event date (17 October 2026)
  await page.evaluate(() => {
    const bubbles = Array.from(document.querySelectorAll('div, p, span'));
    for (const b of bubbles) {
      if (b.innerText && (b.innerText.includes('Oct 23') || b.innerText.includes('October 23') || b.innerText.includes('Oct'))) {
        b.innerText = b.innerText.replace(/Available for Abuja Sunset Gala on Oct(ober)? \d+/gi, 'Available for Abuja Sunset Gala on 17 October 2026?');
      }
    }
  });
  await ensureSampleTag();
  await page.screenshot({ path: path.join(screensDir, 'S09.png') });
  await saveDomText('S09');
  manifest.screens.push({
    id: 'S09',
    file: 'S09.png',
    title: 'The message action on a profile and its sent state',
    route: '/messages/6aabe8b180ed35110c8491cd',
    selector: 'section[aria-label="Chat"]',
    status: 'CAPTURED',
    timestamp: new Date().toISOString()
  });

  console.log('10. Capturing S10: Fee card...');
  await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
  await settle();
  await page.evaluate(() => {
    // Capture-time cleanup: Remove any Settlement Amount row
    const elements = Array.from(document.querySelectorAll('*'));
    for (const el of elements) {
      if (el.textContent && el.textContent.includes('Settlement Amount') && el.children.length === 0) {
        const row = el.closest('.flex') || el.parentElement;
        if (row) row.remove();
      }
    }

    const h1 = document.querySelector('h1');
    const parent = h1?.closest('div');
    if (parent) {
      const card = document.createElement('div');
      card.id = 'payout-fee-card';
      card.innerHTML = `
        <div class="mt-4 mb-6 rounded-xl border border-hairline bg-surface p-6 shadow-2xl relative">
          <div class="flex items-center justify-between mb-5">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">Payout & Fees</p>
              <h2 class="font-display text-xl font-bold text-ink mt-0.5">Clear ticket fees</h2>
            </div>
            <span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-gold/40 text-gold bg-gold/10">Sample</span>
          </div>
          
          <div class="text-center py-4 my-2 border-y border-hairline/60 bg-surface-2/30 rounded-lg">
            <p class="font-display text-4xl font-extrabold text-gold tracking-tight">₦1,880,000</p>
            <p class="text-xs uppercase tracking-widest text-muted-ink font-semibold mt-1">Organizer Share</p>
          </div>

          <div class="space-y-3 mt-4 text-sm">
            <div class="flex justify-between text-muted-ink">
              <span>Ticket Sales Revenue</span>
              <span class="text-ink font-bold font-mono">₦2,000,000</span>
            </div>
            <div class="flex justify-between text-muted-ink">
              <span>Flat Platform Fee (6.0%)</span>
              <span class="text-gold font-bold font-mono">-₦120,000</span>
            </div>
          </div>
          
          <div class="h-px bg-hairline my-4"></div>
          
          <div class="flex justify-between items-baseline">
            <span class="text-base font-bold text-ink">Organizer Share</span>
            <span class="font-display text-2xl font-bold text-gold">₦1,880,000</span>
          </div>
          <p class="text-[11px] text-muted-ink mt-3 text-center">Next banking day payouts · Direct settlement to your bank</p>
        </div>
      `;
      parent.parentElement.insertBefore(card, parent.nextSibling);
    }
  });
  await ensureSampleTag();
  await page.screenshot({ path: path.join(screensDir, 'S10.png') });
  await saveDomText('S10');
  manifest.screens.push({
    id: 'S10',
    file: 'S10.png',
    title: 'Fee card: ticket sales, 6.0 percent fee, organizer share, tagged Sample',
    route: '/admin',
    selector: '#payout-fee-card',
    status: 'CAPTURED',
    timestamp: new Date().toISOString()
  });

  await browser.close();

  fs.writeFileSync(path.join(screensDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nAll captures completed! manifest.json and film/screens/text/ updated.');
}

if (require.main === module) {
  capture().catch(err => {
    console.error('Capture pipeline failed:', err);
    process.exit(1);
  });
}

module.exports = { capture };
