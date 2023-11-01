document.addEventListener('DOMContentLoaded', async () => {
  const config = await chrome.storage.sync.get(['apiKey', 'model', 'customPrompts', 'debug']);

  if (config.apiKey) {
    document.getElementById('apiKey').value = config.apiKey;
  }

  if (config.model) {
    document.getElementById('model').value = config.model;
  }

  if (config.customPrompts) {
    document.getElementById('customPrompts').value = config.customPrompts.join('\n');
  }

  if (config.debug) {
    document.getElementById('debug').checked = !!config.debug;
  }

  // Listen for the close button
  const closeButton = document.getElementById('close-btn');
  closeButton.addEventListener('click', () => {
    document.getElementById('status').style.display = 'none';
  });

  document.getElementById('config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    closeButton.style.display = 'none';

    const apiKey = document.getElementById('apiKey').value;
    const model = document.getElementById('model').value;
    const customPrompts = document.getElementById('customPrompts').value.split('\n');
    const debug = !!document.getElementById('debug').checked;

    await chrome.storage.sync.set({ apiKey, model, customPrompts, debug });

    if (document.getElementById('status').style.display === 'block') {
      // If the status is currently showing, hide it and then show it again after a delay
      document.getElementById('status').style.display = 'none';

      setTimeout(() => {
        document.getElementById('status-text').textContent = 'Settings saved.';
        document.getElementById('status').style.display = 'block';
        closeButton.style.display = 'block';
      }, 250);
    } else {
      document.getElementById('status-text').textContent = 'Settings saved.';
      document.getElementById('status').style.display = 'block';
      closeButton.style.display = 'block';
    }
  });
});
