// BD Tracker — Login Page Script

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

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'LOGIN', email, password }, (resp) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(resp || {});
        }
      });
    });

    if (response.success) {
      // Close login tab and open popup
      window.close();
    } else {
      showError(response.message || 'Login failed');
    }
  } catch (err) {
    showError(`Error: ${err.message || 'Could not connect to extension'}`);
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
