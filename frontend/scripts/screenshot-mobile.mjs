import { chromium, devices } from 'playwright';
import fs from 'fs';

(async () => {
  const url = process.env.URL || 'http://localhost:5173';
  const deviceName = process.env.DEVICE || 'iPhone 12';
  const output = process.env.OUTPUT || 'frontend/screenshots/mobile-screenshot.png';

  const device = devices[deviceName] || { viewport: { width: 375, height: 812 }, userAgent: '' };
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...device, locale: 'hu-HU' });
  const page = await context.newPage();
  try {
    console.log('Opening URL:', url, 'with device', deviceName);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    // Optional: take a full-page screenshot
    await page.screenshot({ path: output, fullPage: true });
    console.log('Screenshot saved to', output);
  } catch (err) {
    console.error('Screenshot error:', err);
    process.exit(2);
  } finally {
    await browser.close();
  }
})();
