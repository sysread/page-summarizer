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

async function fetchCompletions(apiKey, payload) {
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

class GptResponseReader {
  constructor(response) {
    this.reader = response.body.getReader();
    this.buffer = "";
  }

  async next() {
    const {value: chunk, done: readerDone} = await this.reader.read();

    if (readerDone) {
      return this.result(true);
    }

    // Some errors are returned as the initial message, but they can be
    // multi-line, so we have to attempt to parse them here to see if
    // they are an error. If the chunk cannot be parsed as JSON, then it
    // is a normal message chunk.
    try {
      const data = JSON.parse(new TextDecoder().decode(chunk));

      if (data.error) {
        this.reader.releaseLock();
        return this.error(data.error.message);
      }
    }
    catch (error) {
      ; // do nothing
    }

    const lines = new TextDecoder()
      .decode(chunk)
      .split("\n")
      .filter((line) => line !== "");

    for (const line of lines) {
      if (line == "data: [DONE]") {
        this.reader.releaseLock();
        return this.result(true);
      }
      else if (line.startsWith("data: ")) {
        const data = JSON.parse(line.substring(6));

        if (data.error) {
          this.reader.releaseLock();
          return this.error(data.error.message);
        }

        if (data.choices[0].delta.content) {
          this.append(data.choices[0].delta.content);
        }
      }
    }

    return this.result(false);
  }

  append(data) {
    this.buffer += data;
  }

  result(done) {
    return {done: done, value: {data: this.buffer, error: null}};
  }

  error(error) {
    return {done: true, value: {data: null, error: error}};
  }

  [Symbol.asyncIterator]() {
    return this;
  }
}

//------------------------------------------------------------------------------
// Takes the list of message prompts and sends them to OpeanAI's chat
// completions endpoint. It then streams the responses back to the
// caller-supplied port.
//------------------------------------------------------------------------------
export async function fetchAndStream(port, messages) {
  return chrome.storage.sync.get(['apiKey', 'model'])
    .then(async (config) => {
      if (config.apiKey == null || config.apiKey.length == 0) {
        gptError(port, 'API key is not set.');
        return;
      }

      debug("PROMPT:", messages);

      try {
        const payload = {
          model:    config.model,
          messages: messages,
          stream:   true
        };

        const response = await fetchCompletions(config.apiKey, payload);
        const reader   = new GptResponseReader(response);

        for await (const {data: data, error: error} of reader) {
          if (error != null) {
            gptError(port, error);
          }
          else if (data != null) {
            gptMessage(port, data);
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
    });
}
