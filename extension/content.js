// BD Tracker — Content Script (runs in PAGE context via manifest world: "MAIN")
// Intercepts fetch and XHR calls on commerce sites

(function() {
  'use strict';

  const API_PATTERNS = [
    { method: 'POST', pattern: '/api/vendor/products', event_type: 'listing_created' },
    { method: 'PUT', pattern: '/api/vendor/products/', event_type: 'product_updated' },
    { method: 'POST', pattern: '/api/quality-check/products/', suffix: '/approve', event_type: 'qc_approved' },
    { method: 'POST', pattern: '/api/quality-check/products/', suffix: '/reject', event_type: 'qc_rejected' },
    { method: 'GET', pattern: '/api/quality-check/products', event_type: 'qc_pending', extractPagination: true }
  ];

  function matchPattern(method, url) {
    const matches = [];
    for (const apiPattern of API_PATTERNS) {
      if (method !== apiPattern.method) continue;
      if (!url.includes(apiPattern.pattern)) continue;
      if (apiPattern.suffix && !url.includes(apiPattern.suffix)) continue;
      matches.push(apiPattern);
    }
    return matches;
  }

  function hasSpecs(responseData) {
    const data = responseData?.data || responseData;
    const details = data?.categoryComplianceDetails;
    return details && typeof details === 'object' && Object.keys(details).length > 0;
  }

  function extractData(responseData, eventType) {
    if (eventType === 'qc_pending') {
      const pendingCount = responseData?.pagination?.total ?? null;
      return {
        product_id: null, vendor_id: null, product_name: null,
        qc_status: 'pending', is_qc_approved: false, product_sku: null,
        event_type: eventType, pending_count: pendingCount,
        timestamp: new Date().toISOString()
      };
    }

    const data = responseData?.data || responseData;
    return {
      product_id: data._id || data.id || null,
      vendor_id: typeof data.vendor === 'object' ? data.vendor?._id : data.vendor || null,
      product_name: data.productName || null,
      qc_status: data.qcStatus || null,
      is_qc_approved: data.isQCApproved || false,
      product_sku: data.productSku || null,
      event_type: eventType,
      timestamp: new Date().toISOString()
    };
  }

  function sendEvent(eventType, data) {
    window.postMessage({
      type: 'BD_TRACKER_INTERCEPTED',
      event_type: eventType,
      data: data
    }, '*');
  }

  // ==================== FETCH INTERCEPT ====================
  const _nativeFetch = window.fetch;

  window.fetch = async function(...args) {
    const reqObj = args[0];
    const url = typeof reqObj === 'string' ? reqObj : reqObj?.url || '';
    const method = (args[1]?.method || reqObj?.method || 'GET').toUpperCase();

    const response = await _nativeFetch.apply(this, args);

    try {
      const matches = matchPattern(method, url);
      if (matches.length > 0) {
        const clone = response.clone();
        let responseData = {};
        try { responseData = await clone.json(); } catch(e) {}

        for (const matched of matches) {
          let eventType = matched.event_type;

          if (eventType === 'product_updated' && hasSpecs(responseData)) {
            eventType = 'spec_added';
          }

          sendEvent(eventType, extractData(responseData, eventType));
        }
      }
    } catch (err) {}

    return response;
  };

  // ==================== XHR INTERCEPT ====================
  const _nativeOpen = XMLHttpRequest.prototype.open;
  const _nativeSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._bdMethod = method;
    this._bdUrl = url;
    return _nativeOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const method = (this._bdMethod || 'GET').toUpperCase();
    const url = this._bdUrl || '';

    this.addEventListener('load', function() {
      try {
        const matches = matchPattern(method, url);
        if (matches.length > 0) {
          let responseData = {};
          try { responseData = JSON.parse(this.responseText); } catch(e) {}

          for (const matched of matches) {
            let eventType = matched.event_type;

            if (eventType === 'product_updated' && hasSpecs(responseData)) {
              eventType = 'spec_added';
            }

            sendEvent(eventType, extractData(responseData, eventType));
          }
        }
      } catch (err) {}
    });
    return _nativeSend.apply(this, [body]);
  };
})();
