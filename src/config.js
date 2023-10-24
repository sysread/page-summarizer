document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(["apiKey", "model", "customPrompts", "debug"], (result) => {
    if (result.apiKey) {
      document.getElementById("apiKey").value = result.apiKey;
    }

    if (result.model) {
      document.getElementById("model").value = result.model;
    }

    if (result.customPrompts) {
      document.getElementById("customPrompts").value = result.customPrompts.join("\n");
    }

    if (result.debug) {
      document.getElementById("debug").checked = !!result.debug;
    }
  });

  document.getElementById("config-form").addEventListener("submit", (e) => {
    e.preventDefault();
    document.getElementById("status").style.display = "none";

    const apiKey        = document.getElementById("apiKey").value;
    const model         = document.getElementById("model").value;
    const customPrompts = document.getElementById("customPrompts").value.split("\n");
    const debug         = !!document.getElementById("debug").checked;

    chrome.storage.sync.set({ apiKey, model, customPrompts, debug }, () => {
      document.getElementById("status").textContent = "Settings saved.";
      document.getElementById("status").style.display = "block";

      console.log("Settings saved.", { apiKey, model, customPrompts, debug });
    });
  });
});
