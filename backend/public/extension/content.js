(function() {
  'use strict';

  // VERSION is the single source of truth for "is the new code active?".
  // Manifest version stays 1.0.12 — this build suffix lets you confirm in
  // the console which copy of the code is running without bumping manifest.
  const VERSION = '1.0.12-bulkcnt';
  console.log(`[BD Tracker v${VERSION}] Content script loaded on ${window.location.hostname}`);

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
      pathRe: /^\/api\/vendor\/products\/?$/,
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
      pathRe: /^\/api\/quality-check\/products\/?(\?.*)?$/,
      event_type: 'qc_pending',
      queryCheck: (url) => /qcStatus=pending/i.test(url) || /[?&]status=pending/i.test(url)
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

  function _hasPackageTypeInObj(d) {
    if (!d) return false;
    if (d.packageTypeID) return true;
    if (typeof d.packageType === 'string' && d.packageType.length > 0) return true;
    if (d.packageType && typeof d.packageType === 'object' && d.packageType._id) return true;
    return false;
  }

  function hasPackageType(d) {
    if (_hasPackageTypeInObj(d)) return true;
    // Common wrapper keys: some APIs nest the product under .product,
    // .data, .payload, or .body. Only descend into the first wrapper to
    // avoid infinite loops on cyclic shapes.
    if (d && typeof d === 'object') {
      const nested = d.product || d.payload || d.body;
      if (nested && nested !== d && _hasPackageTypeInObj(nested)) return true;
    }
    return false;
  }

  function _hasSpecValuesInObj(d) {
    if (!d) return false;
    if (d.categoryComplianceDetails && Object.keys(d.categoryComplianceDetails).length) return true;
    if (d.productComplianceDetails && Object.keys(d.productComplianceDetails).length) return true;
    return false;
  }

  function hasSpecValues(d) {
    if (_hasSpecValuesInObj(d)) return true;
    if (d && typeof d === 'object') {
      const nested = d.product || d.payload || d.body;
      if (nested && nested !== d && _hasSpecValuesInObj(nested)) return true;
    }
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
    const product_name = d.productName || d.name ||
                         d.product?.productName || d.product?.name ||
                         d.payload?.productName || d.payload?.name ||
                         d.body?.productName || d.body?.name || null;
    setContext(productId, {
      has_package_type: hasPackageType(d),
      has_specs: hasSpecValues(d),
      has_spec_schema: hasSpecSchema(d),
      product_name
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
              try { localStorage.removeItem('bd_events_' + productId); } catch (e) {}
              try { localStorage.removeItem('bd_idle_' + productId); } catch (e) {}
              try { localStorage.removeItem('bd_presence_' + productId); } catch (e) {}
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

      // Recover any sessions that ended without firing session_ended
      // (crashed tab, force-quit, OS kill — anything that skips pagehide).
      this._recoverOrphanedSessions();
    },

    // ═══════════════════════════════════════════════════════════════════
    // ORPHAN SESSION RECOVERY
    //   A "session" is orphaned when bd_state_{productId} is_ended=false
    //   but no live tab is in bd_presence_{productId}. This happens when
    //   the tab dies ungracefully (crash, kill, force-quit) — pagehide
    //   never fires, so the normal endAllSessions path is skipped, and
    //   the backend never sees the session_ended summary.
    //
    //   We rebuild the summary from the persisted state + the events
    //   and idle_periods arrays we now keep in localStorage, post it
    //   via the bridge, and mark the session as ended.
    // ═══════════════════════════════════════════════════════════════════
    _recoverOrphanedSessions() {
      const cutoff = Date.now() - this._deadTabThreshold;
      for (const productId of Object.keys(this._global)) {
        const g = this._global[productId];
        if (!g || g.is_ended || g.recovering) continue;

        // Skip sessions younger than 1 minute — tab may not have
        // heartbeated yet, false positive if a second tab is about to
        // open the same product.
        if (g.first_seen && Date.now() - g.first_seen < 60 * 1000) continue;

        this._readPresence(productId);
        const presence = this._presence[productId] || {};
        const liveTabCount = Object.values(presence).filter(
          (t) => t && typeof t.lastHeartbeat === 'number' && t.lastHeartbeat >= cutoff
        ).length;
        if (liveTabCount > 0) continue;

        // Claim it synchronously to prevent a second tab from also
        // recovering (race on init of two content scripts in parallel).
        g.recovering = true;
        this._global[productId] = g;
        try {
          localStorage.setItem('bd_state_' + productId, JSON.stringify(g));
        } catch (e) {}

        let events = [];
        let idlePeriods = [];
        try { events = JSON.parse(localStorage.getItem('bd_events_' + productId) || '[]'); } catch (e) {}
        try { idlePeriods = JSON.parse(localStorage.getItem('bd_idle_' + productId) || '[]'); } catch (e) {}
        if (!Array.isArray(events)) events = [];
        if (!Array.isArray(idlePeriods)) idlePeriods = [];

        this._postOrphanedSessionEnded(productId, g, events, idlePeriods);
      }
    },

    _postOrphanedSessionEnded(productId, g, events, idlePeriods) {
      const now = Date.now();
      const lastActivity = g.last_activity || now;
      const totalDuration = Math.max(0, lastActivity - (g.first_seen || now));
      const idleTotal = idlePeriods.reduce((sum, p) => sum + (p && p.duration ? p.duration : 0), 0);
      const tabIds = Array.isArray(g.tab_ids) ? g.tab_ids : [];

      const summary = {
        product_id: productId,
        product_name: g.product_name || null,
        tab_id: 'recovered',
        tab_ids: tabIds,
        tab_count: tabIds.length,
        multi_tab_session: tabIds.length > 1,
        total_duration: totalDuration,
        active_duration: Math.max(0, totalDuration - idleTotal),
        idle_time: idleTotal,
        idle_periods_count: idlePeriods.length,
        longest_idle: idlePeriods.length > 0
          ? Math.max.apply(null, idlePeriods.map((p) => (p && p.duration) || 0))
          : 0,
        total_events: events.length,
        total_views: g.total_views || 0,
        spec_count: g.spec_count || 0,
        has_package_type: !!g.has_package_type,
        time_to_first_spec: g.time_to_first_spec || null,
        time_to_listing: g.time_to_listing || null,
        final_state: g.current_state || null,
        completed: g.current_state === 'LISTING_CREATED',
        recovered_from_crash: true,
        event_timeline: events.map((e) => ({
          type: e.type,
          at: e.at,
          offset: e.at - (g.first_seen || now),
          tab_id: e.tab_id
        }))
      };

      postToBridge('session_ended', summary);

      // Mark ended so we don't re-fire on next init.
      g.is_ended = true;
      g.ended_at = now;
      g.recovering = false;
      g.tab_ids = tabIds;
      this._global[productId] = g;
      try {
        localStorage.setItem('bd_state_' + productId, JSON.stringify(g));
      } catch (e) {}
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
      } else if (e.key === RECENTLY_LISTED_KEY) {
        // Another tab listed a product — refresh our in-memory map so
        // this tab also suppresses spec_added for the same 1h window.
        try {
          const fresh = e.newValue ? JSON.parse(e.newValue) : {};
          for (const k of Object.keys(recentlyListed)) delete recentlyListed[k];
          Object.assign(recentlyListed, fresh);
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
          product_name: g.product_name || null,
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

      if (responseData?.product_name) s.product_name = responseData.product_name;
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
          product_name: s.product_name || null,
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

        // Append only NEW events since last persist (delta tracking makes
        // each persist O(new items) instead of O(total events)). The
        // merge-append helper dedupes by at|type|tab_id so two tabs of
        // the same product don't clobber each other.
        if (Array.isArray(s.events) && s.events.length > 0) {
          const start = s._persistedEventCount || 0;
          if (s.events.length > start) {
            appendMergedToStorage(
              'bd_events_' + s.product_id,
              s.events.slice(start),
              (e) => e.at + '|' + e.type + '|' + e.tab_id,
              500
            );
            s._persistedEventCount = s.events.length;
          }
        }
        if (Array.isArray(s.idle_periods) && s.idle_periods.length > 0) {
          const start = s._persistedIdleCount || 0;
          if (s.idle_periods.length > start) {
            appendMergedToStorage(
              'bd_idle_' + s.product_id,
              s.idle_periods.slice(start),
              (p) => p.start + '|' + p.end,
              100
            );
            s._persistedIdleCount = s.idle_periods.length;
          }
        }
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
          product_name: s.product_name || null,
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
    const productId = d._id || d.id ||
                      d.product?._id || d.product?.id ||
                      d.payload?._id || d.payload?.id ||
                      b._id || b.id || fallbackProductId || null;
    const ctx = productId ? getContext(productId) : null;
    return {
      product_id: productId,
      vendor_id: typeof d.vendor === 'object' ? (d.vendor && d.vendor._id) : (d.vendor || b.vendor || null),
      product_name: d.productName || b.productName || d.name || b.name ||
                    d.product?.productName || d.product?.name ||
                    d.payload?.productName || d.payload?.name ||
                    d.body?.productName || d.body?.name ||
                    ctx?.product_name || null,
      qc_status: d.qcStatus || null,
      product_sku: d.productSku || b.productSku || null,
      vendor_updated_at: d.updatedAt || b.updatedAt || null,
      categoryComplianceDetails: b.categoryComplianceDetails || d.categoryComplianceDetails || b.productComplianceDetails || d.productComplianceDetails || null
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LOCALSTORAGE MERGE-APPEND
  //   Two tabs of the same product both write to the same localStorage key.
  //   Naive overwrite would lose the other tab's data. This helper does a
  //   read-merge-write with dedupe by `keyFn(item)`, then caps to maxItems
  //   (drops oldest) to bound localStorage usage per product.
  // ═══════════════════════════════════════════════════════════════════════
  function appendMergedToStorage(key, newItems, keyFn, maxItems) {
    if (!Array.isArray(newItems) || newItems.length === 0) return;
    try {
      let existing = [];
      try { existing = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
      if (!Array.isArray(existing)) existing = [];
      const seen = new Set();
      for (const x of existing) {
        try { seen.add(keyFn(x)); } catch (e) {}
      }
      for (const item of newItems) {
        let k;
        try { k = keyFn(item); } catch (e) { continue; }
        if (!seen.has(k)) { existing.push(item); seen.add(k); }
      }
      if (existing.length > maxItems) {
        existing = existing.slice(existing.length - maxItems);
      }
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 1-HOUR SPEC SUPPRESSION (localStorage-persisted, cross-tab)
  //   If spec_added fires within 1 hour of listing_created for the same
  //   product, suppress the spec_added. Persisted to localStorage so the
  //   suppression survives page reloads and new tabs. Cross-tab sync via
  //   the 'storage' event (see _onStorageEvent).
  // ═══════════════════════════════════════════════════════════════════════
  const RECENTLY_LISTED_KEY = 'bd_recently_listed';
  const SPEC_SUPPRESS_MS = 60 * 60 * 1000;

  function loadRecentlyListed() {
    try {
      const raw = localStorage.getItem(RECENTLY_LISTED_KEY);
      if (!raw) return {};
      const now = Date.now();
      const all = JSON.parse(raw);
      const fresh = {};
      for (const [pid, ts] of Object.entries(all || {})) {
        if (typeof ts === 'number' && now - ts < SPEC_SUPPRESS_MS) {
          fresh[pid] = ts;
        }
      }
      return fresh;
    } catch (e) { return {}; }
  }

  function saveRecentlyListed(map) {
    try {
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
      if (p.queryCheck && !p.queryCheck(url)) {
        if (p.event_type === 'qc_pending') {
          console.warn('[BD Tracker] ⚠️ QC path matched but queryCheck failed', { url, path, query: url.split('?')[1] });
        }
        continue;
      }
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

    console.log('[BD Tracker] detect', { method, url: getPath(url), productId, matched: matched.event_type, hasSpecReq: hasSpecValues(b), hasPkgReq: hasPackageType(b), hasSpecRes: hasSpecValues(d), hasPkgRes: hasPackageType(d), ctx: getContext(productId) });

    if (matched.event_type === 'qc_bulk_approved') {
      const isApprove = /\/bulk-approve/.test(url);
      sendBulkQCEvents(null, isApprove ? 'qc_approved' : 'qc_rejected', method, url, responseData);
      return null;
    }

    if (matched.event_type === 'qc_pending') {
      const now = Date.now();
      if (now - lastQcPendingAt < QC_PENDING_DEDUP_MS) {
        console.log('[BD Tracker] detect → qc_pending DEDUPED');
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
      console.log('[BD Tracker] detect → qc_pending');
      return null;
    }

    if (matched.event_type === 'qc_approved') {
      const t = /\/reject/.test(url) ? 'qc_rejected' : 'qc_approved';
      console.log('[BD Tracker] detect →', t);
      return t;
    }

    if (method === 'GET' && matched.event_type === 'product_viewed' && productId) {
      cacheProductContext(productId, responseData);
      console.log('[BD Tracker] detect → product_viewed');
      return 'product_viewed';
    }

    if (matched.event_type === 'listing_created') {
      // v1.0.12: verify the response actually carries a packageType before
      // calling this a complete listing. A POST that creates a stub product
      // (no pkg yet) is logged as product_created, which the server-side
      // reclassifier can later upgrade to listing_created once a packageType
      // shows up via a subsequent PUT.
      if (hasPackageType(d)) {
        console.log('[BD Tracker] detect → listing_created (POST with packageType in response)');
        return 'listing_created';
      }
      console.log('[BD Tracker] detect → product_created (POST without packageType, not a complete listing yet)');
      return 'product_created';
    }

    if (method === 'PUT' && productId) {
      // v1.0.12: read the BEFORE state from the cache BEFORE updating it.
      // v1.0.10 had `cacheProductContext()` here, which made `ctx` always
      // reflect the current response, so the `!ctxHasPkg` checks could
      // never fire — listing_created became unreachable via PUT and the
      // server-side reclassifier had to paper over the bug. The fix is to
      // compare the cached BEFORE state against the current response, then
      // write the AFTER state to the cache for the next request.
      const ctx = getContext(productId);
      const responseHasPkg = hasPackageType(d);
      const responseHasSpecs = hasSpecValues(d);
      const bodyHasPkg = hasPackageType(b);
      const bodyHasSpecs = hasSpecValues(b);
      const ctxHasPkg = !!(ctx && ctx.has_package_type);
      const ctxHasSpecs = !!(ctx && ctx.has_specs);

      console.log('[BD Tracker] PUT diff', {
        productId,
        before: { pkg: ctxHasPkg, specs: ctxHasSpecs },
        after:  { pkg: responseHasPkg, specs: responseHasSpecs },
        body:   { pkg: bodyHasPkg, specs: bodyHasSpecs }
      });

      // Always update the cache AFTER detection — the AFTER state is the
      // new baseline for the next PUT in this session.
      cacheProductContext(productId, responseData);

      // DETECTION — compare cached BEFORE state against the AFTER response.
      // The body is used as a fallback signal only when no cached state
      // exists yet (e.g., user PUTs without ever doing a GET first).

      // 1. listing_created: product transitioned from unlisted (no pkg)
      //    to listed (has pkg). Covers State 1→2 and State 1→3 in one PUT.
      if (!ctxHasPkg && responseHasPkg) {
        console.log('[BD Tracker] detect → listing_created (before: no pkg, after: has pkg)');
        return 'listing_created';
      }
      // 2. spec_added: listed product gained compliance values.
      if (ctxHasPkg && responseHasSpecs && !ctxHasSpecs) {
        console.log('[BD Tracker] detect → spec_added (before: no specs on listed product, after: has specs)');
        return 'spec_added';
      }
      // 3. spec_added (no-ctx body fallback): the user is clearly adding
      //    specs (body has spec values, no pkg change). Trust the body's
      //    intent when we have no cached state to compare against.
      if (!ctx && bodyHasSpecs && !bodyHasPkg) {
        console.log('[BD Tracker] detect → spec_added (no ctx, body has specs, no pkg in body)');
        return 'spec_added';
      }
      // 4. listing_created (no-ctx body fallback): no cached state but the
      //    body adds packageType and the response confirms it landed.
      if (!ctx && bodyHasPkg && responseHasPkg) {
        console.log('[BD Tracker] detect → listing_created (no ctx, body+response has pkg)');
        return 'listing_created';
      }
      // 5. spec_added (body-fallback): cached state says listed and the
      //    body is adding spec values. Belt-and-suspenders for the case
      //    where the response didn't echo the spec values back.
      if (bodyHasSpecs && ctxHasPkg) {
        console.log('[BD Tracker] detect → spec_added (body has specs, ctx has pkg)');
        return 'spec_added';
      }
      // 6. spec_added (response-only): cached state says listed, response
      //    gained specs even though the body didn't show them (server
      //    filled in derived values, or the body shape didn't match the
      //    check).
      if (responseHasSpecs && ctxHasPkg) {
        console.log('[BD Tracker] detect → spec_added (response has specs, ctx has pkg)');
        return 'spec_added';
      }
      console.log('[BD Tracker] detect → product_updated');
      return 'product_updated';
    }

    console.log('[BD Tracker] detect →', matched.event_type);
    return matched.event_type;
  }

  function sendBulkQCEvents(productIds, eventType, method, url, responseData) {
    if (responseData && responseData.success === false) return;
    const d = unwrap(responseData);

    // The response is the source of truth for bulk QC — NOT the request
    // body. The response shape is:
    //   { data: { totalRequested: 4, approved: 4, alreadyApproved: 0 } }
    // We emit ONE event per bulk action, with bulk_count set to the number
    // of approved products. The backend stores bulk_count and uses it in
    // analytics aggregations: { $sum: { $ifNull: ['$bulk_count', 1] } }.
    // This means a single row with bulk_count=3 contributes 3 to the total.
    const isApprove = eventType === 'qc_approved';
    const countKey = isApprove ? 'approved' : 'rejected';
    const bulkCount = (d && typeof d[countKey] === 'number') ? d[countKey] : 0;
    if (bulkCount === 0) return;

    console.log('[BD Tracker] detect → qc_bulk', {
      type: eventType,
      responseCount: bulkCount,
      totalRequested: d?.totalRequested,
      alreadyRejected: d?.alreadyRejected
    });

    const data = {
      product_id: null,
      qc_status: isApprove ? 'approved' : 'rejected',
      bulk: true,
      bulk_count: bulkCount,
      product_ids: null,
      vendor_updated_at: d?.updatedAt || null,
      url: getPath(url),
      method,
      timestamp: new Date().toISOString()
    };
    postToBridge(eventType, data);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EVENT SENDER
  //   Applies 1-hour spec suppression (localStorage-persisted, cross-tab),
  //   enriches with state, and posts to bridge.
  // ═══════════════════════════════════════════════════════════════════════
  function sendEvent(eventType, data, reqBody) {
    if (!eventType || !data) return;
    const productId = data.product_id;

    if (eventType === 'listing_created' && productId) {
      recentlyListed[productId] = Date.now();
      saveRecentlyListed(recentlyListed);
      console.log('[BD Tracker] send → listing_created', { productId, method: data.method, clockStarted: true });
    }
    if (eventType === 'spec_added' && productId) {
      const listedAt = recentlyListed[productId];
      if (listedAt && Date.now() - listedAt < SPEC_SUPPRESS_MS) {
        const minutes = Math.floor((Date.now() - listedAt) / 60000);
        console.log('[BD Tracker] SUPPRESSED spec_added', { productId, minutesSinceListing: minutes, reason: 'within 1h of listing_created' });
        return;
      }
      console.log('[BD Tracker] send → spec_added', { productId, listedAt: listedAt || null });
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
    if (eventType !== 'spec_added') {
      console.log('[BD Tracker] send →', eventType, { productId, method: data.method });
    }
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
