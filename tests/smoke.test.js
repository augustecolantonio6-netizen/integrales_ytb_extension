const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const listeners = { message: null, beforeNavigate: null, historyState: null, tabRemoved: null };
const sessionStore = Object.create(null);
const localStore = Object.create(null);
const dynamicRuleCalls = [];
const tabUpdates = [];
const noop = () => {};

function selectKeys(store, keys) {
  if (keys === undefined || keys === null) return { ...store };
  const list = Array.isArray(keys) ? keys : [keys];
  return Object.fromEntries(list.filter((key) => Object.prototype.hasOwnProperty.call(store, key)).map((key) => [key, store[key]]));
}
function removeKeys(store, keys) {
  for (const key of (Array.isArray(keys) ? keys : [keys])) delete store[key];
}

const chrome = {
  runtime: {
    getURL: (p) => `chrome-extension://test/${p}`,
    onMessage: { addListener: (fn) => { listeners.message = fn; } },
    openOptionsPage: async () => {}
  },
  webNavigation: {
    onBeforeNavigate: { addListener: (fn) => { listeners.beforeNavigate = fn; } },
    onHistoryStateUpdated: { addListener: (fn) => { listeners.historyState = fn; } }
  },
  tabs: {
    onRemoved: { addListener: (fn) => { listeners.tabRemoved = fn; } },
    update: async (tabId, properties) => { tabUpdates.push({ tabId, properties }); return { id: tabId, ...properties }; },
    get: async (tabId) => ({ id: tabId, url: 'https://www.youtube.com/watch?v=abcdefghijk' }),
    create: async () => ({ id: 31, index: 1 })
  },
  storage: {
    session: {
      get: async (keys) => selectKeys(sessionStore, keys),
      set: async (values) => Object.assign(sessionStore, values),
      remove: async (keys) => removeKeys(sessionStore, keys)
    },
    local: {
      get: async (keys) => selectKeys(localStore, keys),
      set: async (values) => Object.assign(localStore, values),
      remove: async (keys) => removeKeys(localStore, keys)
    }
  },
  declarativeNetRequest: {
    updateDynamicRules: async (update) => { dynamicRuleCalls.push(update); }
  }
};

const context = vm.createContext({
  chrome, console, URL,
  fetch: async () => { throw new Error('network disabled in smoke test'); },
  Date, Math, String, Number, Boolean, Array, Object, RegExp, JSON, Error,
  encodeURIComponent, setTimeout, clearTimeout, AbortController, Promise
});
vm.runInContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), context, { filename: 'background.js' });

async function message(message, sender = { tab: { id: 17 } }) {
  assert.equal(typeof listeners.message, 'function', 'background message listener was registered');
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) reject(new Error(`Timed out waiting for ${message.type}`));
    }, 500);
    const sendResponse = (value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(value);
    };
    const result = listeners.message(message, sender, sendResponse);
    if (result !== true && !finished) {
      finished = true;
      clearTimeout(timer);
      resolve(undefined);
    }
  });
}

(async () => {
  const parse = context.parseVideoUrl;
  assert.equal(parse('https://www.youtube.com/watch?v=abcdefghijk').videoId, 'abcdefghijk');
  assert.equal(parse('https://www.youtube.com/shorts/abcdefghijk').videoId, 'abcdefghijk');
  assert.equal(parse('https://youtu.be/abcdefghijk?t=12').url, 'https://www.youtube.com/watch?v=abcdefghijk&t=12');
  assert.equal(parse('https://m.youtube.com/live/abcdefghijk').videoId, 'abcdefghijk');
  assert.equal(parse('https://www.youtube-nocookie.com/embed/abcdefghijk').videoId, 'abcdefghijk');
  assert.equal(parse('https://www.youtube.com/'), null);
  assert.equal(parse('https://www.netflix.com/watch/123456'), null);
  assert.equal(parse('https://player.vimeo.com/video/abcdefghijk'), null);
  assert.equal(context.isAllowedSubject('Mathématiques'), true);
  assert.equal(context.isAllowedSubject('littérature anglaise'), true);
  assert.equal(context.isAllowedSubject('gaming'), false);
  const parsed = context.extractAssignedJson('var ytInitialPlayerResponse = {"videoDetails":{"title":"A {title}"}}; after;', 'ytInitialPlayerResponse');
  assert.equal(parsed.videoDetails.title, 'A {title}');

  const exerciseFiles = fs.readdirSync(path.join(root, 'assets/exercises')).filter((name) => name.endsWith('.png'));
  const solutionFiles = fs.readdirSync(path.join(root, 'assets/solutions')).filter((name) => name.endsWith('.png'));
  assert.equal(exerciseFiles.length, 100);
  assert.equal(solutionFiles.length, 100);
  for (let i = 1; i <= 100; i++) {
    const n = String(i).padStart(3, '0') + '.png';
    assert.ok(fs.existsSync(path.join(root, 'assets/exercises', n)), `Missing exercise ${n}`);
    assert.ok(fs.existsSync(path.join(root, 'assets/solutions', n)), `Missing solution ${n}`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const rules = JSON.parse(fs.readFileSync(path.join(root, 'rules.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '1.0.3');
  assert.equal((fs.readFileSync(path.join(root, 'background.js'), 'utf8').match(/message\.type === "GET_GATE_TAB_ID"/g) || []).length, 1, 'one GET_GATE_TAB_ID handler is registered');
  assert.ok(manifest.permissions.includes('declarativeNetRequest'));
  assert.equal(manifest.content_scripts[0].all_frames, true, 'YouTube embeds on other pages are covered');
  assert.ok(manifest.content_scripts[0].matches.some((pattern) => pattern.includes('youtube-nocookie')));
  assert.equal(rules.length, 1);
  assert.equal(rules[0].action.type, 'block');
  for (const localPath of [manifest.background.service_worker, manifest.action.default_popup, manifest.options_page, ...manifest.content_scripts.flatMap((script) => script.js)]) {
    assert.ok(fs.existsSync(path.join(root, localPath)), `Missing manifest file: ${localPath}`);
  }

  // The media exception must fail closed unless this exact tab/video has a valid grant.
  let access = await message({ type: 'CHECK_VIDEO_ACCESS', videoId: 'abcdefghijk' });
  assert.equal(access.allowed, false);
  sessionStore['allow_once:17:abcdefghijk'] = { expiresAt: Date.now() + 20_000 };
  access = await message({ type: 'CHECK_VIDEO_ACCESS', videoId: 'abcdefghijk' });
  assert.equal(access.allowed, true);
  assert.equal(dynamicRuleCalls.at(-1).addRules[0].condition.tabIds[0], 17);
  assert.equal(dynamicRuleCalls.at(-1).addRules[0].condition.urlFilter, '||googlevideo.com/');
  sessionStore['allow_once:17:abcdefghijk'] = { expiresAt: Date.now() - 1 };
  access = await message({ type: 'CHECK_VIDEO_ACCESS', videoId: 'abcdefghijk' });
  assert.equal(access.allowed, false);
  assert.equal(Object.hasOwn(sessionStore, 'allow_once:17:abcdefghijk'), false);

  // A hand-crafted call to UNLOCK_VIDEO without a validated Gemini grant must fail closed.
  const gateSender = { tab: { id: 17, index: 0 }, url: 'chrome-extension://test/blocked.html?exercise=5' };
  const beforeUnauthenticatedUnlocks = tabUpdates.length;
  const noGrant = await message({ type: 'UNLOCK_VIDEO' }, gateSender);
  assert.equal(noGrant.ok, false);
  assert.match(noGrant.error, /validation Gemini|valid|Aucune vidéo/i);
  assert.equal(tabUpdates.length, beforeUnauthenticatedUnlocks, 'unauthorized unlock never navigates a tab');

  // A gate page can only receive trusted context that the background stored for this tab.
  const invalidGate = await message({ type: 'GET_GATE_CONTEXT' }, { tab: { id: 17 }, url: 'chrome-extension://test/blocked.html?videoId=attacker&title=math' });
  assert.equal(invalidGate.ok, false);
  sessionStore['gate_context:17'] = {
    videoId: 'abcdefghijk', targetUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
    title: 'Intégrales en terminale', exercise: 8, createdAt: Date.now()
  };
  const validGate = await message({ type: 'GET_GATE_CONTEXT' }, gateSender);
  assert.equal(validGate.ok, true);
  assert.equal(validGate.context.videoId, 'abcdefghijk');
  assert.equal(validGate.context.title, 'Intégrales en terminale');

  // A first metadata lookup obtains only the title; extra data is fetched only when requested.
  const metadataRequests = [];
  context.fetch = async (url) => {
    metadataRequests.push(String(url));
    if (String(url).includes('/oembed')) {
      return { ok: true, json: async () => ({ title: 'Cours de mathématiques', author_name: 'Prof de maths' }) };
    }
    return {
      ok: true,
      text: async () => '<meta property="og:description" content="Description pédagogique de test">'
    };
  };
  const titleOnly = await message({ type: 'GET_VIDEO_DETAILS', videoId: 'abcdefghijk', extended: false }, gateSender);
  assert.equal(titleOnly.ok, true);
  assert.equal(titleOnly.details.title, 'Cours de mathématiques');
  assert.equal(titleOnly.details.description, '');
  assert.equal(metadataRequests.length, 1, 'first lookup requests only title metadata');
  metadataRequests.length = 0;
  const extendedDetails = await message({ type: 'GET_VIDEO_DETAILS', videoId: 'abcdefghijk', extended: true }, gateSender);
  assert.equal(extendedDetails.ok, true);
  assert.equal(extendedDetails.details.description, 'Description pédagogique de test');
  assert.ok(metadataRequests.some((url) => url.includes('/watch?v=')), 'extended lookup fetches the watch page only on demand');

  // Metadata retrieval is limited to the trusted gate context/video.
  const unauthorizedDetails = await message({ type: 'GET_VIDEO_DETAILS', videoId: 'zyxwvutsrq1' }, { tab: { id: 17 }, url: 'https://www.youtube.com/watch?v=zyxwvutsrq1' });
  assert.equal(unauthorizedDetails.ok, false);

  // Classification from a non-gate sender cannot mint an unlock grant.
  localStore.geminiApiKey = 'fake-test-key-12345';
  localStore.geminiModel = 'gemini-3.8-flash';
  const unauthorizedClassification = await message({ type: 'CLASSIFY_VIDEO', video: { videoId: 'abcdefghijk', title: 'Mathématiques' } }, { tab: { id: 17 }, url: 'https://www.youtube.com/watch?v=abcdefghijk' });
  assert.equal(unauthorizedClassification.allowed, false);
  assert.equal(Object.hasOwn(sessionStore, 'unlock_grant:17:abcdefghijk'), false);

  // Mock the Gemini API response and verify that only an accepted result yields a one-use grant.
  let geminiResult = { allowed: true, subject: 'Mathématiques', reason: 'Le titre porte sur une notion mathématique.', needsMoreContext: false };
  let lastGeminiRequest = null;
  context.fetch = async (url, options) => {
    lastGeminiRequest = { url: String(url), options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(geminiResult) }] } }] })
    };
  };
  const classified = await message({ type: 'CLASSIFY_VIDEO', video: { videoId: 'abcdefghijk', title: 'Integrales en terminale' }, context: {} }, gateSender);
  assert.equal(classified.allowed, true);
  assert.equal(Object.hasOwn(sessionStore, 'unlock_grant:17:abcdefghijk'), true);
  assert.equal(lastGeminiRequest.options.headers['x-goog-api-key'], 'fake-test-key-12345');
  assert.equal(lastGeminiRequest.url.includes('fake-test-key-12345'), false, 'API key is not embedded in the request URL');
  const opened = await message({ type: 'UNLOCK_VIDEO' }, gateSender);
  assert.equal(opened.ok, true);
  assert.equal(tabUpdates.at(-1).tabId, 17);
  assert.equal(tabUpdates.at(-1).properties.url, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(Object.hasOwn(sessionStore, 'unlock_grant:17:abcdefghijk'), false, 'grant is consumed after unlock');

  // An explicit rejection does not create a grant; an accepted justification creates one for this exact tab/video.
  geminiResult = { reply: 'Le lien n’est pas encore clair.', accepted: false, needsMoreContext: false, subject: 'Aucune' };
  const rejected = await message({ type: 'JUSTIFY_CHAT', video: { videoId: 'abcdefghijk' }, context: {}, history: [], userMessage: 'C’est éducatif.' }, gateSender);
  assert.equal(rejected.accepted, false);
  assert.equal(Object.hasOwn(sessionStore, 'unlock_grant:17:abcdefghijk'), false);
  geminiResult = { reply: 'La vidéo analyse explicitement une œuvre de littérature anglaise.', accepted: true, needsMoreContext: false, subject: 'Littérature anglaise' };
  const accepted = await message({ type: 'JUSTIFY_CHAT', video: { videoId: 'abcdefghijk' }, context: {}, history: [], userMessage: 'Elle analyse les thèmes de Macbeth et les procédés de Shakespeare.' }, gateSender);
  assert.equal(accepted.accepted, true);
  assert.equal(Object.hasOwn(sessionStore, 'unlock_grant:17:abcdefghijk'), true);
  const reopened = await message({ type: 'UNLOCK_VIDEO' }, gateSender);
  assert.equal(reopened.ok, true);
  assert.equal(tabUpdates.at(-1).properties.url, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(Object.hasOwn(sessionStore, 'unlock_grant:17:abcdefghijk'), false);

  // New-tab flow stores the target on the new tab; the URL carries only the exercise number.
  const clickedInNewTab = await message({ type: 'NAVIGATE_TO_GATE', url: 'https://www.youtube.com/watch?v=zyxwvutsrq1', title: 'Cours de physique', newTab: true }, { tab: { id: 17, index: 0 }, url: 'https://www.youtube.com/' });
  assert.equal(clickedInNewTab.ok, true);
  assert.equal(sessionStore['gate_context:31'].videoId, 'zyxwvutsrq1');
  const gateTabUrl = tabUpdates.at(-1).properties.url;
  const gateUrlObject = new URL(gateTabUrl);
  assert.equal(gateUrlObject.pathname, '/blocked.html');
  assert.equal(gateUrlObject.searchParams.has('target'), false);
  assert.equal(gateUrlObject.searchParams.has('title'), false);
  assert.equal(gateUrlObject.searchParams.has('videoId'), false);

  console.log('Smoke tests OK: URL parsing, YouTube/embedded scope, 100 image pairs, fail-closed access, trusted gate context, Gemini classification and justification grants, and one-use unlock.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
