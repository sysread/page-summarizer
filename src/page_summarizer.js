import { fetchAndStream } from './gpt.js';

export async function fetchAndStreamSummary(port, content, extra) {
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
      content: extra,
    },
  ];

  if (extra === '' || extra === 'Please summarize this web page.') {
    const config = await chrome.storage.sync.get(['customPrompts']);

    for (const prompt of config.customPrompts) {
      messages.push({ role: 'user', content: prompt });
    }
  }

  messages.push({ role: 'user', content: extra });

  return fetchAndStream(port, messages);
}

export function connectPageSummarizer() {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name == 'summarize') {
      port.onMessage.addListener(async (msg) => {
        if (msg.action == 'SUMMARIZE') {
          const tabId = msg.tabId;
          const extra = msg.extra;

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

              fetchAndStreamSummary(port, result[0].result, extra);
            },
          );
        }
      });
    }
  });
}
