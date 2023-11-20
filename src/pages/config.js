document.addEventListener('DOMContentLoaded', async () => {
  const status = document.getElementById('status');

  const profileSelector = document.getElementById('profileSelector');

  const name = document.getElementById('name');
  const apiKey = document.getElementById('apiKey');
  const model = document.getElementById('model');
  const customPrompts = document.getElementById('customPrompts');
  const debug = document.getElementById('debug');
  const isDefault = document.getElementById('default');

  let config;
  let profiles;
  let currentProfile;
  let debugSet;

  function buildDefaultProfile() {
    return {
      apiKey: '',
      model: 'gpt-3.5-turbo-16k',
      customPrompts: [],
    };
  }

  async function saveProfiles() {
    await chrome.storage.sync.set({
      profiles: profiles,
      debug: debugSet,
    });

    await reloadProfiles();
  }

  async function reloadProfiles() {
    config = await chrome.storage.sync.get(['debug', 'profiles']);

    profiles = config.profiles || {
      defaultProfile: 'default',
      default: buildDefaultProfile(),
    };

    debugSet = !!(config.debug || false);

    if (profiles.defaultProfile in profiles) {
      currentProfile = profiles.defaultProfile;
    } else {
      // Something went wrong and there is no default profile. Create a new
      // default one and save it real quick.
      profiles.defaultProfile = 'default';
      profiles[currentProfile] = buildDefaultProfile();

      await chrome.storage.sync.set({
        profiles: profiles,
        debug: debugSet,
      });

      currentProfile = 'default';
    }

    // Load profiles into the dropdown and select the current profile.
    // Sort the profiles such that the default profile is always first.
    const sortedProfileNames = Object.keys(profiles).sort((a, b) => {
      if (a === profiles.defaultProfile) return -1;
      if (b === profiles.defaultProfile) return 1;
      return a.localeCompare(b);
    });

    // Clear the current options before we repopulate them
    profileSelector.innerHTML = '';

    // Populate the profile selector dropdown
    sortedProfileNames.forEach((name) => {
      // defaultProfile is a special key that is used to store the name of the
      // default profile rather than the profile data itself.
      if (name === 'defaultProfile') {
        return;
      }

      const option = new Option(name, name);
      option.selected = name == currentProfile;
      profileSelector.add(option);
    });

    await selectProfile(currentProfile);

    console.log('Debug mode', debugSet);
    console.log('Profiles', profiles);
  }

  // Update the form inputs with profile values
  function selectProfile(profile) {
    debug.checked = debugSet;

    if (profile === null) {
      currentProfile = null;

      name.value = '';
      apiKey.value = '';
      model.value = 'gpt-3.5-turbo-16k';
      customPrompts.value = '';
      isDefault.checked = false;

      return;
    }

    if (profile in profiles) {
      currentProfile = profile;
      const data = profiles[currentProfile];

      name.value = profile;
      apiKey.value = data.apiKey || '';
      model.value = data.model || 'gpt-3.5-turbo-16k';
      customPrompts.value = data.customPrompts.join('\n') || '';
      isDefault.checked = currentProfile === profiles.defaultProfile;

      profileSelector.value = profile;

      return;
    }

    showError(`Profile "${profile}" does not exist.`);
  }

  async function deleteCurrentProfile() {
    if (currentProfile !== profiles.defaultProfile) {
      if (confirm(`Are you sure you want to delete "${currentProfile}"? This cannot be undone.`)) {
        let profileToDelete = currentProfile;
        delete profiles[profileToDelete];
        await saveProfiles();
        showSuccess(`Profile "${profileToDelete}" deleted.`);
      }
    } else {
      showError('Cannot delete the default profile.');
    }
  }

  async function saveProfile() {
    const name = document.getElementById('name').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('model').value.trim();
    const customPrompts = document.getElementById('customPrompts').value.split('\n');
    const debug = document.getElementById('debug').checked;
    const isDefault = document.getElementById('default').checked;

    if (name == 'defaultProfile') {
      showError('Cannot use "defaultProfile" as a profile name.');
      return;
    }

    if (name == '') {
      showError('Profile name cannot be empty.');
      return;
    }

    if (apiKey == '') {
      showError('API key cannot be empty.');
      return;
    }

    // In case the user changed the profile name, delete the old profile.
    delete profiles[currentProfile];

    // Then add the updated profile
    profiles[name] = {
      apiKey: apiKey,
      model: model,
      customPrompts: customPrompts,
    };

    if (isDefault) {
      profiles.defaultProfile = name;
    }

    debugSet = debug;

    // Save the updated profiles object to chrome's storage
    await saveProfiles();
    await selectProfile(name);

    // Show saved status
    showSuccess('Settings saved.');
    window.scrollTo(0, document.body.scrollHeight);
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
    await selectProfile(null);
  });

  // Handler to delete the current profile
  document.getElementById('delete-profile-btn').addEventListener('click', async () => {
    await deleteCurrentProfile();
  });

  // Form submission handler
  document.getElementById('save-profile-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    await saveProfile();
  });

  // Load profiles on page load
  await reloadProfiles();
});
