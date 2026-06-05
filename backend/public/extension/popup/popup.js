const SEND_TIMEOUT_MS = 5000;
const STATS_TIMEOUT_MS = 8000;

document.addEventListener('DOMContentLoaded', async () => {
  const status = await sendMessage({ type: 'GET_STATUS' });

  if (status.isLoggedIn) {
    showLoggedIn(status);
    fetchStats();
  } else {
    showLoggedOut();
  }

  // Listen for auth changes (login from another tab) and refresh
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.authToken) {
      const has = !!changes.authToken.newValue;
      if (has) {
        sendMessage({ type: 'GET_STATUS' }).then((s) => {
          if (s.isLoggedIn) {
            showLoggedIn(s);
            fetchStats();
          }
        });
      } else {
        showLoggedOut();
      }
    }
  });

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  document.getElementById('loginBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('login/login.html') });
    window.close();
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await sendMessage({ type: 'LOGOUT' });
    showLoggedOut();
  });

  document.getElementById('clearQcPendingBtn').addEventListener('click', async () => {
    const btn = document.getElementById('clearQcPendingBtn');
    if (!confirm('Clear all QC pending data?')) return;
    btn.disabled = true;
    btn.textContent = 'Clearing...';

    try {
      const stored = await chrome.storage.local.get(['authToken']);
      const response = await fetch(`${CONFIG.API_BASE_URL}/extension/qc-pending`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${stored.authToken}` }
      });

      if (response.ok) {
        btn.textContent = 'Cleared!';
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Clear QC Pending';
          fetchStats();
        }, 1500);
      } else if (response.status === 401) {
        await sendMessage({ type: 'LOGOUT' });
        showLoggedOut();
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Clear QC Pending';
      } else {
        btn.textContent = 'Failed';
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Clear QC Pending';
        }, 1500);
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Clear QC Pending';
    }
  });

  document.getElementById('syncBtn').addEventListener('click', async () => {
    const btn = document.getElementById('syncBtn');
    btn.disabled = true;
    btn.textContent = 'Syncing...';

    const result = await sendMessage({ type: 'SYNC_NOW' });
    if (result.success) {
      updateLastSync(result.lastSync);
    }

    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Sync Now`;
  });
});

async function fetchStats() {
  hideError();
  try {
    const stored = await chrome.storage.local.get(['authToken']);
    const token = stored.authToken;
    if (!token) return;

    const response = await fetchWithTimeout(`${CONFIG.API_BASE_URL}/extension/my-stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }, STATS_TIMEOUT_MS);

    if (response.status === 401) {
      await sendMessage({ type: 'LOGOUT' });
      showLoggedOut();
      showError('Session expired. Please sign in again.');
      return;
    }

    if (!response.ok) {
      console.log('[BD Tracker Popup] Stats fetch failed:', response.status);
      document.getElementById('myListings').textContent = '0';
      document.getElementById('mySpecs').textContent = '0';
      document.getElementById('myQc').textContent = '0';
      showError(`Stats unavailable (${response.status})`);
      return;
    }

    const result = await response.json();
    const data = result.data;
    console.log('[BD Tracker Popup] API response:', JSON.stringify(data, null, 2));

    // Populate My Stats
    if (data.my) {
      document.getElementById('myListings').textContent = data.my.listing_created || 0;
      document.getElementById('mySpecs').textContent = data.my.spec_added || 0;
      document.getElementById('myQc').textContent = data.my.qc_approved || 0;
    }

    // Populate Targets
    if (data.goals) {
      const listingTarget = data.goals.listing_target || 0;
      const specTarget = data.goals.spec_target || 0;
      const qcEnabled = data.goals.qc_enabled || false;
      const qcTarget = qcEnabled ? (data.goals.qc_target || 0) : 0;

      document.getElementById('targetListings').textContent = listingTarget > 0 ? `Target: ${listingTarget}` : '';
      document.getElementById('targetSpecs').textContent = specTarget > 0 ? `Target: ${specTarget}` : '';
      document.getElementById('targetQc').textContent = qcEnabled && qcTarget > 0 ? `Target: ${qcTarget}` : '';
    } else {
      document.getElementById('targetListings').textContent = '';
      document.getElementById('targetSpecs').textContent = '';
      document.getElementById('targetQc').textContent = '';
    }

    // Update user role display
    if (data.user) {
      const roleMap = { listing: 'Listing Team', qc: 'QC Team', admin: 'Admin', super_admin: 'Super Admin' };
      document.getElementById('userRole').textContent = roleMap[data.user.team] || roleMap[data.user.role] || 'Active';

      // Show QC Pending clear button for admin/super_admin only
      if (data.user.role === 'admin' || data.user.role === 'super_admin') {
        document.getElementById('qcPendingActions').style.display = 'block';
      }
    }

  } catch (err) {
    console.log('[BD Tracker Popup] Stats error:', err.message);
    showError(err.message === 'fetch timeout' ? 'Stats request timed out' : 'Stats unavailable');
  }
}

function showLoggedOut() {
  document.getElementById('loggedOut').style.display = 'block';
  document.getElementById('loggedIn').style.display = 'none';
  hideError();
}

function showLoggedIn(status) {
  document.getElementById('loggedOut').style.display = 'none';
  document.getElementById('loggedIn').style.display = 'block';

  const name = status.userName || 'User';
  document.getElementById('userName').textContent = name;
  document.getElementById('userAvatar').textContent = name.charAt(0).toUpperCase();
  document.getElementById('version').textContent = status.version || '…';

  updateLastSync(status.lastSync);

  chrome.storage.local.get(['updateAvailable', 'latestVersion', 'changelog'], (data) => {
    if (data.updateAvailable) {
      document.getElementById('updateBanner').style.display = 'flex';
      document.getElementById('latestVersion').textContent = data.latestVersion || '?';
      document.getElementById('installUpdateVersion').textContent = data.latestVersion || '?';
      const changelog = (data.changelog || '').trim();
      document.getElementById('updateChangelog').textContent =
        changelog ? changelog.replace(/^Extension v\S+\s*[-—]?\s*/i, '').trim() : 'A new version is available — please reinstall.';
    }
  });
}

async function installUpdate() {
  const btn = document.getElementById('installUpdateBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Downloading…'; }
  try {
    // Same endpoint the frontend uses — always serves the latest zip
    const url = (window.CONFIG?.API_BASE_URL || 'http://localhost:5000') + '/extension/download';
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error('Download failed (HTTP ' + response.status + ')');
    const blob = await response.blob();
    const objUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objUrl;
    const v = document.getElementById('installUpdateVersion').textContent || 'latest';
    link.setAttribute('download', `bd-tracker-extension-v${v}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objUrl);
    if (btn) btn.textContent = 'Downloaded — re-install from chrome://extensions';
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Download failed — try again'; }
  }
}
document.getElementById('installUpdateBtn')?.addEventListener('click', installUpdate);

function updateLastSync(timestamp) {
  const el = document.getElementById('lastSync');
  if (!timestamp) {
    el.textContent = 'Never';
    return;
  }

  const date = new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) {
    el.textContent = 'Just now';
  } else if (diff < 3600) {
    el.textContent = `${Math.floor(diff / 60)}m ago`;
  } else if (diff < 86400) {
    el.textContent = `${Math.floor(diff / 3600)}h ago`;
  } else {
    el.textContent = date.toLocaleDateString();
  }
}

function showError(message) {
  const banner = document.getElementById('errorBanner');
  document.getElementById('errorBannerText').textContent = message;
  if (banner) banner.style.display = 'block';
}

function hideError() {
  const banner = document.getElementById('errorBanner');
  if (banner) banner.style.display = 'none';
}

function fetchWithTimeout(url, options, timeoutMs) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => setTimeout(() => reject(new Error('fetch timeout')), timeoutMs))
  ]);
}

function sendMessage(message) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({});
    }, SEND_TIMEOUT_MS);
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(response || {});
      });
    } catch (e) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({});
    }
  });
}
