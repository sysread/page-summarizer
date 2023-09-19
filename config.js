document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(["apiKey", "model", "customPrompts"], (result) => {
    if (result.apiKey) {
      document.getElementById("apiKey").value = result.apiKey;
    }
    if (result.model) {
      document.getElementById("model").value = result.model;
    }
    if (result.customPrompts) {
      document.getElementById("customPrompts").value = result.customPrompts.join("\n");
    }
  });

  document.getElementById("config-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const apiKey = document.getElementById("apiKey").value;
    const model = document.getElementById("model").value;
    const customPrompts = document.getElementById("customPrompts").value.split("\n");

    chrome.storage.sync.set({ apiKey, model, customPrompts }, () => {
      alert("Settings saved.");
    });
  });
});
