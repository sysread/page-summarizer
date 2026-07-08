import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { connectPageSummarizer } from '../src/page_summarizer.js';
import { connectSelectionSummarizer } from '../src/selection_summarizer.js';
import { connectFormFiller } from '../src/form_filler.js';
import { createChrome, createPort, createSSEResponse, flush } from './helpers.js';

//---- Layer 3: Connector/event-wiring tests ----

const originalFetch = globalThis.fetch;

const defaultStore = {
  apiKey: 'test-key',
  profiles: ['default'],
  defaultProfile: 'default',
  profile__default: { model: 'gpt-4o-mini', customPrompts: ['Summarize.'], reasoning: 'medium' },
};

beforeEach(() => {
  globalThis.chrome = createChrome(defaultStore);
  globalThis.fetch = async () => createSSEResponse([
    'data: {"choices":[{"delta":{"content":"Summary text"}}]}\n\n',
    'data: [DONE]\n\n',
  ]);
});

afterEach(() => {
  delete globalThis.chrome;
  globalThis.fetch = originalFetch;
});

//---- connectPageSummarizer ----

test('connectPageSummarizer: registers onConnect listener', () => {
  connectPageSummarizer();
  assert.equal(chrome.runtime.onConnect._listeners.length, 1);
});

test('connectPageSummarizer: ignores non-summarize ports', () => {
  connectPageSummarizer();
  const port = createPort();
  port.name = 'other';
  chrome.runtime.onConnect._emit(port);
  assert.equal(port.onMessage._listeners.length, 0, 'should not add onMessage for non-summarize port');
});

test('connectPageSummarizer: processes SUMMARIZE message on summarize port', async () => {
  connectPageSummarizer();
  const port = createPort();
  port.name = 'summarize';
  chrome.runtime.onConnect._emit(port);

  assert.ok(port.onMessage._listeners.length >= 1, 'onMessage listener should be registered');

  port.onMessage._emit({
    action: 'SUMMARIZE',
    content: 'page content',
    instructions: 'Summarize this page.',
    model: '',
    profile: '',
  });

  await flush();
  const done = port.messages.find((m) => m.action === 'GPT_DONE');
  assert.ok(done, 'should have received GPT_DONE');
  assert.ok(done.summary.length > 0, 'GPT_DONE should have summary content');
});

test('connectPageSummarizer: ignores non-SUMMARIZE messages on summarize port', async () => {
  connectPageSummarizer();
  const port = createPort();
  port.name = 'summarize';
  chrome.runtime.onConnect._emit(port);

  port.onMessage._emit({ action: 'KEEP_ALIVE' });
  await flush();
  assert.equal(port.messages.length, 0, 'KEEP_ALIVE should not trigger streaming');
});

//---- connectSelectionSummarizer ----

test('connectSelectionSummarizer: creates context menu on install', () => {
  connectSelectionSummarizer();
  chrome.runtime.onInstalled._emit({ reason: 'install' });
  assert.equal(chrome.calls.contextMenusCreate.length, 1);
  assert.equal(chrome.calls.contextMenusCreate[0].id, 'summarizeSelectedText');
  assert.deepEqual(chrome.calls.contextMenusCreate[0].contexts, ['selection']);
});

test('connectSelectionSummarizer: ignores non-matching menu item clicks', async () => {
  connectSelectionSummarizer();
  await chrome.contextMenus.onClicked._emit(
    { menuItemId: 'other-item' },
    { id: 1, url: 'https://example.com' },
  );
  assert.equal(chrome.calls.executeScript.length, 0);
  assert.equal(chrome.calls.tabsConnect.length, 0);
});

test('connectSelectionSummarizer: ignores clicks with no active tab (id=-1)', async () => {
  connectSelectionSummarizer();
  await chrome.contextMenus.onClicked._emit(
    { menuItemId: 'summarizeSelectedText', selectionText: 'text' },
    { id: -1, url: 'https://example.com' },
  );
  assert.equal(chrome.calls.executeScript.length, 0);
  assert.equal(chrome.calls.tabsConnect.length, 0);
});

test('connectSelectionSummarizer: injects alert for PDF selection', async () => {
  connectSelectionSummarizer();
  await chrome.contextMenus.onClicked._emit(
    { menuItemId: 'summarizeSelectedText', selectionText: 'pdf text' },
    { id: 5, url: 'https://example.com/doc.pdf' },
  );
  assert.equal(chrome.calls.executeScript.length, 1);
  assert.equal(chrome.calls.executeScript[0].target.tabId, 5);
  assert.ok(chrome.calls.executeScript[0].func, 'should inject alert function for PDF');
  assert.equal(chrome.calls.tabsConnect.length, 0, 'should not connect port for PDF');
});

test('connectSelectionSummarizer: injects scripts and streams on click', async () => {
  connectSelectionSummarizer();
  await chrome.contextMenus.onClicked._emit(
    { menuItemId: 'summarizeSelectedText', selectionText: 'selected text' },
    { id: 7, url: 'https://example.com' },
  );

  assert.equal(chrome.calls.executeScript.length, 1);
  assert.ok(
    chrome.calls.executeScript[0].files.includes('src/scripts/selection_summarizer.js'),
    'should inject the selection_summarizer content script',
  );

  assert.equal(chrome.calls.tabsConnect.length, 1);
  assert.equal(chrome.calls.tabsConnect[0].name, 'contentScriptPort');

  const port = chrome.calls.tabsConnect[0].port;
  await flush();
  const done = port.messages.find((m) => m.action === 'GPT_DONE');
  assert.ok(done, 'port should receive GPT_DONE from fire-and-forget stream');
});

//---- connectFormFiller ----

test('connectFormFiller: creates context menu on install', () => {
  connectFormFiller();
  chrome.runtime.onInstalled._emit({ reason: 'install' });
  assert.equal(chrome.calls.contextMenusCreate.length, 1);
  assert.equal(chrome.calls.contextMenusCreate[0].id, 'fillForm');
  assert.deepEqual(chrome.calls.contextMenusCreate[0].contexts, ['editable']);
});

test('connectFormFiller: ignores non-matching menu item clicks', async () => {
  connectFormFiller();
  await chrome.contextMenus.onClicked._emit(
    { menuItemId: 'other-item' },
    { id: 1, url: 'https://example.com' },
  );
  assert.equal(chrome.calls.executeScript.length, 0);
  assert.equal(chrome.calls.tabsConnect.length, 0);
});

test('connectFormFiller: injects scripts, connects port, and sends DISPLAY_OVERLAY', async () => {
  connectFormFiller();
  await chrome.contextMenus.onClicked._emit(
    { menuItemId: 'fillForm' },
    { id: 10, url: 'https://example.com' },
  );

  assert.equal(chrome.calls.executeScript.length, 1);
  assert.ok(
    chrome.calls.executeScript[0].files.includes('src/scripts/form_filler.js'),
    'should inject the form_filler content script',
  );

  assert.equal(chrome.calls.tabsConnect.length, 1);
  assert.equal(chrome.calls.tabsConnect[0].name, 'fillForm');

  const port = chrome.calls.tabsConnect[0].port;
  const overlay = port.messages.find((m) => m.action === 'DISPLAY_OVERLAY');
  assert.ok(overlay, 'should send DISPLAY_OVERLAY to content script');
});

test('connectFormFiller: processes GET_COMPLETION and streams response', async () => {
  connectFormFiller();
  await chrome.contextMenus.onClicked._emit(
    { menuItemId: 'fillForm' },
    { id: 10, url: 'https://example.com' },
  );

  const port = chrome.calls.tabsConnect[0].port;
  assert.ok(port.onMessage._listeners.length >= 1, 'onMessage listener should be registered');

  port.onMessage._emit({
    action: 'GET_COMPLETION',
    text: 'Write a greeting',
    instructions: 'Say hello',
  });

  await flush();
  const done = port.messages.find((m) => m.action === 'GPT_DONE');
  assert.ok(done, 'port should receive GPT_DONE after GET_COMPLETION');
});