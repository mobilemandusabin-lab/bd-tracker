// BD Tracker — Content Script (runs in PAGE context via manifest world: "MAIN")
// Intercepts fetch and XHR calls on commerce.thecanbrand.com

(function() {
  'use strict';

  console.log('[BD Tracker] Interceptor loaded — v3');

  const API_PATTERNS = [
    { method: 'POST', pattern: '/api/vendor/products', event_type: 'listing_created' },
    { method: 'PUT', pattern: '/api/vendor/products/', event_type: 'product_updated' },
    { method: 'POST', pattern: '/api/quality-check/products/', suffix: '/approve', event_type: 'qc_approved' },
    { method: 'POST', pattern: '/api/quality-check/products/', suffix: '/reject', event_type: 'qc_rejected' }
  ];

  function matchPattern(method, url) {
    for (const apiPattern of API_PATTERNS) {
      if (method !== apiPattern.method) continue;
      if (!url.includes(apiPattern.pattern)) continue;
      if (apiPattern.suffix && !url.includes(apiPattern.suffix)) continue;
      return apiPattern;
    }
    return null;
  }

  function extractData(responseData, eventType) {
    const data = responseData?.data || responseData;
    return {
      product_id: data._id || data.id || null,
      vendor_id: data.vendor || null,
      product_name: data.productName || null,
      qc_status: data.qcStatus || null,
      is_qc_approved: data.isQCApproved || false,
      product_sku: data.productSku || null,
      event_type: eventType,
      timestamp: new Date().toISOString()
    };
  }

  // ==================== FETCH INTERCEPT ====================
  const _nativeFetch = window.fetch;

  window.fetch = async function(...args) {
    // Log EVERY fetch call to confirm our wrapper is being used
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const method = (args[1]?.method || 'GET').toUpperCase();

    console.log('[BD Tracker] FETCH called:', method, url);

    const response = await _nativeFetch.apply(this, args);

    try {
      const matched = matchPattern(method, url);
      if (matched) {
        console.log('[BD Tracker] FETCH MATCH:', matched.event_type);
        const clone = response.clone();
        let responseData = {};
        try { responseData = await clone.json(); } catch(e) {}
        window.postMessage({
          type: 'BD_TRACKER_INTERCEPTED',
          event_type: matched.event_type,
          data: extractData(responseData, matched.event_type)
        }, '*');
      }
    } catch (err) {
      console.error('[BD Tracker] Fetch error:', err);
    }

    return response;
  };

  // ==================== XHR INTERCEPT ====================
  const _nativeOpen = XMLHttpRequest.prototype.open;
  const _nativeSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._bdMethod = method;
    this._bdUrl = url;
    console.log('[BD Tracker] XHR open:', method, url);
    return _nativeOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const method = this._bdMethod || 'GET';
    const url = this._bdUrl || '';
    console.log('[BD Tracker] XHR send:', method, url);

    this.addEventListener('load', function() {
      try {
        const matched = matchPattern(method.toUpperCase(), url);
        if (matched) {
          console.log('[BD Tracker] XHR MATCH:', matched.event_type);
          let responseData = {};
          try { responseData = JSON.parse(this.responseText); } catch(e) {}
          window.postMessage({
            type: 'BD_TRACKER_INTERCEPTED',
            event_type: matched.event_type,
            data: extractData(responseData, matched.event_type)
          }, '*');
        }
      } catch (err) {
        console.error('[BD Tracker] XHR error:', err);
      }
    });
    return _nativeSend.apply(this, [body]);
  };
})();
