document.addEventListener('DOMContentLoaded', function () {
  let working = false;
  const statusElement = document.getElementById('status');
  
  function updateStatus(message) {
    statusElement.textContent = message;
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

    chrome.runtime.sendMessage({ action: 'summarize' }, function (response) {
      working = false;
      if (response && response.summary) {
        updateStatus(`Summary: ${response.summary}`);
      } else {
        updateStatus('Failed to fetch summary.');
      }
    });
  });
});
