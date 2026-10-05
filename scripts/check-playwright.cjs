const { chromium } = require('playwright');

async function test() {
  try {
    const browser = await chromium.launch({ channel: 'chrome' });
    console.log('Playwright Chrome channel launched successfully!');
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1080, height: 1920 });
    console.log('Viewport set to 1080x1920 successfully!');
    await browser.close();
  } catch (err) {
    console.log('Playwright Chrome channel error:', err.message);
    try {
      const browserEdge = await chromium.launch({ channel: 'msedge' });
      console.log('Playwright Edge channel launched successfully!');
      await browserEdge.close();
    } catch (err2) {
      console.log('Playwright Edge channel error:', err2.message);
    }
  }
}

test();
