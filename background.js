// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          return;
        }

        let text = result[0].result;

        // Send the request to the API
        fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model,
            messages: [{role: 'user', content: 'Summarize the text for me.'}, {role: 'system', content: text}]
          })
        })
        // Parse the response
        .then(response => response.json())
        // Send the response to the popup
        .then(data => {
          // Extract the summary or error
          let result = data.error
            ? { summary: null, error: data.error.message }
            : { summary: data.choices[0].message.content, error: null };

          // Store the response
          chrome.storage.local.set({ "lastResult": result });

          // Send the response back to the popup
          sendResponse(result);
        })
        .catch(error => { console.error("Error:", error) });
      }
    );
  }
  return true;
});

// Clear stored data when the URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    // Clear stored data
    chrome.storage.local.remove("lastResult", () => {
      console.log("Cleared last result due to URL change.");
    });
  }
});
