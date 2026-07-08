import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setDefaultConfig,
  updateConfigToUseProfiles_20231117,
  updateModelNaming_20240129,
  updateModelNaming_20240423,
  updateProfileStructure_20240620,
} from '../src/compat.js';
import { createChrome } from './helpers.js';

//---- Layer 1: Migration tests (chrome.storage.sync mock) ----

beforeEach(() => {
  globalThis.chrome = createChrome();
});

afterEach(() => {
  delete globalThis.chrome;
});

test('setDefaultConfig: creates default profile on fresh install', async () => {
  await setDefaultConfig();
  const store = await chrome.storage.sync.get(null);
  assert.deepEqual(store.profiles, ['default']);
  assert.equal(store.defaultProfile, 'default');
  assert.equal(store.apiKey, '');
  assert.equal(store.debug, false);
  assert.deepEqual(store.profile__default, {
    model: 'gpt-4o-mini',
    customPrompts: ['Please summarize the contents of this web page for brevity.'],
  });
});

test('setDefaultConfig: does not overwrite existing profiles', async () => {
  await chrome.storage.sync.set({
    profiles: ['work'],
    defaultProfile: 'work',
    profile__work: { model: 'gpt-4', customPrompts: [] },
    apiKey: 'existing-key',
  });
  await setDefaultConfig();
  const store = await chrome.storage.sync.get(null);
  assert.deepEqual(store.profiles, ['work']);
  assert.equal(store.defaultProfile, 'work');
  assert.equal(store.apiKey, 'existing-key');
  assert.equal(store.profile__default, undefined);
  assert.deepEqual(store.profile__work, { model: 'gpt-4', customPrompts: [] });
});

test('setDefaultConfig: adds missing defaultProfile to profiles list', async () => {
  await chrome.storage.sync.set({
    profiles: ['work'],
    defaultProfile: 'personal',
    profile__work: { model: 'gpt-4', customPrompts: [] },
  });
  await setDefaultConfig();
  const store = await chrome.storage.sync.get(null);
  assert.ok(store.profiles.includes('personal'));
  assert.equal(store.defaultProfile, 'personal');
  assert.deepEqual(store['profile__personal'], {
    model: 'gpt-4o-mini',
    customPrompts: ['Please summarize the contents of this web page for brevity.'],
  });
});

test('updateConfigToUseProfiles: migrates flat config to profiles object', async () => {
  await chrome.storage.sync.set({
    model: 'gpt-4',
    customPrompts: ['Summarize this page.'],
    apiKey: 'test-key',
    debug: true,
  });
  await updateConfigToUseProfiles_20231117();
  const store = await chrome.storage.sync.get(null);
  assert.equal(store.defaultProfile, 'default');
  assert.deepEqual(store.profiles, {
    default: { model: 'gpt-4', customPrompts: ['Summarize this page.'] },
  });
  // old keys removed
  assert.equal(store.model, undefined);
  assert.equal(store.customPrompts, undefined);
  // other settings preserved
  assert.equal(store.apiKey, 'test-key');
  assert.equal(store.debug, true);
});

test('updateConfigToUseProfiles: no-op when already migrated', async () => {
  await chrome.storage.sync.set({
    profiles: ['default'],
    defaultProfile: 'default',
    profile__default: { model: 'gpt-4o-mini', customPrompts: [] },
    apiKey: 'test-key',
  });
  await updateConfigToUseProfiles_20231117();
  const store = await chrome.storage.sync.get(null);
  assert.deepEqual(store.profiles, ['default']);
  assert.equal(store.defaultProfile, 'default');
  assert.equal(store.apiKey, 'test-key');
});

test('updateModelNaming_20240129: renames model in array profile structure', async () => {
  await chrome.storage.sync.set({
    profiles: ['default', 'work'],
    profile__default: { model: 'gpt-4-1106-preview', customPrompts: [] },
    profile__work: { model: 'gpt-4o', customPrompts: [] },
  });
  await updateModelNaming_20240129();
  const store = await chrome.storage.sync.get(null);
  assert.equal(store.profile__default.model, 'gpt-4-turbo-preview');
  assert.equal(store.profile__work.model, 'gpt-4o');
  assert.deepEqual(store.profiles, ['default', 'work']);
});

test('updateModelNaming_20240129: renames model in object profile structure', async () => {
  await chrome.storage.sync.set({
    profiles: {
      default: { model: 'gpt-4-1106-preview', customPrompts: [] },
      work: { model: 'gpt-4o', customPrompts: [] },
    },
  });
  await updateModelNaming_20240129();
  const store = await chrome.storage.sync.get(null);
  assert.equal(store.profiles.default.model, 'gpt-4-turbo-preview');
  assert.equal(store.profiles.work.model, 'gpt-4o');
});

test('updateModelNaming_20240129: does not rename non-matching models', async () => {
  await chrome.storage.sync.set({
    profiles: ['default'],
    profile__default: { model: 'gpt-4o-mini', customPrompts: [] },
  });
  await updateModelNaming_20240129();
  const store = await chrome.storage.sync.get(null);
  assert.equal(store.profile__default.model, 'gpt-4o-mini');
});

test('updateModelNaming_20240423: renames gpt-4-turbo-preview to gpt-4-turbo', async () => {
  await chrome.storage.sync.set({
    profiles: ['default'],
    profile__default: { model: 'gpt-4-turbo-preview', customPrompts: [] },
  });
  await updateModelNaming_20240423();
  const store = await chrome.storage.sync.get(null);
  assert.equal(store.profile__default.model, 'gpt-4-turbo');
});

test('updateProfileStructure: converts object profiles to array with root keys', async () => {
  await chrome.storage.sync.set({
    profiles: {
      default: { model: 'gpt-4o', customPrompts: [] },
      work: { model: 'gpt-4o-mini', customPrompts: ['Work prompt'] },
    },
  });
  await updateProfileStructure_20240620();
  const store = await chrome.storage.sync.get(null);
  assert.deepEqual(store.profiles, ['default', 'work']);
  assert.deepEqual(store.profile__default, { model: 'gpt-4o', customPrompts: [] });
  assert.deepEqual(store.profile__work, { model: 'gpt-4o-mini', customPrompts: ['Work prompt'] });
});

test('updateProfileStructure: no-op when already array', async () => {
  await chrome.storage.sync.set({
    profiles: ['default'],
    profile__default: { model: 'gpt-4o', customPrompts: [] },
  });
  await updateProfileStructure_20240620();
  const store = await chrome.storage.sync.get(null);
  assert.deepEqual(store.profiles, ['default']);
  assert.deepEqual(store.profile__default, { model: 'gpt-4o', customPrompts: [] });
});

test('updateProfileStructure: handles undefined profiles gracefully', async () => {
  await chrome.storage.sync.set({});
  await updateProfileStructure_20240620();
  const store = await chrome.storage.sync.get(null);
  assert.deepEqual(store.profiles, []);
});

test('full migration chain: fresh install produces stable default config', async () => {
  // Simulate background.js onInstalled handler on a fresh install
  await setDefaultConfig();
  await updateConfigToUseProfiles_20231117();
  await updateModelNaming_20240129();
  await updateModelNaming_20240423();
  await updateProfileStructure_20240620();

  const store = await chrome.storage.sync.get(null);
  assert.deepEqual(store.profiles, ['default']);
  assert.equal(store.defaultProfile, 'default');
  assert.equal(store.apiKey, '');
  assert.equal(store.debug, false);
  assert.deepEqual(store.profile__default, {
    model: 'gpt-4o-mini',
    customPrompts: ['Please summarize the contents of this web page for brevity.'],
  });
});

test('full migration chain: upgrades old flat config through all migrations', async () => {
  // Old flat config with a model that needs two name renames
  await chrome.storage.sync.set({
    model: 'gpt-4-1106-preview',
    customPrompts: ['Summarize this page.'],
    apiKey: 'old-key',
    debug: true,
  });

  await setDefaultConfig();
  await updateConfigToUseProfiles_20231117();
  await updateModelNaming_20240129();
  await updateModelNaming_20240423();
  await updateProfileStructure_20240620();

  const store = await chrome.storage.sync.get(null);
  assert.deepEqual(store.profiles, ['default']);
  assert.equal(store.defaultProfile, 'default');

  // gpt-4-1106-preview -> gpt-4-turbo-preview -> gpt-4-turbo
  assert.equal(store.profile__default.model, 'gpt-4-turbo');
  assert.deepEqual(store.profile__default.customPrompts, ['Summarize this page.']);

  assert.equal(store.model, undefined);
  assert.equal(store.customPrompts, undefined);
  assert.equal(store.apiKey, 'old-key');
  assert.equal(store.debug, true);
});