document.addEventListener('DOMContentLoaded', function () {
  const port = chrome.runtime.connect({ name: 'summarize' });
  const target = document.getElementById('summary');
  const modelDropdown = document.getElementById('model');

  //----------------------------------------------------------------------------
  // powers the doc hint in the extra instructions text area
  //----------------------------------------------------------------------------
  const extra = document.getElementById('extra-instructions');
  const hint = 'Please summarize this web page.';

  extra.value = hint;

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
      const config = await chrome.storage.sync.get(['model']);
      modelDropdown.value = config.model;
    } else {
      modelDropdown.value = model;
    }
  }

  async function getModel() {
    const selectedModel = modelDropdown ? modelDropdown.value : undefined;

    if (selectedModel) {
      return selectedModel;
    } else {
      const config = await chrome.storage.local.get(['model']);
      return config.model;
    }
  }

  // Set the default model on load
  setModel();

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
