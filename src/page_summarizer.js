import { fetchAndStream } from './gpt.js';

export async function fetchAndStreamSummary(port, content, instructions, model, profile) {
  const { profiles, defaultProfile } = await chrome.storage.sync.get(['profiles', 'defaultProfile']);

  if (!profile) {
    profile = defaultProfile;
  }

  if (!instructions) {
    instructions = profiles[profile].customPrompts.join('\n');
  }

  let messages = [
    {
      role: 'system',
      content: 'You are a browser extension that helps the user understand the contents of a web page.',
    },
    {
      role: 'user',
      content: 'Web page contents: ' + content,
    },
    {
      role: 'user',
      content: instructions,
    },
  ];

  return fetchAndStream(port, messages, { model: model, profile: profile });
}

export function connectPageSummarizer() {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name == 'summarize') {
      port.onMessage.addListener(async (msg) => {
        if (msg.action == 'SUMMARIZE') {
          const tabId = msg.tabId;
          const instructions = msg.instructions;
          const model = msg.model;
          const profile = msg.profile;
          const tab = await chrome.tabs.get(tabId);

          if (tab.url.startsWith('chrome://')) {
            port.postMessage({ action: 'GPT_ERROR', error: 'Cannot summarize internal browser pages.' });
            return;
          }

          chrome.scripting.executeScript(
            {
              target: { tabId },
              func: () => {
                return document.body.innerText;
              },
            },
            (result) => {
              if (result === undefined || result.length == 0) {
                port.postMessage({ action: 'GPT_ERROR', error: 'Unable to retrieve page contents.' });
                return;
              }

              if (result[0].result == '') {
                port.postMessage({ action: 'GPT_ERROR', error: 'Page contents are empty.' });
                return;
              }

              fetchAndStreamSummary(port, result[0].result, instructions, model, profile);
            },
          );
        }
      });
    }
  });
}
