document.addEventListener('DOMContentLoaded', function () {
  const port = chrome.runtime.connect({ name: 'summarize' });
  const target = document.getElementById('summary');

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
      return config.results[url];
    } else {
      return null;
    }
  }

  async function setSummary(summary) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0].url;
    const config = await chrome.storage.local.get('results');

    let results = config.results || {};
    results[url] = summary;
    chrome.storage.local.set({ results: results });
  }

  function updateSummary(message) {
    target.innerHTML = message;

    // Autoscroll to the bottom of the page
    window.scrollTo(0, document.body.scrollHeight);
  }

  function reportError(message) {
    updateSummary(`<span style="color: red; font-style: italic;">Error: ${message}</span>`);
  }

  async function requestNewSummary() {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    port.postMessage({
      action: 'SUMMARIZE',
      tabId: tabs[0].id,
      extra: extra.value,
    });
  }

  // Restore the last page summary when the popup is opened
  restoreSummary().then((summary) => {
    if (summary != null) {
      updateSummary(marked.marked(summary));
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

  port.onMessage.addListener(function (msg) {
    if (msg == null) {
      return;
    }

    switch (msg.action) {
      case 'GPT_MESSAGE':
        lastMessage = msg.summary;
        updateSummary(format(msg.summary));
        break;

      case 'GPT_DONE':
        setSummary(lastMessage);
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
