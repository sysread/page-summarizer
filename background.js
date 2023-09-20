function debug() {
  const args = arguments;

  chrome.storage.sync.get(['debug'], function (config) {
    if (config.debug) {
      console.log(...args);
    }
  });
}

async function fetchAndStream(text, config, port) {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.apiKey}`
  };

  let messages = [
    {
      role: 'system',
      content: 'You are a browser extension that summarizes the contents of a web page for the user.'
    },
  ];

  for (const prompt of config.customPrompts) {
    messages.push({role: 'user', content: prompt});
  }

  messages.push({role: 'user', content: 'Summarize the this text for me.'});
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
}

// Listen for messages from the popup
chrome.runtime.onConnect.addListener((port) => {
  if (port.name == "summarize") {
    port.onMessage.addListener((msg) => {
      if (msg.action === "summarize") {
        let tabId = msg.tabId;
        let config = msg.config;

        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: function () {
              return document.body.innerText;
            },
          },
          (result) => {
            const text = result[0].result;
            fetchAndStream(text, config, port);
          }
        );
      }
    });
  }
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "summarize") {
    let tabId = request.tabId;
    let config = request.config;

    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: function () {
          return document.body.innerText;
        },
      },
      (result) => {
        sendResponse(true);
        const text = result[0].result;
        fetchAndStream(text, config);
      }
    );
  }

  return true;
});
