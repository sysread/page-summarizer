document.addEventListener('DOMContentLoaded', function () {
  let working = false;
  const statusElement = document.getElementById('status');

  // Reset the status when the popup is opened
  chrome.storage.local.get('lastResult', function(data) {
    if (data.lastSummary) {
      updateStatus(data.lastSummary);
    }
  });

  function updateStatus(message) {
    statusElement.innerHTML = marked.marked(message);
  }

  function resetStatus() {
    statusElement.textContent = '';
  }

  document.getElementById('summarize').addEventListener('click', function () {
    if (working) {
      return;
    }

    working = true;
    updateStatus('Fetching summary...');

    chrome.storage.sync.get(['apiKey', 'model', 'customPrompts', 'debug'], function (config) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        let tab = tabs[0];

        chrome.runtime.sendMessage({ action: 'summarize', tabId: tab.id, config: config }, function(response) {
          working = false;

          if (response && response.summary) {
            updateStatus(`Summary: ${response.summary}`);
          } else if (response && response.error) {
            updateStatus(`<span style="color: red; font-style: italic;">Error: ${response.error}</span>`);
          } else {
            updateStatus('Failed to fetch summary.');
          }
        });
      });
    });
  });
});
