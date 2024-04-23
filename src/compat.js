async function updateConfig(keys, callback) {
  let config = await chrome.storage.sync.get(keys);
  config = await callback(config);
  return chrome.storage.sync.set(config);
}

async function updateModelName(from, to) {
  await updateConfig(['profiles'], async (config) => {
    for (const profileName of Object.keys(config.profiles)) {
      const profile = config.profiles[profileName];

      if (profile.model === from) {
        profile.model = to;
      }
    }

    return config;
  });
}

export async function updateConfigToUseProfiles_20231117() {
  await updateConfig(['apiKey', 'model', 'customPrompts', 'debug'], async (oldConfig) => {
    // Check if there is an old config and no profiles key
    if (oldConfig.model && !oldConfig.profiles) {
      // Found old configuration, migrate to new profile-based format
      const defaultProfileConfig = {
        model: oldConfig.model || 'gpt-3.5-turbo-16k',
        customPrompts: oldConfig.customPrompts || [],
      };

      // Wrap the default profile configuration into the new profiles structure
      return {
        apiKey: oldConfig.apiKey || '',
        defaultProfile: 'default',
        debug: oldConfig.debug || false,
        profiles: {
          default: defaultProfileConfig,
        },
      };
    }

    return oldConfig;
  });

  // Clear the old configuration keys that are no longer relevant
  await chrome.storage.sync.remove(['model', 'customPrompts']);
}

// Update models to change "gpt-4-1106-preview" to "gpt-4-turbo-preview"
export async function updateModelNaming_20240129() {
  await updateModelName('gpt-4-1106-preview', 'gpt-4-turbo-preview');
}

// Update models to change "gpt-4-turbo-preview" to "gpt-4-turbo"
export async function updateModelNaming_20240423() {
  await updateModelName('gpt-4-turbo-preview', 'gpt-4-turbo');
}
