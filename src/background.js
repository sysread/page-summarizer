import { connectPageSummarizer } from './page_summarizer.js';
import { connectSelectionSummarizer } from './selection_summarizer.js';
import { connectFormFiller } from './form_filler.js';

import {
  setDefaultConfig,
  updateConfigToUseProfiles_20231117,
  updateModelNaming_20240129,
  updateModelNaming_20240423,
  updateProfileStructure_20240620,
} from './compat.js';

// Summarize page
connectPageSummarizer();

// Summarize selected text (context menu item)
connectSelectionSummarizer();

// Fill in form input (context menu item)
connectFormFiller();

// Automatically upgrade the user's config if they are still using the old config format.
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    await setDefaultConfig();
    await updateConfigToUseProfiles_20231117();
    await updateModelNaming_20240129();
    await updateModelNaming_20240423();
    await updateProfileStructure_20240620();
  }
});
