import { fetchAndStreamSummary } from './page_summarizer.js';
import { setupContentScript } from './util.js';

export async function connectSelectionSummarizer() {
  // Add the context menu item to summarize selected text
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'summarizeSelectedText',
      title: 'Summarize selection',
      contexts: ['selection']
    });
  });

  // Listen for clicks on the context menu item
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId == 'summarizeSelectedText') {
      await setupContentScript({id: tab.id}, [
        'assets/marked.min.js',
        'src/scripts/selection_summarizer.js'
      ]);

      const text = info.selectionText;
      const port = chrome.tabs.connect(tab.id, {name: 'contentScriptPort'});
      fetchAndStreamSummary(port, text, "");
    }
  });
}
