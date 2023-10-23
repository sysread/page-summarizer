function debug() {
  const args = arguments;

  chrome.storage.sync.get(['debug'])
    .then((config) => {
      if (config.debug) {
        console.log(...args);
      }
    });
}

async function fetchAndStream(port, messages) {
  chrome.storage.sync.get(['apiKey', 'model', 'customPrompts', 'debug'])
    .then(async (config) => {
      if (config.apiKey == null || config.apiKey.length === 0) {
        port.postMessage({
          action: 'recvCompletion',
          summary: null,
          error: 'API key is not set.',
          done: true
        });

        return;
      }

      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      };

      debug("PROMPT:", messages);

      let reader;
      let buff = "";

      try {
        let response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: headers,
          body: JSON.stringify({
            model: config.model,
            messages: messages,
            stream: true
          })
        });

        reader = response.body.getReader();

        while (true) {
          const { value: chunk, done: readerDone } = await reader.read();

          if (readerDone) {
            break;
          }

          // Some errors are returned as the initial message, but they can be
          // multi-line, so we have to attempt to parse them here to see if
          // they are an error. If the chunk cannot be parsed as JSON, then it
          // is a normal message chunk.
          try {
            const data = JSON.parse(new TextDecoder().decode(chunk));

            if (data.error) {
              port.postMessage({
                action: 'recvCompletion',
                summary: null,
                error: data.error.message,
                done: true
              });

              break;
            }
          } catch (error) {
            ; // Do nothing
          }

          debug("RECV:", chunk);

          const lines = new TextDecoder()
            .decode(chunk)
            .split("\n")
            .filter((line) => line !== "");

          for (const line of lines) {
            if (line == "data: [DONE]") {
              port.postMessage({
                action: 'recvCompletion',
                summary: buff,
                error: null,
                done: true
              });

              break;
            }

            if (line.startsWith("data: ")) {
              const data = JSON.parse(line.substring(6));

              let message;

              if (data.error) {
                message = {
                  action: 'recvCompletion',
                  summary: buff,
                  error: data.error.message,
                  done: true
                };
              }
              else if (data.choices[0].delta.content) {
                buff += data.choices[0].delta.content;

                message = {
                  action: 'recvCompletion',
                  summary: buff,
                  error: null,
                  done: false
                };
              }

              port.postMessage(message);
              continue;
            }
          }
        }
      }
      catch (error) {
        console.error("Error:", error);
      }
      finally {
        if (reader) {
          reader.releaseLock();
        }
      }
  });
}

//------------------------------------------------------------------------------
// Summarize page
//------------------------------------------------------------------------------
async function fetchAndStreamSummary(port, content, extra) {
  chrome.storage.sync.get(['customPrompts'])
    .then(async (config) => {
      let messages = [
        {
          role:    'system',
          content: 'You are a browser extension that helps the user understand the contents of a web page.',
        },
      ];

      for (const prompt of config.customPrompts) {
        messages.push({role: 'user', content: prompt});
      }

      if (extra != "") {
        messages.push({role: 'user', content: extra});
      } else {
        messages.push({role: 'user', content: 'Summarize this text.'});
      }

      messages.push({role: 'user', content: content});

      return messages;
    })
    .then(async (messages) => {
      return fetchAndStream(port, messages);
    });
}

// Listen for messages from the popup
chrome.runtime.onConnect.addListener((port) => {
  if (port.name == "summarize") {
    port.onMessage.addListener((msg) => {
      if (msg.action === "summarize") {
        const tabId = msg.tabId;
        const extra = msg.extra;

        chrome.scripting.executeScript(
          {target: {tabId}, func: () => { return document.body.innerText }},
          (result) => { fetchAndStreamSummary(port, result[0].result, extra) }
        );
      }
    });
  }
});

//------------------------------------------------------------------------------
// Summarize selected text (context menu item)
//------------------------------------------------------------------------------

// Add the context menu item to summarize selected text
chrome.contextMenus.create({
  id: 'summarizeSelectedText',
  title: 'Summarize selection',
  contexts: ['selection']
});

// Listen for clicks on the context menu item
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId == 'summarizeSelectedText') {
    const text = info.selectionText;
    const port = chrome.tabs.connect(tab.id, {name: 'contentScriptPort'});
    fetchAndStreamSummary(port, text, "");
  }
});

//------------------------------------------------------------------------------
// Fill in form input (context menu item)
//------------------------------------------------------------------------------
async function fetchAndStreamFormFill(port, prompt, extra) {
  let messages = [
    {
      role:    'system',
      content: 'You are a browser extension that helps the user fill in a form.'
    },
  ]

  if (extra != null && extra.length > 0) {
    messages.push({
      role:    'user',
      content: `For context, the page contains the following text: ${extra}`,
    });
  }

  messages.push({role: 'user', content: prompt});

  return fetchAndStream(port, messages);
}

chrome.contextMenus.create({
  id: 'fillForm',
  title: 'Fill with text using GPT',
  contexts: ['editable'],
  documentUrlPatterns: ['<all_urls>']
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId == 'fillForm') {
    const port = chrome.tabs.connect(tab.id, {name: 'fillForm'});
    port.postMessage({action: 'displayOverlay'});

    port.onMessage.addListener((msg) => {
      if (msg.action == 'getCompletion') {
        fetchAndStreamFormFill(port, msg.text, msg.extra);
      }
    });
  }
});
