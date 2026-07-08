// Mock chrome extension APIs for unit testing. Each factory creates a
// fresh, independent instance - no shared state between tests.

// In-memory chrome.storage mock. get/set/remove return Promises to match
// the real MV3 API shape.
export function createChrome(initialStore = {}) {
  const syncStore = { ...initialStore };
  const localStore = {};

  const createStorageArea = (store) => ({
    get(keys) {
      if (keys === null || keys === undefined) return Promise.resolve({ ...store });
      const arr = Array.isArray(keys) ? keys : [keys];
      const result = {};
      for (const k of arr) if (k in store) result[k] = store[k];
      return Promise.resolve(result);
    },
    set(obj) {
      Object.assign(store, obj);
      return Promise.resolve();
    },
    remove(keys) {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const k of arr) delete store[k];
      return Promise.resolve();
    },
  });

  return {
    storage: {
      sync: createStorageArea(syncStore),
      local: createStorageArea(localStore),
    },
  };
}

// Mock chrome.runtime Port for message passing between content scripts and
// the background service worker.
export function createPort() {
  const messages = [];
  const disconnectListeners = [];
  let connected = true;

  return {
    postMessage(msg) {
      if (connected) messages.push(msg);
    },
    onMessage: { addListener() {} },
    onDisconnect: {
      addListener(fn) { disconnectListeners.push(fn); },
    },
    messages,
    disconnect() {
      connected = false;
      disconnectListeners.forEach((fn) => fn());
    },
  };
}

// Mock streaming SSE response from OpenAI's chat completions endpoint.
// Each entry in chunks is a raw string as it would arrive over the network.
export function createSSEResponse(chunks) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    body: {
      getReader() {
        return {
          read() {
            if (i < chunks.length) {
              const value = encoder.encode(chunks[i++]);
              return Promise.resolve({ value, done: false });
            }
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    },
  };
}