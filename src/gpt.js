import { debug } from './devtools.js';

const ENDPOINT    = 'https://api.openai.com/v1/chat/completions';
const DATA_MARKER = 'data: ';
const DONE_MARKER = `${DATA_MARKER}[DONE]`;
const PORT_CLOSED = 'Error: Attempting to use a disconnected port object';
const ERR_API_KEY = 'Error: API key is not set';

/*------------------------------------------------------------------------------
 * Parses the response from the openai chat completions endpoint and acts as an
 * iterator over the response. Because the response is streamed, the iterator
 * builds up the aggregated response, returning the complete buffer on each
 * iteration until complete.
 *
 * For example:
 *   {data: "Hello", error: null}
 *   {data: "Hello, how are", error: null}
 *   {data: "Hello, how are you?", error: null}
 *
 * If an error occurs, the error is returned in the error field and the
 * iteration is stopped.
 *----------------------------------------------------------------------------*/
class GptResponseReader {
  constructor(response) {
    this.reader = response.body.getReader();
    this.buffer = "";
  }

  // Required for the async iterator protocol
  [Symbol.asyncIterator]() {
    return this;
  }

  // Required for the async iterator protocol
  async next() {
    const {value: chunk, done: readerDone} = await this.reader.read();

    if (readerDone) {
      return this.result(true);
    }

    return this.parseChunk(chunk);
  }

  parseChunk(chunk) {
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

    debug("RECV:", lines);

    for (const line of lines) {
      if (line === DONE_MARKER) {
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
}

async function fetchCompletions(apiKey, payload) {
  const headers = {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${apiKey}`
  };

  return fetch(ENDPOINT, {
    method:  "POST",
    headers: headers,
    body:    JSON.stringify(payload)
  });
}

function gptError(port, error) {
  port.postMessage({action: 'gptError', error: error});
}

function gptMessage(port, summary) {
  port.postMessage({action: 'gptMessage', summary: summary});
}

function gptDone(port, summary) {
  port.postMessage({action: 'gptDone', summary: summary});
}

//------------------------------------------------------------------------------
// Takes the list of message prompts and sends them to OpeanAI's chat
// completions endpoint. It then streams the responses back to the
// caller-supplied port.
//------------------------------------------------------------------------------
export async function fetchAndStream(port, messages) {
  const config = await chrome.storage.sync.get(['apiKey', 'model']);

  if (config.apiKey === null || config.apiKey.length === 0) {
    gptError(port, ERR_API_KEY);
    return;
  }

  debug("PROMPT:", messages);

  try {
    const payload = {
      model:    config.model,
      messages: messages,
      stream:   true
    };

    const response  = await fetchCompletions(config.apiKey, payload);
    const reader    = new GptResponseReader(response);
    let lastMessage = null;

    for await (const {data: data, error: error} of reader) {
      if (error !== null) {
        gptError(port, error);
      }
      else if (data !== null) {
        gptMessage(port, data);
        lastMessage = data;
      }
    }

    gptDone(port, lastMessage);
  }
  catch (error) {
    if (error === PORT_CLOSED) {
      return;
    } else {
      console.error(error);
    }
  }
}
