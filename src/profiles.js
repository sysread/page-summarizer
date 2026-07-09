// Pure profile management operations. These functions manipulate a config
// object (the same shape stored in chrome.storage.sync) without touching
// DOM or chrome APIs, making them directly unit-testable.
//
// Config object shape:
//   {
//     apiKey: string,
//     debug: boolean,
//     defaultProfile: string,
//     profiles: string[],
//     profile__<name>: { model: string, reasoning: string|null, customPrompts: string[] },
//   }

const defaultModel = 'gpt-4o-mini';

export function buildDefaultProfile() {
  return {
    model: defaultModel,
    customPrompts: [],
  };
}

// Add a new empty profile to the config. Returns { config } on success
// or { error } on failure. The config object is mutated in place.
export function addProfile(config, name) {
  if (!name || name === '') {
    return { error: 'Profile name cannot be empty.' };
  }
  if (config.profiles.includes(name)) {
    return { error: `Profile "${name}" already exists.` };
  }
  config.profiles.push(name);
  config[`profile__${name}`] = buildDefaultProfile();
  return { config };
}

// Delete a profile from the config. Returns { config } on success
// or { error } on failure. The config object is mutated in place.
export function deleteProfile(config, name) {
  if (name === config.defaultProfile) {
    return { error: 'Cannot delete the default profile.' };
  }
  if (!config.profiles.includes(name)) {
    return { error: `Profile "${name}" does not exist.` };
  }
  config.profiles = config.profiles.filter((p) => p !== name);
  delete config[`profile__${name}`];
  return { config };
}

// Move a profile from its current position to the position of the
// target profile (inserting before it). Returns { config } on success
// or { error } on failure. The config object is mutated in place.
export function reorderProfiles(config, fromName, toName) {
  if (!config.profiles.includes(fromName)) {
    return { error: `Profile "${fromName}" does not exist.` };
  }
  if (!config.profiles.includes(toName)) {
    return { error: `Profile "${toName}" does not exist.` };
  }
  if (fromName === toName) {
    return { config };
  }
  const fromIdx = config.profiles.indexOf(fromName);
  const toIdx = config.profiles.indexOf(toName);
  config.profiles.splice(fromIdx, 1);
  config.profiles.splice(toIdx, 0, fromName);
  return { config };
}