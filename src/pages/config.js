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
      profiles: ['default'],
      profile__default: buildDefaultProfile(),
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
      config.profiles = config.profiles.filter((profile) => profile !== currentProfile);
      delete config[`profile__${currentProfile}`];
      config.profiles.push(name);
      config[`profile__${name}`] = newProfile;
      currentProfile = name;
    }
    // The user is adding a new profile
    else if (currentProfile === null) {
      currentProfile = name;
      config.profiles.push(name);
      config[`profile__${name}`] = newProfile;
    }
    // The user is updating the current profile
    else {
      config[`profile__${name}`] = newProfile;
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
      // remove from list of profile names
      config.profiles = config.profiles.filter((profile) => profile !== currentProfile);

      // remove individual profile's config
      delete config[`profile__${currentProfile}`];

      // remove from the ui
      profileSelector.remove(profileSelector.selectedIndex);

      // save the new config
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

    // Not an error - the user probably cancelled
    if (name == '' || name == null) {
      return;
    }

    config.profiles.push(name);
    config[`profile__${name}`] = buildDefaultProfile();
    await chrome.storage.sync.set(config);

    addOption(name);

    // omg this is stupid, why do i have to do this?
    profileSelector.value = name;
    const event = new Event('change', { bubbles: true });
    profileSelector.dispatchEvent(event);
  }

  async function reloadConfig() {
    const profileKeys = (await chrome.storage.sync.get('profiles')).profiles.map((name) => `profile__${name}`);
    config = await chrome.storage.sync.get(['apiKey', 'defaultProfile', 'debug', 'profiles', ...profileKeys]);
    console.log('Config', config);

    if (config.profiles === undefined) {
      config.profiles = ['default'];
      config.defaultProfile = 'default';
      config[`profile__default`] = buildDefaultProfile();
    }

    // Update state variables
    currentProfile = config.defaultProfile;

    // Then update the form with global configs
    debug.checked = !!(config.debug || false);
    apiKey.value = config.apiKey;

    // Load profiles into the dropdown and select the current profile.
    // Sort the profiles such that the default profile is always first.
    const sortedProfileNames = config.profiles.sort((a, b) => {
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
    if (config.profiles.includes(profile)) {
      const data = config[`profile__${profile}`];

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

  // Powers the button that opens the OpenAI API page
  document.getElementById('open-api-keys').addEventListener('click', function () {
    chrome.tabs.create({ url: 'https://platform.openai.com/api-keys' });
  });

  // Powers the button that exports the current profile config
  document.getElementById('export-profiles-btn').addEventListener('click', function () {
    if (!config) {
      showStatus('No profiles to export.', 'danger');
      return;
    }

    const profiles = {};
    config.profiles.forEach((name) => {
      profiles[name] = config[`profile__${name}`];
    });

    if (Object.keys(profiles).length === 0) {
      showStatus('No profiles to export.', 'danger');
      return;
    }

    const configStr = JSON.stringify(profiles, null, 2);
    const blob = new Blob([configStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'PageSummarizeProfiles.json';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccess('Profiles exported successfully.');
  });

  // Powers the button that imports the profile config file (part 1)
  document.getElementById('import-profiles-btn').addEventListener('click', function () {
    document.getElementById('import-profiles-file').click(); // Trigger file input
  });

  // Powers the button that imports the profile config file (part 2)
  document.getElementById('import-profiles-file').addEventListener('change', function (event) {
    const fileReader = new FileReader();

    // Once the file is read, import the profiles into the current config
    fileReader.onload = async function () {
      try {
        const importedProfiles = JSON.parse(fileReader.result);
        const importedProfileNames = Object.keys(importedProfiles);

        config.profiles = [...new Set([...config.profiles, ...importedProfileNames])];

        importedProfileNames.forEach((name) => {
          config[`profile__${name}`] = importedProfiles[name];
        });

        await chrome.storage.sync.set(config);
        await reloadConfig();

        showSuccess('Profiles imported successfully.');
      } catch (error) {
        showError('Failed to import profiles: ' + error.message);
      }
    };

    // Read the file, triggering the above callback
    const file = event.target.files[0];
    if (file) {
      fileReader.readAsText(file);
    }
  });

  // Load config on page load
  await reloadConfig();
});
