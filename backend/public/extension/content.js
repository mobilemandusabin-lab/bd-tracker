(function() {
  'use strict';

  console.log(`[BD Tracker] Extension content script loaded on ${window.location.hostname}`);

  // ═══════════════════════════════════════════════════════════════
  // API PATTERNS — what URLs we intercept
  // ═══════════════════════════════════════════════════════════════
  const API_PATTERNS = [
    { method: 'POST', pattern: '/api/vendor/products', event_type: 'listing_created' },
    { method: 'GET', pattern: '/api/vendor/products/', event_type: 'product_opened' },
    { method: 'PUT', pattern: '/api/vendor/products/', event_type: 'product_updated' },
    { method: 'POST', pattern: '/api/quality-check/products/', suffix: '/approve', event_type: 'qc_approved', rejectPattern: 'bulk-approve' },
    { method: 'POST', pattern: '/api/quality-check/products/', suffix: '/reject', event_type: 'qc_rejected', rejectPattern: 'bulk-reject' },
    { method: 'GET', pattern: '/api/quality-check/products', requiredParams: ['qcStatus=pending'], event_type: 'qc_pending', extractPagination: true },
    { method: 'POST', pattern: '/api/quality-check/bulk-approve', event_type: 'qc_bulk_approved' },
    { method: 'POST', pattern: '/api/quality-check/bulk-reject', event_type: 'qc_bulk_rejected' }
  ];

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT CONTEXT CACHE
  // Remembers what we saw on initial GET for each product in this tab
  // ═══════════════════════════════════════════════════════════════
  const ProductContext = {};

  function extractProductId(url) {
    const match = url.match(/\/products\/([a-f0-9]+)/i);
    return match ? match[1] : null;
  }

  function cacheProductContext(productId, responseData) {
    if (!productId) return;
    const data = responseData?.data || responseData || {};

    // packageType can be:
    //  - an object with _id (full packageType object): { _id, code, name, categoryComplianceKeys, ... }
    //  - a string (just the ID)
    //  - null/undefined (not set yet)
    const hasPackageType = !!(
      data.packageTypeID ||
      (typeof data.packageType === 'string' && data.packageType) ||
      (data.packageType && typeof data.packageType === 'object' && !Array.isArray(data.packageType) && data.packageType._id)
    );

    const ctx = {
      product_id: productId,
      packageTypeID_present: hasPackageType,
      packageType_isObject: !!(data.packageType && typeof data.packageType === 'object' && !Array.isArray(data.packageType)),
      specs_present: !!((data.categoryComplianceDetails && Object.keys(data.categoryComplianceDetails).length > 0) || (data.productComplianceDetails && Object.keys(data.productComplianceDetails).length > 0)),
      vendor_id: typeof data.vendor === 'object' ? data.vendor?._id : (data.vendor || null),
      product_name: data.productName || data.name || null,
      product_sku: data.productSku || null,
      seen_at: Date.now()
    };

    ProductContext[productId] = ctx;
    console.log(`[BD Tracker] 📦 ProductContext cached for ${productId}:`, JSON.stringify({
      packageTypeID_present: ctx.packageTypeID_present,
      specs_present: ctx.specs_present,
      product_name: ctx.product_name
    }));
  }

  function getProductContext(productId) {
    return ProductContext[productId] || null;
  }

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT TRACKER — session tracking per product per tab
  // ═══════════════════════════════════════════════════════════════
  const ProductTracker = {
    _sessions: {},

    getTabId() {
      let tabId = sessionStorage.getItem('bd_tab_id');
      if (!tabId) {
        tabId = 'tab_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
        sessionStorage.setItem('bd_tab_id', tabId);
        console.log(`[BD Tracker] 🆕 New tab ID: ${tabId}`);
      }
      return tabId;
    },

    getSession(productId) {
      if (!productId) return null;
      const tabId = this.getTabId();
      const key = `${tabId}:${productId}`;

      if (!this._sessions[key]) {
        const globalState = this._getGlobalState(productId);

        this._sessions[key] = {
          product_id: productId,
          tab_id: tabId,
          first_seen: Date.now(),
          last_event_at: Date.now(),
          events: [],
          current_state: globalState?.current_state || 'PRODUCT_OPENED',
          previous_state: null,
          has_package_type: globalState?.has_package_type || false,
          has_specs: globalState?.has_specs || false,
          spec_count: globalState?.spec_count || 0,
          total_views: globalState?.total_views || 0,
          time_to_first_spec: globalState?.time_to_first_spec || null,
          time_to_listing: globalState?.time_to_listing || null,
          idle_periods: []
        };

        console.log(`[BD Tracker] 🆕 New session for product ${productId} in tab ${tabId}`);
      }

      const session = this._sessions[key];
      session.last_event_at = Date.now();
      session.total_views++;
      return session;
    },

    track(productId, eventType, responseData, reqBody) {
      const session = this.getSession(productId);
      if (!session) return null;

      const now = Date.now();
      const previousState = session.current_state;

      // Detect idle period (gap > 15 min)
      if (session.events.length > 0) {
        const gap = now - session.last_event_at;
        if (gap > 15 * 60 * 1000) {
          session.idle_periods.push({ start: session.last_event_at, end: now, duration: gap });
          console.log(`[BD Tracker] ⏸️ Idle period detected for ${productId}: ${Math.round(gap / 60000)}min`);
        }
      }

      session.events.push({ type: eventType, timestamp: now });
      session.last_event_at = now;

      // Update flags
      const data = responseData?.data || responseData || {};
      const body = reqBody || {};

      if (data.packageType || body.packageType) {
        session.has_package_type = true;
      }
      if (data.categoryComplianceDetails || body.categoryComplianceDetails || data.productComplianceDetails || body.productComplianceDetails) {
        session.has_specs = true;
        session.spec_count++;
      }

      // Resolve true state
      session.previous_state = previousState;
      session.current_state = this._resolveState(session, eventType, responseData, reqBody);

      // Track milestones
      if (session.current_state === 'SPEC_ADDED' && !session.time_to_first_spec) {
        session.time_to_first_spec = now - session.first_seen;
        console.log(`[BD Tracker] ⏱️ Time to first spec for ${productId}: ${Math.round(session.time_to_first_spec / 60000)}min`);
      }
      if (session.current_state === 'LISTING_CREATED' && !session.time_to_listing) {
        session.time_to_listing = now - session.first_seen;
        console.log(`[BD Tracker] ⏱️ Time to listing for ${productId}: ${Math.round(session.time_to_listing / 60000)}min`);
      }

      console.log(`[BD Tracker] 📊 Session state for ${productId}: ${previousState} → ${session.current_state} (event: ${eventType})`);

      this._persistSession(session);

      return {
        event_type: eventType,
        workflow_state: session.current_state,
        previous_state: previousState,
        product_id: productId,
        tab_id: session.tab_id,
        session_duration: now - session.first_seen,
        time_to_first_spec: session.time_to_first_spec,
        time_to_listing: session.time_to_listing,
        total_views: session.total_views,
        spec_count: session.spec_count,
        has_package_type: session.has_package_type
      };
    },

    endAllSessions() {
      const tabId = this.getTabId();
      const now = Date.now();
      console.log(`[BD Tracker] 🔚 Ending all sessions for tab ${tabId}`);

      for (const [key, session] of Object.entries(this._sessions)) {
        if (session.tab_id !== tabId) continue;

        const totalDuration = now - session.first_seen;
        const activeDuration = totalDuration - session.idle_periods.reduce((sum, p) => sum + p.duration, 0);

        const sessionSummary = {
          event_type: 'session_ended',
          workflow_state: session.current_state,
          product_id: session.product_id,
          tab_id: tabId,
          total_duration: totalDuration,
          active_duration: activeDuration,
          idle_time: totalDuration - activeDuration,
          idle_periods_count: session.idle_periods.length,
          longest_idle: session.idle_periods.length > 0 ? Math.max(...session.idle_periods.map(p => p.duration)) : 0,
          total_events: session.events.length,
          total_views: session.total_views,
          spec_count: session.spec_count,
          has_package_type: session.has_package_type,
          time_to_first_spec: session.time_to_first_spec,
          time_to_listing: session.time_to_listing,
          final_state: session.current_state,
          completed: session.current_state === 'LISTING_CREATED',
          event_timeline: session.events.map(e => ({
            type: e.type,
            at: e.timestamp,
            offset: e.timestamp - session.first_seen
          }))
        };

        console.log(`[BD Tracker] 📋 Session summary for ${session.product_id}:`, JSON.stringify(sessionSummary, null, 2));

        window.postMessage({
          type: 'BD_TRACKER_INTERCEPTED',
          event_type: 'session_ended',
          data: sessionSummary
        }, '*');

        this._persistSession(session, true);
      }
    },

    _resolveState(session, rawEventType, responseData, reqBody) {
      const data = responseData?.data || responseData || {};
      const body = reqBody || {};

      // POST to /api/vendor/products = always listing_created
      if (rawEventType === 'listing_created') return 'LISTING_CREATED';

      // PUT: spec addition takes PRIORITY — body.categoryComplianceDetails = strongest signal
      if (rawEventType === 'spec_added') {
        return 'SPEC_ADDED';
      }

      // PUT: listing_created (detected when product was new + packageType confirmed)
      if (rawEventType === 'product_updated' && this._hasPackageType(body) && (!session.has_package_type || session.current_state === 'PRODUCT_OPENED')) {
        return 'LISTING_CREATED';
      }

      // PUT: generic product update
      // Generic PUT
      if (rawEventType === 'product_updated') {
        return session.has_specs ? 'SPEC_REFINED' : 'PRODUCT_EDITED';
      }

      // GET = viewing (product_created = no packageType, product_viewed = has packageType)
      if (rawEventType === 'product_opened' || rawEventType === 'product_created') {
        return 'PRODUCT_OPENED';
      }
      if (rawEventType === 'product_viewed') {
        return 'PRODUCT_VIEWED';
      }

      return session.current_state;
    },

    _hasPackageType(val) {
      if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
      const pt = val.packageType;
      if (!pt) return false;
      if (typeof pt === 'string' && pt.length > 0) return true;
      if (typeof pt === 'object' && !Array.isArray(pt) && pt._id) return true;
      return false;
    },

    _getGlobalState(productId) {
      try {
        const raw = localStorage.getItem(`bd_product_${productId}`);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },

    _persistSession(session, isEnded = false) {
      try {
        localStorage.setItem(`bd_product_${session.product_id}`, JSON.stringify({
          current_state: session.current_state,
          has_package_type: session.has_package_type,
          has_specs: session.has_specs,
          spec_count: session.spec_count,
          total_views: session.total_views,
          time_to_first_spec: session.time_to_first_spec,
          time_to_listing: session.time_to_listing,
          last_activity: session.last_event_at,
          last_tab: session.tab_id,
          events: session.events,
          is_ended: isEnded,
          ended_at: isEnded ? Date.now() : null
        }));
      } catch (e) {}
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // PATTERN MATCHING
  // ═══════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════
  // EVENT DETECTION — determines what actually happened
  // ═══════════════════════════════════════════════════════════════
  function detectEventType(matched, reqBody, responseData, method, url) {
    const productId = extractProductId(url);

    // ── POST /api/vendor/products = always listing_created ──
    if (matched.event_type === 'listing_created' && method === 'POST') {
      console.log(`[BD Tracker] ✅ listing_created detected (POST)`);
      return 'listing_created';
    }

    // ── GET /api/vendor/products/{id} = product opened ──
    if (matched.event_type === 'product_opened' && method === 'GET') {
      const data = responseData?.data || responseData || {};
      const hasPackageType = data.packageType && (
        (typeof data.packageType === 'string' && data.packageType.length > 0) ||
        (typeof data.packageType === 'object' && !Array.isArray(data.packageType))
      );

      // Cache what we see on this GET
      if (productId) {
        cacheProductContext(productId, responseData);
      }

      if (hasPackageType) {
        console.log(`[BD Tracker] ✅ product_viewed detected (GET with packageType)`);
        return 'product_viewed';
      }

      console.log(`[BD Tracker] ✅ product_created detected (GET, no packageType)`);
      return 'product_created';
    }

    // ── PUT /api/vendor/products/{id} = need context to decide ──
    if (matched.event_type === 'product_updated' && method === 'PUT') {
      const body = reqBody || {};
      const data = responseData?.data || responseData || {};
      const ctx = productId ? getProductContext(productId) : null;

      const bodyHasSpecs = (body.categoryComplianceDetails && Object.keys(body.categoryComplianceDetails).length > 0) || (body.productComplianceDetails && Object.keys(body.productComplianceDetails).length > 0);
      const responseHasSpecs = (data.categoryComplianceDetails && Object.keys(data.categoryComplianceDetails).length > 0) || (data.productComplianceDetails && Object.keys(data.productComplianceDetails).length > 0);

      console.log(`[BD Tracker] 🔍 PUT detection for ${productId}:`, JSON.stringify({
        bodyHasSpecs,
        responseHasSpecs,
        ctx_packageTypeID: ctx?.packageTypeID_present,
        ctx_specs_present: ctx?.specs_present,
        body_packageType: !!body.packageType,
        response_packageType: typeof data.packageType === 'string' ? data.packageType : (data.packageType?._id || null)
      }));

      // Check 1: Body has categoryComplianceDetails = spec addition
      // This is the STRONGEST signal — staff is saving specs
      // (Both listing creation and spec addition echo back packageType in body,
      //  so packageType alone can't distinguish them. categoryComplianceDetails can.)
      if (bodyHasSpecs) {
        console.log(`[BD Tracker] ✅ spec_added detected (PUT body has categoryComplianceDetails)`);
        return 'spec_added';
      }

      // Check 2: Response has categoryComplianceDetails AND context says product had no specs = spec added (response-side)
      if (responseHasSpecs && ctx && ctx.packageTypeID_present && !ctx.specs_present) {
        console.log(`[BD Tracker] ✅ spec_added detected (PUT response has categoryComplianceDetails, context confirms new)`);
        return 'spec_added';
      }

      // Check 3: Body has packageType AND context says product did NOT have packageType = listing created
      // Only fire if the product was NEW (no prior packageType in context)
      if (body.packageType && (!ctx || !ctx.packageTypeID_present)) {
        const responseConfirmed = data.packageTypeID || (typeof data.packageType === 'string' && data.packageType) || (data.packageType?._id);
        if (responseConfirmed) {
          console.log(`[BD Tracker] ✅ listing_created detected (PUT body has packageType, product was new, response confirmed)`);
          return 'listing_created';
        }
      }

      // Default: generic product update
      console.log(`[BD Tracker] ✅ product_updated detected (PUT, no special fields)`);
      return 'product_updated';
    }

    console.log(`[BD Tracker] ⚠️ No detection rule matched, returning: ${matched.event_type}`);
    return matched.event_type;
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA EXTRACTION
  // ═══════════════════════════════════════════════════════════════
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

    const data = responseData?.data || responseData || {};
    const body = reqBody || {};

    // For spec_added, prioritize request body fields (what staff actually submitted)
    const categoryComplianceDetails = body.categoryComplianceDetails || data.categoryComplianceDetails || body.productComplianceDetails || data.productComplianceDetails || null;

    return {
      product_id: data._id || data.id || body._id || body.id || null,
      vendor_id: typeof data.vendor === 'object' ? data.vendor?._id : (data.vendor || body.vendor || null),
      product_name: data.productName || body.productName || data.name || body.name || null,
      qc_status: data.qcStatus || null,
      is_qc_approved: data.isQCApproved || false,
      product_sku: data.productSku || body.productSku || null,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      categoryComplianceDetails: categoryComplianceDetails
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENT SENDER
  // ═══════════════════════════════════════════════════════════════
  // LISTING-CREATED DEDUP — suppress spec_added within 15min of listing_created
  // ═══════════════════════════════════════════════════════════════
  const recentlyListed = {};  // { product_id: timestamp }
  const SPEC_SUPPRESS_WINDOW = 15 * 60 * 1000; // 15 minutes

  // ═══════════════════════════════════════════════════════════════
  function sendEvent(eventType, data, reqBody) {
    const productId = data.product_id;

    // Track listing_created timestamp per product
    if (eventType === 'listing_created' && productId) {
      recentlyListed[productId] = Date.now();
      console.log(`[BD Tracker] ⏱️ Listing-created recorded for ${productId}, suppressing spec_added for 15min`);
    }

    // Suppress spec_added if listing_created just fired for same product
    if (eventType === 'spec_added' && productId && recentlyListed[productId]) {
      const elapsed = Date.now() - recentlyListed[productId];
      if (elapsed < SPEC_SUPPRESS_WINDOW) {
        console.log(`[BD Tracker] ⏭️ Skipping spec_added for ${productId} — listing_created was ${Math.round(elapsed / 1000)}s ago (within 15min window)`);
        return;
      }
    }
    let enrichedData = { ...data };

    // Enrich product_name from ProductContext cache if missing
    if (!enrichedData.product_name && productId) {
      const ctx = getProductContext(productId);
      if (ctx?.product_name) enrichedData.product_name = ctx.product_name;
      if (!enrichedData.vendor_id && ctx?.vendor_id) enrichedData.vendor_id = ctx.vendor_id;
      if (!enrichedData.product_sku && ctx?.product_sku) enrichedData.product_sku = ctx.product_sku;
    }

    // Track the product session
    if (productId) {
      const sessionInfo = ProductTracker.track(productId, eventType, data, reqBody);

      if (sessionInfo) {
        enrichedData = {
          ...enrichedData,
          workflow_state: sessionInfo.workflow_state,
          previous_state: sessionInfo.previous_state,
          session_duration: sessionInfo.session_duration,
          time_to_first_spec: sessionInfo.time_to_first_spec,
          time_to_listing: sessionInfo.time_to_listing,
          total_views: sessionInfo.total_views,
          spec_count: sessionInfo.spec_count,
          has_package_type: sessionInfo.has_package_type,
          tab_id: sessionInfo.tab_id
        };
      }
    }

    console.log(`[BD Tracker] 📤 Sending event: ${enrichedData.event_type || eventType}`, JSON.stringify({
      product_id: enrichedData.product_id,
      product_name: enrichedData.product_name,
      workflow_state: enrichedData.workflow_state,
      vendor_id: enrichedData.vendor_id
    }));

    window.postMessage({
      type: 'BD_TRACKER_INTERCEPTED',
      event_type: enrichedData.event_type || eventType,
      data: enrichedData,
      reqBody: reqBody || null
    }, '*');
  }

  // ═══════════════════════════════════════════════════════════════
  // FETCH INTERCEPTOR
  // ═══════════════════════════════════════════════════════════════
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
    if (!reqBody && reqObj?.clone && (method === 'POST' || method === 'PUT')) {
      try {
        const clonedReq = reqObj.clone();
        const bodyText = await clonedReq.text();
        if (bodyText) reqBody = JSON.parse(bodyText);
      } catch (e) {}
    }

    try {
      const matches = matchPattern(method, url);
      if (matches.length > 0) {
        console.log(`[BD Tracker] 🔗 Fetch intercepted: ${method} ${url.split('?')[0]}`);

        const response = await _nativeFetch.apply(this, args);
        const clone = response.clone();
        let responseData = {};
        try { responseData = await clone.json(); } catch(e) {}

        for (const matched of matches) {
          // ── Bulk approve: expand into individual qc_approved events ──
          if (matched.event_type === 'qc_bulk_approved') {
            const productIds = Array.isArray(reqBody) ? reqBody : (reqBody?.productIds || []);
            console.log(`[BD Tracker] 📦 Bulk approve matched! productIds=${JSON.stringify(productIds)}`);
            if (responseData && responseData.success !== false && productIds.length > 0) {
              for (const pid of productIds) {
                sendEvent('qc_approved', {
                  product_id: pid, vendor_id: null, product_name: null, product_sku: null,
                  qc_status: 'approved', bulk: true, url: url.split('?')[0], method,
                  timestamp: new Date().toISOString()
                }, null);
              }
              console.log(`[BD Tracker] ✅ Bulk QC approved: ${productIds.length} products`);
            }
            continue;
          }

          // ── Bulk reject: expand into individual qc_rejected events ──
          if (matched.event_type === 'qc_bulk_rejected') {
            const productIds = Array.isArray(reqBody) ? reqBody : (reqBody?.productIds || []);
            console.log(`[BD Tracker] 📦 Bulk reject matched! productIds=${JSON.stringify(productIds)}`);
            if (responseData && responseData.success !== false && productIds.length > 0) {
              for (const pid of productIds) {
                sendEvent('qc_rejected', {
                  product_id: pid, vendor_id: null, product_name: null, product_sku: null,
                  qc_status: 'rejected', bulk: true, url: url.split('?')[0], method,
                  timestamp: new Date().toISOString()
                }, null);
              }
              console.log(`[BD Tracker] ✅ Bulk QC rejected: ${productIds.length} products`);
            }
            continue;
          }

          // ── Detect and send normal events ──
          let eventType = detectEventType(matched, reqBody, responseData, method, url);
          if (!eventType) continue;

          const data = extractData(responseData, eventType, reqBody);
          data.url = url.split('?')[0];
          data.method = method;

          // If opened product, also cache context
          if (eventType === 'product_created' || eventType === 'product_viewed') {
            const pid = data.product_id || extractProductId(url);
            if (pid) cacheProductContext(pid, responseData);
          }

          sendEvent(eventType, data, reqBody);
        }
        return response;
      }
    } catch (err) {
      console.error(`[BD Tracker] ❌ Fetch interceptor error:`, err);
    }

    return _nativeFetch.apply(this, args);
  };

  // ═══════════════════════════════════════════════════════════════
  // XMLHttpRequest INTERCEPTOR
  // ═══════════════════════════════════════════════════════════════
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
          console.log(`[BD Tracker] 🔗 XHR intercepted: ${method} ${url.split('?')[0]}`);

          let responseData = {};
          try { responseData = JSON.parse(this.responseText); } catch(e) {}

          for (const matched of matches) {
            // ── Bulk approve ──
            if (matched.event_type === 'qc_bulk_approved') {
              const productIds = Array.isArray(reqBody) ? reqBody : (reqBody?.productIds || []);
              if (responseData && responseData.success !== false && productIds.length > 0) {
                for (const pid of productIds) {
                  sendEvent('qc_approved', {
                    product_id: pid, vendor_id: null, product_name: null, product_sku: null,
                    qc_status: 'approved', bulk: true, url: url.split('?')[0], method,
                    timestamp: new Date().toISOString()
                  }, null);
                }
                console.log(`[BD Tracker] ✅ Bulk QC approved (XHR): ${productIds.length} products`);
              }
              continue;
            }

            // ── Bulk reject ──
            if (matched.event_type === 'qc_bulk_rejected') {
              const productIds = Array.isArray(reqBody) ? reqBody : (reqBody?.productIds || []);
              if (responseData && responseData.success !== false && productIds.length > 0) {
                for (const pid of productIds) {
                  sendEvent('qc_rejected', {
                    product_id: pid, vendor_id: null, product_name: null, product_sku: null,
                    qc_status: 'rejected', bulk: true, url: url.split('?')[0], method,
                    timestamp: new Date().toISOString()
                  }, null);
                }
                console.log(`[BD Tracker] ✅ Bulk QC rejected (XHR): ${productIds.length} products`);
              }
              continue;
            }

            let eventType = detectEventType(matched, reqBody, responseData, method, url);
            if (!eventType) continue;

            const data = extractData(responseData, eventType, reqBody);
            data.url = url.split('?')[0];
            data.method = method;

            if (eventType === 'product_created' || eventType === 'product_viewed') {
              const pid = data.product_id || extractProductId(url);
              if (pid) cacheProductContext(pid, responseData);
            }

            sendEvent(eventType, data, reqBody);
          }
        }
      } catch (err) {
        console.error(`[BD Tracker] ❌ XHR interceptor error:`, err);
      }
    });
    return _nativeSend.apply(this, [body]);
  };

  // ═══════════════════════════════════════════════════════════════
  // TAB CLOSE HANDLER — send session_ended for all products
  // ═══════════════════════════════════════════════════════════════
  window.addEventListener('beforeunload', () => {
    console.log(`[BD Tracker] 🔚 Tab closing, ending all sessions...`);
    ProductTracker.endAllSessions();
  });

  // Periodic flush to localStorage (every 5 min) — protects against browser crash
  setInterval(() => {
    for (const session of Object.values(ProductTracker._sessions)) {
      ProductTracker._persistSession(session);
    }
  }, 5 * 60 * 1000);

  // Cleanup stale localStorage entries (older than 24h) on script load
  (function cleanupStaleEntries() {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('bd_product_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            if (data.is_ended && data.ended_at && data.ended_at < cutoff) {
              localStorage.removeItem(key);
              i--; // index shifted after removal
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  })();

  console.log(`[BD Tracker] ✅ Content script fully initialized`);
})();
