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
        let text = result[0].result;

        messages = [
          {role: 'system', content: 'You are a browser extension that summarizes the content of a web page.'},
          {role: 'user', content: 'Summarize the contents of this web page for me.'},
          {role: 'user', content: text}
        ];

        for (const prompt of config.customPrompts) {
          messages.unshift({role: 'user', content: prompt});
        }

        if (config.debug) {
          console.log("Sending prompt:", messages);
        }

        // Send the request to the API
        fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model,
            messages: messages
          })
        })
        // Parse the response
        .then(response => response.json())
        .then(data => {
          if (config.debug) {
            console.log("Response:", data);
          }

          return data;
        })
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
