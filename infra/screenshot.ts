// screenshot.ts — Captures the live site for whiteboard background + codegen vision
// Usage: npx tsx screenshot.ts [businessId]
// Returns: path to the saved PNG

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const SITE_PORT = 5173;
const MACOS_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, '..', 'data');

/**
 * Capture a full-page screenshot of the live site.
 * Used by:
 *   - Whiteboard app (GET /api/screenshot) for the canvas background
 *   - Codegen for "before" vision context
 */
export async function captureSite(businessId: string = 'demo'): Promise<string> {
  const screenshotDir = path.join(DATA_ROOT, businessId, 'screenshots');
  await mkdir(screenshotDir, { recursive: true });

  const timestamp = Date.now();
  const filename = `site-${timestamp}.png`;
  const outputPath = path.join(screenshotDir, filename);

  const browser = await launchBrowser();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  try {
    await page.goto(`http://localhost:${SITE_PORT}`, {
      waitUntil: 'networkidle',
      timeout: 15000,
    });

    // Wait a beat for animations to settle
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: outputPath,
      fullPage: true,
      type: 'png',
    });

    console.log(`Screenshot saved: ${outputPath}`);
    return outputPath;
  } finally {
    await browser.close();
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (existsSync(MACOS_CHROME)) {
      return chromium.launch({ headless: true, executablePath: MACOS_CHROME });
    }
    throw error;
  }
}

// CLI entry point
if (process.argv[1]?.includes('screenshot')) {
  const businessId = process.argv[2] ?? 'demo';
  captureSite(businessId)
    .then((p) => console.log(`Done: ${p}`))
    .catch((err) => {
      console.error('Screenshot failed:', err.message);
      process.exit(1);
    });
}
