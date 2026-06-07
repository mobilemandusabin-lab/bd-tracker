(function() {
  'use strict';

  var SEND_TIMEOUT_MS = 5000;
  var DRAIN_INTERVAL_MS = 3000;
  var MAX_DRAIN_ATTEMPTS = 5;

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

    console.log('[BD Tracker] bridge → sendMessage', { type: eventData.event_type, product: eventData.data && eventData.data.product_id, ctxValid: isContextValid() });

    if (!isContextValid()) {
      console.warn('[BD Tracker] bridge → context INVALID, queueing in chrome.storage.local');
      fallbackToStorage(message);
      return;
    }

    try {
      var promise = chrome.runtime.sendMessage(message);
      withTimeout(promise, SEND_TIMEOUT_MS).then(function() {
        console.log('[BD Tracker] bridge → ack', { type: eventData.event_type });
      }).catch(function(err) {
        console.warn('[BD Tracker] bridge → sendMessage failed/timeout, queueing', err && err.message);
        fallbackToStorage(message);
      });
    } catch (e) {
      console.error('[BD Tracker] bridge → sync error, queueing', e);
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
        console.log('[BD Tracker] bridge → queued to storage:', key);
      }
    } catch (e) {
      console.error('[BD Tracker] bridge → storage write failed', e);
    }
  }

  // v1.0.10: drain queued events from chrome.storage.local back to the
  // background. Runs on startup, on every forwardEvent (after the new
  // event is queued/sent), and on a polling interval. Without this,
  // events queued during a context-invalid window are lost forever.
  function drainQueuedEvents(attempt) {
    attempt = attempt || 0;
    if (attempt >= MAX_DRAIN_ATTEMPTS) {
      console.warn('[BD Tracker] drain → giving up after', MAX_DRAIN_ATTEMPTS, 'attempts');
      return;
    }
    if (!isContextValid()) {
      console.log('[BD Tracker] drain → context still invalid, will retry');
      return;
    }
    if (!chrome.storage || !chrome.storage.local) return;

    chrome.storage.local.get(null, function(items) {
      if (chrome.runtime.lastError) {
        console.warn('[BD Tracker] drain → storage read error', chrome.runtime.lastError.message);
        return;
      }
      var keys = Object.keys(items).filter(function(k) { return k.indexOf('bd_event_') === 0; });
      if (keys.length === 0) {
        console.log('[BD Tracker] drain → queue empty');
        return;
      }
      console.log('[BD Tracker] drain → found', keys.length, 'queued events, replaying');

      var remaining = keys.length;
      var failed = [];

      keys.forEach(function(key) {
        var message = items[key];
        var promise;
        try {
          promise = chrome.runtime.sendMessage(message);
        } catch (e) {
          failed.push(key);
          if (--remaining === 0) finishDrain(failed);
          return;
        }
        withTimeout(promise, SEND_TIMEOUT_MS).then(function() {
          chrome.storage.local.remove(key, function() {
            console.log('[BD Tracker] drain → sent + removed', key, '(', message.event_type, ')');
            if (--remaining === 0) finishDrain(failed);
          });
        }).catch(function(err) {
          console.warn('[BD Tracker] drain → send failed for', key, err && err.message);
          failed.push(key);
          if (--remaining === 0) finishDrain(failed);
        });
      });
    });
  }

  function finishDrain(failed) {
    if (failed.length > 0) {
      console.warn('[BD Tracker] drain →', failed.length, 'events still failed, keeping in queue');
    } else {
      console.log('[BD Tracker] drain → all events replayed successfully');
    }
  }

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'BD_TRACKER_INTERCEPTED') return;
    forwardEvent(event.data);
    // After every intercepted event, try to drain anything queued
    // (covers the case where a previous event was queued and the
    // context has since become valid).
    setTimeout(function() { drainQueuedEvents(); }, 100);
  });

  // Startup drain: events queued from a previous tab/extension session
  console.log('[BD Tracker] bridge → startup drain check');
  setTimeout(function() { drainQueuedEvents(); }, 500);

  // Periodic drain: covers long-lived tabs where the context went
  // invalid (e.g., extension reloaded) and later became valid again.
  setInterval(function() {
    if (isContextValid()) drainQueuedEvents();
  }, DRAIN_INTERVAL_MS);
})();
