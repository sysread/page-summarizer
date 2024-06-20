import { fetchAndStream } from './gpt.js';

export async function fetchAndStreamSummary(port, content, instructions, model, profile) {
  const { profiles, defaultProfile } = await chrome.storage.sync.get(['profiles', 'defaultProfile']);

  if (!profile) {
    profile = defaultProfile;
  }

  const profileKey = `profile__${profile}`;
  const profileData = await chrome.storage.sync.get(profileKey);

  if (!instructions) {
    instructions = profileData[profileKey].customPrompts.join('\n');
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
      port.onMessage.addListener((msg) => {
        if (msg.action == 'SUMMARIZE') {
          const { content, instructions, model, profile } = msg;
          fetchAndStreamSummary(port, content, instructions, model, profile);
        }
      });
    }
  });
}
