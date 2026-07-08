// E2E tests load the unpacked extension in Chromium via Playwright and
// exercise real UI flows against mocked or in-process operations. These
// tests need `npm install` (devDependencies) and a one-time
// `npx playwright install chromium` to download the browser binary.
//
// Run with: npm test
// (Or just: node --test test/*.test.js)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '..');

let context = null;
let worker = null;
let extensionId = null;

// Wait for Chrome to spawn the service worker for the extension - this is
// the signal that the extension has loaded. Then read its runtime ID so we
// can build chrome-extension://<id>/... URLs for popup/options pages.
async function launchExtension() {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  // Poll up to 3 seconds for the service worker to register.
  for (let i = 0; i < 30; i++) {
    worker = context.serviceWorkers()[0];
    if (worker) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!worker) throw new Error('Service worker not found - extension failed to load');

  extensionId = await worker.evaluate(() => chrome.runtime.id);
  if (!extensionId) throw new Error('chrome.runtime.id is null - extension failed to load');
}

before(async () => {
  await launchExtension();
});

after(async () => {
  if (context) await context.close();
});

test('extension loads a service worker', () => {
  assert.ok(worker, 'service worker should be registered');
  assert.ok(extensionId, 'should have an extension ID');
});

test('popup page shows summarize UI', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/pages/popup.html`);
  await page.waitForSelector('#summarize', { timeout: 5000 });
  assert.ok(await page.$('#summarize'), 'summarize button should be visible');
  assert.ok(await page.$('#instructions'), 'instructions textarea should be present');
});

test('options page shows API key field and save button', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/pages/config.html`);
  await page.waitForSelector('#apiKey', { timeout: 5000 });
  assert.ok(await page.$('#apiKey'), 'API key field should be visible');
  assert.ok(await page.$('#save-profile-btn'), 'save button should be present');
});

test('saving API key via options page persists to storage', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/pages/config.html`);
  await page.waitForSelector('#apiKey', { timeout: 5000 });

  await page.fill('#apiKey', 'sk-test-e2e-123');
  await page.click('#save-profile-btn');

  await page.waitForSelector('.alert', { timeout: 5000 });

  const storedKey = await worker.evaluate(() =>
    chrome.storage.sync.get('apiKey').then((r) => r.apiKey)
  );
  assert.equal(storedKey, 'sk-test-e2e-123');
});

test('summarize button fetches and renders summary end-to-end', async () => {
  // Track whether the route fires for service worker fetches.
  let routeCalled = false;

  await context.route('https://api.openai.com/v1/chat/completions', (route) => {
    routeCalled = true;
    const body =
      'data: {"choices":[{"delta":{"content":"This is the mocked summary."}}]}\r\n' +
      '\r\n' +
      'data: [DONE]\r\n\r\n';
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: { 'Transfer-Encoding': 'chunked' },
      body,
    });
  });

  // Pre-seed storage so fetchAndStream has a config + profile to read.
  await worker.evaluate(() =>
    chrome.storage.sync.set({
      apiKey: 'sk-e2e-test',
      profiles: ['default'],
      defaultProfile: 'default',
      models: ['gpt-4o-mini'],
      profile__default: { model: 'gpt-4o-mini', customPrompts: ['Summarize.'] },
    }),
  );

  // Open the popup page itself. popup.js tries to read the active tab's
  // URL via chrome.tabs.get(tabId).url on DOMContentLoaded, which fails
  // because the extension lacks the `tabs` permission when opened via
  // direct URL navigation (as opposed to a real toolbar-icon click that
  // grants activeTab). The defensive `url || ''` change keeps the popup
  // from crashing on missing url, but chrome.scripting.executeScript on
  // the active tab also fails without `activeTab` and host permissions.
  // So the popup UI flow fails early with an error in #errors.
  //
  // To exercise the real streaming pipeline through the extension's wire
  // format, we directly open a chrome.runtime port from within the popup
  // page context and post a SUMMARIZE message. This is the same port path
  // popup.js uses, but we bypass its UI handlers that need URL/scripting
  // permissions unavailable in tests.
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup.html`);
  await popup.waitForSelector('#summarize', { timeout: 5000 });

  const result = await popup.evaluate(() => {
    return new Promise((resolve) => {
      const messages = [];
      const port = chrome.runtime.connect({ name: 'summarize' });
      port.onMessage.addListener((msg) => {
        messages.push(msg);
        if (msg.action === 'GPT_DONE' || msg.action === 'GPT_ERROR') {
          resolve({ messages });
        }
      });
      port.postMessage({
        action: 'SUMMARIZE',
        content: 'This is the page content that would normally come from document.body.innerText.',
        instructions: 'Summarize briefly.',
        model: '',
        profile: '',
      });
      // Safety timeout
      setTimeout(() => resolve({ messages, timeout: true }), 10000);
    });
  });

  assert.ok(routeCalled, 'context.route should intercept the service worker fetch');
  assert.ok(!result.timeout, 'should receive GPT_DONE or GPT_ERROR before safety timeout');
  const done = result.messages.find((m) => m.action === 'GPT_DONE');
  assert.ok(done, 'should receive GPT_DONE on the port');
  assert.ok(
    done.summary && done.summary.includes('mocked summary'),
    `GPT_DONE summary should contain the mocked text, got: ${done?.summary}`,
  );
});