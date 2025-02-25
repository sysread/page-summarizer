import { debug } from './util.js';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DATA_MARKER = 'data: ';
const DONE_MARKER = `${DATA_MARKER}[DONE]`;
const PORT_CLOSED = 'Error: Attempting to use a disconnected port object';
const ERR_API_KEY = 'Error: API key is not set';

/*------------------------------------------------------------------------------
 * Builds up a buffer of JSON data and returns the parsed JSON object once
 * enough data has been received to represent a complete JSON string. If the
 * buffer is incomplete, returns null until enough data has been received to
 * return a complete JSON object.
 *----------------------------------------------------------------------------*/
function JsonBuffer() {
  let buffer = '';

  return function (data) {
    buffer += data;

    let result = null;

    try {
      result = JSON.parse(buffer);
      buffer = '';
    } catch (error) {
      // do nothing
    }

    return result;
  };
}

/*------------------------------------------------------------------------------
 * Parses the response from the openai chat completions endpoint and acts as an
 * iterator over the response. Because the response is streamed, the generator
 * builds up the aggregated response, returning the complete buffer on each
 * invocation until complete.
 *
 * For example:
 *   {data: "Hello", error: null}
 *   {data: "Hello, how are", error: null}
 *   {data: "Hello, how are you?", error: null}
 *
 * If an error occurs, the error is returned in the error field and the
 * generation is stopped. After that, it will always return the same structure.
 *----------------------------------------------------------------------------*/
function GptResponseReader(response) {
  const reader = response.body.getReader();

  let buffer = '';
  let error = null;
  let done = false;

  return async function () {
    if (done) {
      return null;
    }

    const { value: chunk, done: readerDone } = await reader.read();

    if (readerDone) {
      debug('FINISH');
      done = true;
      return { data: buffer, error: error };
    }

    const string = new TextDecoder().decode(chunk);
    debug('RECV:', string);

    // Some errors are returned as the initial message, but they can be
    // multi-line, so we have to attempt to parse them here to see if they are
    // an error. If the chunk cannot be parsed as JSON, then it is a normal
    // message chunk.
    try {
      const data = JSON.parse(string);

      if (data.error) {
        error = data.error.message;
        return { data: buffer, error: error };
      }
    } catch (error) {
      // do nothing
    }

    const lines = string.split('\n').filter((line) => line !== '');
    const json_buffer = JsonBuffer();

    debug('LINES:', lines);

    for (const line of lines) {
      if (line === DONE_MARKER) {
        done = true;
        return { data: buffer, error: error };
      }

      if (line.startsWith('data: ')) {
        const data = json_buffer(line.substring(6));

        if (data !== null) {
          if (data.error) {
            error = data.error.message;
            return { data: buffer, error: error };
          }

          if (data.choices[0].delta.content) {
            buffer += data.choices[0].delta.content;
          }
        }
      }
    }

    return { data: buffer, error: error };
  };
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

function isReasoningModel(model) {
  return model.startsWith('o1') || model.startsWith('o3');
}

//------------------------------------------------------------------------------
// Takes the list of message prompts and sends them to OpeanAI's chat
// completions endpoint. It then streams the responses back to the
// caller-supplied port.
//------------------------------------------------------------------------------
export async function fetchAndStream(port, messages, options = {}) {
  const config = await chrome.storage.sync.get(['apiKey', 'profiles', 'defaultProfile']);
  const profileName = options.profile || config.defaultProfile;
  const profileKey = `profile__${profileName}`;
  const profileData = await chrome.storage.sync.get(profileKey);
  const profile = profileData[profileKey];

  let connected = true;

  port.onDisconnect.addListener(() => {
    connected = false;
  });

  if (config.apiKey === null || config.apiKey.length === 0) {
    gptError(port, ERR_API_KEY);
    return;
  }

  try {
    const payload = {
      model: options.model || profile.model,
      messages: messages,
      stream: true,
    };

    if (isReasoningModel(payload.model)) {
      payload.reasoning_effort = profile.reasoning;
    }

    debug('PAYLOAD', payload);

    const response = await fetchCompletions(config.apiKey, payload);
    const reader = GptResponseReader(response);
    let lastMessage = null;

    while (connected) {
      const message = await reader();

      if (!connected) {
        debug('DISCONNECTED');
        break;
      }

      if (message === null) {
        break;
      }

      debug('MSG:', message);

      const { data: data, error: error } = message;

      if (connected) {
        if (error !== null) {
          gptError(port, error);
        } else if (data !== null) {
          gptMessage(port, data);
          lastMessage = data;
        }
      } else {
        debug('DISCONNECTED');
        break;
      }
    }

    if (connected) {
      gptDone(port, lastMessage);
    }
  } catch (error) {
    console.error(error);
  }
}
