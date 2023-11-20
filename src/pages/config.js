document.addEventListener('DOMContentLoaded', async () => {
  const status = document.getElementById('status');

  const profileSelector = document.getElementById('profileSelector');

  // Global options
  const apiKey = document.getElementById('apiKey');
  const debug = document.getElementById('debug');

  // Profile options
  const name = document.getElementById('name');
  const model = document.getElementById('model');
  const customPrompts = document.getElementById('customPrompts');
  const isDefault = document.getElementById('default');

  let config;
  let currentProfile;

  function buildDefaultProfile() {
    return {
      model: 'gpt-3.5-turbo-16k',
      customPrompts: [],
    };
  }

  function buildDefaultConfig() {
    return {
      apiKey: '',
      debug: false,
      defaultProfile: 'default',
      profiles: {
        default: buildDefaultProfile(),
      },
    };
  }

  async function saveConfig() {
    // Global options
    const debug = document.getElementById('debug').checked;
    const apiKey = document.getElementById('apiKey').value.trim();

    // Profile options
    const name = document.getElementById('name').value.trim();
    const model = document.getElementById('model').value.trim();
    const customPrompts = document.getElementById('customPrompts').value.split('\n');
    const isDefault = document.getElementById('default').checked;

    // Basic validations
    if (apiKey == '') {
      showError('An API key is required. Get one <a href="https://beta.openai.com">here</a>.');
      return;
    }

    if (name == '') {
      showError('Profile name cannot be empty.');
      return;
    }

    const newProfile = {
      model: model,
      customPrompts: customPrompts,
    };

    // The user is changing the current profile's name
    if (currentProfile !== null && name !== currentProfile) {
      delete config.profiles[currentProfile];
      config.profiles[name] = newProfile;
      currentProfile = name;
    }
    // The user is adding a new profile
    else if (currentProfile === null) {
      currentProfile = name;
      config.profiles[name] = newProfile;
    }
    // The user is updating the current profile
    else {
      config.profiles[name] = newProfile;
    }

    config.debug = debug;
    config.apiKey = apiKey;

    if (isDefault) {
      config.defaultProfile = name;
    }

    await chrome.storage.sync.set(config);
    await reloadConfig();
    await selectProfile(name);

    window.scrollTo(0, 0);
    showSuccess('Settings saved.');
  }

  async function deleteCurrentProfile() {
    if (currentProfile === config.defaultProfile) {
      showError('Cannot delete the default profile.');
      return;
    }

    if (confirm(`Are you sure you want to delete "${currentProfile}"? This cannot be undone.`)) {
      delete config.profiles[currentProfile];
      profileSelector.remove(profileSelector.selectedIndex);
      await chrome.storage.sync.set(config);
      showSuccess(`Profile "${currentProfile}" deleted.`);
      await selectProfile(config.defaultProfile);
    }
  }

  async function addNewProfile() {
    const name = prompt('Enter a name for the new profile');

    if (name in config.profiles) {
      showError(`Profile "${name}" already exists.`);
      return;
    }

    config.profiles[name] = buildDefaultProfile();
    await chrome.storage.sync.set(config);

    addOption(name);

    // omg this is stupid, why do i have to do this?
    profileSelector.value = name;
    const event = new Event('change', { bubbles: true });
    profileSelector.dispatchEvent(event);
  }

  async function reloadConfig() {
    config = await chrome.storage.sync.get(['apiKey', 'defaultProfile', 'debug', 'profiles']);
    console.log('Config', config);

    if (config.profiles === undefined) {
      config.profiles = { profiles: buildDefaultProfile() };
      config.defaultProfile = 'default';
    }

    // Update state variables
    currentProfile = config.defaultProfile;

    // Then update the form with global configs
    debug.checked = !!(config.debug || false);
    apiKey.value = config.apiKey;

    // Load profiles into the dropdown and select the current profile.
    // Sort the profiles such that the default profile is always first.
    const sortedProfileNames = Object.keys(config.profiles).sort((a, b) => {
      if (a === config.defaultProfile) return -1;
      if (b === config.defaultProfile) return 1;
      return a.localeCompare(b);
    });

    // Clear the current options before we repopulate them
    profileSelector.innerHTML = '';

    // Populate the profile selector dropdown
    sortedProfileNames.forEach(addOption);

    await selectProfile(currentProfile);
  }

  function addOption(name) {
    const option = new Option(name, name);
    option.selected = name == currentProfile;
    profileSelector.add(option);
    return option;
  }

  // Update the form inputs with profile values
  function selectProfile(profile) {
    if (profile in config.profiles) {
      const data = config.profiles[profile];

      currentProfile = profile;
      profileSelector.value = profile;

      name.value = profile;
      model.value = data.model || 'gpt-3.5-turbo-16k';
      customPrompts.value = data.customPrompts.join('\n') || '';
      isDefault.checked = profile === config.defaultProfile;

      return;
    }

    showError(`Profile "${profile}" does not exist.`);
  }

  function showStatus(msg, type) {
    status.innerHTML = [
      `<div class="alert alert-${type} alert-dismissible fadee" role="alert">`,
      `   <div>${msg}</div>`,
      '   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
      '</div>',
    ].join('');
  }

  function showError(msg) {
    showStatus(msg, 'danger');
  }

  function showSuccess(msg) {
    showStatus(msg, 'success');
  }

  // Update form inputs when profile is changed
  profileSelector.addEventListener('change', (e) => {
    selectProfile(e.target.value);
  });

  // Handler to add new profile
  document.getElementById('add-profile-btn').addEventListener('click', async () => {
    await addNewProfile();
  });

  // Handler to delete the current profile
  document.getElementById('delete-profile-btn').addEventListener('click', async () => {
    await deleteCurrentProfile();
  });

  // Form submission handler
  document.getElementById('save-profile-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    await saveConfig();
  });

  // Load config on page load
  await reloadConfig();
});
