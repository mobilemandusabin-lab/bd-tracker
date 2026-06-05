(function() {
  const versionEl = document.getElementById('extVersion');
  if (versionEl && chrome.runtime && chrome.runtime.getManifest) {
    try { versionEl.textContent = chrome.runtime.getManifest().version; } catch (e) {}
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = document.getElementById('submitBtn');
    const errorMsg = document.getElementById('errorMsg');

    if (!email || !password) {
      showError('Please enter email and password');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';
    errorMsg.style.display = 'none';

    if (!CONFIG || !CONFIG.API_BASE_URL) {
      showError('Configuration error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
      return;
    }

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/extension/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.token) {
        await chrome.storage.local.set({
          authToken: data.token,
          userName: data.data?.user?.name || email,
          userEmail: data.data?.user?.email || email,
          userTeam: data.data?.user?.team || null,
          userId: data.data?.user?._id || null
        });

        chrome.runtime.sendMessage({ type: 'LOGIN_SUCCESS' }).catch(() => {});

        window.close();
      } else {
        showError(data.message || 'Login failed');
      }
    } catch (err) {
      showError(`Error: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });

  function showError(message) {
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
  }
})();
