importScripts('config.js');

let authToken = null;
let deviceId = null;

console.log('[BD Tracker] Service worker loaded');

chrome.storage.local.get(['authToken', 'deviceId']).then((stored) => {
  authToken = stored.authToken || null;
  deviceId = stored.deviceId || generateDeviceId();
  if (authToken) {
    console.log('[BD Tracker] Restored auth token from storage');
    startHeartbeat();
  } else {
    console.log('[BD Tracker] No auth token in storage');
  }
});

chrome.runtime.onInstalled.addListener(async () => {
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
});

chrome.runtime.onStartup.addListener(async () => {
  const stored = await chrome.storage.local.get(['authToken', 'deviceId']);
  authToken = stored.authToken || null;
  deviceId = stored.deviceId || generateDeviceId();

  if (authToken) {
    startHeartbeat();
    registerDevice();
    checkForUpdates();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BD_TRACKER_EVENT') {
    console.log('[BD Tracker] Received event from bridge:', message.event_type);
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
      console.log('[BD Tracker] Storage fallback received:', message.event_type);
      handleEvent(message);
      chrome.storage.local.remove(key);
    }
  }
});

async function handleEvent(message) {
  if (!authToken) {
    console.log('[BD Tracker] Event ignored — not logged in');
    return;
  }

  const dedupKey = message.data?.product_id || message.data?.url || message.data?.product_name || '';
  if (isDuplicate(message.event_type, dedupKey)) {
    console.log('[BD Tracker] Skipping duplicate:', message.event_type, dedupKey);
    return;
  }

  console.log('[BD Tracker] Sending event:', message.event_type);
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/extension/activity-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        event_type: message.event_type,
        product_id: message.data.product_id,
        vendor_id: message.data.vendor_id,
        product_name: message.data.product_name,
        product_sku: message.data.product_sku,
        qc_status: message.data.qc_status,
        pending_count: message.data.pending_count,
        metadata: message.data
      })
    });

    if (!response.ok) {
      const data = await response.json();
      console.log('[BD Tracker] Event failed:', response.status, data);
      if (response.status === 401) {
        await handleLogout();
      }
    } else {
      console.log('[BD Tracker] Event sent OK');
    }
  } catch (err) {
    console.error('[BD Tracker] Event error:', err.message);
  }
}

async function handleLogin(message) {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/extension/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: message.email, password: message.password })
    });

    const data = await response.json();

    if (response.ok && data.token) {
      authToken = data.token;
      await chrome.storage.local.set({
        authToken: data.token,
        userName: data.data?.user?.name || message.email,
        userEmail: data.data?.user?.email || message.email,
        userTeam: data.data?.user?.team || null
      });

      startHeartbeat();
      registerDevice();
      checkForUpdates();

      return { success: true, userName: data.data?.user?.name || message.email, team: data.data?.user?.team };
    } else {
      return { success: false, message: data.message || 'Login failed' };
    }
  } catch (err) {
    console.error('[BD Tracker] Login error:', err.message);
    return { success: false, message: `Network error: ${err.message}` };
  }
}

async function handleLogout() {
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
  } catch (err) {}
}

async function sendHeartbeat() {
  if (!authToken || !deviceId) return;

  console.log('[BD Tracker] Sending heartbeat');
  try {
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
    } else if (response.status === 401) {
      await handleLogout();
    }
  } catch (err) {}
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
      } else {
        await chrome.storage.local.set({ updateAvailable: false });
      }
    }
  } catch (err) {}
}

function startHeartbeat() {
  stopHeartbeat();
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
  await sendHeartbeat();
  await checkForUpdates();
  const stored = await chrome.storage.local.get(['lastSync']);
  return { success: true, lastSync: stored.lastSync };
}

function generateDeviceId() {
  return 'ext_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

const recentEvents = new Map();
const DEDUP_WINDOW = 8000;

function isDuplicate(eventType, dedupKey) {
  const key = eventType + '|' + dedupKey;
  const now = Date.now();
  if (recentEvents.has(key) && now - recentEvents.get(key) < DEDUP_WINDOW) {
    return true;
  }
  recentEvents.set(key, now);
  for (const [k, t] of recentEvents) {
    if (now - t > DEDUP_WINDOW) recentEvents.delete(k);
  }
  return false;
}

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

    chrome.storage.local.get(['authToken'], async (stored) => {
      const token = stored.authToken || authToken;
      if (!token) return;

      for (const matched of matches) {
        const pid = extractProductIdFromUrl(details.url);
        const dedupKey = pid || details.url.split('?')[0];
        if (isDuplicate(matched.eventType, dedupKey)) {
          console.log('[BD Tracker] Skipping duplicate webRequest:', matched.eventType, dedupKey);
          continue;
        }
        console.log('[BD Tracker] webRequest sending:', matched.eventType, dedupKey);
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
        } catch (err) {
          console.error('[BD Tracker] webRequest send error:', err.message);
        }
      }
    });
  },
  { urls: ['https://commerce.thecanbrand.com/*', 'https://demo.commerce.thecanbrand.com/*'] },
  ['responseHeaders']
);
