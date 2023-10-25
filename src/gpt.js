import { debug } from './devtools.js';

function gptError(port, error) {
  port.postMessage({action: 'gptError', error: error});
}

function gptMessage(port, summary) {
  port.postMessage({action: 'gptMessage', summary: summary});
}

function gptDone(port, summary) {
  port.postMessage({action: 'gptDone', summary: summary});
}

async function getCompletion(apiKey, payload) {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  };

  return fetch("https://api.openai.com/v1/chat/completions", {
    method:  "POST",
    headers: headers,
    body:    JSON.stringify(payload)
  });
}

//------------------------------------------------------------------------------
// Takes the list of message prompts and sends them to OpeanAI's chat
// completions endpoint. It then streams the responses back to the
// caller-supplied port.
//------------------------------------------------------------------------------
export async function fetchAndStream(port, messages) {
  chrome.storage.sync.get(['apiKey', 'model'])
    .then(async (config) => {
      if (config.apiKey == null || config.apiKey.length == 0) {
        gptError(port, 'API key is not set.');
        return;
      }

      debug("PROMPT:", messages);

      let reader;
      let buff = "";

      try {
        const payload = {
          model:    config.model,
          messages: messages,
          stream:   true
        };

        const response = await getCompletion(config.apiKey, payload);
        reader = response.body.getReader();

        while (true) {
          const {value: chunk, done: readerDone} = await reader.read();

          if (readerDone) {
            break;
          }

          try {
            const data = JSON.parse(new TextDecoder().decode(chunk));

            if (data.error) {
              gptError(port, data.error.message);
              break;
            }
          }
          // Some errors are returned as the initial message, but they can be
          // multi-line, so we have to attempt to parse them here to see if
          // they are an error. If the chunk cannot be parsed as JSON, then it
          // is a normal message chunk.
          catch (error) {
            ; // do nothing
          }

          const lines = new TextDecoder()
            .decode(chunk)
            .split("\n")
            .filter((line) => line !== "");

          debug("RECV:", lines);

          for (const line of lines) {
            if (line == "data: [DONE]") {
              gptDone(port, buff);
              break;
            }
            else if (line.startsWith("data: ")) {
              const data = JSON.parse(line.substring(6));

              if (data.error) {
                gptError(port, data.error.message);
              }
              else if (data.choices[0].delta.content) {
                buff += data.choices[0].delta.content;
                gptMessage(port, buff);
              }
            }
          }
        }
      }
      catch (error) {
        if (error == 'Error: Attempting to use a disconnected port object') {
          return;
        } else {
          console.error(error);
        }
      }
      finally {
        if (reader) {
          reader.releaseLock();
        }
      }
  });
}
