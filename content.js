(() => {
  "use strict";

  const VIDEO_PATH = /^\/(?:watch(?:\/|$)|shorts\/|live\/|embed\/|v\/)/;
  const COVER_ID = "integrales-ytb-emergency-cover";
  const COVER_STYLE_ID = "integrales-ytb-emergency-cover-style";
  let lastGateRequest = { id: "", at: 0, newTab: false };
  let playGuardInstalled = false;
  let spaNavigationVersion = 0;

  function getVideoInfo(rawUrl) {
    try {
      const url = new URL(rawUrl, location.href);
      const host = url.hostname.toLowerCase();
      const isYoutube = host === "youtube.com" || host.endsWith(".youtube.com");
      const isShort = host === "youtu.be";
      const isNoCookie = host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com");
      if (!isYoutube && !isShort && !isNoCookie) return null;

      let id = "";
      if (isShort) id = url.pathname.split("/").filter(Boolean)[0] || "";
      else if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
      else {
        const match = url.pathname.match(/^\/(?:shorts|live|embed|v)\/([^/?#]+)/);
        if (match) id = match[1];
      }
      if (!/^[a-zA-Z0-9_-]{6,20}$/.test(id)) return null;

      const canonical = new URL("https://www.youtube.com/watch");
      canonical.searchParams.set("v", id);
      const list = url.searchParams.get("list");
      const index = url.searchParams.get("index");
      const start = url.searchParams.get("t") || url.searchParams.get("start");
      if (list) canonical.searchParams.set("list", list);
      if (index) canonical.searchParams.set("index", index);
      if (start) canonical.searchParams.set("t", start);
      return { id, url: canonical.href };
    } catch { return null; }
  }

  function titleFromLink(link) {
    // Prefer the visible video title; aria-label/title can identify UI controls.
    const candidates = [
      link.querySelector("#video-title, yt-formatted-string#video-title, .yt-lockup-metadata-view-model__title, h3")?.textContent,
      link.querySelector("[aria-label*='Video:'], [aria-label*='Vidéo :']")?.getAttribute("aria-label"),
      link.dataset?.title,
      link.getAttribute("aria-label"),
      link.getAttribute("title"),
      link.textContent
    ];
    const generic = /^(youtube|watch video|watch later|add to queue|save to playlist|vidéo|video|shorts|à regarder plus tard|ajouter à la file d'attente)$/i;
    for (const candidate of candidates) {
      const text = String(candidate || "").replace(/\s+/g, " ").trim();
      if (text.length >= 3 && text.length <= 500 && !generic.test(text)) return text;
    }
    return "";
  }

  function requestGate(url, title, newTab) {
    const video = getVideoInfo(url);
    if (!video) return;
    const now = Date.now();
    const wantsNewTab = Boolean(newTab);
    if (lastGateRequest.id === video.id && lastGateRequest.newTab === wantsNewTab && now - lastGateRequest.at < 450) return;
    lastGateRequest = { id: video.id, at: now, newTab: wantsNewTab };
    chrome.runtime.sendMessage({
      type: "NAVIGATE_TO_GATE",
      url: video.url,
      title: title || "",
      newTab: wantsNewTab
    }, (response) => {
      const error = chrome.runtime.lastError;
      // The worker replaces this page with a tiny checker page. The checker
      // itself navigates to the video or the integral gate after classification.
      if (error || response?.ok === false) {
        console.error("Impossible de lancer la vérification.", error || response?.error || "");
        if (!wantsNewTab) ensureCover("La vérification n’a pas pu démarrer. Recharge YouTube et réessaie.");
      }
    });
  }

  function linkFromEvent(event) {
    for (const item of event.composedPath ? event.composedPath() : [event.target]) {
      if (item && item.nodeType === Node.ELEMENT_NODE && item.matches?.("a[href]")) return item;
    }
    return event.target?.closest?.("a[href]") || null;
  }

  function interceptLinkEvent(event) {
    const link = linkFromEvent(event);
    if (!link) return;
    const video = getVideoInfo(link.href);
    if (!video) return;
    if (event.type === "click" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const newTab = Boolean(
      event.type === "auxclick" || event.ctrlKey || event.metaKey || event.shiftKey || link.target === "_blank"
    );
    if (!newTab) ensureCover("Vérification du sujet avec Gemini…");
    requestGate(video.url, titleFromLink(link), newTab);
  }

  function ensureCover(message = "Vérification du sujet…") {
    let style = document.getElementById(COVER_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = COVER_STYLE_ID;
      style.textContent = `
        html, body { background: #0b0c0f !important; }
        body > *:not(#${COVER_ID}) { visibility: hidden !important; }
        #${COVER_ID} {
          position: fixed !important; inset: 0 !important; z-index: 2147483647 !important;
          display: flex !important; align-items: center !important; justify-content: center !important;
          padding: 24px !important; box-sizing: border-box !important;
          background: #0b0c0f !important; color: #f5f5f6 !important;
          font: 500 15px/1.5 system-ui, sans-serif !important; text-align: center !important;
        }
      `;
      (document.documentElement || document).appendChild(style);
    }
    let cover = document.getElementById(COVER_ID);
    if (!cover) {
      cover = document.createElement("div");
      cover.id = COVER_ID;
      (document.documentElement || document).appendChild(cover);
    }
    cover.textContent = message;
    return { style, cover };
  }

  function removeCover() {
    document.getElementById(COVER_STYLE_ID)?.remove();
    document.getElementById(COVER_ID)?.remove();
  }

  function pauseVideos() {
    document.querySelectorAll("video").forEach((video) => {
      try { video.pause(); video.currentTime = 0; } catch { /* player may not expose its timeline yet */ }
      video.muted = true;
    });
    if (playGuardInstalled) return;
    playGuardInstalled = true;
    document.addEventListener("play", (event) => {
      if (event.target instanceof HTMLVideoElement) {
        try { event.target.pause(); event.target.currentTime = 0; } catch { /* ignored */ }
      }
    }, true);
  }

  async function guardCurrentVideo() {
    const info = getVideoInfo(location.href);
    if (!info || !VIDEO_PATH.test(location.pathname)) {
      removeCover();
      return;
    }

    ensureCover();
    try {
      const response = await chrome.runtime.sendMessage({ type: "CHECK_VIDEO_ACCESS", videoId: info.id });
      if (response?.allowed === true) {
        removeCover();
        return;
      }
    } catch { /* Fail closed if the extension worker is unavailable. */ }

    ensureCover("Vérification du sujet avec Gemini…");
    pauseVideos();
    requestGate(info.url, "", false);
  }

  // Cover a direct navigation before YouTube can paint the player.
  void guardCurrentVideo();

  // Intercept recommendation/search/Shorts links before YouTube starts playback.
  document.addEventListener("click", interceptLinkEvent, true);
  document.addEventListener("auxclick", interceptLinkEvent, true);

  // YouTube is a single-page app. Cover during route changes, then check the final URL.
  window.addEventListener("yt-navigate-start", () => {
    spaNavigationVersion += 1;
    ensureCover("Vérification du sujet…");
    const version = spaNavigationVersion;
    setTimeout(() => {
      if (version !== spaNavigationVersion) return;
      const info = getVideoInfo(location.href);
      if (info && VIDEO_PATH.test(location.pathname)) void guardCurrentVideo();
      else removeCover();
    }, 0);
  }, true);

  const finishSpaNavigation = () => {
    spaNavigationVersion += 1;
    const version = spaNavigationVersion;
    setTimeout(() => {
      if (version === spaNavigationVersion) void guardCurrentVideo();
    }, 0);
  };
  window.addEventListener("yt-navigate-finish", finishSpaNavigation, true);
  window.addEventListener("yt-page-data-updated", finishSpaNavigation, true);
  window.addEventListener("popstate", finishSpaNavigation, true);
  window.addEventListener("pageshow", finishSpaNavigation, true);
})();
