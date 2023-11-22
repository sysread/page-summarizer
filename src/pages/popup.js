document.addEventListener('DOMContentLoaded', async function () {
  const target = document.getElementById('summary');
  const profileSelector = document.getElementById('profileSelector');
  const modelDropdown = document.getElementById('model');
  const instructions = document.getElementById('instructions');

  //----------------------------------------------------------------------------
  // Port management
  //----------------------------------------------------------------------------
  let port;
  let portIsConnected = false;

  function connectPort() {
    port = chrome.runtime.connect({ name: 'summarize' });
    portIsConnected = true;

    // Attach the message listener
    port.onMessage.addListener(onMessage);

    // If the port disconnects, try to reconnect once after a short delay.
    port.onDisconnect.addListener(() => {
      portIsConnected = false;
      setTimeout(connectPort);
    });
  }

  function postMessage(msg) {
    if (!portIsConnected) {
      connectPort();
    }

    port.postMessage(msg);
  }

  connectPort();

  // Send regular "keep-alive" messages to the background script to ensure it
  // continues running for as long as the user keeps the popup open.
  setInterval(() => {
    postMessage({ action: 'KEEP_ALIVE' });
  }, 1000);

  //----------------------------------------------------------------------------
  // Message listener
  //----------------------------------------------------------------------------
  let lastMessage = null;

  async function onMessage(msg) {
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
  }

  //----------------------------------------------------------------------------
  // Display error messages from the background script.
  //----------------------------------------------------------------------------
  function reportError(msg) {
    document.getElementById('errors').innerHTML = [
      `<div class="alert alert-danger alert-dismissible fadee" role="alert">`,
      `   <div>${msg}</div>`,
      '   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
      '</div>',
    ].join('');
  }

  //----------------------------------------------------------------------------
  // Controlling the popup window size is a real pain in extensions. This
  // function attempts to set the window size to 'auto' on small screen
  // devices, like mobile browsers, where the popup is likely to have been
  // opened in a full screen tab (as is the case with Kiwi). On larger screens,
  // the popup is set to a fixed size of 600px x 600px.
  //----------------------------------------------------------------------------
  function setWindowSize() {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

    if (isMobile) {
      document.body.style.width = 'auto';
      document.body.style.height = 'auto';
    } else {
      document.body.style.width = '600px';
      document.body.style.height = '600px';
    }
  }

  setWindowSize();

  //----------------------------------------------------------------------------
  // Powers the button that opens the options page
  //----------------------------------------------------------------------------
  document.getElementById('options').addEventListener('click', function () {
    chrome.runtime.openOptionsPage(); // if using options_page in manifest
  });

  //----------------------------------------------------------------------------
  // Powers the doc hint in the instructions text area. Provides a default when
  // the user has not yet created a profile. Select all text in the
  // instructions textarea when the user clicks on it.
  //----------------------------------------------------------------------------
  const defaultInstruction = 'Please summarize this web page.';

  instructions.value ||= defaultInstruction;

  instructions.addEventListener('focus', () => {
    instructions.select();
  });

  instructions.addEventListener('focus', () => {
    if (instructions.value == defaultInstruction) {
      instructions.value = '';
      instructions.classList.remove('hint');
    }
  });

  instructions.addEventListener('blur', () => {
    if (instructions.value == '') {
      instructions.value = defaultInstruction;
      instructions.classList.add('hint');
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
  const noProfilesMessage =
    'No profiles found. Use the gear icon above or right-click the extension ' +
    'icon and select "Options" to create a profile.';

  // Load profiles and set the current profile in the dropdown
  async function loadProfiles() {
    const { defaultProfile, profiles } = await chrome.storage.sync.get(['defaultProfile', 'profiles']);

    if (!profiles) {
      reportError(noProfilesMessage);
      return;
    }

    const sortedKeys = Object.keys(profiles).sort((a, b) => {
      if (a === defaultProfile) return -1;
      if (b === defaultProfile) return 1;
      return a.localeCompare(b);
    });

    sortedKeys.forEach((profileName) => {
      const option = new Option(profileName, profileName);
      profileSelector.add(option);
    });

    profileSelector.value = defaultProfile;
    setModel(profiles[defaultProfile].model);
  }

  // Update the model and instructions when the profile changes
  async function selectProfile() {
    const selectedProfileName = profileSelector.value;
    const config = await chrome.storage.sync.get(['defaultProfile', 'profiles']);

    if (config.profiles && config.profiles[selectedProfileName]) {
      const selectedProfile = config.profiles[selectedProfileName];

      setModel(selectedProfile.model);

      // Update "custom instructions" textarea with the profile's custom prompts
      instructions.value = selectedProfile.customPrompts.join('\n');

      // Make sure to handle the case when there are no custom prompts
      if (!instructions.value) {
        instructions.value = hint;
        instructions.classList.add('hint');
      } else {
        // Remove the hint class if the custom prompts are not empty
        instructions.classList.remove('hint');
      }
    } else if (selectedProfileName === '') {
      reportError(noProfilesMessage);
      setModel('gpt-3.5-turbo-16k'); // Fallback to a default model
      instructions.value = hint; // Fallback instructions
      instructions.classList.add('hint');
    } else {
      reportError(`Profile "${selectedProfileName}" not found.`);
      setModel('gpt-3.5-turbo-16k'); // Fallback to a default model
      instructions.value = hint; // Fallback instructions
      instructions.classList.add('hint');
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
      return '';
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
      document.getElementById('summaryCard').classList.remove('visually-hidden');

      target.innerHTML = message;

      // Autoscroll to the bottom of the page
      if (autoScroll) {
        window.scrollTo(0, document.body.scrollHeight);
      }
    });
  }

  async function requestNewSummary() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const model = await getModel();

    postMessage({
      action: 'SUMMARIZE',
      tabId: tabs[0].id,
      instructions: instructions.value,
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
});
