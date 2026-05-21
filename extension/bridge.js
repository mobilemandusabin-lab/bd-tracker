// BD Tracker — Bridge Script (runs in ISOLATED world)
// Forwards intercepted events from page to background service worker

(function() {
  'use strict';

  const hasSendMessage = typeof chrome !== 'undefined'
    && typeof chrome.runtime !== 'undefined'
    && typeof chrome.runtime.sendMessage === 'function';

  const hasStorage = typeof chrome !== 'undefined'
    && typeof chrome.storage !== 'undefined'
    && typeof chrome.storage.local !== 'undefined';

  function forwardEvent(eventData) {
    const message = {
      type: 'BD_TRACKER_EVENT',
      event_type: eventData.event_type,
      data: eventData.data
    };

    if (hasSendMessage) {
      chrome.runtime.sendMessage(message).catch(function() {
        fallbackToStorage(message);
      });
      return;
    }

    fallbackToStorage(message);
  }

  function fallbackToStorage(message) {
    if (!hasStorage) return;
    var key = 'bd_event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    var store = {};
    store[key] = message;
    chrome.storage.local.set(store);
  }

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'BD_TRACKER_INTERCEPTED') return;
    forwardEvent(event.data);
  });
})();
