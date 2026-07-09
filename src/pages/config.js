import { wantModel, isReasoningModel } from '../gpt.js';
import { addProfile, deleteProfile, reorderProfiles, buildDefaultProfile } from '../profiles.js';
import { initTheme, setTheme } from './theme.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();

  const defaultModel = 'gpt-4o-mini';
  const defaultReasoning = 'medium';

  const maxPromptBytes = 8192;
  const customPromptsCounter = document.getElementById('customPromptsCounter');

  const status = document.getElementById('status');

  const profileButtonContainer = document.getElementById('profileButtonContainer');

  // Global options
  const apiKey = document.getElementById('apiKey');
  const apiKeyHint = document.getElementById('apiKeyHint');
  const toggleApiKeyBtn = document.getElementById('toggle-api-key');
  const debug = document.getElementById('debug');

  // Profile options
  const name = document.getElementById('name');
  const customPrompts = document.getElementById('customPrompts');
  const isDefault = document.getElementById('default');

  // Model-related widgets
  const refreshModelsBtn = document.getElementById('refresh-models-btn');
  const modelCountPill = document.getElementById('modelCountPill');
  const modelRefreshPill = document.getElementById('modelRefreshPill');
  const saveProfileBtn = document.getElementById('save-profile-btn');
  const modelSelect = document.getElementById('model');
  const reasoningSelect = document.getElementById('reasoning');

  let config;
  let currentProfile;

  // Drag-and-drop state for reordering profile buttons
  let draggedProfile = null;

  function createProfileButton(profileName) {
    const button = document.createElement('button');
    button.className = 'profile-button btn btn-sm btn-outline-secondary text-nowrap';
    button.textContent = profileName;
    button.dataset.profile = profileName;
    button.draggable = true;

    button.addEventListener('click', () => selectProfile(profileName));
    button.addEventListener('dragstart', handleDragStart);
    button.addEventListener('dragover', handleDragOver);
    button.addEventListener('dragenter', handleDragEnter);
    button.addEventListener('dragleave', handleDragLeave);
    button.addEventListener('drop', handleDrop);
    button.addEventListener('dragend', handleDragEnd);

    return button;
  }

  function renderProfileButtons() {
    profileButtonContainer.innerHTML = '';
    config.profiles.forEach((name) => {
      profileButtonContainer.appendChild(createProfileButton(name));
    });
  }

  function handleDragStart(e) {
    draggedProfile = e.currentTarget.dataset.profile;
    e.currentTarget.classList.add('ps-dragging');
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDragEnter(e) {
    const target = e.currentTarget;
    if (target.dataset.profile !== draggedProfile) {
      target.classList.add('ps-drag-target');
    }
  }

  function handleDragLeave(e) {
    e.currentTarget.classList.remove('ps-drag-target');
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const targetProfile = e.currentTarget.dataset.profile;
    e.currentTarget.classList.remove('ps-drag-target');

    if (draggedProfile && targetProfile && draggedProfile !== targetProfile) {
      reorderProfiles(config, draggedProfile, targetProfile);
      chrome.storage.sync.set({ profiles: config.profiles });
      renderProfileButtons();
      selectProfile(currentProfile);
    }
  }

  function handleDragEnd() {
    draggedProfile = null;
    profileButtonContainer.querySelectorAll('.ps-dragging, .ps-drag-target').forEach((el) => {
      el.classList.remove('ps-dragging', 'ps-drag-target');
    });
  }

  // Partially mask an API key for display: show the prefix and last few
  // chars, replace the middle with dots. Short keys are fully masked.
  function maskApiKey(key) {
    if (!key) return '';
    if (key.length <= 12) return '****';
    return key.slice(0, 8) + '...' + key.slice(-4);
  }

  function updateApiKeyHint() {
    const val = apiKey.value.trim();
    if (val) {
      apiKeyHint.textContent = 'Current key: ' + maskApiKey(val);
      apiKeyHint.classList.remove('d-none');
    } else {
      apiKeyHint.classList.add('d-none');
    }
  }

  toggleApiKeyBtn.addEventListener('click', () => {
    if (apiKey.type === 'password') {
      apiKey.type = 'text';
      toggleApiKeyBtn.textContent = '\u{1F648}';
    } else {
      apiKey.type = 'password';
      toggleApiKeyBtn.textContent = '\u{1F441}';
    }
  });

  apiKey.addEventListener('input', updateApiKeyHint);

  function toggleReasoningOptions() {
    const model = modelSelect.value;

    if (!isReasoningModel(model)) {
      reasoningSelect.value = '';
      reasoningSelect.disabled = true;
    } else {
      reasoningSelect.disabled = false;
      if (currentProfile && config.profiles.includes(currentProfile)) {
        const data = config[`profile__${currentProfile}`];
        reasoningSelect.value = data.reasoning || defaultReasoning;
      } else {
        reasoningSelect.value = defaultReasoning;
      }
    }
  }

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
    const customPrompts = document.getElementById('customPrompts').value.split('\n');
    const isDefault = document.getElementById('default').checked;
    const model = modelSelect.value.trim();
    const reasoning = isReasoningModel(model) ? reasoningSelect.value.trim() : null;

    // Basic validations
    if (apiKey == '') {
      showError(`
        <p>An API key is required.</p>
        <ol>
          <li>Sign up for an OpenAI API account <a href="https://platform.openai.com/signup/">here</a>.
          <li>Get your API key from the <a href="https://platform.openai.com/api-keys">API keys</a> page.
          <li>Enter your API key in the field above.</li>
        </ol>
      `);
      return;
    }

    if (name == '') {
      showError('Profile name cannot be empty.');
      return;
    }

    const newProfile = {
      model: model,
      reasoning: reasoning,
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
      const result = deleteProfile(config, currentProfile);
      if (result.error) {
        showError(result.error);
        return;
      }

      await chrome.storage.sync.set(config);

      renderProfileButtons();
      showSuccess(`Profile "${currentProfile}" deleted.`);
      selectProfile(config.defaultProfile);
    }
  }

  async function addNewProfile() {
    const name = prompt('Enter a name for the new profile');

    if (!name) return;

    const result = addProfile(config, name);
    if (result.error) {
      showError(result.error);
      return;
    }

    await chrome.storage.sync.set(config);

    renderProfileButtons();
    selectProfile(name);
  }

  async function reloadConfig() {
    const profileKeys = (await chrome.storage.sync.get('profiles')).profiles.map((name) => `profile__${name}`);
    config = await chrome.storage.sync.get(['apiKey', 'defaultProfile', 'debug', 'models', 'modelsRefreshedAt', 'profiles', ...profileKeys]);
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
    apiKey.type = 'password';
    toggleApiKeyBtn.textContent = '\u{1F441}';
    updateApiKeyHint();

    // Load profiles into the button container in stored order (no sorting;
    // the user controls order via drag-and-drop).
    renderProfileButtons();

    // Populate the model selector dropdown if possible
    if (config.models && config.models.length > 0) {
      populateModelOptions(config.models);
      modelSelect.disabled = false;
      showModelsAvailable(config.models.length, config.modelsRefreshedAt);
    } else {
      modelSelect.disabled = true;
      showNoModels();
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
        const errorMsg = response.statusText;
        console.error('Error fetching models:', response);
        return { models: [], error: `Error fetching models: ${errorMsg}` };
      }

      const data = await response.json();
      const candidateIds = data.data.map((model) => model.id);
      const filtered = candidateIds.filter(wantModel);
      const withoutNumericSuffix = filtered.filter(id => !/-\d{4,}$/.test(id));
      const DATE_SUFFIX_RE = /-\d{4}-\d{2}-\d{2}$/;
      // Build per-base-model selection map
      const modelMap = {};
      for (const id of withoutNumericSuffix) {
        const base = id.replace(DATE_SUFFIX_RE, '');
        if (!modelMap[base]) {
          modelMap[base] = { undated: null, dated: null };
        }
        if (DATE_SUFFIX_RE.test(id)) {
          // Keep first dated if multiple exist
          if (modelMap[base].dated === null) {
            modelMap[base].dated = id;
          }
        } else {
          modelMap[base].undated = id;
        }
      }
      const chosen = Object.values(modelMap).map(({undated, dated}) => undated || dated);
      chosen.sort();
      return { models: chosen, error: null };
    } catch (error) {
      console.error(error);
      return { models: [], error: error.message };
    }
  }

  function formatRefreshTimestamp(ts) {
    const d = new Date(ts);
    const date = d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `${date} ${time} (${tz})`;
  }

  function showModelsAvailable(count, refreshedAt) {
    modelCountPill.textContent = `${count} model${count === 1 ? '' : 's'}`;
    modelCountPill.classList.remove('d-none', 'text-bg-warning', 'text-bg-danger');
    modelCountPill.classList.add('text-bg-secondary');

    if (refreshedAt) {
      modelRefreshPill.textContent = formatRefreshTimestamp(refreshedAt);
      modelRefreshPill.classList.remove('d-none', 'text-bg-warning', 'text-bg-danger');
      modelRefreshPill.classList.add('text-bg-light');
    } else {
      modelRefreshPill.classList.add('d-none');
    }
  }

  function showRefreshStatus(msg, type) {
    modelCountPill.textContent = msg;
    modelCountPill.classList.remove('d-none', 'text-bg-secondary', 'text-bg-light', 'text-bg-danger');
    modelCountPill.classList.add(type === 'danger' ? 'text-bg-danger' : 'text-bg-warning');
    modelRefreshPill.classList.add('d-none');
  }

  function showNoModels() {
    modelCountPill.textContent = 'No models loaded';
    modelCountPill.classList.remove('d-none', 'text-bg-secondary', 'text-bg-light', 'text-bg-warning');
    modelCountPill.classList.add('text-bg-danger');
    modelRefreshPill.classList.add('d-none');
  }

  async function refreshAvailableModels() {
    // Disable the button to prevent multiple clicks
    refreshModelsBtn.disabled = true;
    refreshModelsBtn.textContent = 'Refreshing...';
    showRefreshStatus('Refreshing models...', 'muted');

    // Store the currently selected model
    const currentModel = modelSelect.value;

    try {
      const apiKeyValue = apiKey.value.trim();

      if (!apiKeyValue) {
        showRefreshStatus('Enter your OpenAI API key first.', 'danger');
        return;
      }

      const result = await fetchAvailableModels(apiKeyValue);

      if (result.error) {
        showRefreshStatus(`Failed: ${result.error}`, 'danger');
        return;
      }

      const models = result.models;

      if (models.length === 0) {
        showRefreshStatus('No usable models returned', 'danger');
        return;
      }

      // Store models in config
      config.models = models;
      config.modelsRefreshedAt = Date.now();
      await chrome.storage.sync.set(config);

      // Populate the models dropdown
      populateModelOptions(models);

      // Enable the models select and save button
      modelSelect.disabled = false;
      saveProfileBtn.disabled = false;

      showModelsAvailable(models.length, config.modelsRefreshedAt);

      // Restore the previously selected model... if it still exists.
      if (models.includes(currentModel)) {
        modelSelect.value = currentModel;
      } else {
        modelSelect.value = defaultModel;
      }
      toggleReasoningOptions();
    } catch (error) {
      showRefreshStatus(`Failed: ${error.message}`, 'danger');
    } finally {
      refreshModelsBtn.disabled = false;
      refreshModelsBtn.textContent = 'Refresh models';
    }
  }

  // Update the form inputs with profile values
  function selectProfile(profile) {
    if (config.profiles.includes(profile)) {
      const data = config[`profile__${profile}`];

      currentProfile = profile;

      // Update button classes to highlight the active profile
      const buttons = profileButtonContainer.getElementsByClassName('profile-button');
      for (const button of buttons) {
        if (button.dataset.profile === currentProfile) {
          button.className = 'profile-button btn btn-sm text-nowrap btn-outline-primary active';
        } else {
          button.className = 'profile-button btn btn-sm text-nowrap btn-outline-secondary';
        }
      }

      name.value = profile;
      modelSelect.value = data.model || defaultModel;
      reasoningSelect.value = data.reasoning || '';
      customPrompts.value = data.customPrompts.join('\n') || '';
      isDefault.checked = profile === config.defaultProfile;

      // Update the model select and reasoning select based on the current model
      toggleReasoningOptions();

      // Update the byte counter after setting the prompt value
      updateCustomPromptsCounter();

      return;
    }

    showError(`Profile "${profile}" does not exist.`);
  }

  function showStatus(msg, type) {
    status.innerHTML = [
      `<div class="alert alert-${type} alert-dismissible fade show" role="alert">`,
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

  // Theme selector: applies immediately on change, no save needed
  const themeSelect = document.getElementById('theme');
  const { theme: storedTheme } = await chrome.storage.sync.get('theme');
  themeSelect.value = storedTheme || 'system';
  themeSelect.addEventListener('change', () => setTheme(themeSelect.value));

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

  // Event listener to disable/enable the reasoning effort drop down based on
  // the selected model.
  modelSelect.addEventListener('change', () => toggleReasoningOptions());

  // Powers the display of the custom prompts byte counter
  customPrompts.addEventListener('input', updateCustomPromptsCounter);

  // Load config on page load
  await reloadConfig();
});
