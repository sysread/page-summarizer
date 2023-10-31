import { debug } from './util.js';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
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
    this.buffer = '';
    this.error = null;
    this.done = false;
    this.lastChunk = '';
  }

  // Required for the async iterator protocol
  [Symbol.asyncIterator]() {
    return this;
  }

  // Required for the async iterator protocol
  async next() {
    if (this.done) {
      return { done: true };
    }

    const { value: chunk, done: readerDone } = await this.reader.read();

    if (readerDone) {
      this.finish();
      return this.sendResult();
    }

    return this.parseChunk(chunk);
  }

  parseChunk(chunk) {
    const string = new TextDecoder().decode(chunk);

    debug('RECV:', string);

    // Some errors are returned as the initial message, but they can be
    // multi-line, so we have to attempt to parse them here to see if
    // they are an error. If the chunk cannot be parsed as JSON, then it
    // is a normal message chunk.
    try {
      const data = JSON.parse(string);

      if (data.error) {
        this.setError(data.error.message);
        return this.sendResult();
      }
    } catch (error) {
      // do nothing
    }

    const lines = string.split('\n').filter((line) => line !== '');

    debug('LINES:', lines);

    for (const line of lines) {
      if (line === DONE_MARKER) {
        this.finish();
        return this.sendResult();
      } else if (line.startsWith('data: ')) {
        const json = this.lastChunk + line.substring(6);

        let data = null;

        try {
          data = JSON.parse(json);
        } catch (error) {
          this.lastChunk = json;
        }

        if (data !== null) {
          if (data.error) {
            this.setError(data.error.message);
            return this.sendResult();
          }

          if (data.choices[0].delta.content) {
            this.append(data.choices[0].delta.content);
          }
        }
      }
    }

    return this.sendResult();
  }

  append(data) {
    this.buffer += data;
  }

  sendResult() {
    debug('RESULT:', { data: this.buffer, error: this.error });
    return { done: false, value: { data: this.buffer, error: this.error } };
  }

  setError(error) {
    debug('ERROR:', error);
    this.error = error;
    this.finish();
  }

  finish() {
    debug('FINISH');
    this.done = true;
    this.reader.releaseLock();
  }
}

async function fetchCompletions(apiKey, payload) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  return fetch(ENDPOINT, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload),
  });
}

function gptError(port, error) {
  port.postMessage({ action: 'GPT_ERROR', error: error });
}

function gptMessage(port, summary) {
  port.postMessage({ action: 'GPT_MESSAGE', summary: summary });
}

function gptDone(port, summary) {
  port.postMessage({ action: 'GPT_DONE', summary: summary });
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

  debug('PROMPT:', messages);

  try {
    const payload = {
      model: config.model,
      messages: messages,
      stream: true,
    };

    const response = await fetchCompletions(config.apiKey, payload);
    const reader = new GptResponseReader(response);
    let lastMessage = null;

    for await (const message of reader) {
      debug('MSG:', message);

      const { data: data, error: error } = message;

      if (error !== null) {
        gptError(port, error);
      } else if (data !== null) {
        gptMessage(port, data);
        lastMessage = data;
      }
    }

    gptDone(port, lastMessage);
  } catch (error) {
    if (error === PORT_CLOSED) {
      return;
    } else {
      console.error(error);
    }
  }
}
