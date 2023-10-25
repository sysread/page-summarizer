//------------------------------------------------------------------------------
// Reload content scripts on extension update
//------------------------------------------------------------------------------
const contentScripts = [
  'assets/marked.min.js',
  'src/scripts/selection_summarizer.js',
  'src/scripts/form_filler.js',
];

function reloadContentScripts(details) {
  if (details.reason == 'update') {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        // Skip chrome:// URLs, tab groups, unloaded tabs, etc.
        if (!tab.url || tab.url.startsWith('chrome://')) {
          return;
        }

        // Reload each of the content scripts
        contentScripts.forEach((script) => {
          chrome.scripting
            .executeScript({target: { tabId: tab.id }, files: [script]})
            .catch((err) => {
              console.debug(`Unable to inject ${script} into tab ${tab.id}: ${err.message}`);
              console.debug("Tab", tab);
            });
        });
      });

      // Only execute this callback *once*. The addListener below will be
      // picked up the next time the background worker starts.
      chrome.runtime.onInstalled.removeListener(reloadContentScripts);
    });
  }
}

export function connectScriptReloader() {
  chrome.runtime.onInstalled.addListener(reloadContentScripts);
}

//------------------------------------------------------------------------------
// If the user has enabled debug mode, log to the console
//------------------------------------------------------------------------------
export async function debug() {
  const config = await chrome.storage.sync.get(['debug']);

  if (config.debug) {
    console.log(...arguments);
  }
}
