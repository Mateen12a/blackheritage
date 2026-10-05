const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Launching browser with Chrome channel...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const page = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  });

  console.log('Navigating to http://localhost:5050/reel?raw=1 ...');
  await page.goto('http://localhost:5050/reel?raw=1', { waitUntil: 'networkidle' });

  // Await document.fonts.ready
  await page.evaluate(async () => {
    await document.fonts.ready;
    console.log('Fonts ready! Loaded font faces count:', document.fonts.size);
    const fonts = [];
    document.fonts.forEach(f => fonts.push(`${f.family} ${f.weight} ${f.style} (${f.status})`));
    return fonts;
  });

  const loadedFonts = await page.evaluate(() => {
    const list = [];
    document.fonts.forEach(f => list.push({
      family: f.family,
      weight: f.weight,
      style: f.style,
      status: f.status
    }));
    return list;
  });

  console.log('Loaded fonts in document:', JSON.stringify(loadedFonts, null, 2));

  // Check Playfair Display
  const hasPlayfair = await page.evaluate(() => document.fonts.check("800 48px 'Playfair Display'"));
  const hasDMSans = await page.evaluate(() => document.fonts.check("700 24px 'DM Sans'"));
  console.log('document.fonts.check Playfair 800:', hasPlayfair);
  console.log('document.fonts.check DM Sans 700:', hasDMSans);

  // Take a test screenshot of the hook headline rendered in Playfair Display
  const screenshotPath = path.resolve('out', 'font_proof_playfair.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`Saved proof screenshot to ${screenshotPath}`);

  await browser.close();
})();
