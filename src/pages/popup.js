document.addEventListener('DOMContentLoaded', async function () {
  const defaultModel = 'gpt-4o-mini';
  const defaultReasoning = 'medium';

  const query = new URLSearchParams(window.location.search);

  const target = document.getElementById('summary');
  const modelDropdown = document.getElementById('model');
  const reasoningDropdown = document.getElementById('reasoning');
  const instructions = document.getElementById('instructions');
  const profileContainer = document.getElementById('profileContainer');

  //----------------------------------------------------------------------------
  // Mobile device detection
  //----------------------------------------------------------------------------
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
  const isMobileUserAgent = /Mobi|Android/i.test(navigator.userAgent);
  const isSmallScreen = screen.width < 768;
  const isMobile = isTouchDevice && (isMobileUserAgent || isSmallScreen);

  //----------------------------------------------------------------------------
  // Tab ID
  //----------------------------------------------------------------------------
  let tabId;

  if (query.has('tabId')) {
    tabId = parseInt(query.get('tabId'), 10);
  } else {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tabs[0].id;
  }

  // Assigns the tabId to the new window link, so that when you open the popup
  // in a new window, the new window will have the same tabId.
  document.getElementById('newWindow').addEventListener('click', async () => {
    chrome.tabs.create({ url: 'src/pages/popup.html?tabId=' + tabId });
  });

  // Returns the URL of the original tab, identified by the global tabId.
  async function getOriginalTabUrl() {
    const tab = await chrome.tabs.get(tabId);
    return tab.url;
  }

  //----------------------------------------------------------------------------
  // Copy summary to clipboard
  //----------------------------------------------------------------------------
  const copySummaryButton = document.getElementById('copySummary');

  function enableCopyButton() {
    copySummaryButton.classList.remove('btn-outline-secondary');
    copySummaryButton.classList.add('btn-outline-primary');
    copySummaryButton.disabled = false;
  }

  function disableCopyButton() {
    copySummaryButton.classList.remove('btn-outline-primary');
    copySummaryButton.classList.add('btn-outline-secondary');
    copySummaryButton.disabled = true;
  }

  window.setInterval(() => {
    if (lastMessage) {
      enableCopyButton();
    } else {
      disableCopyButton();
    }
  }, 500);

  copySummaryButton.addEventListener('click', async () => {
    if (lastMessage) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const urlOfPage = tabs[0].url;
      const formattedText = `Summary of ${urlOfPage}:\n\n${lastMessage}`;

      try {
        await navigator.clipboard.writeText(formattedText);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    }
  });

  //----------------------------------------------------------------------------
  // Display the header when in full screen mode, including the URL of the
  // current page. This is only necessary when the popup is opened in a new
  // tab, which is the case when the user clicks the "open in new window" icon,
  // or when the popup is opened on a mobile device (kiwi browser displays
  // extension popups as full screen tabs).
  //----------------------------------------------------------------------------
  async function displayHeader() {
    document.getElementById('header').classList.remove('visually-hidden');
    document.getElementById('sourceUrl').href = (await chrome.tabs.get(tabId)).url;
  }

  if (query.has('tabId') || isMobile) {
    displayHeader();
  }

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
        const model = getModel();
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
    if (isMobile) {
      document.body.style.width = 'auto';
      document.body.style.height = 'auto';
    } else {
      const width = Math.min(780, Math.round(screen.width * 0.6 * 0.1) * 10);
      const height = Math.min(580, Math.round(screen.height * 0.75 * 0.1) * 10);
      document.body.style.width = `${width}px`;
      document.body.style.height = `${height}px`;
    }
  }

  setWindowSize();

  //----------------------------------------------------------------------------
  // Extracting text from PDF files
  //----------------------------------------------------------------------------
  pdfjsLib.GlobalWorkerOptions.workerSrc = '../assets/pdf.worker.mjs';

  async function extractTextFromPDF(url) {
    const pdf = await pdfjsLib.getDocument(url).promise;
    let content = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const text = await page.getTextContent();
      content += text.items.map((item) => item.str).join(' ');
    }

    return content;
  }

  function isPDF(url) {
    return url.toLowerCase().endsWith('.pdf');
  }

  //----------------------------------------------------------------------------
  // Extracting text from anything supported
  //----------------------------------------------------------------------------
  async function getReferenceText() {
    const url = (await chrome.tabs.get(tabId)).url;

    if (isPDF(url)) {
      return extractTextFromPDF(url);
    } else {
      return new Promise((resolve, reject) => {
        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: () => document.body.innerText,
          },
          (results) => {
            if (results === undefined || results.length == 0) {
              reject('Unable to retrieve page contents or page contents are empty.');
            }

            if (results[0].result === undefined || results[0].result == '') {
              reject('Unable to retrieve page contents or page contents are empty.');
            }

            resolve(results[0].result);
          },
        );
      });
    }
  }

  //----------------------------------------------------------------------------
  // Powers the button that opens the options page
  //----------------------------------------------------------------------------
  document.getElementById('options').addEventListener('click', function () {
    chrome.runtime.openOptionsPage();
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
  // powers the reasoning dropdown
  //----------------------------------------------------------------------------
  function isReasoningModel(model) {
    return model.startsWith('o1') || model.startsWith('o3');
  }

  function setReasoningEffort(model, reasoning = null) {
    if (!isReasoningModel(model)) {
      reasoningDropdown.value = '';
      reasoningDropdown.disabled = true;
    } else {
      reasoningDropdown.value = reasoning || defaultReasoning;
      reasoningDropdown.disabled = false;
    }
  }

  function getReasoningEffort() {
    return reasoningDropdown ? reasoningDropdown.value : defaultReasoning;
  }

  //----------------------------------------------------------------------------
  // powers the model dropdown
  //----------------------------------------------------------------------------
  async function setModel(model = null) {
    if (model == null) {
      const profileKey = `profile__${currentProfile}`;
      const profileData = await chrome.storage.sync.get(profileKey);
      modelDropdown.value = profileData[profileKey].model;
      setReasoningEffort(profileData[profileKey].model, profileData[profileKey].reasoning);
    } else {
      modelDropdown.value = model;
      setReasoningEffort(model, null);
    }
  }

  function getModel() {
    const selectedModel = modelDropdown ? modelDropdown.value : undefined;
    return selectedModel || defaultModel; // Fallback to a default model
  }

  async function populateModelOptions() {
    const config = await chrome.storage.sync.get('models');
    const models = config.models || [];

    // Clear existing options
    modelDropdown.innerHTML = '';

    // Populate the models dropdown
    models.forEach((modelName) => {
      const option = new Option(modelName, modelName);
      modelDropdown.add(option);
    });
  }

  await populateModelOptions();

  //----------------------------------------------------------------------------
  // powers the profile dropdown
  //----------------------------------------------------------------------------
  const noProfilesMessage =
    'No profiles found. Use the gear icon above or right-click the extension ' +
    'icon and select "Options" to create a profile.';

  let currentProfile = '';

  // Update profile button UI and event listeners
  async function loadProfiles() {
    const [{ defaultProfile, profiles }, { lastUsedProfile }] = await Promise.all([
      chrome.storage.sync.get(['defaultProfile', 'profiles']),
      chrome.storage.local.get(['lastUsedProfile']),
    ]);

    if (!profiles) {
      reportError(noProfilesMessage);
      return;
    }

    const sortedProfiles = profiles.sort((a, b) => {
      if (a === defaultProfile) return -1;
      if (b === defaultProfile) return 1;
      return a.localeCompare(b);
    });

    // Clear existing buttons
    profileContainer.innerHTML = '';

    sortedProfiles.forEach(async (profileName) => {
      const button = document.createElement('button');
      button.className = 'profile-button btn btn-sm btn-outline-secondary text-nowrap';
      button.textContent = profileName;

      // Add click event listener for profile buttons
      button.addEventListener('click', async () => {
        await selectProfile(profileName);
      });

      profileContainer.appendChild(button);

      if (profileName === lastUsedProfile) {
        const profileKey = `profile__${profileName}`;
        const profileData = await chrome.storage.sync.get(profileKey);
        setModel(profileData[profileKey].model);
      }
    });

    // Automatically select a profile if necessary
    if (lastUsedProfile) {
      await selectProfile(lastUsedProfile);
    } else if (defaultProfile) {
      await selectProfile(defaultProfile);
    }
  }

  // Update the model and instructions when the profile changes
  async function selectProfile(selectedProfileName) {
    currentProfile = selectedProfileName;

    // Update the active profile button classes
    const buttons = profileContainer.getElementsByClassName('btn');

    for (const button of buttons) {
      if (button.textContent === currentProfile) {
        button.className = 'btn btn-sm m-1 text-nowrap btn-outline-primary active';
      } else {
        button.className = 'btn btn-sm m-1 text-nowrap btn-outline-secondary';
      }
    }

    // Save the selected profile name locally
    await chrome.storage.local.set({ lastUsedProfile: selectedProfileName });

    const profileKey = `profile__${selectedProfileName}`;
    const profileData = await chrome.storage.sync.get(profileKey);

    if (profileData[profileKey]) {
      const selectedProfile = profileData[profileKey];

      setModel(selectedProfile.model);

      // Update "custom instructions" textarea with the profile's custom prompts
      instructions.value = selectedProfile.customPrompts.join('\n');

      // Make sure to handle the case when there are no custom prompts
      if (!instructions.value) {
        instructions.value = defaultInstruction;
        instructions.classList.add('hint');
      } else {
        // Remove the hint class if the custom prompts are not empty
        instructions.classList.remove('hint');
      }
    } else if (selectedProfileName === '') {
      reportError(noProfilesMessage);
      setModel(defaultModel); // Fallback to a default model
      instructions.value = defaultInstruction; // Fallback instructions
      instructions.classList.add('hint');
    } else {
      reportError(`Profile "${selectedProfileName}" not found.`);
      setModel(defaultModel); // Fallback to a default model
      instructions.value = defaultInstruction; // Fallback instructions
      instructions.classList.add('hint');
    }
  }

  // Initial call to load profiles
  await loadProfiles();

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
    const url = await getOriginalTabUrl();
    const config = await chrome.storage.local.get('results');

    if (config.results && config.results[url] && config.results[url].summary) {
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
    const url = await getOriginalTabUrl();
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

  function clearSummary() {
    requestAnimationFrame(() => {
      document.getElementById('summaryCard').classList.add('visually-hidden');
      target.innerHTML = '';
    });
  }

  async function requestNewSummary() {
    const model = getModel();
    const content = await getReferenceText()
      .then((text) => {
        postMessage({
          action: 'SUMMARIZE',
          instructions: instructions.value,
          model: model,
          profile: currentProfile,
          content: text,
        });
      })
      .catch((error) => {
        reportError(error);
        clearSummary();
        working = false;
      });
  }

  // Restore the last page summary when the popup is opened
  restoreSummary().then((result) => {
    if (result != null) {
      setModel(result.model);

      updateSummary(marked.marked(result.summary));

      lastMessage = result.summary;

      // When restoring a summary, force the page to scroll to the top
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    }
  });

  modelDropdown.addEventListener('change', async () => {
    const model = getModel();
    setReasoningEffort(model);
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
