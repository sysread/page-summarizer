import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wantModel, isReasoningModel, fetchAndStream } from '../src/gpt.js';
import { createChrome, createPort, createSSEResponse } from './helpers.js';

//---- Layer 0: Pure function tests (no chrome/DOM/fetch mocks needed) ----

test('wantModel: allows gpt-* family', () => {
  for (const m of ['gpt-4o', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'gpt-4', 'gpt-4-0613', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k']) {
    assert.equal(wantModel(m), true, `${m} should be allowed`);
  }
});

test('wantModel: allows o* reasoning models', () => {
  for (const m of ['o1', 'o1-mini', 'o1-mini-2024-09-12', 'o3', 'o3-mini', 'o3-mini-2025-01-31']) {
    assert.equal(wantModel(m), true, `${m} should be allowed`);
  }
});

test('wantModel: denies non-chat model families', () => {
  for (const m of [
    'text-embedding-3-small', 'text-embedding-3-large',
    'whisper-1', 'dall-e-3', 'dall-e-2',
    'tts-1', 'tts-1-hd',
    'omni-moderation-latest', 'text-moderation-latest', 'moderation-latest',
  ]) {
    assert.equal(wantModel(m), false, `${m} should be denied`);
  }
});

test('wantModel: denies preview variants', () => {
  for (const m of ['gpt-4-turbo-preview', 'gpt-4-1106-preview', 'o1-preview']) {
    assert.equal(wantModel(m), false, `${m} should be denied`);
  }
});

test('wantModel: denies instruct variants', () => {
  for (const m of ['gpt-4o-instruct', 'gpt-4o-mini-instruct']) {
    assert.equal(wantModel(m), false, `${m} should be denied`);
  }
});

test('wantModel: denies pro variants', () => {
  for (const m of ['gpt-4o-pro', 'o1-pro', 'o3-pro']) {
    assert.equal(wantModel(m), false, `${m} should be denied`);
  }
});

test('wantModel: denies turbo variants except gpt-3.5-turbo family', () => {
  assert.equal(wantModel('gpt-3.5-turbo'), true, 'gpt-3.5-turbo should be allowed');
  assert.equal(wantModel('gpt-3.5-turbo-16k'), true, 'gpt-3.5-turbo-16k should be allowed');
  assert.equal(wantModel('gpt-4-turbo'), false, 'gpt-4-turbo should be denied');
  assert.equal(wantModel('gpt-4-turbo-preview'), false, 'gpt-4-turbo-preview should be denied (turbo + preview)');
});

test('wantModel: denies special-purpose chat model variants', () => {
  for (const m of [
    'gpt-4o-realtime', 'gpt-4o-mini-realtime',
    'gpt-4o-audio', 'gpt-4o-mini-audio',
    'gpt-4o-transcribe', 'gpt-4o-search',
    'o3-deep-research',
  ]) {
    assert.equal(wantModel(m), false, `${m} should be denied`);
  }
});

test('wantModel: denies models that do not match allow families', () => {
  for (const m of ['codex-mini-latest', 'codex-1', 'random-string', 'ada', 'text-davinci-003']) {
    assert.equal(wantModel(m), false, `${m} should be denied`);
  }
});

test('isReasoningModel: matches o*-mini patterns only', () => {
  for (const m of ['o1-mini', 'o3-mini', 'o1-mini-2024-09-12']) {
    assert.equal(isReasoningModel(m), true, `${m} should be reasoning`);
  }
  // Full o1/o3 models are NOT matched by isReasoningModel even though
  // they support reasoning_effort. This may be intentional (the full
  // o1/o3 API may default reasoning effort) or a gap.
  for (const m of ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3', 'gpt-3.5-turbo']) {
    assert.equal(isReasoningModel(m), false, `${m} should NOT be reasoning`);
  }
});

//---- Layer 2: fetchAndStream streaming engine (chrome + fetch + port mocks) ----

const originalFetch = globalThis.fetch;

test('fetchAndStream', async (t) => {
  t.beforeEach(() => {
    globalThis.chrome = createChrome({
      apiKey: 'test-key',
      profiles: ['default'],
      defaultProfile: 'default',
      profile__default: { model: 'gpt-4o-mini', reasoning: 'medium' },
    });
  });

  t.afterEach(() => {
    delete globalThis.chrome;
    globalThis.fetch = originalFetch;
  });

  await t.test('sends GPT_ERROR when API key is empty string', async () => {
    await chrome.storage.sync.set({ apiKey: '' });
    const port = createPort();
    await fetchAndStream(port, [{ role: 'user', content: 'test' }]);
    assert.equal(port.messages.length, 1);
    assert.equal(port.messages[0].action, 'GPT_ERROR');
    assert.equal(port.messages[0].error, 'Error: API key is not set');
  });

  await t.test('streams multi-chunk response and sends GPT_DONE', async () => {
    const port = createPort();
    globalThis.fetch = async () => createSSEResponse([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);

    await fetchAndStream(port, [{ role: 'user', content: 'Summarize this.' }]);

    const last = port.messages[port.messages.length - 1];
    assert.equal(last.action, 'GPT_DONE');
    assert.equal(last.summary, 'Hello world');
    const msgs = port.messages.filter(m => m.action === 'GPT_MESSAGE');
    assert.ok(msgs.length >= 2, `expected >= 2 GPT_MESSAGE, got ${msgs.length}`);
    assert.equal(msgs[0].summary, 'Hello');
  });

  await t.test('sends GPT_ERROR on OpenAI API error response', async () => {
    const port = createPort();
    // OpenAI returns a plain JSON error (not SSE)
    globalThis.fetch = async () => createSSEResponse([
      '{"error":{"message":"Invalid API key"}}',
    ]);

    await fetchAndStream(port, [{ role: 'user', content: 'test' }]);

    const error = port.messages.find(m => m.action === 'GPT_ERROR');
    assert.ok(error, 'should have received GPT_ERROR');
    assert.equal(error.error, 'Invalid API key');
  });

  await t.test('stops sending when port disconnects mid-stream', async () => {
    const port = createPort();
    globalThis.fetch = async () => {
      port.disconnect();
      return createSSEResponse([
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);
    };

    await fetchAndStream(port, [{ role: 'user', content: 'test' }]);
    assert.equal(port.messages.length, 0, 'no messages after disconnect');
  });

  await t.test('sets reasoning_effort for o*-mini models', async () => {
    await chrome.storage.sync.set({
      profile__default: { model: 'o3-mini', reasoning: 'high' },
    });
    let capturedPayload = null;
    globalThis.fetch = async (url, { body }) => {
      capturedPayload = JSON.parse(body);
      return createSSEResponse([
        'data: {"choices":[{"delta":{"content":"x"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);
    };

    const port = createPort();
    await fetchAndStream(port, [{ role: 'user', content: 'test' }]);
    assert.equal(capturedPayload.model, 'o3-mini');
    assert.equal(capturedPayload.reasoning_effort, 'high');
  });

  await t.test('omits reasoning_effort for non-reasoning models', async () => {
    let capturedPayload = null;
    globalThis.fetch = async (url, { body }) => {
      capturedPayload = JSON.parse(body);
      return createSSEResponse([
        'data: {"choices":[{"delta":{"content":"x"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);
    };

    const port = createPort();
    await fetchAndStream(port, [{ role: 'user', content: 'test' }]);
    assert.equal(capturedPayload.model, 'gpt-4o-mini');
    assert.equal(capturedPayload.reasoning_effort, undefined);
  });

  await t.test('uses options.model to override profile model', async () => {
    let capturedPayload = null;
    globalThis.fetch = async (url, { body }) => {
      capturedPayload = JSON.parse(body);
      return createSSEResponse([
        'data: {"choices":[{"delta":{"content":"x"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);
    };

    const port = createPort();
    await fetchAndStream(port, [{ role: 'user', content: 'test' }], { model: 'o1-mini' });
    assert.equal(capturedPayload.model, 'o1-mini');
  });
});