function debug() {
  const args = arguments;

  chrome.storage.sync.get(['debug'])
    .then((config) => {
      if (config.debug) {
        console.log(...args);
      }
    });
}

async function fetchAndStream(text, extra, port) {
  chrome.storage.sync.get(['apiKey', 'model', 'customPrompts', 'debug'])
    .then(async (config) => {
      if (config.apiKey == null || config.apiKey.length === 0) {
        port.postMessage({
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

      let messages = [
        {
          role: 'system',
          content: 'You are a browser extension that helps the user understand the contents of a web page.'
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

      messages.push({role: 'user', content: text});

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

          const lines = new TextDecoder()
            .decode(chunk)
            .split("\n")
            .filter((line) => line !== "");

          debug("RECV:", lines);

          for (const line of lines) {
            if (line == "data: [DONE]") {
              port.postMessage({
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
                  summary: buff,
                  error: data.error.message,
                  done: true
                };
              }
              else if (data.choices[0].delta.content) {
                buff += data.choices[0].delta.content;

                message = {
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

// Listen for messages from the popup
chrome.runtime.onConnect.addListener((port) => {
  if (port.name == "summarize") {
    port.onMessage.addListener((msg) => {
      if (msg.action === "summarize") {
        const tabId = msg.tabId;
        const extra = msg.extra;

        chrome.scripting.executeScript(
          {target: {tabId}, func: () => { return document.body.innerText }},
          (result) => { fetchAndStream(result[0].result, extra, port) }
        );
      }
    });
  }
});

//------------------------------------------------------------------------------
// Context menu
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
    fetchAndStream(text, "", port);
  }
});
