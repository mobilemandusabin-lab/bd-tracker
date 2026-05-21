// BD Tracker — Background Service Worker
importScripts('config.js');

let authToken = null;
let deviceId = null;

// Initialize on install
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

// Initialize on startup
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

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BD_TRACKER_EVENT') {
    handleEvent(message);
    return;
  }

  if (message.type === 'LOGIN') {
    handleLogin(message).then(sendResponse);
    return true; // async response
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

// Handle API events from content script
async function handleEvent(message) {
  if (!authToken) return;

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
        metadata: message.data
      })
    });

    if (!response.ok) {
      const data = await response.json();
      if (response.status === 401) {
        await handleLogout();
      }
    }
  } catch (err) {
    // Network error — will retry on next event
  }
}

// Handle login
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
    return { success: false, message: 'Network error — is BD Tracker running?' };
  }
}

// Handle logout
async function handleLogout() {
  authToken = null;
  stopHeartbeat();
  await chrome.storage.local.remove(['authToken', 'userName', 'userEmail']);
  return { success: true };
}

// Get current status
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

// Register device with backend
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
  } catch (err) {
    // Will retry on next heartbeat
  }
}

// Send heartbeat
async function sendHeartbeat() {
  if (!authToken || !deviceId) return;

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
  } catch (err) {
    // Network error
  }
}

// Check for extension updates
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
  } catch (err) {
    // Network error
  }
}

// Start heartbeat using chrome.alarms (survives MV3 service worker termination)
function startHeartbeat() {
  stopHeartbeat();
  sendHeartbeat();
  checkForUpdates();

  chrome.alarms.create('heartbeat', { periodInMinutes: CONFIG.HEARTBEAT_INTERVAL / 60000 });
  chrome.alarms.create('versionCheck', { periodInMinutes: CONFIG.VERSION_CHECK_INTERVAL / 60000 });
}

// Stop alarms
function stopHeartbeat() {
  chrome.alarms.clear('heartbeat');
  chrome.alarms.clear('versionCheck');
}

// Handle alarm fires
chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Restore auth state from storage (service worker may have been restarted)
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

// Manual sync
async function syncNow() {
  await sendHeartbeat();
  await checkForUpdates();
  const stored = await chrome.storage.local.get(['lastSync']);
  return { success: true, lastSync: stored.lastSync };
}

// Generate unique device ID
function generateDeviceId() {
  return 'ext_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

// ==================== WEB REQUEST INTERCEPT ====================
// Detect API calls at the network level (can't be bypassed by page JS)
const API_EVENT_MAP = [
  { method: 'POST', urlPattern: '/api/vendor/products', eventType: 'listing_created' },
  { method: 'PUT', urlPattern: '/api/vendor/products/', eventType: 'product_updated' },
  { method: 'POST', urlPattern: '/api/quality-check/products/', urlSuffix: '/approve', eventType: 'qc_approved' },
  { method: 'POST', urlPattern: '/api/quality-check/products/', urlSuffix: '/reject', eventType: 'qc_rejected' }
];

chrome.webRequest.onCompleted.addListener(
  async (details) => {
    // Debug: log ALL requests to see what we're getting
    console.log('[BD Tracker webRequest] Request:', details.method, details.url, 'status:', details.statusCode);

    // Only successful responses
    if (details.statusCode < 200 || details.statusCode >= 300) return;

    // Match against our patterns
    const matched = API_EVENT_MAP.find(p => {
      if (details.method !== p.method) return false;
      if (!details.url.includes(p.urlPattern)) return false;
      if (p.urlSuffix && !details.url.includes(p.urlSuffix)) return false;
      return true;
    });

    if (!matched) return;

    console.log('[BD Tracker webRequest] Detected:', matched.eventType, details.url);

    // Get auth state
    if (!authToken) {
      const stored = await chrome.storage.local.get(['authToken']);
      authToken = stored.authToken || null;
    }

    if (!authToken) {
      console.log('[BD Tracker webRequest] Not logged in, skipping');
      return;
    }

    // Send to backend — we don't have response body from webRequest,
    // but the backend will still create the ExtensionEvent with event_type and user_id
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/extension/activity-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          event_type: matched.eventType,
          product_id: null,
          vendor_id: null,
          product_name: null,
          product_sku: null,
          qc_status: null,
          metadata: { source: 'webRequest', url: details.url, method: details.method }
        })
      });

      if (response.ok) {
        console.log('[BD Tracker webRequest] Event logged:', matched.eventType);
      } else {
        console.log('[BD Tracker webRequest] Failed:', response.status);
      }
    } catch (err) {
      console.log('[BD Tracker webRequest] Error:', err.message);
    }
  },
  { urls: ['https://commerce.thecanbrand.com/*'] },
  ['responseHeaders']
);
