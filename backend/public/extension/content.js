(function() {
  'use strict';

  console.log(`[BD Tracker] Extension content script loaded on ${window.location.hostname}`);

  const API_PATTERNS = [
    { method: 'POST', pattern: '/api/vendor/products', event_type: 'listing_created' },
    { method: 'GET', pattern: '/api/vendor/products/', event_type: 'product_created' },
    { method: 'PUT', pattern: '/api/vendor/products/', event_type: 'product_updated' },
    { method: 'POST', pattern: '/api/quality-check/products/', suffix: '/approve', event_type: 'qc_approved', rejectPattern: 'bulk-approve' },
    { method: 'POST', pattern: '/api/quality-check/products/', suffix: '/reject', event_type: 'qc_rejected', rejectPattern: 'bulk-reject' },
    { method: 'GET', pattern: '/api/quality-check/products', requiredParams: ['qcStatus=pending'], event_type: 'qc_pending', extractPagination: true },
    { method: 'POST', pattern: '/api/quality-check/bulk-approve', event_type: 'qc_bulk_approved' },
    { method: 'POST', pattern: '/api/quality-check/bulk-reject', event_type: 'qc_bulk_rejected' }
  ];

  function matchPattern(method, url) {
    const matches = [];
    for (const apiPattern of API_PATTERNS) {
      if (method !== apiPattern.method) continue;
      if (!url.includes(apiPattern.pattern)) continue;
      if (apiPattern.suffix && !url.includes(apiPattern.suffix)) continue;
      if (apiPattern.rejectPattern && url.includes(apiPattern.rejectPattern)) continue;
      if (apiPattern.requiredParams) {
        const hasAll = apiPattern.requiredParams.every(p => url.includes(p));
        if (!hasAll) continue;
      }
      matches.push(apiPattern);
    }
    return matches;
  }

  function hasData(val) {
    return val && typeof val === 'object' && Object.keys(val).length > 0;
  }

  function hasPackageTypeObject(val) {
    if (!val || typeof val !== 'object') return false;
    if (Array.isArray(val)) return false;
    return Object.values(val).some(v => v != null && v !== '');
  }

  function detectEventType(matched, reqBody, responseData, method) {
    if (matched.event_type === 'product_created') {
      const data = responseData?.data || responseData;
      const productId = data?._id || data?.id;
      const hasPackageType = data?.packageType && (
        (typeof data.packageType === 'string' && data.packageType.length > 0) ||
        (typeof data.packageType === 'object' && !Array.isArray(data.packageType))
      );
      if (productId && !hasPackageType) {
        return 'product_created';
      }
      // GET to /products/{id} with packageType = product viewed (listed product detail page)
      if (method === 'GET' && productId) {
        return 'product_viewed';
      }
      return null;
    }
    if (matched.event_type === 'product_updated') {
      if (hasData(responseData?.categoryComplianceDetails)) {
        return 'spec_added';
      }
      if (hasPackageTypeObject(reqBody?.packageType) && (responseData?.packageTypeID || (typeof responseData?.packageType === 'string' && responseData.packageType))) {
        return 'listing_created';
      }
      return 'product_updated';
    }
    // POST to /api/vendor/products = always listing_created
    if (matched.event_type === 'listing_created' && method === 'POST') {
      return 'listing_created';
    }
    return matched.event_type;
  }

  function extractData(responseData, eventType, reqBody) {
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
    const body = reqBody || {};

    return {
      product_id: data._id || data.id || body._id || body.id || null,
      vendor_id: typeof data.vendor === 'object' ? data.vendor?._id : (data.vendor || body.vendor || null),
      product_name: data.productName || body.productName || data.name || body.name || null,
      qc_status: data.qcStatus || null,
      is_qc_approved: data.isQCApproved || false,
      product_sku: data.productSku || body.productSku || null,
      event_type: eventType,
      timestamp: new Date().toISOString()
    };
  }

  function sendEvent(eventType, data, reqBody) {
    window.postMessage({
      type: 'BD_TRACKER_INTERCEPTED',
      event_type: eventType,
      data: data,
      reqBody: reqBody || null
    }, '*');
  }

  const _nativeFetch = window.fetch;

  window.fetch = async function(...args) {
    const reqObj = args[0];
    const url = typeof reqObj === 'string' ? reqObj : reqObj?.url || '';
    const method = (args[1]?.method || reqObj?.method || 'GET').toUpperCase();

    // Get request body
    let reqBody = null;
    if (args[1]?.body) {
      try {
        reqBody = typeof args[1].body === 'string' ? JSON.parse(args[1].body) : args[1].body;
      } catch (e) {}
    }
    // If a Request object was passed, clone it to read body (clone gets independent stream)
    if (!reqBody && reqObj?.clone && (method === 'POST' || method === 'PUT')) {
      try {
        const clonedReq = reqObj.clone();
        const bodyText = await clonedReq.text();
        if (bodyText) reqBody = JSON.parse(bodyText);
      } catch (e) {}
    }

    try {
      // DEBUG: log all POST requests to see what's being intercepted
      if (method === 'POST') {
        console.log(`[BD Tracker] POST intercepted: url=${url}, body type=${typeof reqBody}, isArray=${Array.isArray(reqBody)}`);
      }

      const matches = matchPattern(method, url);
      if (matches.length > 0) {
        const response = await _nativeFetch.apply(this, args);
        const clone = response.clone();
        let responseData = {};
        try { responseData = await clone.json(); } catch(e) {}

        for (const matched of matches) {
          // Bulk approve: expand into individual qc_approved events per product ID
          if (matched.event_type === 'qc_bulk_approved') {
            const productIds = Array.isArray(reqBody) ? reqBody : (reqBody?.productIds || []);
            console.log(`[BD Tracker] Bulk approve matched! productIds=${JSON.stringify(productIds)}, response.success=${responseData?.success}`);
            if (responseData && responseData.success !== false && productIds.length > 0) {
              for (const pid of productIds) {
                sendEvent('qc_approved', {
                  product_id: pid,
                  vendor_id: null,
                  product_name: null,
                  product_sku: null,
                  qc_status: 'approved',
                  bulk: true,
                  url: url.split('?')[0],
                  method: method,
                  timestamp: new Date().toISOString()
                }, null);
              }
              console.log(`[BD Tracker] Bulk QC approved: ${productIds.length} products (${responseData.data?.approved || productIds.length} approved) → ${productIds.length} events sent`);
            } else {
              console.log(`[BD Tracker] Bulk approve NOT expanded: no productIds found`);
            }
            continue;
          }

          // Bulk reject: expand into individual qc_rejected events per product ID
          if (matched.event_type === 'qc_bulk_rejected') {
            const productIds = Array.isArray(reqBody) ? reqBody : (reqBody?.productIds || []);
            console.log(`[BD Tracker] Bulk reject matched! productIds=${JSON.stringify(productIds)}, response.success=${responseData?.success}`);
            if (responseData && responseData.success !== false && productIds.length > 0) {
              for (const pid of productIds) {
                sendEvent('qc_rejected', {
                  product_id: pid,
                  vendor_id: null,
                  product_name: null,
                  product_sku: null,
                  qc_status: 'rejected',
                  bulk: true,
                  url: url.split('?')[0],
                  method: method,
                  timestamp: new Date().toISOString()
                }, null);
              }
              console.log(`[BD Tracker] Bulk QC rejected: ${productIds.length} products (${responseData.data?.rejected || productIds.length} rejected) → ${productIds.length} events sent`);
            } else {
              console.log(`[BD Tracker] Bulk reject NOT expanded: no productIds found`);
            }
            continue;
          }

          let eventType = detectEventType(matched, reqBody, responseData, method);
          if (!eventType) {
            continue;
          }
          const data = extractData(responseData, eventType, reqBody);
          data.url = url.split('?')[0];
          data.method = method;
          sendEvent(eventType, data, reqBody);
        }
        return response;
      }
    } catch (err) {}

    return _nativeFetch.apply(this, args);
  };

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

    let reqBody = null;
    if ((method === 'PUT' || method === 'POST') && body) {
      try {
        reqBody = typeof body === 'string' ? JSON.parse(body) : body;
      } catch (e) {}
    }

    this.addEventListener('load', function() {
      try {
        const matches = matchPattern(method, url);
        if (matches.length > 0) {
          let responseData = {};
          try { responseData = JSON.parse(this.responseText); } catch(e) {}

          for (const matched of matches) {
            // Bulk approve: expand into individual qc_approved events per product ID
            if (matched.event_type === 'qc_bulk_approved') {
              const productIds = Array.isArray(reqBody) ? reqBody : (reqBody?.productIds || []);
              if (responseData && responseData.success !== false && productIds.length > 0) {
                for (const pid of productIds) {
                  sendEvent('qc_approved', {
                    product_id: pid,
                    vendor_id: null,
                    product_name: null,
                    product_sku: null,
                    qc_status: 'approved',
                    bulk: true,
                    url: url.split('?')[0],
                    method: method,
                    timestamp: new Date().toISOString()
                  }, null);
                }
                console.log(`[BD Tracker] Bulk QC approved: ${productIds.length} products (${responseData.data?.approved || productIds.length} approved) → ${productIds.length} events sent`);
              }
              continue;
            }

            // Bulk reject: expand into individual qc_rejected events per product ID
            if (matched.event_type === 'qc_bulk_rejected') {
              const productIds = Array.isArray(reqBody) ? reqBody : (reqBody?.productIds || []);
              if (responseData && responseData.success !== false && productIds.length > 0) {
                for (const pid of productIds) {
                  sendEvent('qc_rejected', {
                    product_id: pid,
                    vendor_id: null,
                    product_name: null,
                    product_sku: null,
                    qc_status: 'rejected',
                    bulk: true,
                    url: url.split('?')[0],
                    method: method,
                    timestamp: new Date().toISOString()
                  }, null);
                }
                console.log(`[BD Tracker] Bulk QC rejected: ${productIds.length} products (${responseData.data?.rejected || productIds.length} rejected) → ${productIds.length} events sent`);
              }
              continue;
            }

            let eventType = detectEventType(matched, reqBody, responseData, method);
            if (!eventType) continue;
            const data = extractData(responseData, eventType, reqBody);
            data.url = url.split('?')[0];
            data.method = method;
            sendEvent(eventType, data, reqBody);
          }
        }
      } catch (err) {}
    });
    return _nativeSend.apply(this, [body]);
  };
})();
