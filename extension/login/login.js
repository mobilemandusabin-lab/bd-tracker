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
    const response = await chrome.runtime.sendMessage({
      type: 'LOGIN',
      email,
      password
    });

    if (response.success) {
      // Close login tab and open popup
      window.close();
    } else {
      showError(response.message || 'Login failed');
    }
  } catch (err) {
    showError('Could not connect to BD Tracker. Is the server running?');
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
