(() => {
  const status = document.getElementById("popupStatus");
  const settingsButton = document.getElementById("settingsButton");
  const testButton = document.getElementById("testButton");
  function setStatus(text, good = true) {
    status.replaceChildren();
    const dot = document.createElement("span");
    dot.className = "status-dot";
    dot.style.background = good ? "#a5d6bd" : "#f0b2a8";
    const label = document.createElement("span");
    label.textContent = text;
    status.append(dot, label);
  }
  chrome.runtime.sendMessage({ type: "GET_SETTINGS_STATUS" }).then((response) => {
    if (response?.configured) setStatus(`Gemini configuré · ${response.model}`);
    else setStatus("Gemini n’est pas configuré. Les vidéos resteront bloquées.", false);
  }).catch(() => setStatus("Extension indisponible.", false));
  settingsButton.addEventListener("click", () => void chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" }));
  testButton.addEventListener("click", async () => {
    setStatus("Pour tester la clé, ouvre les paramètres.", false);
    await chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" }).catch(() => {});
  });
})();
