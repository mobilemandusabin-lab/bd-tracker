(function() {
  'use strict';

  console.log(`[BD Tracker] Content script loaded on ${window.location.hostname}`);

  // ═══════════════════════════════════════════════════════════════════════
  // URL PATTERNS
  //   pathRe:    regex matched against the URL pathname (anchored)
  //   method:    HTTP method to match
  //   excludeRe: optional, if matches the path, this pattern is skipped
  //   skip:      if true, the URL is recognized but no event is sent
  //   event_type: candidate event_type; detection may refine it
  // ═══════════════════════════════════════════════════════════════════════
  const PATTERNS = [
    {
      method: 'POST',
      pathRe: /^\/api\/vendor\/products$/,
      excludeRe: /\/bulk[-\/]/i,
      event_type: 'listing_created'
    },
    {
      method: 'GET',
      pathRe: /^\/api\/vendor\/products\/[a-f0-9]{24}$/i,
      event_type: 'product_viewed'
    },
    {
      method: 'PUT',
      pathRe: /^\/api\/vendor\/products\/[a-f0-9]{24}$/i,
      event_type: 'product_updated'
    },
    {
      method: 'POST',
      pathRe: /^\/api\/quality-check\/products\/[a-f0-9]{24}\/(approve|reject)$/i,
      event_type: 'qc_approved'
    },
    {
      method: 'POST',
      pathRe: /^\/api\/quality-check\/bulk-(approve|reject)$/i,
      event_type: 'qc_bulk_approved',
      bulk: true
    },
    {
      method: 'GET',
      pathRe: /^\/api\/quality-check\/products(\?.*)?$/,
      event_type: 'qc_pending',
      queryCheck: (url) => url.includes('qcStatus=pending')
    }
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // PRODUCT CONTEXT CACHE
  //   Stores what we saw on the initial GET for a product, used by the
  //   PUT branch to decide between "new listing" and "edit".
  //   Backed by localStorage (bd_ctx_{productId}) so multiple tabs of the
  //   same product share the cache; an in-memory mirror keeps reads fast.
  //   5-minute TTL handles stale entries after long idle periods.
  // ═══════════════════════════════════════════════════════════════════════
  const ProductContext = {};
  const PRODUCT_CONTEXT_KEY_PREFIX = 'bd_ctx_';
  const PRODUCT_CONTEXT_TTL_MS = 5 * 60 * 1000;

  function _ctxKey(productId) {
    return PRODUCT_CONTEXT_KEY_PREFIX + productId;
  }

  function getContext(productId) {
    if (!productId) return null;
    const now = Date.now();
    const mem = ProductContext[productId];
    if (mem && now - mem.seen_at < PRODUCT_CONTEXT_TTL_MS) return mem;
    let stored = null;
    try {
      const raw = localStorage.getItem(_ctxKey(productId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && now - parsed.seen_at < PRODUCT_CONTEXT_TTL_MS) {
          stored = parsed;
        } else {
          localStorage.removeItem(_ctxKey(productId));
        }
      }
    } catch (e) {}
    ProductContext[productId] = stored;
    return stored;
  }

  function setContext(productId, ctx) {
    if (!productId || !ctx) return;
    ctx.seen_at = Date.now();
    ProductContext[productId] = ctx;
    try {
      localStorage.setItem(_ctxKey(productId), JSON.stringify(ctx));
    } catch (e) {}
  }

  function hasPackageType(d) {
    if (!d) return false;
    if (d.packageTypeID) return true;
    if (typeof d.packageType === 'string' && d.packageType.length > 0) return true;
    if (d.packageType && typeof d.packageType === 'object' && d.packageType._id) return true;
    return false;
  }

  function hasSpecValues(d) {
    if (!d) return false;
    if (d.categoryComplianceDetails && Object.keys(d.categoryComplianceDetails).length) return true;
    if (d.productComplianceDetails && Object.keys(d.productComplianceDetails).length) return true;
    return false;
  }

  function hasSpecSchema(d) {
    if (!d) return false;
    const pkg = d.packageType;
    if (!pkg || typeof pkg !== 'object') return false;
    const hasKeys = (arr) => Array.isArray(arr) && arr.length > 0;
    return hasKeys(pkg.categoryComplianceKeys) || hasKeys(pkg.productComplianceKeys);
  }

  function hasSpecs(d) {
    return hasSpecValues(d);
  }

  function cacheProductContext(productId, responseData) {
    if (!productId) return;
    const d = unwrap(responseData);
    setContext(productId, {
      has_package_type: hasPackageType(d),
      has_specs: hasSpecValues(d),
      has_spec_schema: hasSpecSchema(d)
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WORKFLOW STATE TRACKER
  //   Per-product session state (shared across tabs of the same product).
  //   localStorage presence registry tracks which tabs have the product
  //   open; session_ended only fires when the LAST tab closes.
  // ═══════════════════════════════════════════════════════════════════════
  const State = {
    _sessions: {},
    _global: {},
    _presence: {},
    _idleThreshold: 15 * 60 * 1000,
    _deadTabThreshold: 2 * 60 * 1000,
    _cleanupTimer: null,

    init() {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith('bd_state_')) {
            const v = JSON.parse(localStorage.getItem(k));
            const productId = k.slice('bd_state_'.length);
            this._global[productId] = v;
            if (v.is_ended && v.ended_at && Date.now() - v.ended_at > 24 * 60 * 60 * 1000) {
              localStorage.removeItem(k);
              delete this._global[productId];
            }
          } else if (k.startsWith('bd_presence_')) {
            const productId = k.slice('bd_presence_'.length);
            try {
              this._presence[productId] = JSON.parse(localStorage.getItem(k)) || {};
            } catch (e) {
              this._presence[productId] = {};
            }
          }
        }
      } catch (e) {}

      window.addEventListener('storage', (e) => this._onStorageEvent(e));
      this._cleanupTimer = setInterval(() => this._cleanupDeadTabs(), 30 * 1000);
    },

    getTabId() {
      let id = sessionStorage.getItem('bd_tab_id');
      if (!id) {
        id = 'tab_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
        sessionStorage.setItem('bd_tab_id', id);
      }
      return id;
    },

    _onStorageEvent(e) {
      if (!e.key) return;
      if (e.key.startsWith('bd_presence_')) {
        const productId = e.key.slice('bd_presence_'.length);
        try {
          this._presence[productId] = e.newValue ? JSON.parse(e.newValue) : {};
        } catch (err) {
          this._presence[productId] = {};
        }
      } else if (e.key.startsWith('bd_state_')) {
        const productId = e.key.slice('bd_state_'.length);
        try {
          this._global[productId] = e.newValue ? JSON.parse(e.newValue) : null;
        } catch (err) {}
      } else if (e.key.startsWith(PRODUCT_CONTEXT_KEY_PREFIX)) {
        const productId = e.key.slice(PRODUCT_CONTEXT_KEY_PREFIX.length);
        try {
          ProductContext[productId] = e.newValue ? JSON.parse(e.newValue) : null;
        } catch (err) {}
      }
    },

    _readPresence(productId) {
      try {
        const raw = localStorage.getItem('bd_presence_' + productId);
        this._presence[productId] = raw ? JSON.parse(raw) : {};
      } catch (e) {
        this._presence[productId] = {};
      }
    },

    _writePresence(productId) {
      try {
        localStorage.setItem('bd_presence_' + productId, JSON.stringify(this._presence[productId] || {}));
      } catch (e) {}
    },

    _heartbeat(productId) {
      this._readPresence(productId);
      if (!this._presence[productId]) this._presence[productId] = {};
      const tabId = this.getTabId();
      const existing = this._presence[productId][tabId];
      this._presence[productId][tabId] = {
        openedAt: existing?.openedAt || Date.now(),
        lastHeartbeat: Date.now()
      };
      this._writePresence(productId);
    },

    _deregisterTab(productId) {
      const tabId = this.getTabId();
      if (this._presence[productId] && this._presence[productId][tabId]) {
        delete this._presence[productId][tabId];
        this._writePresence(productId);
      }
    },

    _cleanupDeadTabs() {
      const cutoff = Date.now() - this._deadTabThreshold;
      const tabId = this.getTabId();
      let anyChanged = false;
      for (const productId of Object.keys(this._presence)) {
        const tabs = this._presence[productId];
        let changed = false;
        for (const tid of Object.keys(tabs)) {
          if (tid !== tabId && tabs[tid].lastHeartbeat < cutoff) {
            delete tabs[tid];
            changed = true;
          }
        }
        if (changed) {
          anyChanged = true;
          this._writePresence(productId);
        }
      }
      return anyChanged;
    },

    _otherTabsViewing(productId) {
      this._readPresence(productId);
      const tabs = this._presence[productId] || {};
      const tabId = this.getTabId();
      return Object.keys(tabs).some(tid => tid !== tabId);
    },

    _tabCount(productId) {
      this._readPresence(productId);
      return Object.keys(this._presence[productId] || {}).length;
    },

    getSession(productId) {
      if (!productId) return null;
      const tabId = this.getTabId();
      this._readPresence(productId);
      if (!this._sessions[productId]) {
        const g = this._global[productId] || {};
        this._sessions[productId] = {
          product_id: productId,
          tab_id: tabId,
          first_seen: g.first_seen || Date.now(),
          last_event_at: Date.now(),
          events: [],
          current_state: g.current_state || 'PRODUCT_OPENED',
          previous_state: g.previous_state || null,
          has_package_type: !!g.has_package_type,
          has_specs: !!g.has_specs,
          spec_count: g.spec_count || 0,
          total_views: g.total_views || 0,
          time_to_first_spec: g.time_to_first_spec || null,
          time_to_listing: g.time_to_listing || null,
          tab_ids: Array.isArray(g.tab_ids) ? g.tab_ids.slice() : [],
          idle_periods: []
        };
      }
      this._heartbeat(productId);
      const s = this._sessions[productId];
      if (!s.tab_ids.includes(tabId)) s.tab_ids.push(tabId);
      s.tab_id = tabId;
      const now = Date.now();
      if (s.events.length > 0 && now - s.last_event_at > this._idleThreshold) {
        s.idle_periods.push({ start: s.last_event_at, end: now, duration: now - s.last_event_at });
      }
      s.last_event_at = now;
      s.total_views++;
      return s;
    },

    track(productId, eventType, responseData, reqBody) {
      const s = this.getSession(productId);
      if (!s) return null;
      const now = Date.now();
      const prev = s.current_state;
      const d = unwrap(responseData);
      const b = reqBody || {};

      if (hasPackageType(b) || hasPackageType(d)) s.has_package_type = true;
      if (hasSpecValues(b) || hasSpecValues(d)) {
        s.has_specs = true;
        s.spec_count++;
      }

      s.current_state = resolveWorkflowState(s, eventType, b, d);
      if (s.current_state === 'SPEC_ADDED' && s.time_to_first_spec == null) {
        s.time_to_first_spec = now - s.first_seen;
      }
      if (s.current_state === 'LISTING_CREATED' && s.time_to_listing == null) {
        s.time_to_listing = now - s.first_seen;
      }
      s.events.push({ type: eventType, at: now, tab_id: s.tab_id });
      this._persist(s);
      const tabCount = this._tabCount(productId);
      return {
        workflow_state: s.current_state,
        previous_state: prev,
        session_duration: now - s.first_seen,
        time_to_first_spec: s.time_to_first_spec,
        time_to_listing: s.time_to_listing,
        total_views: s.total_views,
        spec_count: s.spec_count,
        has_package_type: s.has_package_type,
        tab_id: s.tab_id,
        active_tab_count: tabCount,
        multi_tab: tabCount > 1
      };
    },

    _persist(s) {
      try {
        const payload = {
          first_seen: s.first_seen,
          current_state: s.current_state,
          previous_state: s.previous_state,
          has_package_type: s.has_package_type,
          has_specs: s.has_specs,
          spec_count: s.spec_count,
          total_views: s.total_views,
          time_to_first_spec: s.time_to_first_spec,
          time_to_listing: s.time_to_listing,
          tab_ids: s.tab_ids,
          last_activity: s.last_event_at
        };
        localStorage.setItem('bd_state_' + s.product_id, JSON.stringify(payload));
        this._global[s.product_id] = payload;
      } catch (e) {}
    },

    endAllSessions() {
      const tabId = this.getTabId();
      const now = Date.now();
      for (const productId of Object.keys(this._sessions)) {
        const s = this._sessions[productId];
        this._deregisterTab(productId);
        this._readPresence(productId);
        if (this._otherTabsViewing(productId)) {
          const g = this._global[productId] || {};
          g.last_tab = tabId;
          g.last_activity = now;
          g.tab_ids = s.tab_ids;
          this._global[productId] = g;
          this._persist(s);
          continue;
        }
        const g = this._global[productId] || {};
        if (Array.isArray(g.tab_ids) && g.tab_ids.length > s.tab_ids.length) {
          s.tab_ids = g.tab_ids;
        }
        const totalDuration = now - s.first_seen;
        const idleTotal = s.idle_periods.reduce((sum, p) => sum + p.duration, 0);
        const summary = {
          product_id: s.product_id,
          tab_id: tabId,
          tab_ids: s.tab_ids,
          tab_count: s.tab_ids.length,
          multi_tab_session: s.tab_ids.length > 1,
          total_duration: totalDuration,
          active_duration: totalDuration - idleTotal,
          idle_time: idleTotal,
          idle_periods_count: s.idle_periods.length,
          longest_idle: s.idle_periods.length > 0 ? Math.max(...s.idle_periods.map(p => p.duration)) : 0,
          total_events: s.events.length,
          total_views: s.total_views,
          spec_count: s.spec_count,
          has_package_type: s.has_package_type,
          time_to_first_spec: s.time_to_first_spec,
          time_to_listing: s.time_to_listing,
          final_state: s.current_state,
          completed: s.current_state === 'LISTING_CREATED',
          event_timeline: s.events.map(e => ({ type: e.type, at: e.at, offset: e.at - s.first_seen, tab_id: e.tab_id }))
        };
        postToBridge('session_ended', summary);
        g.is_ended = true;
        g.ended_at = now;
        g.tab_ids = s.tab_ids;
        this._global[productId] = g;
        this._persist(s);
      }
    }
  };

  function resolveWorkflowState(session, eventType, body, responseData) {
    if (eventType === 'listing_created') return 'LISTING_CREATED';
    if (eventType === 'spec_added') return 'SPEC_ADDED';
    if (eventType === 'product_viewed') return 'PRODUCT_VIEWED';
    if (eventType === 'product_updated') {
      if (hasPackageType(body) || hasPackageType(responseData)) {
        if (!session.has_package_type) return 'LISTING_CREATED';
      }
      if (hasSpecs(body) || hasSpecs(responseData)) {
        return session.has_specs ? 'SPEC_REFINED' : 'SPEC_ADDED';
      }
      return session.has_specs ? 'SPEC_REFINED' : 'PRODUCT_EDITED';
    }
    return session.current_state;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════
  function unwrap(responseData) {
    if (!responseData) return {};
    if (responseData.data && typeof responseData.data === 'object') return responseData.data;
    return responseData;
  }

  function getPath(url) {
    try {
      const u = new URL(url, window.location.origin);
      return u.pathname;
    } catch (e) {
      return url.split('?')[0];
    }
  }

  function extractProductId(url) {
    const m = getPath(url).match(/\/products\/([a-f0-9]{24})/i);
    return m ? m[1] : null;
  }

  function postToBridge(eventType, data) {
    window.postMessage({
      type: 'BD_TRACKER_INTERCEPTED',
      event_type: eventType,
      data: data
    }, '*');
  }

  function extractData(responseData, reqBody, url, fallbackProductId) {
    const d = unwrap(responseData);
    const b = reqBody || {};
    return {
      product_id: d._id || d.id || b._id || b.id || fallbackProductId || null,
      vendor_id: typeof d.vendor === 'object' ? (d.vendor && d.vendor._id) : (d.vendor || b.vendor || null),
      product_name: d.productName || b.productName || d.name || b.name || null,
      qc_status: d.qcStatus || null,
      product_sku: d.productSku || b.productSku || null,
      vendor_updated_at: d.updatedAt || b.updatedAt || null,
      categoryComplianceDetails: b.categoryComplianceDetails || d.categoryComplianceDetails || b.productComplianceDetails || d.productComplianceDetails || null
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 1-HOUR SPEC SUPPRESSION
  //   If spec_added fires within 1 hour of listing_created for the same
  //   product, suppress the spec_added. Persisted to localStorage so
  //   suppression survives page reloads and new tabs (where the in-memory
  //   Map would otherwise be empty).
  // ═══════════════════════════════════════════════════════════════════════
  const RECENTLY_LISTED_KEY = 'bd_recently_listed';
  const SPEC_SUPPRESS_MS = 60 * 60 * 1000;

  function loadRecentlyListed() {
    try {
      const raw = localStorage.getItem(RECENTLY_LISTED_KEY);
      if (!raw) return {};
      const now = Date.now();
      const all = JSON.parse(raw);
      // Prune expired entries on load
      const fresh = {};
      for (const [pid, ts] of Object.entries(all || {})) {
        if (typeof ts === 'number' && now - ts < SPEC_SUPPRESS_MS) {
          fresh[pid] = ts;
        }
      }
      return fresh;
    } catch (e) {
      return {};
    }
  }

  function saveRecentlyListed(map) {
    try {
      // Prune expired before saving so the localStorage entry stays small
      const now = Date.now();
      const fresh = {};
      for (const [pid, ts] of Object.entries(map)) {
        if (typeof ts === 'number' && now - ts < SPEC_SUPPRESS_MS) {
          fresh[pid] = ts;
        }
      }
      localStorage.setItem(RECENTLY_LISTED_KEY, JSON.stringify(fresh));
    } catch (e) {}
  }

  const recentlyListed = loadRecentlyListed();

  // ═══════════════════════════════════════════════════════════════════════
  // QC PENDING DEDUP
  //   Backend dedups globally, but we still post a message on every page
  //   load. Cache the last fire time per page-load-batch so we only post
  //   once per page lifetime (re-suppressed by tab switch or reload).
  // ═══════════════════════════════════════════════════════════════════════
  let lastQcPendingAt = 0;
  const QC_PENDING_DEDUP_MS = 30 * 1000;

  // ═══════════════════════════════════════════════════════════════════════
  // PATTERN MATCHING
  // ═══════════════════════════════════════════════════════════════════════
  function matchPattern(method, url) {
    const path = getPath(url);
    for (const p of PATTERNS) {
      if (method !== p.method) continue;
      if (!p.pathRe.test(path)) continue;
      if (p.excludeRe && p.excludeRe.test(path)) continue;
      if (p.queryCheck && !p.queryCheck(url)) continue;
      return p;
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DETECTION
  //   Decides the actual event_type from request body + response data.
  // ═══════════════════════════════════════════════════════════════════════
  function detectEventType(matched, method, url, reqBody, responseData) {
    const productId = extractProductId(url);
    const d = unwrap(responseData);
    const b = reqBody || {};

    if (matched.event_type === 'qc_bulk_approved') {
      const productIds = Array.isArray(b) ? b : (b && b.productIds) || [];
      const isApprove = /\/bulk-approve/.test(url);
      sendBulkQCEvents(productIds, isApprove ? 'qc_approved' : 'qc_rejected', method, url, responseData);
      return null;
    }

    if (matched.event_type === 'qc_pending') {
      const now = Date.now();
      if (now - lastQcPendingAt < QC_PENDING_DEDUP_MS) {
        return null;
      }
      lastQcPendingAt = now;
      const pendingCount = (responseData && responseData.pagination && responseData.pagination.total) || null;
      sendEvent('qc_pending', {
        product_id: null,
        qc_status: 'pending',
        pending_count: pendingCount,
        url: getPath(url),
        method,
        timestamp: new Date().toISOString()
      }, null);
      return null;
    }

    if (matched.event_type === 'qc_approved') {
      return /\/reject/.test(url) ? 'qc_rejected' : 'qc_approved';
    }

    if (method === 'GET' && matched.event_type === 'product_viewed' && productId) {
      cacheProductContext(productId, responseData);
      return 'product_viewed';
    }

    if (matched.event_type === 'listing_created') {
      return 'listing_created';
    }

    if (method === 'PUT' && productId) {
      const ctx = getContext(productId);

      if (hasSpecValues(b)) return 'spec_added';
      if (hasSpecValues(d) && ctx && ctx.has_package_type && !ctx.has_specs) return 'spec_added';
      if (hasPackageType(b) && (!ctx || !ctx.has_package_type) && hasPackageType(d)) {
        return 'listing_created';
      }
      return 'product_updated';
    }

    return matched.event_type;
  }

  function sendBulkQCEvents(productIds, eventType, method, url, responseData) {
    if (!Array.isArray(productIds) || productIds.length === 0) return;
    if (responseData && responseData.success === false) return;
    const d = unwrap(responseData);
    const firstId = productIds[0];
    const data = {
      product_id: firstId,
      qc_status: eventType === 'qc_approved' ? 'approved' : 'rejected',
      bulk: true,
      bulk_count: productIds.length,
      product_ids: productIds,
      vendor_updated_at: d.updatedAt || null,
      url: getPath(url),
      method,
      timestamp: new Date().toISOString()
    };
    if (firstId) {
      const sessionInfo = State.track(firstId, eventType, data, null);
      Object.assign(data, sessionInfo || {});
    }
    postToBridge(eventType, data);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EVENT SENDER
  //   Applies 15-min suppression, enriches with state, and posts to bridge.
  // ═══════════════════════════════════════════════════════════════════════
  function sendEvent(eventType, data, reqBody) {
    if (!eventType || !data) return;
    const productId = data.product_id;

    if (eventType === 'listing_created' && productId) {
      recentlyListed[productId] = Date.now();
      saveRecentlyListed(recentlyListed);
    }
    if (eventType === 'spec_added' && productId && recentlyListed[productId]) {
      const elapsed = Date.now() - recentlyListed[productId];
      if (elapsed < SPEC_SUPPRESS_MS) return;
    }

    const sessionInfo = productId ? State.track(productId, eventType, data, reqBody) : null;
    const enriched = {
      ...data,
      event_type: eventType,
      timestamp: data.timestamp || new Date().toISOString(),
      url: data.url || (reqBody && reqBody.url) || null,
      method: data.method || null,
      ...(sessionInfo || {})
    };
    postToBridge(eventType, enriched);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FETCH INTERCEPTOR
  // ═══════════════════════════════════════════════════════════════════════
  const _nativeFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
    const init = args[1] || {};
    const method = (init.method || (typeof args[0] === 'object' && args[0] && args[0].method) || 'GET').toUpperCase();

    let reqBody = null;
    if (init.body) {
      try { reqBody = typeof init.body === 'string' ? JSON.parse(init.body) : init.body; } catch (e) {}
    }
    if (!reqBody && args[0] && typeof args[0].clone === 'function' && (method === 'POST' || method === 'PUT')) {
      try {
        const cloned = args[0].clone();
        const txt = await cloned.text();
        if (txt) reqBody = JSON.parse(txt);
      } catch (e) {}
    }

    try {
      const matched = matchPattern(method, url);
      if (matched) {
        const response = await _nativeFetch.apply(this, args);
        if (response.ok) {
          const clone = response.clone();
          let responseData = {};
          try { responseData = await clone.json(); } catch (e) {}

          const eventType = detectEventType(matched, method, url, reqBody, responseData);
          if (eventType) {
            const productId = extractProductId(url);
            const data = extractData(responseData, reqBody, url, productId);
            data.url = getPath(url);
            data.method = method;
            sendEvent(eventType, data, reqBody);
          }
        }
        return response;
      }
    } catch (err) {
      console.error('[BD Tracker] fetch interceptor error:', err);
    }
    return _nativeFetch.apply(this, args);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // XMLHttpRequest INTERCEPTOR
  // ═══════════════════════════════════════════════════════════════════════
  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._bdMethod = method;
    this._bdUrl = url;
    return _xhrOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const method = (this._bdMethod || 'GET').toUpperCase();
    const url = this._bdUrl || '';
    let reqBody = null;
    if ((method === 'POST' || method === 'PUT') && body) {
      try { reqBody = typeof body === 'string' ? JSON.parse(body) : body; } catch (e) {}
    }
    this.addEventListener('load', function() {
      try {
        if (this.status < 200 || this.status >= 300) return;
        const matched = matchPattern(method, url);
        if (matched) {
          let responseData = {};
          try { responseData = JSON.parse(this.responseText); } catch (e) {}
          const eventType = detectEventType(matched, method, url, reqBody, responseData);
          if (eventType) {
            const productId = extractProductId(url);
            const data = extractData(responseData, reqBody, url, productId);
            data.url = getPath(url);
            data.method = method;
            sendEvent(eventType, data, reqBody);
          }
        }
      } catch (err) {
        console.error('[BD Tracker] xhr interceptor error:', err);
      }
    });
    return _xhrSend.apply(this, [body]);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // TAB CLOSE
  //   pagehide is more reliable than beforeunload (fires on mobile,
  //   force-close, and BFCache). beforeunload is kept for desktop
  //   browsers that prefer it.
  // ═══════════════════════════════════════════════════════════════════════
  function handleTabClose() {
    State.endAllSessions();
  }
  window.addEventListener('pagehide', handleTabClose);
  window.addEventListener('beforeunload', handleTabClose);

  // Periodic flush of state to localStorage
  setInterval(() => {
    for (const s of Object.values(State._sessions)) {
      State._persist(s);
    }
  }, 5 * 60 * 1000);

  State.init();
  console.log('[BD Tracker] Content script ready');
})();
