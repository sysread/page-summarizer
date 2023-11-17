document.addEventListener('DOMContentLoaded', async () => {
  // Initialize profiles if they don't exist
  let storedData = await chrome.storage.sync.get('profiles');

  let profiles = storedData.profiles || {
    defaultProfile: 'default',
    default: {
      apiKey: '',
      model: 'gpt-3.5-turbo-16k',
      customPrompts: [],
      debug: false,
    },
  };

  let currentProfile = profiles.defaultProfile;

  // Function to update the form inputs with profile values
  function updateFormInputs(profileData) {
    document.getElementById('profileName').value = currentProfile;
    document.getElementById('apiKey').value = profileData.apiKey || '';
    document.getElementById('model').value = profileData.model || 'gpt-3.5-turbo-16k';
    document.getElementById('customPrompts').value = profileData.customPrompts.join('\n') || '';
    document.getElementById('debug').checked = profileData.debug || false;
  }

  // Load profiles into the dropdown and select the current profile
  const profileSelector = document.getElementById('profileSelector');

  const sortedProfileNames = Object.keys(profiles).sort((a, b) => {
    if (a === 'default') return -1;
    if (b === 'default') return 1;
    return a.localeCompare(b);
  });

  sortedProfileNames.forEach((profileName) => {
    if (profileName !== 'defaultProfile') {
      const option = new Option(profileName, profileName);

      profileSelector.add(option);

      if (currentProfile === profileName) {
        option.selected = true;
      }
    }
  });

  // Update form inputs when profile is changed
  profileSelector.addEventListener('change', (e) => {
    currentProfile = e.target.value;
    updateFormInputs(profiles[currentProfile]);
  });

  // Populate fields on initial load
  updateFormInputs(profiles[currentProfile]);

  // Handler to save profile name
  document.getElementById('save-profile-name-btn').addEventListener('click', () => {
    const newProfileName = document.getElementById('profileName').value.trim();
    const oldProfileName = currentProfile;

    if (!newProfileName) {
      alert('Profile name cannot be empty.');
      return;
    }

    if (newProfileName !== oldProfileName && profiles[newProfileName]) {
      alert('Profile with this name already exists.');
      return;
    }

    if (oldProfileName === 'default') {
      alert('Cannot rename the default profile.');
      document.getElementById('profileName').value = 'default';
      return;
    }

    // Rename the profile key in the `profiles` object
    if (newProfileName !== oldProfileName) {
      profiles[newProfileName] = profiles[oldProfileName];
      delete profiles[oldProfileName];

      // Update the dropdown
      const options = profileSelector.options;
      for (let i = 0; i < options.length; i++) {
        if (options[i].value === oldProfileName) {
          options[i].value = newProfileName;
          options[i].text = newProfileName;
          break;
        }
      }

      currentProfile = newProfileName;
      profileSelector.value = newProfileName;

      // Save the change to storage
      chrome.storage.sync.set({ profiles });
    }
  });

  // Handler to add new profile
  document.getElementById('add-profile-btn').addEventListener('click', () => {
    const newProfileName = prompt('Enter a name for the new profile:');

    if (newProfileName && !profiles[newProfileName]) {
      profiles[newProfileName] = {
        apiKey: profiles.default.apiKey,
        model: 'gpt-3.5-turbo-16k',
        customPrompts: [],
        debug: false,
      };

      const newOption = new Option(newProfileName, newProfileName);
      profileSelector.add(newOption);
      profileSelector.value = newProfileName;
      currentProfile = newProfileName;
      updateFormInputs(profiles[currentProfile]);
    } else if (profiles[newProfileName]) {
      alert('A profile with this name already exists.');
    }
  });

  // Handler to delete the current profile
  document.getElementById('delete-profile-btn').addEventListener('click', () => {
    if (currentProfile !== 'default') {
      if (confirm(`Are you sure you want to delete the profile "${currentProfile}"?`)) {
        delete profiles[currentProfile];
        profileSelector.remove(profileSelector.selectedIndex);
        currentProfile = 'default';
        profileSelector.value = 'default';
        updateFormInputs(profiles[currentProfile]);
      }
    } else {
      alert('Cannot delete the default profile.');
    }
  });

  // Close button handler
  const closeButton = document.getElementById('close-btn');
  closeButton.addEventListener('click', () => {
    document.getElementById('status').style.display = 'none';
  });

  // Form submission handler
  document.getElementById('config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    closeButton.style.display = 'none';

    // Update the current profile's settings with form input values
    profiles[currentProfile] = {
      apiKey: document.getElementById('apiKey').value,
      model: document.getElementById('model').value,
      customPrompts: document.getElementById('customPrompts').value.split('\n'),
      debug: document.getElementById('debug').checked,
    };

    // Save the updated profiles object to chrome's storage
    await chrome.storage.sync.set({ profiles });

    // Show saved status
    const statusText = document.getElementById('status-text');
    const statusEl = document.getElementById('status');
    statusText.textContent = 'Settings saved.';
    statusEl.style.display = 'block';
    closeButton.style.display = 'block';
  });
});
