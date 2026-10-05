const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REVIEW_TIMESTAMPS = [0.8, 2.5, 5.0, 7.5, 8.5, 10.5, 12.8, 15.5, 17.5, 20.0, 23.0, 24.5, 27.0];

async function main() {
  console.log('Capturing review stills...');
  const stillsDir = path.resolve('out', 'stills');
  fs.mkdirSync(stillsDir, { recursive: true });

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const page = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  });

  await page.goto('http://localhost:5050/reel?raw=1', { waitUntil: 'networkidle' });

  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  for (const t of REVIEW_TIMESTAMPS) {
    await page.evaluate((time) => {
      if (typeof window.__setReelTime === 'function') {
        window.__setReelTime(time, false);
      }
    }, t);

    // Short delay for React re-render
    await page.waitForTimeout(100);

    const dst = path.join(stillsDir, `still_${t.toFixed(1)}s.png`);
    await page.screenshot({
      path: dst,
      clip: { x: 0, y: 0, width: 1080, height: 1920 },
      type: 'png',
    });
    console.log(`Captured still_${t.toFixed(1)}s.png`);
  }

  await browser.close();
  console.log('All review stills captured successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
