// Mock chrome extension APIs for unit testing. Each factory creates a
// fresh, independent instance - no shared state between tests.

// Simple event bus matching chrome.*.addListener / emit pattern.
// _listeners and _emit are test-only accessors.
function createEventBus() {
  const listeners = [];
  return {
    addListener(fn) { listeners.push(fn); },
    removeListener(fn) {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    get _listeners() { return listeners; },
    _emit(...args) {
      return Promise.all(listeners.map((fn) => fn(...args)));
    },
  };
}

// In-memory chrome.storage mock. get/set/remove return Promises to match
// the real MV3 API shape. Includes event system, scripting, tabs, and
// contextMenus mocks for connector-level tests.
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

  // Spy log: tests inspect these arrays to verify what the code under test
  // called.
  const calls = {
    contextMenusCreate: [],
    executeScript: [],
    tabsConnect: [],
  };

  return {
    storage: {
      sync: createStorageArea(syncStore),
      local: createStorageArea(localStore),
    },
    runtime: {
      onConnect: createEventBus(),
      onInstalled: createEventBus(),
    },
    contextMenus: {
      create(options) {
        calls.contextMenusCreate.push(options);
      },
      onClicked: createEventBus(),
    },
    scripting: {
      async executeScript(options) {
        calls.executeScript.push(options);
        return [];
      },
    },
    tabs: {
      connect(tabId, options = {}) {
        const port = createPort(options.name);
        calls.tabsConnect.push({ tabId, name: options.name, port });
        return port;
      },
      async query() { return []; },
      async get(id) { return { id, url: 'https://example.com' }; },
    },
    // Call log: tests inspect this to verify what was invoked.
    calls,
  };
}

// Mock chrome.runtime Port for message passing between content scripts and
// the background service worker. Supports listener registration and test
// emission via onMessage._emit(msg).
export function createPort() {
  const messages = [];
  const disconnectListeners = [];
  const messageListeners = [];
  let connected = true;

  const port = {
    name: '',
    postMessage(msg) {
      if (connected) messages.push(msg);
    },
    onMessage: {
      addListener(fn) { messageListeners.push(fn); },
      removeListener(fn) {
        const i = messageListeners.indexOf(fn);
        if (i >= 0) messageListeners.splice(i, 1);
      },
      get _listeners() { return messageListeners; },
      _emit(msg) {
        messageListeners.forEach((fn) => fn(msg));
      },
    },
    onDisconnect: {
      addListener(fn) { disconnectListeners.push(fn); },
    },
    messages,
    disconnect() {
      connected = false;
      disconnectListeners.forEach((fn) => fn());
    },
  };

  return port;
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

// Yield to the microtask queue so pending async operations (streaming
// loops, fire-and-forget calls) can settle. Used in connector tests where
// connect* handlers call fetchAndStreamSummary without await.
export function flush() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}