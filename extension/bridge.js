// BD Tracker — Bridge Script (runs in ISOLATED world)
// Listens for intercepted events from the page and forwards to background service worker

(function() {
  'use strict';

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'BD_TRACKER_INTERCEPTED') return;

    chrome.runtime.sendMessage({
      type: 'BD_TRACKER_EVENT',
      event_type: event.data.event_type,
      data: event.data.data
    }).catch(() => {});
  });
})();
