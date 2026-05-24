document.addEventListener('DOMContentLoaded', async () => {
  const status = await sendMessage({ type: 'GET_STATUS' });

  if (status.isLoggedIn) {
    showLoggedIn(status);
  } else {
    showLoggedOut();
  }

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
