import { connectPageSummarizer } from './page_summarizer.js';
import { connectSelectionSummarizer } from './selection_summarizer.js';
import { connectFormFiller } from './form_filler.js';

// Summarize page
connectPageSummarizer();

// Summarize selected text (context menu item)
connectSelectionSummarizer();

// Fill in form input (context menu item)
connectFormFiller();

// Automatically upgrade the user's config if they are still using the old config format.
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    const oldConfig = await chrome.storage.sync.get(['apiKey', 'model', 'customPrompts', 'debug']);

    // Check if there is an old config and no profiles key
    if (oldConfig.model && !oldConfig.profiles) {
      // Found old configuration, migrate to new profile-based format
      const defaultProfileConfig = {
        model: oldConfig.model || 'gpt-3.5-turbo-16k',
        customPrompts: oldConfig.customPrompts || [],
      };

      // Wrap the default profile configuration into the new profiles structure
      const newConfig = {
        apiKey: oldConfig.apiKey || '',
        defaultProfile: 'default',
        debug: oldConfig.debug || false,
        profiles: {
          default: defaultProfileConfig,
        },
      };

      // Save the new config
      await chrome.storage.sync.set(newConfig);

      // Optionally, clear the old configuration keys if you don't want to keep them anymore
      await chrome.storage.sync.remove(['model', 'customPrompts']);
    }

    // Update models to change "gpt-4-1106-preview" to "gpt-4-turbo-preview"
    const config = await chrome.storage.sync.get(['profiles']);

    for (const profileName of Object.keys(config.profiles)) {
      const profile = config.profiles[profileName];

      if (profile.model === 'gpt-4-1106-preview') {
        profile.model = 'gpt-4-turbo-preview';
      }
    }

    await chrome.storage.sync.set(config);
  }
});
