(() => {
  "use strict";
  const form = document.getElementById("settingsForm");
  const apiKey = document.getElementById("apiKey");
  const model = document.getElementById("model");
  const testButton = document.getElementById("testButton");
  const saveButton = document.getElementById("saveButton");
  const result = document.getElementById("settingsResult");
  let hasSavedKey = false;
  const DEFAULT_MODEL = "gemini-3.5-flash-lite";

  function message(text, isError = false) {
    result.textContent = text;
    result.classList.toggle("error", isError);
  }

  chrome.storage.local.get(["geminiApiKey", "geminiModel"]).then((settings) => {
    // Never prefill the secret; allow testing against the saved key without retyping it.
    if (settings.geminiApiKey) {
      hasSavedKey = true;
      apiKey.placeholder = "Clé enregistrée — laisse vide pour la conserver";
    }
    const savedModel = String(settings.geminiModel || "").trim();
    model.value = (!savedModel || savedModel === "gemini-3.8-flash") ? DEFAULT_MODEL : savedModel;
  }).catch(() => {
    model.value = DEFAULT_MODEL;
    message("Impossible de lire les paramètres existants.", true);
  });

  testButton.addEventListener("click", async () => {
    const key = apiKey.value.trim();
    if (!key && !hasSavedKey) {
      message("Colle et enregistre une clé API avant de tester la connexion.", true);
      apiKey.focus();
      return;
    }
    testButton.disabled = true;
    saveButton.disabled = true;
    message("Test de connexion en cours…");
    const response = await chrome.runtime.sendMessage({ type: "TEST_API_KEY", apiKey: key, model: model.value }).catch((error) => ({ ok: false, error: error.message }));
    testButton.disabled = false;
    saveButton.disabled = false;
    message(response?.ok
      ? (key ? "Connexion réussie avec la clé saisie. Tu peux enregistrer les paramètres." : "Connexion réussie avec la clé déjà enregistrée.")
      : (response?.error || "Connexion impossible."), !response?.ok);
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
      message(`Paramètres enregistrés sur cet appareil. Modèle : ${model.value.trim()}.`);
    } else {
      message(response?.error || "Impossible d’enregistrer les paramètres.", true);
    }
  });
})();
