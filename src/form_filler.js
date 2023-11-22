import { fetchAndStream } from './gpt.js';
import { loadSupportScripts } from './util.js';

async function fetchAndStreamFormFill(port, prompt, instructions) {
  let messages = [
    {
      role: 'system',
      content: 'You are a browser extension that helps the user fill in a form.',
    },
  ];

  if (instructions != null && instructions.length > 0) {
    messages.push({
      role: 'user',
      content: `For context, the page contains the following text: ${instructions}`,
    });
  }

  messages.push({
    role: 'user',
    content: 'Do not wrap your response in quotes.',
  });

  messages.push({ role: 'user', content: prompt });

  return fetchAndStream(port, messages);
}

export function connectFormFiller() {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'fillForm',
      title: 'Fill with text using GPT',
      contexts: ['editable'],
      documentUrlPatterns: ['<all_urls>'],
    });
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId == 'fillForm') {
      await loadSupportScripts({ id: tab.id }, ['assets/marked.min.js', 'src/scripts/form_filler.js']);

      const port = chrome.tabs.connect(tab.id, { name: 'fillForm' });
      port.postMessage({ action: 'DISPLAY_OVERLAY' });

      port.onMessage.addListener((msg) => {
        if (msg.action == 'GET_COMPLETION') {
          fetchAndStreamFormFill(port, msg.text, msg.instructions);
        }
      });
    }
  });
}
