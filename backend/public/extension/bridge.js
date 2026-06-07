(function() {
  'use strict';

  var SEND_TIMEOUT_MS = 5000;

  function isContextValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function withTimeout(promise, ms) {
    if (!promise || typeof promise.then !== 'function') return promise;
    return Promise.race([
      promise,
      new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error('sendMessage timeout')); }, ms);
      })
    ]);
  }

  function forwardEvent(eventData) {
    var message = {
      type: 'BD_TRACKER_EVENT',
      event_type: eventData.event_type,
      data: eventData.data
    };

    if (!isContextValid()) {
      fallbackToStorage(message);
      return;
    }

    try {
      var promise = chrome.runtime.sendMessage(message);
      withTimeout(promise, SEND_TIMEOUT_MS).catch(function() {
        fallbackToStorage(message);
      });
    } catch (e) {
      fallbackToStorage(message);
    }
  }

  function fallbackToStorage(message) {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        var key = 'bd_event_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        var store = {};
        store[key] = message;
        chrome.storage.local.set(store);
      }
    } catch (e) {}
  }

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'BD_TRACKER_INTERCEPTED') return;
    forwardEvent(event.data);
  });
})();
