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
    if (oldConfig.apiKey && !oldConfig.profiles) {
      // Found old configuration, migrate to new profile-based format
      const defaultProfileConfig = {
        apiKey: oldConfig.apiKey,
        model: oldConfig.model || 'gpt-3.5-turbo-16k',
        customPrompts: oldConfig.customPrompts || [],
        debug: oldConfig.debug || false,
      };

      // Wrap the default profile configuration into the new profiles structure
      const newProfilesConfig = {
        defaultProfile: 'default',
        default: defaultProfileConfig,
      };

      // Save the new config
      await chrome.storage.sync.set({ profiles: newProfilesConfig });

      // Optionally, clear the old configuration keys if you don't want to keep them anymore
      await chrome.storage.sync.remove(['apiKey', 'model', 'customPrompts', 'debug']);
    }
  }
});
