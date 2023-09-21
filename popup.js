document.addEventListener('DOMContentLoaded', function () {
  const port = chrome.runtime.connect({name: "summarize"});
  const summaryElement = document.getElementById('summary');

  let working = false;

  // Set up the port message listener
  port.onMessage.addListener(function(msg) {
    if (msg == null) {
      return;
    }

    if (msg.done) {
      working = false;

      if (msg.error != null) {
        reportError(msg.error);
      }
      else if (msg.summary != null && msg.summary.length > 0) {
        setSummary(msg.summary);
      }

      return;
    }

    if (msg.summary != null && msg.summary.length > 0) {
      updateSummary(marked.marked(msg.summary));
    }
    else {
      reportError('Failed to fetch summary.');
      working = false;
    }
  });

  // Restore the summary when the popup is opened
  getSummary().then((summary) => {
    if (summary != null) {
      updateSummary(marked.marked(summary));
    }
  });

  function getSummary() {
    return new Promise((resolve, _reject) => {
      chrome.tabs.query({active: true, currentWindow: true})
        .then((tabs) => {
          const url = tabs[0].url;

          chrome.storage.local.get('results')
            .then((data) => {
              if (data.results && data.results[url]) {
                resolve(data.results[url]);
              } else {
                resolve(null);
              }
            });
        });
    });
  }

  function setSummary(summary) {
    chrome.tabs.query({active: true, currentWindow: true})
      .then((tabs) => {
        var url = tabs[0].url;

        chrome.storage.local.get('results')
          .then((data) => {
            var results = data.results || {};
            results[url] = summary;
            chrome.storage.local.set({results: results});
          });
      });
  }

  function updateSummary(message) {
    summaryElement.innerHTML = message;
  }

  function reportError(message) {
    updateSummary(`<span style="color: red; font-style: italic;">Error: ${message}</span>`);
  }

  document.getElementById('summarize').addEventListener('click', function () {
    if (working) {
      return;
    }

    updateSummary('Fetching summary...');
    working = true;

    chrome.storage.sync.get(['apiKey', 'model', 'customPrompts', 'debug'])
      .then((config) => {
        chrome.tabs.query({active: true, currentWindow: true})
          .then((tabs) => {
            port.postMessage({
              action: 'summarize',
              tabId: tabs[0].id,
              config: config,
              extra: getExtraInstructions()
            });
          });
      });
  });

  //----------------------------------------------------------------------------
  // powers the doc hint in the textarea
  //----------------------------------------------------------------------------
  const textarea = document.getElementById("extra-instructions");
  const hint = "Please summarize this web page.";

  textarea.value = hint;

  textarea.addEventListener("focus", () => {
    if (textarea.value === hint) {
      textarea.value = "";
      textarea.classList.remove("hint");
    }
  });

  textarea.addEventListener("blur", () => {
    if (textarea.value === "") {
      textarea.value = hint;
      textarea.classList.add("hint");
    }
  });

  function getExtraInstructions() {
    return textarea.value;
  }
});
