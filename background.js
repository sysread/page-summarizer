chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summarize") {
    chrome.tabs.executeScript(
      { code: "document.body.innerText" },
      async (resultArray) => {
        const pageContent = resultArray[0];
        try {
          const summary = await summarizeContent(pageContent);
          sendResponse({ summary });
        } catch (error) {
          sendResponse({ summary: "An error occurred while summarizing." });
        }
      }
    );
    return true;
  }
});

function getPageContent() {
  return document.body.innerText;
}

async function summarizeContent(content) {
  let config = await new Promise((resolve) => {
    chrome.storage.sync.get(["apiKey", "model", "customPrompts"], (result) => {
      resolve(result);
    });
  });

  const apiKey = config.apiKey;
  const model = config.model || "gpt-3.5-turbo-16k";
  const customPrompts = config.customPrompts || [];

  const messages = [{ role: "system", content: `You are a helpful assistant that summarizes texts.` }];
  customPrompts.forEach((prompt) => {
    messages.push({ role: "user", content: prompt });
  });
  messages.push({ role: "user", content: `Summarize:\n${content}` });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
    }),
  });
  const data = await response.json();
  return data.choices[0].message.content.trim();
}
