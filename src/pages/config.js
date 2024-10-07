document.addEventListener('DOMContentLoaded', async () => {
  const defaultModel = 'gpt-4o-mini';

  const maxPromptBytes = 8192;
  const customPromptsCounter = document.getElementById('customPromptsCounter');

  const status = document.getElementById('status');

  const profileSelector = document.getElementById('profileSelector');

  // Global options
  const apiKey = document.getElementById('apiKey');
  const debug = document.getElementById('debug');

  // Profile options
  const name = document.getElementById('name');
  const customPrompts = document.getElementById('customPrompts');
  const isDefault = document.getElementById('default');

  // Model-related widgets
  const refreshModelsBtn = document.getElementById('refresh-models-btn');
  const saveProfileBtn = document.getElementById('save-profile-btn');
  const modelSelect = document.getElementById('model');

  let config;
  let currentProfile;

  function updateCustomPromptsCounter() {
    const encoder = new TextEncoder();
    let byteCount = encoder.encode(customPrompts.value).length;

    if (byteCount > maxPromptBytes) {
      let low = 0;
      let high = customPrompts.value.length;
      let mid;
      while (low < high) {
        mid = Math.floor((low + high) / 2);
        byteCount = encoder.encode(customPrompts.value.substring(0, mid)).length;

        if (byteCount > maxPromptBytes) {
          high = mid;
        } else {
          low = mid + 1;
        }
      }

      customPrompts.value = customPrompts.value.substring(0, high - 1);
      byteCount = encoder.encode(customPrompts.value).length;
    }

    customPromptsCounter.textContent = `${byteCount}/${maxPromptBytes}`;

    // Update the color of the byte counter based on the byte count
    customPromptsCounter.classList.remove('text-danger');
    customPromptsCounter.classList.remove('text-muted');

    if (byteCount >= maxPromptBytes) {
      customPromptsCounter.classList.add('text-danger');
    } else {
      customPromptsCounter.classList.add('text-muted');
    }
  }

  function buildDefaultProfile() {
    return {
      model: defaultModel,
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
    const model = modelSelect.value.trim();
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
    selectProfile(name);

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
      selectProfile(config.defaultProfile);
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
    config = await chrome.storage.sync.get(['apiKey', 'defaultProfile', 'debug', 'models', 'profiles', ...profileKeys]);
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

    // Populate the model selector dropdown if possible
    if (config.models && config.models.length > 0) {
      populateModelOptions(config.models);
      modelSelect.disabled = false;
      saveProfileBtn.disabled = false;
    } else {
      modelSelect.disabled = true;
      saveProfileBtn.disabled = true;
    }

    selectProfile(currentProfile);
  }

  function populateModelOptions(models) {
    // Clear existing options
    modelSelect.innerHTML = '';

    // Populate the models dropdown
    models.forEach((modelName) => {
      const option = new Option(modelName, modelName);
      modelSelect.add(option);
    });
  }

  async function fetchAvailableModels(apiKey) {
    const headers = {
      Authorization: `Bearer ${apiKey}`,
    };

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: headers,
      });

      if (!response.ok) {
        console.error('Error fetching models:', response);
        throw new Error(`Error fetching models: ${response.statusText}`);
      }

      const data = await response.json();

      models = data.data
        // We only want the model IDs
        .map((model) => model.id)
        // Filter out models that are not GPT-3 or GPT-4
        .filter((model) => model.startsWith('gpt-'))
        // Filter out models matching `-\d\d\d\d`
        .filter((model) => !model.match(/-\d\d\d\d/));

      models.sort();

      return models;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async function refreshAvailableModels() {
    // Disable the button to prevent multiple clicks
    refreshModelsBtn.disabled = true;
    refreshModelsBtn.textContent = 'Refreshing...';

    // Store the currently selected model
    const currentModel = modelSelect.value;

    try {
      const apiKeyValue = apiKey.value.trim();

      if (!apiKeyValue) {
        showError('Please enter your OpenAI API key before refreshing models.');
        return;
      }

      const models = await fetchAvailableModels(apiKeyValue);

      if (models.length === 0) {
        showError('No models retrieved. Please check your API key and try again.');
        return;
      }

      // Store models in config
      config.models = models;
      await chrome.storage.sync.set(config);

      // Populate the models dropdown
      populateModelOptions(models);

      // Enable the models select and save button
      modelSelect.disabled = false;
      saveProfileBtn.disabled = false;

      showSuccess('Available models have been refreshed.');

      // Restore the previously selected model... if it still exists.
      if (models.includes(currentModel)) {
        modelSelect.value = currentModel;
      } else {
        modelSelect.value = defaultModel;
      }
    } catch (error) {
      showError(`Failed to refresh models: ${error.message}`);
    } finally {
      refreshModelsBtn.disabled = false;
      refreshModelsBtn.textContent = 'Refresh available models';
    }
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
      modelSelect.value = data.model || defaultModel;
      customPrompts.value = data.customPrompts.join('\n') || '';
      isDefault.checked = profile === config.defaultProfile;

      // Update the byte counter after setting the prompt value
      updateCustomPromptsCounter();

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

  // Event listener for the refresh models button
  refreshModelsBtn.addEventListener('click', async () => {
    await refreshAvailableModels();
  });

  // Powers the display of the custom prompts byte counter
  customPrompts.addEventListener('input', updateCustomPromptsCounter);

  // Load config on page load
  await reloadConfig();
});
