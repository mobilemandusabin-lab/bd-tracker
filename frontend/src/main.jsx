import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import './index.css'
import App from './App.jsx'

const APP_VERSION = '__APP_VERSION__';

function checkVersion() {
  const stored = localStorage.getItem('app_version');
  if (stored && stored !== APP_VERSION) {
    localStorage.setItem('app_version', APP_VERSION);
    window.location.reload();
    return;
  }
  if (!stored) {
    localStorage.setItem('app_version', APP_VERSION);
  }
}

checkVersion();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
