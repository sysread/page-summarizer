document.addEventListener('DOMContentLoaded', function () {
  const port = chrome.runtime.connect({name: "summarize"});
  const summaryElement = document.getElementById('summary');

  let working = false;

  // Set up the port message listener right here
  port.onMessage.addListener(function(msg) {
    if (msg == null) {
      return;
    }

    if (msg.done) {
      working = false;

      if (msg.error != null) {
        reportError(msg.error);
      }
      else if (msg.summary != null && msg.summary.length > 0) {
        setSummary(msg.summary);
      }

      return;
    }

    if (msg.summary != null && msg.summary.length > 0) {
      updateSummary(marked.marked(msg.summary));
    }
    else {
      reportError('Failed to fetch summary.');
      working = false;
    }
  });

  // Restore the summary when the popup is opened
  getSummary().then((summary) => {
    if (summary != null) {
      updateSummary(marked.marked(summary));
    }
  });

  function getSummary() {
    href = window.location.href;

    return chrome.storage.local.get(['results'])
      .then((data) => {
        if (data.results && data.results[href]) {
          return data.results[href];
        }

        return null;
      });
  }

  function setSummary(summary) {
    href = window.location.href;

    return chrome.storage.local.get(['results'])
      .then((data) => {
        if (!data.results) {
          data.results = {};
        }

        data.results[href] = summary;

        chrome.storage.local.set(data);
      });
  }

  function updateSummary(message) {
    summaryElement.innerHTML = message;
  }

  function reportError(message) {
    updateSummary(`<span style="color: red; font-style: italic;">Error: ${message}</span>`);
  }

  document.getElementById('summarize').addEventListener('click', function () {
    if (working) {
      return;
    }

    updateSummary('Fetching summary...');
    working = true;

    chrome.storage.sync.get(['apiKey', 'model', 'customPrompts', 'debug'], function (config) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        port.postMessage({
          action: 'summarize',
          tabId: tabs[0].id,
          config: config
        });
      });
    });
  });
});

