(() => {
  "use strict";
  const form = document.getElementById("settingsForm");
  const apiKey = document.getElementById("apiKey");
  const model = document.getElementById("model");
  const testButton = document.getElementById("testButton");
  const saveButton = document.getElementById("saveButton");
  const result = document.getElementById("settingsResult");
  let hasSavedKey = false;

  function message(text, isError = false) {
    result.textContent = text;
    result.classList.toggle("error", isError);
  }

  chrome.storage.local.get(["geminiApiKey", "geminiModel"]).then((settings) => {
    // Do not prefill the password input with the saved key; only indicate that one exists.
    if (settings.geminiApiKey) { hasSavedKey = true; apiKey.placeholder = "Clé enregistrée — laisse vide pour la conserver"; }
    if (settings.geminiModel && [...model.options].some((option) => option.value === settings.geminiModel)) model.value = settings.geminiModel;
  });

  testButton.addEventListener("click", async () => {
    const key = apiKey.value.trim();
    if (!key) {
      message("Colle ta clé API pour tester la connexion.", true);
      apiKey.focus();
      return;
    }
    testButton.disabled = true;
    saveButton.disabled = true;
    message("Test de connexion en cours…");
    const response = await chrome.runtime.sendMessage({ type: "TEST_API_KEY", apiKey: key, model: model.value }).catch((error) => ({ ok: false, error: error.message }));
    testButton.disabled = false;
    saveButton.disabled = false;
    message(response?.ok ? "Connexion réussie. Tu peux enregistrer la clé." : (response?.error || "Connexion impossible."), !response?.ok);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const key = apiKey.value.trim();
    if (!key && !hasSavedKey) {
      message("Colle ta clé API. Pour des raisons de sécurité, elle n'est pas réaffichée une fois enregistrée.", true);
      apiKey.focus();
      return;
    }
    testButton.disabled = true;
    saveButton.disabled = true;
    message("Enregistrement…");
    const response = await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", apiKey: key, model: model.value }).catch((error) => ({ ok: false, error: error.message }));
    testButton.disabled = false;
    saveButton.disabled = false;
    if (response?.ok) {
      apiKey.value = "";
      hasSavedKey = true;
      apiKey.placeholder = "Clé enregistrée — laisse vide pour la conserver";
      message("Paramètres enregistrés sur cet appareil.");
    } else {
      message(response?.error || "Impossible d’enregistrer les paramètres.", true);
    }
  });
})();
