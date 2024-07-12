async function updateConfig(keys, callback) {
  let config = await chrome.storage.sync.get(keys);
  config = await callback(config);
  return chrome.storage.sync.set(config);
}

const defaultProfile = {
  model: 'gpt-3.5-turbo-16k',
  customPrompts: ['Please summarize the contents of this web page for brevity.'],
};

export async function setDefaultConfig() {
  await updateConfig(null, async (config) => {
    config.profiles ||= [];
    config.debug ||= false;
    config.apiKey ||= '';

    if (!config.defaultProfile) {
      if (config.profiles.length === 0) {
        config.profiles = ['default'];
        config.profile__default = defaultProfile;
        config.defaultProfile = 'default';
      }
    } else if (config.profiles.indexOf(config.defaultProfile) === -1) {
      config.profiles.push(config.defaultProfile);
      config['profile__' + config.defaultProfile] = defaultProfile;
    }

    return config;
  });
}

async function updateModelName(from, to) {
  await updateConfig(['profiles'], async (config) => {
    if (Array.isArray(config.profiles)) {
      // New structure: profiles is an array
      for (const profileName of config.profiles) {
        const profileKey = `profile__${profileName}`;
        const profileData = await chrome.storage.sync.get(profileKey);

        if (profileData[profileKey].model === from) {
          profileData[profileKey].model = to;
          await chrome.storage.sync.set({ [profileKey]: profileData[profileKey] });
        }
      }
    } else {
      // Old structure: profiles is an object
      for (const profileName of Object.keys(config.profiles || {})) {
        const profile = config.profiles[profileName];

        if (profile.model === from) {
          profile.model = to;
        }
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

// Move profiles from config.profiles (object) to config.profiles (array),
// where each name corresponds to a key in the root config object, prefixed by
// "profile__".
export async function updateProfileStructure_20240620() {
  await updateConfig(['profiles'], async (oldConfig) => {
    if (Array.isArray(oldConfig.profiles)) {
      return oldConfig;
    }

    const newConfig = {};

    for (const name of Object.keys(oldConfig.profiles || {})) {
      const profile = oldConfig.profiles[name];
      newConfig['profile__' + name] = profile;
    }

    newConfig.profiles = Object.keys(oldConfig.profiles || {});

    return newConfig;
  });
}
