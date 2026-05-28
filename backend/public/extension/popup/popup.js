document.addEventListener('DOMContentLoaded', async () => {
  const status = await sendMessage({ type: 'GET_STATUS' });

  if (status.isLoggedIn) {
    showLoggedIn(status);
    fetchStats();
  } else {
    showLoggedOut();
  }

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
  try {
    const stored = await chrome.storage.local.get(['authToken']);
    const token = stored.authToken;
    if (!token) return;

    const response = await fetch(`${CONFIG.API_BASE_URL}/extension/my-stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      console.log('[BD Tracker Popup] Stats fetch failed:', response.status);
      document.getElementById('myListings').textContent = '0';
      document.getElementById('mySpecs').textContent = '0';
      document.getElementById('myQc').textContent = '0';
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
    }

  } catch (err) {
    console.log('[BD Tracker Popup] Stats error:', err.message);
  }
}

function showLoggedOut() {
  document.getElementById('loggedOut').style.display = 'block';
  document.getElementById('loggedIn').style.display = 'none';
}

function showLoggedIn(status) {
  document.getElementById('loggedOut').style.display = 'none';
  document.getElementById('loggedIn').style.display = 'block';

  const name = status.userName || 'User';
  document.getElementById('userName').textContent = name;
  document.getElementById('userAvatar').textContent = name.charAt(0).toUpperCase();
  document.getElementById('version').textContent = status.version || '1.0.0';

  updateLastSync(status.lastSync);

  chrome.storage.local.get(['updateAvailable', 'latestVersion'], (data) => {
    if (data.updateAvailable) {
      document.getElementById('updateBanner').style.display = 'flex';
      document.getElementById('latestVersion').textContent = data.latestVersion || '?';
    }
  });
}

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

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || {});
    });
  });
}
