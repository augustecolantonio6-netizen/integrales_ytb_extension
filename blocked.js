(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  let videoId = "";
  let targetUrl = "";
  let videoTitle = "";
  let exerciseNumber = parseInt(params.get("exercise") || "", 10);
  if (!Number.isInteger(exerciseNumber) || exerciseNumber < 1 || exerciseNumber > 100) exerciseNumber = pickExercise();
  let showingSolution = false;
  let context = { description: "", transcript: "", channel: "" };
  let initialDecision = "";
  let tabId = null;
  let chatHistory = [];
  let chatOpen = false;
  let classificationBusy = false;
  let unlockStarted = false;

  const $ = (id) => document.getElementById(id);
  const videoTitleEl = $("videoTitle");
  const classificationStatus = $("classificationStatus");
  const exerciseNumberEl = $("exerciseNumber");
  const exerciseCard = $("exerciseCard");
  const appealCard = $("appealCard");
  const exerciseImage = $("exerciseImage");
  const solutionButton = $("solutionButton");
  const anotherButton = $("anotherButton");
  const solutionNote = $("solutionNote");
  const notice = $("notice");
  const appealButton = $("appealButton");
  const chatPanel = $("chatPanel");
  const chatMessages = $("chatMessages");
  const chatForm = $("chatForm");
  const chatInput = $("chatInput");
  const sendChatButton = $("sendChatButton");

  function pickExercise(exclude = null) {
    let chosen = Math.floor(Math.random() * 100) + 1;
    if (exclude && chosen === exclude) chosen = (chosen % 100) + 1;
    return chosen;
  }

  function isGenericVideoTitle(value) {
    const title = String(value || "").replace(/\s+/g, " ").trim();
    return !title || /^(vidéo youtube|video youtube|youtube|watch later|add to queue|watch video|video unavailable|récupération du titre de la vidéo…?)$/i.test(title);
  }

  function padded(value) { return String(value).padStart(3, "0"); }

  function setExerciseImage() {
    const folder = showingSolution ? "solutions" : "exercises";
    exerciseImage.src = chrome.runtime.getURL(`assets/${folder}/${padded(exerciseNumber)}.png`);
    exerciseImage.alt = showingSolution ? `Solution de l’intégrale numéro ${exerciseNumber}` : `Énoncé de l’intégrale numéro ${exerciseNumber}`;
    exerciseImage.classList.toggle("solution-render", showingSolution);
    exerciseNumberEl.textContent = `N° ${exerciseNumber} / 100`;
    solutionButton.innerHTML = showingSolution
      ? '<span class="button-icon">↶</span> Revoir l’intégrale'
      : '<span class="button-icon">∫</span> Solution';
    solutionNote.hidden = !showingSolution;
  }

  function revealBlockedInterface() {
    exerciseCard.hidden = false;
    appealCard.hidden = false;
  }

  function showNotice(text, type = "error") {
    notice.textContent = text;
    notice.hidden = !text;
    notice.className = "notice" + (type === "info" ? " notice-info" : type === "success" ? " notice-success" : "");
  }

  function setStatus(text, type = "loading") {
    classificationStatus.className = "classification-status";
    classificationStatus.replaceChildren();
    if (type === "loading") {
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      classificationStatus.appendChild(spinner);
    } else if (type === "error") {
      classificationStatus.classList.add("is-error");
    } else if (type === "success") {
      classificationStatus.classList.add("is-success");
    }
    const label = document.createElement("span");
    label.textContent = text;
    classificationStatus.appendChild(label);
  }

  function sendRuntime(message) {
    return chrome.runtime.sendMessage(message).catch((error) => ({ ok: false, error: error.message || "Extension indisponible." }));
  }

  async function getCurrentTabId() {
    const senderTab = await sendRuntime({ type: "GET_GATE_TAB_ID" });
    if (Number.isInteger(senderTab?.tabId) && senderTab.tabId >= 0) return senderTab.tabId;
    try {
      const tab = await chrome.tabs.getCurrent();
      if (Number.isInteger(tab?.id) && tab.id >= 0) return tab.id;
    } catch { /* fallback only to an explicitly provided numeric value */ }
    const raw = params.get("tabId");
    if (raw === null || raw.trim() === "") return null;
    const fromUrl = Number(raw);
    return Number.isInteger(fromUrl) && fromUrl >= 0 ? fromUrl : null;
  }

  async function retrieveVideoDetails(extended = false) {
    if (!videoId) return false;
    const response = await sendRuntime({ type: "GET_VIDEO_DETAILS", videoId, extended });
    if (!response?.ok || !response.details) return false;
    const details = response.details;
    if (details.title && isGenericVideoTitle(videoTitle)) {
      videoTitle = details.title;
      videoTitleEl.textContent = videoTitle;
    }
    context = {
      description: details.description || context.description,
      transcript: details.transcript || context.transcript,
      channel: details.channel || context.channel
    };
    return Boolean(context.description || context.transcript || videoTitle);
  }

  async function attemptUnlock() {
    if (unlockStarted) return;
    unlockStarted = true;
    setStatus("Justification acceptée — ouverture de la vidéo…", "success");
    showNotice("Le lien pédagogique a été confirmé. Tu es redirigé vers cette vidéo.", "success");
    const response = await sendRuntime({ type: "UNLOCK_VIDEO" });
    if (!response?.ok) {
      unlockStarted = false;
      revealBlockedInterface();
      setStatus("Autorisation incomplète — la vidéo reste bloquée.", "error");
      showNotice(response?.error || "Impossible d’ouvrir la vidéo. Elle reste bloquée.");
      return;
    }

    // Replacing the gate page (rather than asking tabs.update to navigate)
    // removes the exercise page from the Back history after an approval.
    const approvedUrl = String(response.targetUrl || targetUrl);
    try {
      const parsed = new URL(approvedUrl);
      if (parsed.hostname !== "www.youtube.com" || parsed.pathname !== "/watch" || parsed.searchParams.get("v") !== videoId) {
        throw new Error("L’URL approuvée ne correspond pas à la vidéo.");
      }
      location.replace(parsed.href);
    } catch (error) {
      unlockStarted = false;
      revealBlockedInterface();
      setStatus("Navigation impossible — la vidéo reste bloquée.", "error");
      showNotice(error?.message || "Impossible d’ouvrir l’URL vidéo approuvée.");
    }
  }

  async function classify() {
    if (classificationBusy) return;
    classificationBusy = true;
    setStatus("Vérification du sujet avec Gemini…", "loading");
    try {
      if (isGenericVideoTitle(videoTitle)) await retrieveVideoDetails(false);
      if (!videoTitle) videoTitle = videoId ? `Vidéo YouTube (${videoId})` : "Vidéo YouTube";
      videoTitleEl.textContent = videoTitle;

      let result = await sendRuntime({
        type: "CLASSIFY_VIDEO",
        video: { title: videoTitle, videoId },
        context
      });
      if (result?.configured === false) {
        revealBlockedInterface();
        initialDecision = result.reason || "Gemini n'est pas configuré.";
        setStatus("Configuration Gemini nécessaire — la vidéo reste bloquée.", "error");
        showNotice("Pour classer les vidéos et examiner les recours, ajoute ta clé API Gemini dans les paramètres. En attendant, aucune vidéo ne passe automatiquement.", "info");
        return;
      }

      const firstReason = String(result?.reason || result?.error || "");
      const hardApiFailure = /analyse indisponible|erreur api|quota|clé api|modèle gemini|délai d’attente|clé invalide/i.test(firstReason);
      if ((result?.needsMoreContext === true || result?.allowed !== true) && !hardApiFailure) {
        const before = JSON.stringify(context);
        setStatus("Je vérifie aussi la description et les informations de la vidéo…", "loading");
        await retrieveVideoDetails(true);
        const moreContextAvailable = JSON.stringify(context) !== before &&
          Boolean(context.description || context.transcript || context.channel);
        if (moreContextAvailable) {
          // A negative title-only decision is not final when more metadata can clarify the main subject.
          result = await sendRuntime({
            type: "CLASSIFY_VIDEO",
            video: { title: videoTitle, videoId },
            context
          });
        }
      }

      if (result?.allowed === true && result?.needsMoreContext !== true) {
        initialDecision = result.reason || `Sujet identifié : ${result.subject || "matière autorisée"}.`;
        await attemptUnlock();
        return;
      }

      revealBlockedInterface();
      initialDecision = result?.reason || result?.error || "Le lien avec une matière autorisée n'a pas pu être confirmé.";
      if (/analyse indisponible|erreur api|quota|clé api|modèle gemini/i.test(initialDecision)) {
        setStatus("La vidéo est bloquée — classification impossible.", "error");
        showNotice(`${initialDecision} La vidéo restera bloquée tant que l’analyse n’est pas disponible.`, "error");
      } else {
        setStatus("Vidéo bloquée — aucun lien avec les matières autorisées n’a été confirmé.", "error");
        showNotice(initialDecision, "info");
      }
    } catch (error) {
      revealBlockedInterface();
      initialDecision = error?.message || "Erreur d’analyse.";
      setStatus("La vidéo est bloquée — analyse indisponible.", "error");
      showNotice("Gemini n’a pas pu vérifier cette vidéo. Elle reste bloquée par sécurité. Tu peux réessayer plus tard ou vérifier les paramètres.");
    } finally {
      classificationBusy = false;
    }
  }

  function appendChatMessage(role, text) {
    const item = document.createElement("div");
    item.className = `chat-message ${role}`;
    item.textContent = text;
    chatMessages.appendChild(item);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return item;
  }

  function openChat() {
    chatOpen = true;
    chatPanel.hidden = false;
    appealButton.hidden = true;
    if (chatHistory.length === 0) {
      const welcome = "Explique-moi en quoi le sujet principal de cette vidéo est directement lié à l’une de tes matières autorisées. Je vais examiner ta justification et les informations disponibles sur la vidéo.";
      chatHistory.push({ role: "assistant", text: welcome });
      appendChatMessage("assistant", welcome);
    }
    chatInput.focus();
  }

  function closeChat() {
    chatOpen = false;
    chatPanel.hidden = true;
    appealButton.hidden = false;
  }

  async function submitJustification(message, allowDetailsRetry = true) {
    const response = await sendRuntime({
      type: "JUSTIFY_CHAT",
      video: { title: videoTitle, videoId },
      context,
      initialDecision,
      history: chatHistory,
      userMessage: message
    });

    if (response?.configured === false) {
      appendChatMessage("assistant", response.reply || "Gemini n'est pas configuré. La vidéo reste bloquée.");
      showNotice("Configure Gemini pour utiliser le recours.", "info");
      sendChatButton.disabled = false;
      chatInput.disabled = false;
      return;
    }

    if (response?.needsMoreContext && allowDetailsRetry) {
      const hadMore = Boolean(context.description || context.transcript);
      await retrieveVideoDetails(true);
      const hasMore = Boolean(context.description || context.transcript);
      if (!hadMore && !hasMore) {
        const fallback = "Je n’arrive pas à récupérer assez d’informations supplémentaires sur cette vidéo. La justification n’est donc pas validée et elle reste bloquée.";
        chatHistory.push({ role: "user", text: message }, { role: "assistant", text: fallback });
        appendChatMessage("user", message);
        appendChatMessage("assistant", fallback);
        sendChatButton.disabled = false;
        chatInput.disabled = false;
        return;
      }
      return submitJustification(message, false);
    }

    const reply = response?.reply || "Je n'ai pas pu vérifier cette justification. La vidéo reste bloquée.";
    chatHistory.push({ role: "user", text: message }, { role: "assistant", text: reply });
    appendChatMessage("user", message);
    appendChatMessage("assistant", reply);
    if (response?.accepted === true) {
      const success = "Justification acceptée. Ouverture de la vidéo…";
      appendChatMessage("system", success);
      await attemptUnlock();
      return;
    }
    if (response?.error) showNotice(response.error);
    sendChatButton.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  }

  solutionButton.addEventListener("click", () => {
    showingSolution = !showingSolution;
    setExerciseImage();
  });

  anotherButton.addEventListener("click", () => {
    const previous = exerciseNumber;
    exerciseNumber = pickExercise(previous);
    showingSolution = false;
    setExerciseImage();
    showNotice("Nouvelle intégrale sélectionnée.", "info");
    const updatedUrl = new URL(location.href);
    updatedUrl.searchParams.set("exercise", String(exerciseNumber));
    history.replaceState(null, "", updatedUrl.href);
  });

  appealButton.addEventListener("click", openChat);
  $("closeChatButton").addEventListener("click", closeChat);
  $("settingsButton").addEventListener("click", () => { void sendRuntime({ type: "OPEN_OPTIONS" }); });
  $("footerSettingsButton").addEventListener("click", () => { void sendRuntime({ type: "OPEN_OPTIONS" }); });

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message || sendChatButton.disabled) return;
    sendChatButton.disabled = true;
    chatInput.disabled = true;
    chatInput.value = "";
    const pendingMessage = appendChatMessage("assistant", "J’examine ta justification…");
    await submitJustification(message);
    pendingMessage.remove();
    sendChatButton.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  });

  async function init() {
    setExerciseImage();
    // Keep the exercise and appeal visible while Gemini analyses the title.
    revealBlockedInterface();
    videoTitleEl.textContent = "Récupération du titre de la vidéo…";
    tabId = await getCurrentTabId();
    if (tabId === null) {
      videoTitleEl.textContent = "Aucune vidéo associée";
      revealBlockedInterface();
      setStatus("Contexte introuvable — aucune vidéo ne peut être ouverte.", "error");
      showNotice("Cette page d’intégrale n’est pas associée à une vidéo bloquée. Reviens sur YouTube et clique sur une vidéo.");
      return;
    }

    const gate = await sendRuntime({ type: "GET_GATE_CONTEXT" });
    if (!gate?.ok || !gate.context) {
      videoTitleEl.textContent = "Aucune vidéo associée";
      revealBlockedInterface();
      setStatus("Contexte introuvable — aucune vidéo ne peut être ouverte.", "error");
      showNotice(gate?.error || "Cette page d’intégrale n’est pas associée à une vidéo bloquée. Elle ne peut pas autoriser une navigation.");
      return;
    }

    const assignedExercise = Number(gate.context.exercise);
    if (Number.isInteger(assignedExercise) && assignedExercise >= 1 && assignedExercise <= 100) {
      exerciseNumber = assignedExercise;
      setExerciseImage();
    }
    videoId = String(gate.context.videoId || "");
    targetUrl = String(gate.context.targetUrl || "");
    videoTitle = String(gate.context.title || "").trim();
    if (!/^[a-zA-Z0-9_-]{6,20}$/.test(videoId) || !/^https:\/\/www\.youtube\.com\/watch\?v=/.test(targetUrl)) {
      videoId = "";
      targetUrl = "";
      videoTitleEl.textContent = "Contexte de vidéo invalide";
      revealBlockedInterface();
      setStatus("Contexte invalide — la vidéo reste bloquée.", "error");
      showNotice("Les informations de cette vidéo ne sont pas valides. Aucune autorisation ne sera accordée.");
      return;
    }

    videoTitleEl.textContent = videoTitle || "Récupération du titre de la vidéo…";
    await sendRuntime({ type: "GATE_PAGE_READY" });
    if (gate.context.prechecked === true) {
      initialDecision = String(gate.context.initialDecision || "Aucun lien avec une matière autorisée n’a été confirmé.");
      revealBlockedInterface();
      setStatus("Vidéo bloquée — le sujet semble hors des matières autorisées.", "error");
      showNotice(initialDecision, "info");
      return;
    }
    await classify();
  }

  void init();
})();
