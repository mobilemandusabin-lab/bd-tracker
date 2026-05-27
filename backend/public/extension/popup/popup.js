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

      // Fetch team data on first click
      if (tab.dataset.tab === 'teamTab' && !tab.dataset.loaded) {
        tab.dataset.loaded = 'true';
      }
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
      document.getElementById('myProducts').textContent = '0';
      document.getElementById('myUpdates').textContent = '0';
      document.getElementById('myQc').textContent = '0';
      document.getElementById('myTotal').textContent = '0';
      document.getElementById('teamLoading').textContent = 'Endpoint not available yet — restart backend after push';
      return;
    }

    const result = await response.json();
    const data = result.data;

    // Populate My Stats
    if (data.my) {
      document.getElementById('myListings').textContent = data.my.listing_created || 0;
      document.getElementById('myProducts').textContent = data.my.product_created || 0;
      document.getElementById('myUpdates').textContent = data.my.product_updated || 0;
      document.getElementById('myQc').textContent = data.my.qc_approved || 0;
      document.getElementById('myTotal').textContent = data.my.total || 0;
    }

    // Populate Team
    if (data.team && data.team.length > 0) {
      document.getElementById('teamLoading').style.display = 'none';
      const teamList = document.getElementById('teamList');
      const myUserId = data.user?.name; // Use name for matching since we have it

      teamList.innerHTML = data.team.map(member => {
        const isMe = member.name === data.user?.name;
        const avatarClass = member.team === 'listing' ? 'listing' : member.team === 'qc' ? 'qc' : 'admin';
        const roleLabel = member.team === 'listing' ? 'LST' : member.team === 'qc' ? 'QC' : 'ADM';

        return `
          <div class="team-user${isMe ? ' is-me' : ''}">
            <div class="team-user-avatar ${avatarClass}">${member.name.charAt(0).toUpperCase()}</div>
            <div class="team-user-info">
              <div class="team-user-name">${member.name}${isMe ? ' (You)' : ''}</div>
              <div class="team-user-team">${roleLabel}</div>
            </div>
            <div class="team-user-stats">
              <div class="team-stat">
                <div class="team-stat-value">${member.listing_created || 0}</div>
                <div class="team-stat-label">LST</div>
              </div>
              <div class="team-stat">
                <div class="team-stat-value">${member.qc_approved || 0}</div>
                <div class="team-stat-label">QC</div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      document.getElementById('teamLoading').textContent = 'No team data available';
    }

    // Update user role display
    if (data.user) {
      const roleMap = { listing: 'Listing Team', qc: 'QC Team', admin: 'Admin', super_admin: 'Super Admin' };
      document.getElementById('userRole').textContent = roleMap[data.user.team] || roleMap[data.user.role] || 'Active';
    }

  } catch (err) {
    console.log('[BD Tracker Popup] Stats error:', err.message);
    document.getElementById('teamLoading').textContent = 'Could not load stats — check connection';
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
