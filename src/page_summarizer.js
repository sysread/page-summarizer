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
  ];

  if (extra != '') {
    messages.push({ role: 'user', content: extra });
  } else {
    const config = await chrome.storage.sync.get(['customPrompts']);

    for (const prompt of config.customPrompts) {
      messages.push({ role: 'user', content: prompt });
    }
  }

  return fetchAndStream(port, messages);
}

export function connectPageSummarizer() {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name == 'summarize') {
      port.onMessage.addListener((msg) => {
        if (msg.action == 'SUMMARIZE') {
          const tabId = msg.tabId;
          const extra = msg.extra;

          chrome.scripting.executeScript(
            {
              target: { tabId },
              func: () => {
                return document.body.innerText;
              },
            },
            (result) => {
              fetchAndStreamSummary(port, result[0].result, extra);
            },
          );
        }
      });
    }
  });
}
