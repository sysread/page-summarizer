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