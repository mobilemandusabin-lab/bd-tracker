importScripts('config.js');

let authToken = null;
let deviceId = null;
let consecutiveAuthFailures = 0;
const MAX_AUTH_FAILURES = 3;

function handleAuthFailure() {
  consecutiveAuthFailures++;
  console.log(`[BD Tracker BG] ⚠️ Auth failure ${consecutiveAuthFailures}/${MAX_AUTH_FAILURES}`);
  if (consecutiveAuthFailures >= MAX_AUTH_FAILURES) {
    console.log(`[BD Tracker BG] 🔒 Too many auth failures — logging out`);
    handleLogout();
  }
}

function resetAuthFailures() {
  if (consecutiveAuthFailures > 0) {
    console.log(`[BD Tracker BG] ✅ Auth failures reset`);
    consecutiveAuthFailures = 0;
  }
}

chrome.storage.local.get(['authToken', 'deviceId']).then((stored) => {
  authToken = stored.authToken || null;
  deviceId = stored.deviceId || generateDeviceId();
  console.log(`[BD Tracker BG] 🔧 Initialized. Logged in: ${!!authToken}, deviceId: ${deviceId}`);
  if (authToken) {
    startHeartbeat();
  }
});

async function injectIntoExistingTabs() {
  const urls = ['https://commerce.thecanbrand.com/*', 'https://demo.commerce.thecanbrand.com/*'];
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: urls });
  } catch (e) {
    console.log(`[BD Tracker BG] ⚠️ tabs.query failed: ${e.message}`);
    return;
  }
  console.log(`[BD Tracker BG] 💉 Injecting into ${tabs.length} existing tabs`);
  for (const tab of tabs) {
    if (!tab || !tab.id) continue;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['bridge.js']
      });
      console.log(`[BD Tracker BG] ✅ Injected into tab ${tab.id}: ${tab.url}`);
    } catch (e) {
      console.log(`[BD Tracker BG] ⚠️ Failed to inject into tab ${tab.id}: ${e.message}`);
    }
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log(`[BD Tracker BG] 🚀 Extension installed/updated`);
  const stored = await chrome.storage.local.get(['authToken', 'deviceId', 'userName']);
  authToken = stored.authToken || null;
  deviceId = stored.deviceId || generateDeviceId();

  if (!stored.deviceId) {
    await chrome.storage.local.set({ deviceId });
  }

  if (authToken) {
    startHeartbeat();
    registerDevice();
    checkForUpdates();
  }
  injectIntoExistingTabs();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log(`[BD Tracker BG] 🌅 Browser started`);
  const stored = await chrome.storage.local.get(['authToken', 'deviceId']);
  authToken = stored.authToken || null;
  deviceId = stored.deviceId || generateDeviceId();

  if (authToken) {
    startHeartbeat();
    registerDevice();
    checkForUpdates();
  }
  injectIntoExistingTabs();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BD_TRACKER_EVENT') {
    handleEvent(message);
    return;
  }

  if (message.type === 'LOGIN') {
    handleLogin(message).then(sendResponse);
    return true;
  }

  if (message.type === 'LOGIN_SUCCESS') {
    chrome.storage.local.get(['authToken'], (stored) => {
      if (stored.authToken) {
        authToken = stored.authToken;
        console.log(`[BD Tracker BG] 🔑 Login success, starting heartbeat`);
        startHeartbeat();
        registerDevice();
        checkForUpdates();
      }
    });
    return;
  }

  if (message.type === 'LOGOUT') {
    handleLogout().then(sendResponse);
    return true;
  }

  if (message.type === 'GET_STATUS') {
    getStatus().then(sendResponse);
    return true;
  }

  if (message.type === 'SYNC_NOW') {
    syncNow().then(sendResponse);
    return true;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  for (const [key, change] of Object.entries(changes)) {
    if (!key.startsWith('bd_event_')) continue;
    const message = change.newValue;
    if (message && message.type === 'BD_TRACKER_EVENT') {
      handleEvent(message);
      chrome.storage.local.remove(key);
    }
  }
});

async function handleEvent(message) {
  if (!authToken) {
    console.log(`[BD Tracker BG] ⚠️ Event ignored — not logged in`);
    return;
  }

  const eventType = message.event_type;
  const data = message.data || {};

  console.log(`[BD Tracker BG] 📥 Received event: ${eventType}`, JSON.stringify({
    product_id: data.product_id,
    product_name: data.product_name,
    workflow_state: data.workflow_state
  }));

  // ── session_ended: no dedup, log directly ──
  if (eventType === 'session_ended') {
    try {
      console.log(`[BD Tracker BG] 📋 Session ended for ${data.product_id}:`, JSON.stringify({
        final_state: data.final_state,
        completed: data.completed,
        total_duration: data.total_duration ? Math.round(data.total_duration / 60000) + 'min' : null,
        active_duration: data.active_duration ? Math.round(data.active_duration / 60000) + 'min' : null,
        total_events: data.total_events,
        spec_count: data.spec_count
      }));

      const response = await fetch(`${CONFIG.API_BASE_URL}/extension/activity-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          event_type: 'session_ended',
          product_id: data.product_id,
          vendor_id: null,
          product_name: data.product_name || null,
          product_sku: null,
          qc_status: null,
          pending_count: null,
          metadata: data
        })
      });

      if (!response.ok) {
        console.log(`[BD Tracker BG] ❌ session_ended log failed: ${response.status}`);
        if (response.status === 401) handleAuthFailure();
      } else {
        resetAuthFailures();
        console.log(`[BD Tracker BG] ✅ session_ended logged for ${data.product_id}`);
      }
    } catch (err) {
      console.log(`[BD Tracker BG] ❌ session_ended error: ${err.message}`);
    }
    return;
  }

  // ── Normal events: dedup + log ──
  let dedupKey = data.product_id || data.product_name || data.url || '';
  let dedupWindow = DEDUP_WINDOW;
  if (eventType === 'listing_created' || eventType === 'product_created') dedupWindow = 5000;
  else if (eventType === 'spec_added') dedupWindow = 300000; // 5 min — specs should not be added twice to same product

  if (isDuplicate(eventType, dedupKey, dedupWindow)) {
    console.log(`[BD Tracker BG] 🔄 Duplicate event ignored: ${eventType} for ${dedupKey}`);
    return;
  }

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/extension/activity-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        event_type: eventType,
        product_id: data.product_id,
        vendor_id: data.vendor_id,
        product_name: data.product_name,
        product_sku: data.product_sku,
        qc_status: data.qc_status,
        pending_count: data.pending_count,
        bulk_count: data.bulk_count,
        metadata: {
          ...data,
          // Include session context in metadata
          workflow_state: data.workflow_state,
          previous_state: data.previous_state,
          session_duration: data.session_duration,
          time_to_first_spec: data.time_to_first_spec,
          time_to_listing: data.time_to_listing,
          total_views: data.total_views,
          spec_count: data.spec_count,
          has_package_type: data.has_package_type,
          tab_id: data.tab_id
        }
      })
    });

    if (!response.ok) {
      console.log(`[BD Tracker BG] ❌ Event log failed: ${response.status}`);
      if (response.status === 401) {
        handleAuthFailure();
      }
    } else {
      resetAuthFailures();
      const result = await response.json();
      console.log(`[BD Tracker BG] ✅ Event logged: ${eventType} → ${result?.data?.event_id || 'ok'}`);
    }
  } catch (err) {
    console.log(`[BD Tracker BG] ❌ Event log error: ${err.message}`);
  }
}

async function handleLogin(message) {
  try {
    console.log(`[BD Tracker BG] 🔑 Logging in...`);
    const response = await fetch(`${CONFIG.API_BASE_URL}/extension/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: message.email, password: message.password })
    });

    const data = await response.json();

    if (response.ok && data.token) {
      authToken = data.token;
      consecutiveAuthFailures = 0;
      await chrome.storage.local.set({
        authToken: data.token,
        userName: data.data?.user?.name || message.email,
        userEmail: data.data?.user?.email || message.email,
        userTeam: data.data?.user?.team || null,
        userId: data.data?.user?._id || null
      });

      startHeartbeat();
      registerDevice();
      checkForUpdates();

      console.log(`[BD Tracker BG] ✅ Login success: ${data.data?.user?.name}`);
      return { success: true, userName: data.data?.user?.name || message.email, team: data.data?.user?.team };
    } else {
      console.log(`[BD Tracker BG] ❌ Login failed: ${data.message}`);
      return { success: false, message: data.message || 'Login failed' };
    }
  } catch (err) {
    console.log(`[BD Tracker BG] ❌ Login error: ${err.message}`);
    return { success: false, message: `Network error: ${err.message}` };
  }
}

async function handleLogout() {
  console.log(`[BD Tracker BG] 👋 Logging out`);
  authToken = null;
  stopHeartbeat();
  await chrome.storage.local.remove(['authToken', 'userName', 'userEmail']);
  return { success: true };
}

async function getStatus() {
  const stored = await chrome.storage.local.get(['authToken', 'userName', 'userEmail', 'deviceId', 'lastSync']);
  return {
    isLoggedIn: !!stored.authToken,
    userName: stored.userName || null,
    userEmail: stored.userEmail || null,
    deviceId: stored.deviceId || null,
    lastSync: stored.lastSync || null,
    version: chrome.runtime.getManifest().version
  };
}

async function registerDevice() {
  if (!authToken || !deviceId) return;

  try {
    console.log(`[BD Tracker BG] 📱 Registering device: ${deviceId}`);
    await fetch(`${CONFIG.API_BASE_URL}/extension/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        device_id: deviceId,
        extension_version: chrome.runtime.getManifest().version
      })
    });
  } catch (err) {
    console.log(`[BD Tracker BG] ⚠️ Device registration failed: ${err.message}`);
  }
}

async function sendHeartbeat() {
  if (!authToken || !deviceId) return;

  try {
    console.log(`[BD Tracker BG] 💓 Sending heartbeat`);
    const response = await fetch(`${CONFIG.API_BASE_URL}/extension/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ device_id: deviceId })
    });

    if (response.ok) {
      await chrome.storage.local.set({ lastSync: new Date().toISOString() });
      resetAuthFailures();
      console.log(`[BD Tracker BG] ✅ Heartbeat success`);
    } else if (response.status === 401) {
      handleAuthFailure();
    }
  } catch (err) {
    console.log(`[BD Tracker BG] ❌ Heartbeat error: ${err.message}`);
  }
}

async function checkForUpdates() {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/extension/latest-version`);
    const data = await response.json();

    if (response.ok && data.data) {
      const currentVersion = chrome.runtime.getManifest().version;
      const latestVersion = data.data.version;

      if (latestVersion !== currentVersion) {
        await chrome.storage.local.set({
          updateAvailable: true,
          latestVersion: latestVersion,
          changelog: data.data.changelog || ''
        });
        console.log(`[BD Tracker BG] 📦 Update available: ${currentVersion} → ${latestVersion}`);
      } else {
        await chrome.storage.local.set({ updateAvailable: false });
        console.log(`[BD Tracker BG] ✅ Extension up to date: ${currentVersion}`);
      }
    }
  } catch (err) {
    console.log(`[BD Tracker BG] ⚠️ Version check failed: ${err.message}`);
  }
}

function startHeartbeat() {
  stopHeartbeat();
  console.log(`[BD Tracker BG] 🫀 Starting heartbeat (${CONFIG.HEARTBEAT_INTERVAL / 60000}min interval)`);
  sendHeartbeat();
  checkForUpdates();

  chrome.alarms.create('heartbeat', { periodInMinutes: CONFIG.HEARTBEAT_INTERVAL / 60000 });
  chrome.alarms.create('versionCheck', { periodInMinutes: CONFIG.VERSION_CHECK_INTERVAL / 60000 });
}

function stopHeartbeat() {
  chrome.alarms.clear('heartbeat');
  chrome.alarms.clear('versionCheck');
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!authToken) {
    const stored = await chrome.storage.local.get(['authToken', 'deviceId']);
    authToken = stored.authToken || null;
    deviceId = stored.deviceId || null;
  }

  if (!authToken) return;

  if (alarm.name === 'heartbeat') {
    await sendHeartbeat();
  } else if (alarm.name === 'versionCheck') {
    await checkForUpdates();
  }
});

async function syncNow() {
  console.log(`[BD Tracker BG] 🔄 Manual sync triggered`);
  await sendHeartbeat();
  await checkForUpdates();
  const stored = await chrome.storage.local.get(['lastSync']);
  return { success: true, lastSync: stored.lastSync };
}

function generateDeviceId() {
  const id = 'ext_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
  console.log(`[BD Tracker BG] 🆕 Generated device ID: ${id}`);
  return id;
}

const recentEvents = new Map();
const DEDUP_WINDOW = 60000;
const DEDUP_STORAGE_KEY = 'bd_dedup_state';

async function loadDedupState() {
  try {
    if (!chrome.storage || !chrome.storage.session) return;
    const stored = await chrome.storage.session.get(DEDUP_STORAGE_KEY);
    const entries = stored[DEDUP_STORAGE_KEY];
    if (entries && typeof entries === 'object') {
      const now = Date.now();
      for (const [k, t] of Object.entries(entries)) {
        if (now - t < DEDUP_WINDOW * 2) {
          recentEvents.set(k, t);
        }
      }
      console.log(`[BD Tracker BG] 🔄 Restored ${recentEvents.size} dedup entries from session storage`);
    }
  } catch (e) {
    console.log(`[BD Tracker BG] ⚠️ loadDedupState failed: ${e.message}`);
  }
}

let dedupFlushTimer = null;
function scheduleDedupFlush() {
  if (dedupFlushTimer) return;
  dedupFlushTimer = setTimeout(async () => {
    dedupFlushTimer = null;
    try {
      if (!chrome.storage || !chrome.storage.session) return;
      const obj = {};
      recentEvents.forEach((v, k) => { obj[k] = v; });
      await chrome.storage.session.set({ [DEDUP_STORAGE_KEY]: obj });
    } catch (e) {}
  }, 500);
}

function isDuplicate(eventType, dedupKey, windowOverride) {
  const key = eventType + '|' + dedupKey;
  const now = Date.now();
  const window = windowOverride || DEDUP_WINDOW;

  if (recentEvents.has(key) && now - recentEvents.get(key) < window) {
    return true;
  }
  recentEvents.set(key, now);
  for (const [k, t] of recentEvents) {
    if (now - t > DEDUP_WINDOW * 2) recentEvents.delete(k);
  }
  scheduleDedupFlush();
  return false;
}

loadDedupState();

function extractProductIdFromUrl(url) {
  const match = url.match(/\/products\/([^\/]+)/);
  return match ? match[1] : null;
}

const API_EVENT_MAP = [
  { method: 'POST', urlPattern: '/api/quality-check/products/', urlSuffix: '/approve', eventType: 'qc_approved' },
  { method: 'POST', urlPattern: '/api/quality-check/products/', urlSuffix: '/reject', eventType: 'qc_rejected' }
];

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.statusCode < 200 || details.statusCode >= 300) return;

    const matches = API_EVENT_MAP.filter(p => {
      if (details.method !== p.method) return false;
      if (!details.url.includes(p.urlPattern)) return false;
      if (p.urlSuffix && !details.url.includes(p.urlSuffix)) return false;
      return true;
    });

    if (matches.length === 0) return;

    console.log(`[BD Tracker BG] 🔍 webRequest QC match: ${details.method} ${details.url}`);

    chrome.storage.local.get(['authToken'], async (stored) => {
      const token = stored.authToken || authToken;
      if (!token) return;

      for (const matched of matches) {
        const pid = extractProductIdFromUrl(details.url);
        const dedupKey = pid || details.url.split('?')[0];
        if (isDuplicate(matched.eventType, dedupKey)) {
          console.log(`[BD Tracker BG] 🔄 webRequest QC duplicate ignored: ${matched.eventType}`);
          continue;
        }
        try {
          await fetch(`${CONFIG.API_BASE_URL}/extension/activity-log`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              event_type: matched.eventType,
              product_id: pid,
              vendor_id: null,
              product_name: null,
              product_sku: null,
              qc_status: null,
              metadata: { source: 'webRequest', url: details.url, method: details.method }
            })
          });
          console.log(`[BD Tracker BG] ✅ webRequest QC logged: ${matched.eventType} for ${pid}`);
        } catch (err) {
          console.log(`[BD Tracker BG] ❌ webRequest QC error: ${err.message}`);
        }
      }
    });
  },
  { urls: ['https://commerce.thecanbrand.com/*', 'https://demo.commerce.thecanbrand.com/*'] },
  ['responseHeaders']
);
