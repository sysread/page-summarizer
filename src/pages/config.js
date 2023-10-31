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

  document.getElementById('config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('status').style.display = 'none';

    const apiKey = document.getElementById('apiKey').value;
    const model = document.getElementById('model').value;
    const customPrompts = document.getElementById('customPrompts').value.split('\n');
    const debug = !!document.getElementById('debug').checked;

    await chrome.storage.sync.set({ apiKey, model, customPrompts, debug });
    document.getElementById('status').textContent = 'Settings saved.';
    document.getElementById('status').style.display = 'block';
  });
});
