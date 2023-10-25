document.addEventListener('DOMContentLoaded', function () {
  const port   = chrome.runtime.connect({name: "summarize"});
  const target = document.getElementById('summary');

  //----------------------------------------------------------------------------
  // powers the doc hint in the extra instructions text area
  //----------------------------------------------------------------------------
  const extra = document.getElementById("extra-instructions");
  const hint = "Please summarize this web page.";

  extra.value = hint;

  extra.addEventListener("focus", () => {
    if (extra.value == hint) {
      extra.value = "";
      extra.classList.remove("hint");
    }
  });

  extra.addEventListener("blur", () => {
    if (extra.value == "") {
      extra.value = hint;
      extra.classList.add("hint");
    }
  });

  function restoreSummary() {
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
        const url = tabs[0].url;

        chrome.storage.local.get('results')
          .then((data) => {
            let results = data.results || {};
            results[url] = summary;
            chrome.storage.local.set({results: results});
          });
      });
  }

  function updateSummary(message) {
    target.innerHTML = message;
  }

  function reportError(message) {
    updateSummary(`<span style="color: red; font-style: italic;">Error: ${message}</span>`);
  }

  function requestNewSummary() {
    chrome.tabs.query({active: true, currentWindow: true})
      .then((tabs) => {
        port.postMessage({
          action: 'summarize',
          tabId:  tabs[0].id,
          extra:  extra.value
        });
      });
  }


  // Restore the last page summary when the popup is opened
  restoreSummary().then((summary) => {
    if (summary != null) {
      updateSummary(marked.marked(summary));
    }
  });

  // Flag to prevent multiple clicks
  let working = false;

  // Handle the summarize button click
  document.getElementById('summarize').addEventListener('click', function () {
    if (working) {
      return;
    }

    working = true;
    updateSummary('Fetching summary...');
    requestNewSummary();
  });

  // Set up the port message listener
  port.onMessage.addListener(function(msg) {
    if (msg == null) {
      return;
    }

    switch (msg.action) {
      case 'gptMessage':
        updateSummary(marked.marked(msg.summary));
        break;

      case 'gptDone':
        updateSummary(marked.marked(msg.summary));
        setSummary(msg.summary);
        working = false;
        break;

      case 'gptError':
        reportError(msg.error);
        working = false;
        break;

      default:
        reportError('Failed to fetch summary.');
        working = false;
        break;
    }
  });
});
