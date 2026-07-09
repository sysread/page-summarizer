import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addProfile, deleteProfile, reorderProfiles, buildDefaultProfile } from '../src/profiles.js';

//---- Layer 4: Pure profile CRUD tests (no mocks needed) ----

function setupConfig() {
  return {
    apiKey: 'test-key',
    debug: false,
    defaultProfile: 'default',
    profiles: ['default', 'work'],
    profile__default: { model: 'gpt-4o-mini', customPrompts: [] },
    profile__work: { model: 'gpt-4o', customPrompts: ['Do work stuff.'] },
  };
}

test('buildDefaultProfile: returns gpt-4o-mini with empty prompts', () => {
  assert.deepEqual(buildDefaultProfile(), {
    model: 'gpt-4o-mini',
    customPrompts: [],
  });
});

test('addProfile: adds a new profile with default config', () => {
  const config = setupConfig();
  const result = addProfile(config, 'personal');
  assert.equal(result.config, config);
  assert.ok(config.profiles.includes('personal'));
  assert.deepEqual(config.profile__personal, {
    model: 'gpt-4o-mini',
    customPrompts: [],
  });
});

test('addProfile: rejects duplicate name', () => {
  const config = setupConfig();
  const result = addProfile(config, 'work');
  assert.equal(result.error, 'Profile "work" already exists.');
  assert.equal(config.profiles.length, 2);
  // original data untouched
  assert.deepEqual(config.profile__work, { model: 'gpt-4o', customPrompts: ['Do work stuff.'] });
});

test('addProfile: rejects empty/null/undefined names', () => {
  const config = setupConfig();
  assert.equal(addProfile(config, '').error, 'Profile name cannot be empty.');
  assert.equal(addProfile(config, null).error, 'Profile name cannot be empty.');
  assert.equal(addProfile(config, undefined).error, 'Profile name cannot be empty.');
  assert.equal(config.profiles.length, 2);
});

test('addProfile: does not mutate config on rejection', () => {
  const config = setupConfig();
  const original = { ...config };
  addProfile(config, 'work');
  assert.deepEqual(config.profiles, original.profiles);
  assert.deepEqual(config.profile__work, original.profile__work);
});

test('deleteProfile: removes a profile from config', () => {
  const config = setupConfig();
  const result = deleteProfile(config, 'work');
  assert.equal(result.config, config);
  assert.ok(!config.profiles.includes('work'));
  assert.equal(config.profile__work, undefined);
});

test('deleteProfile: rejects deleting the default profile', () => {
  const config = setupConfig();
  const result = deleteProfile(config, 'default');
  assert.equal(result.error, 'Cannot delete the default profile.');
  assert.ok(config.profiles.includes('default'));
  assert.ok(config.profile__default);
});

test('deleteProfile: rejects deleting non-existent profile', () => {
  const config = setupConfig();
  const result = deleteProfile(config, 'nonexistent');
  assert.equal(result.error, 'Profile "nonexistent" does not exist.');
  assert.equal(config.profiles.length, 2);
});

test('reorderProfiles: moves a profile before the target', () => {
  const config = setupConfig();
  assert.deepEqual(config.profiles, ['default', 'work']);
  const result = reorderProfiles(config, 'work', 'default');
  assert.equal(result.config, config);
  assert.deepEqual(config.profiles, ['work', 'default']);
});

test('reorderProfiles: moves target forward correctly', () => {
  const config = { profiles: ['a', 'b', 'c', 'd'] };
  reorderProfiles(config, 'a', 'c');
  assert.deepEqual(config.profiles, ['b', 'c', 'a', 'd']);
});

test('reorderProfiles: no-op when from and target are the same', () => {
  const config = setupConfig();
  const result = reorderProfiles(config, 'default', 'default');
  assert.equal(result.config, config);
  assert.deepEqual(config.profiles, ['default', 'work']);
});

test('reorderProfiles: rejects non-existent from name', () => {
  const config = setupConfig();
  const result = reorderProfiles(config, 'nonexistent', 'work');
  assert.equal(result.error, 'Profile "nonexistent" does not exist.');
  assert.deepEqual(config.profiles, ['default', 'work']);
});

test('reorderProfiles: rejects non-existent target name', () => {
  const config = setupConfig();
  const result = reorderProfiles(config, 'default', 'nonexistent');
  assert.equal(result.error, 'Profile "nonexistent" does not exist.');
  assert.deepEqual(config.profiles, ['default', 'work']);
});