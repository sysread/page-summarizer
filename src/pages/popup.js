document.addEventListener('DOMContentLoaded', async function () {
  const port = chrome.runtime.connect({ name: 'summarize' });
  const target = document.getElementById('summary');
  const profileSelector = document.getElementById('profileSelector');
  const modelDropdown = document.getElementById('model');
  const extra = document.getElementById('extra-instructions');

  //----------------------------------------------------------------------------
  // powers the doc hint in the extra instructions text area
  //----------------------------------------------------------------------------
  const hint = 'Please summarize this web page.';
  extra.value ||= hint;

  extra.addEventListener('focus', () => {
    if (extra.value == hint) {
      extra.value = '';
      extra.classList.remove('hint');
    }
  });

  extra.addEventListener('blur', () => {
    if (extra.value == '') {
      extra.value = hint;
      extra.classList.add('hint');
    }
  });

  //----------------------------------------------------------------------------
  // powers the model dropdown
  //----------------------------------------------------------------------------
  async function setModel(model = null) {
    if (model == null) {
      const profileName = profileSelector.value;
      const config = await chrome.storage.sync.get('profiles');
      modelDropdown.value = config.profiles[profileName].model;
    } else {
      modelDropdown.value = model;
    }
  }

  async function getModel() {
    const selectedModel = modelDropdown ? modelDropdown.value : undefined;
    return selectedModel || 'gpt-3.5-turbo-16k'; // Fallback to a default model
  }

  //----------------------------------------------------------------------------
  // powers the profile dropdown
  //----------------------------------------------------------------------------

  // Load profiles and set the current profile in the dropdown
  async function loadProfiles() {
    const config = await chrome.storage.sync.get('profiles');
    let profiles = config.profiles || { default: { model: 'gpt-3.5-turbo-16k' }, defaultProfile: 'default' };

    const sortedKeys = Object.keys(profiles).sort((a, b) => {
      if (a === profiles.defaultProfile) return -1;
      if (b === profiles.defaultProfile) return 1;
      return a.localeCompare(b);
    });

    sortedKeys.forEach((profileName) => {
      if (profileName !== 'defaultProfile') {
        const option = new Option(profileName, profileName);
        profileSelector.add(option);
      }
    });

    profileSelector.value = profiles.defaultProfile;
    setModel(profiles[profiles.defaultProfile].model);
  }

  // Update the model and extra instructions when the profile changes
  async function selectProfile() {
    const selectedProfileName = profileSelector.value;
    const config = await chrome.storage.sync.get('profiles');

    if (config.profiles && config.profiles[selectedProfileName]) {
      const selectedProfile = config.profiles[selectedProfileName];

      setModel(selectedProfile.model);

      // Update "custom instructions" textarea with the profile's custom prompts
      extra.value = selectedProfile.customPrompts.join('\n');

      // Make sure to handle the case when there are no custom prompts
      if (!extra.value) {
        extra.value = hint;
        extra.classList.add('hint');
      } else {
        // Remove the hint class if the custom prompts are not empty
        extra.classList.remove('hint');
      }
    } else {
      console.error(`Profile "${selectedProfileName}" not found.`);
      setModel('gpt-3.5-turbo-16k'); // Fallback to a default model
      extra.value = hint; // Fallback instructions
      extra.classList.add('hint');
    }
  }

  // Initial call to load profiles
  await loadProfiles();
  await selectProfile();

  // Update profile when the selector changes
  profileSelector.addEventListener('change', selectProfile);

  //----------------------------------------------------------------------------
  // Autoscroll to the bottom of the page when new content is added. If the
  // user scrolls up, disable autoscroll until they scroll back to the bottom.
  //----------------------------------------------------------------------------
  let autoScroll = true;

  window.addEventListener('scroll', () => {
    const { scrollHeight, scrollTop, clientHeight } = document.documentElement;
    autoScroll = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
  });

  function format(text) {
    if (text == null || text.length == 0) {
      return 'Received empty string';
    }

    return marked.marked(text);
  }

  async function restoreSummary() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0].url;
    const config = await chrome.storage.local.get('results');

    if (config.results && config.results[url]) {
      const result = config.results[url];

      // Check if the result is a string (old format) or an object (new format)
      if (typeof result === 'string') {
        return { summary: result, model: config.model }; // Convert to new format for consistency
      }

      // It's already in the new format (object with model and summary)
      return result;
    } else {
      return null;
    }
  }

  async function setSummary(summary, model) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0].url;
    const config = await chrome.storage.local.get('results');

    let results = config.results || {};
    results[url] = { model: model, summary: summary };
    chrome.storage.local.set({ results: results });
  }

  function updateSummary(message) {
    requestAnimationFrame(() => {
      target.innerHTML = message;

      // Autoscroll to the bottom of the page
      if (autoScroll) {
        window.scrollTo(0, document.body.scrollHeight);
      }
    });
  }

  function reportError(message) {
    updateSummary(`<span style="color: red; font-style: italic;">Error: ${message}</span>`);
  }

  async function requestNewSummary() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const model = await getModel();

    port.postMessage({
      action: 'SUMMARIZE',
      tabId: tabs[0].id,
      extra: extra.value,
      model: model,
      profile: profileSelector.value,
    });
  }

  // Restore the last page summary when the popup is opened
  restoreSummary().then((result) => {
    if (result != null) {
      setModel(result.model);

      updateSummary(marked.marked(result.summary));

      // When restoring a summary, force the page to scroll to the top
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    }
  });

  // Flag to prevent multiple clicks
  let working = false;

  // Handle the summarize button click
  document.getElementById('summarize').addEventListener('click', function () {
    if (working) {
      return;
    }

    working = true;
    updateSummary('Fetching summary...');
    requestNewSummary();
  });

  // Set up the port message listener
  let lastMessage = null;

  port.onMessage.addListener(async function (msg) {
    if (msg == null) {
      return;
    }

    switch (msg.action) {
      case 'GPT_MESSAGE':
        lastMessage = msg.summary;
        updateSummary(format(msg.summary));
        break;

      case 'GPT_DONE':
        const model = await getModel();
        setSummary(lastMessage, model);
        working = false;
        break;

      case 'GPT_ERROR':
        reportError(msg.error);
        working = false;
        break;

      default:
        reportError('Failed to fetch summary.');
        working = false;
        break;
    }
  });
});
