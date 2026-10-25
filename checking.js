(() => {
  "use strict";
  const status = document.getElementById("status");

  function setStatus(message, loading = false) {
    status.replaceChildren();
    if (loading) {
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      spinner.setAttribute("aria-hidden", "true");
      status.appendChild(spinner);
    }
    status.appendChild(document.createTextNode(message));
  }

  function sendRuntime(message) {
    return chrome.runtime.sendMessage(message).catch((error) => ({
      ok: false,
      error: error?.message || "L’extension ne répond pas."
    }));
  }

  function validatedVideoUrl(value) {
    try {
      const url = new URL(String(value || ""));
      const id = url.searchParams.get("v") || "";
      if (url.protocol !== "https:" || url.hostname !== "www.youtube.com" ||
          url.pathname !== "/watch" || !/^[a-zA-Z0-9_-]{6,20}$/.test(id)) return null;
      return url;
    } catch { return null; }
  }

  function validatedBlockedUrl(value) {
    try {
      const url = new URL(String(value || ""));
      const expected = new URL(chrome.runtime.getURL("blocked.html"));
      const exercise = Number(url.searchParams.get("exercise"));
      if (url.origin !== expected.origin || url.pathname !== expected.pathname ||
          !Number.isInteger(exercise) || exercise < 1 || exercise > 100) return null;
      return url;
    } catch { return null; }
  }

  function replaceWithFallback(targetUrl, fallbackMessage) {
    return new Promise((resolve) => {
      let pageLeaving = false;
      window.addEventListener("pagehide", () => {
        pageLeaving = true;
        resolve(true);
      }, { once: true });
      location.replace(targetUrl);
      setTimeout(async () => {
        if (pageLeaving || location.pathname !== "/checking.html") return;
        const fallback = await sendRuntime(fallbackMessage);
        if (fallback?.ok) {
          resolve(true);
        } else {
          setStatus(fallback?.error || "La navigation n’a pas abouti. Recharge YouTube et réessaie.");
          resolve(false);
        }
      }, 900);
    });
  }

  async function init() {
    const ready = await sendRuntime({ type: "CHECKING_PAGE_READY" });
    if (!ready?.ok) {
      setStatus("Le contexte de la vidéo est introuvable. Reviens sur YouTube et réessaie.");
      return;
    }
    setStatus("Analyse du titre et des informations disponibles…", true);
    const result = await sendRuntime({ type: "VERIFY_PENDING_VIDEO" });
    if (!result?.ok) {
      setStatus(result?.error || "La vérification a échoué. Reviens sur YouTube et réessaie.");
      return;
    }
    if (result.allowed === true) {
      const target = validatedVideoUrl(result.targetUrl);
      if (!target) {
        setStatus("L’URL de la vidéo vérifiée est invalide. Aucun accès n’a été ouvert.");
        return;
      }
      setStatus("Sujet autorisé. Ouverture de la vidéo…", true);
      await replaceWithFallback(target.href, { type: "NAVIGATE_APPROVED_VIDEO" });
      return;
    }
    const blockedUrl = validatedBlockedUrl(result.blockedUrl);
    if (!blockedUrl) {
      setStatus(result.reason || "La page d’intégrales n’a pas pu être ouverte.");
      return;
    }
    setStatus("Aucun lien suffisant avec les matières autorisées. Ouverture de la page d’intégrales…", true);
    await replaceWithFallback(blockedUrl.href, { type: "NAVIGATE_BLOCKED_GATE" });
  }

  void init().catch((error) => setStatus(error?.message || "Une erreur a empêché la vérification."));
})();
