//------------------------------------------------------------------------------
// Execute support scripts
//------------------------------------------------------------------------------
export async function loadSupportScripts(tab, scripts) {
  return chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: scripts,
  });
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
