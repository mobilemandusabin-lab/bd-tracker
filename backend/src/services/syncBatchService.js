// ponytail: one batch per function, reuses existing pure logic. No orchestration loops.
const axios = require('axios');
const NepalcanOrder = require('../models/NepalcanOrder');
const Lead = require('../models/Lead');
const {
  batchFetchTracking, buildOrderUpdate, retryWithBackoff, deriveFromLogisticsFields
} = require('./nepalcanOrderSyncService');
const { loginToNepalcan, getDefaultSyncUser } = require('./nepalcanAuthService');
const { fetchOrderDetail, normalizeOrderDetail } = require('./nepalcanOrderDetailService');
const {
  extractVendors, getTotalCount, fetchVendorServiceBranches
} = require('./nepalcanVendorSyncService');
const {
  ORDERS_API_URL, buildOrderRequestParams, getOrderSyncWindow,
  isLastOrderPage, isOrderFrozen, parseOrderResponse
} = require('./nepalcanOrderWindow');

const API_BASE = 'https://commerce.thecanbrand.com/api';
const MAX_RETRIES = parseInt(process.env.SYNC_MAX_RETRIES) || 3;
// ponytail: tiny batches fit Hobby 10s / Render throttle; override via env
const ORDERS_LIMIT = parseInt(process.env.SYNC_ORDERS_LIMIT) || 200;
const TRACKING_LIMIT = parseInt(process.env.SYNC_TRACKING_LIMIT) || 25;
const DETAILS_LIMIT = parseInt(process.env.SYNC_DETAILS_LIMIT) || 25;
const VENDORS_LIMIT = parseInt(process.env.SYNC_VENDORS_LIMIT) || 25;
const TRACKING_CONCURRENCY = parseInt(process.env.SYNC_TRACKING_CONCURRENCY) || 5;
const DETAILS_CONCURRENCY = parseInt(process.env.SYNC_DETAILS_CONCURRENCY) || 5;

const authHeaders = (token) => ({
  'Content-Type': 'application/json',
  'Origin': 'https://commerce.thecanbrand.com',
  'Referer': 'https://commerce.thecanbrand.com/',
  ...(token ? { Authorization: `Bearer ${token}` } : {})
});

const pushError = (job, recordId, message) => {
  job.batch_errors = [...(job.batch_errors || []).slice(-19), { recordId: String(recordId || ''), message: String(message || '').slice(0, 500), at: new Date() }];
};

// --- ORDERS: exactly ONE API page (default 50), checkpoint = current_page ---
const fetchOrdersPage = async (token, page, limit = ORDERS_LIMIT) =>
  retryWithBackoff(() => axios.get(ORDERS_API_URL, {
    // Commerce uses limit (not perPage) and honors the 19-day date window.
    params: buildOrderRequestParams(page, limit),
    headers: authHeaders(token), timeout: 20000
  }).then(parseOrderResponse), MAX_RETRIES);

const processOrdersPage = async (job, token) => {
  const page = job.current_page || 1;
  const { orders: ordersList, total: totalApi } = await fetchOrdersPage(token, page);
  if (ordersList.length === 0) return { done: true, totalApi, successful: 0, failed: 0, count: 0 };

  const ids = ordersList.map(o => o.orderId || o._id).filter(Boolean);
  const existing = await NepalcanOrder.find({ orderId: { $in: ids } })
    .select('orderId apiUpdatedAt orderStatus totalAmount shippingAmount priceHistory statusHistory trackingData processingAt shippedAt deliveredAt cancelledAt returnedAt customer vendor paymentStatus paymentMethod source rawData').lean();
  const existingMap = new Map(existing.map(o => [o.orderId, o]));

  const vendorNames = [...new Set(ordersList.map(o => o.vendor).filter(Boolean))];
  const vendorLeads = vendorNames.length ? await Lead.find({
    $or: [{ business_name: { $in: vendorNames } }, { nepalcanId: { $in: vendorNames } }]
  }).select('_id business_name nepalcanId').lean() : [];
  const vlMap = new Map();
  for (const vl of vendorLeads) {
    vlMap.set(String(vl.business_name || '').toLowerCase(), vl._id);
    if (vl.nepalcanId) vlMap.set(vl.nepalcanId, vl._id);
  }

  const trackingMap = await batchFetchTracking(ids, TRACKING_CONCURRENCY);
  const ops = [];
  const statChanges = [];
  let successful = 0, failed = 0;
  for (const orderData of ordersList) {
    try {
      const orderId = orderData.orderId || orderData._id;
      const ex = existingMap.get(orderId);
      const apiTs = orderData.updatedAt ? new Date(orderData.updatedAt).getTime() : 0;
      const storedTs = ex?.apiUpdatedAt ? new Date(ex.apiUpdatedAt).getTime() : 0;

      // Skip frozen orders — terminal status + grace period expired.
      // These are done and won't change; no point writing them every sync.
      if (ex && isOrderFrozen(ex)) { successful++; continue; }

      // Skip if API timestamp unchanged AND order is terminal (can't advance further)
      if (ex && apiTs > 0 && storedTs > 0 && apiTs === storedTs && ['Delivered', 'Cancelled', 'Returned'].includes(ex.orderStatus)) { successful++; continue; }
      const u = buildOrderUpdate(orderData, trackingMap.get(orderId), ex || null);
      const vl = orderData.vendor ? (vlMap.get(String(orderData.vendor).toLowerCase()) || vlMap.get(orderData.vendor)) : null;
      if (u.isNew) { if (vl) u.update.$setOnInsert.vendor_lead_id = vl; ops.push({ updateOne: { ...u, upsert: true } }); }
      else { if (vl) u.update.$set.vendor_lead_id = vl; ops.push({ updateOne: u }); }
      statChanges.push({ prev: ex || null, next: u.nextState });
      successful++;
    } catch (e) { failed++; pushError(job, orderData.orderId || orderData._id, e.message); }
  }
  if (ops.length) await NepalcanOrder.bulkWrite(ops, { ordered: false });
  if (statChanges.length) await require('./nepalcanOrderStatsService').applyOrderChanges(statChanges);
  // ponytail: totalApi known — done when page covers it, not only on short page (exact multiples stall)
  const isLast = isLastOrderPage({ page, limit: ORDERS_LIMIT, count: ordersList.length, total: totalApi });
  return { done: !!isLast, totalApi, successful, failed, count: ordersList.length };
};

// --- TRACKING: small slice after last_processed_id ---
const processTrackingBatch = async (job) => {
  const { from, to } = getOrderSyncWindow();
  const TERMINAL_GRACE_MS = (parseInt(process.env.NEPALCAN_ORDER_TERMINAL_GRACE_DAYS) || 10) * 24 * 60 * 60 * 1000;
  const graceCutoff = new Date(Date.now() - TERMINAL_GRACE_MS);

  const filter = {
    // Active orders OR terminal orders still within the grace period
    $or: [
      { orderStatus: { $in: ['Pending', 'Processing', 'Shipped', 'Hold'] } },
      { orderStatus: 'Delivered', deliveredAt: { $gte: graceCutoff } },
      { orderStatus: 'Cancelled', cancelledAt: { $gte: graceCutoff } },
      { orderStatus: 'Returned', returnedAt: { $gte: graceCutoff } },
      // Orders with no terminal date yet — may still get tracking update
      { orderStatus: { $in: ['Delivered', 'Cancelled', 'Returned'] }, deliveredAt: null, cancelledAt: null, returnedAt: null },
    ],
    createdAt: { $gte: from }
  };
  if (job.last_processed_id) filter._id = { $gt: job.last_processed_id };
  const batch = await NepalcanOrder.find(filter).sort({ _id: 1 }).limit(TRACKING_LIMIT)
    .select('_id orderId orderStatus customer totalAmount statusHistory rawData trackingData processingAt shippedAt deliveredAt cancelledAt returnedAt').lean();
  if (!batch.length) return { done: true, successful: 0, failed: 0, count: 0 };
  const { deriveStatusFromTracking, extractStatusTimeline, resolveStatus } = require('./nepalcanOrderSyncService');
  const { lifecycleFields, mergeStatusHistory, processingDurationHours } = require('../utils/orderLifecycle');
  const trackingMap = await batchFetchTracking(batch.map(o => o.orderId), TRACKING_CONCURRENCY);
  const ops = [];
  const statChanges = [];
  let successful = 0, failed = 0;
  for (const order of batch) {
    try {
      const td = trackingMap.get(order.orderId);
      // ponytail: empty/unknown tracking yields null — must not demote Delivered to Pending
      if (!td?.marketplaceProcesses?.length && !td?.processHistory?.length && !td?.deliveryDate && !deriveFromLogisticsFields(td)) { successful++; continue; }
      const ns = deriveStatusFromTracking(td?.marketplaceProcesses, td);
      if (!ns) { successful++; continue; }
      const resolved = resolveStatus(order.orderStatus, ns, 'logistics_api');
      const set = { 'rawData.trackingProcesses': td.marketplaceProcesses, trackingData: td, lastSyncedAt: new Date() };
      if (resolved.status !== order.orderStatus) {
        set.orderStatus = resolved.status; set.statusSource = resolved.source;
        const tl = extractStatusTimeline(td);
        if (tl.length) {
          set.statusHistory = mergeStatusHistory(order.statusHistory || [], tl);
          const lifecycle = lifecycleFields({ ...order, statusHistory: set.statusHistory, trackingData: td });
          for (const field of ['processingAt', 'shippedAt', 'deliveredAt', 'cancelledAt', 'returnedAt']) {
            if (lifecycle[field]) set[field] = lifecycle[field];
          }
        }
        set.processingDurationHours = processingDurationHours(set.statusHistory || order.statusHistory || []);
      }
      statChanges.push({ prev: order, next: { ...order, ...set } });
      ops.push({ updateOne: { filter: { _id: order._id }, update: { $set: set } } });
      successful++;
    } catch (e) { failed++; pushError(job, order.orderId, e.message); }
  }
  if (ops.length) await NepalcanOrder.bulkWrite(ops, { ordered: false });
  if (statChanges.length) await require('./nepalcanOrderStatsService').applyOrderChanges(statChanges);
  const lastId = String(batch[batch.length - 1]._id);
  job.last_processed_id = lastId;
  return { done: batch.length < TRACKING_LIMIT, last_processed_id: lastId, successful, failed, count: batch.length };
};

// --- DETAILS: cursor-walk all orders by _id, fetch detailData only for those missing it.
// Always advances by _id so the phase terminates regardless of whether API returns data.
const processDetailsBatch = async (job) => {
  const filter = { nepalcanId: { $exists: true, $ne: null } };
  if (job.last_processed_id) filter._id = { $gt: job.last_processed_id };
  const batch = await NepalcanOrder.find(filter).sort({ _id: 1 }).limit(DETAILS_LIMIT)
    .select('_id orderId nepalcanId detailData detailFetchedAt').lean();
  if (!batch.length) return { done: true, successful: 0, failed: 0, count: 0 };

  const needsFetch = batch.filter(o => !o.detailData && !o.detailFetchedAt);
  const ops = [];
  let successful = 0, failed = 0;

  if (needsFetch.length > 0) {
    for (let i = 0; i < needsFetch.length; i += DETAILS_CONCURRENCY) {
      const chunk = needsFetch.slice(i, i + DETAILS_CONCURRENCY);
      const settled = await Promise.allSettled(chunk.map(async (order) => {
        const raw = await fetchOrderDetail(order.nepalcanId);
        return { order, detail: normalizeOrderDetail(raw) };
      }));
      settled.forEach((result, index) => {
        const o = chunk[index];
        if (result.status === 'fulfilled') {
          ops.push({ updateOne: { filter: { _id: o._id }, update: { $set: { detailData: result.value.detail, detailFetchedAt: new Date() } } } });
          successful++;
        } else {
          ops.push({ updateOne: { filter: { _id: o._id }, update: { $set: { detailFetchedAt: new Date() } } } });
          failed++;
          pushError(job, o?.orderId, result.reason?.message);
        }
      });
    }
  }
  // Count already-done orders as successful so totals are accurate
  successful += batch.length - needsFetch.length;

  if (ops.length) await NepalcanOrder.bulkWrite(ops, { ordered: false });
  const lastId = String(batch[batch.length - 1]._id);
  job.last_processed_id = lastId;
  return { done: batch.length < DETAILS_LIMIT, last_processed_id: lastId, successful, failed, count: batch.length };
};

// --- VENDORS: ONE API page (default 25), bulkWrite + bulk Activity ---
const fetchVendorsPage = async (token, page, limit = VENDORS_LIMIT) =>
  retryWithBackoff(() => axios.get(`${API_BASE}/vendor/super-admin/list`, {
    params: { page, limit, type: 'Business' }, headers: authHeaders(token), timeout: 20000
  }).then(r => r.data), MAX_RETRIES);

const buildLeadData = (v) => {
  const pc = v.activeMarketplaceProductCount || v.productCount || v.activeProductsCount || 0;
  return {
    business_name: v.name, contact_person: v.name, email: v.email || 'TBD', phone: v.phone || 'TBD',
    location: v.address || 'TBD', lead_source: 'Nepalcan', expected_product_count: pc,
    nepalcanId: v._id, type: 'vendor', is_verified: v.isVerified,
    verification_status: v.isVerified ? 'verified' : 'pending',
    onboarding_stage: v.isVerified ? 'seller_activated' : 'documents_pending',
    activation_status: v.isVerified ? 'active' : 'inactive',
    lead_status: v.isVerified ? 'Activated' : 'Document Pending',
    vendorCanId: v.canId?.canId || v.canId || null,
    vendorSlug: v.slug || null,
    rawData: { canId: v.canId?.canId || v.canId || null, slug: v.slug || null, createdAt: v.createdAt || null, updatedAt: v.updatedAt || null, address: v.address || null },
    updated_at: new Date()
  };
};

const processVendorsPage = async (job, token, userId) => {
  const page = job.current_page || 1;
  const raw = await fetchVendorsPage(token, page);
  const vendors = extractVendors({ data: raw });
  const totalApi = getTotalCount({ data: raw }) || vendors.length;
  if (!vendors.length) return { done: true, totalApi, successful: 0, failed: 0, count: 0 };
  const syncUserId = userId || (await getDefaultSyncUser())?._id;
  const now = new Date();
  // ponytail: one query for whole page, not N+1 findOne
  const existingLeads = await Lead.find({ nepalcanId: { $in: vendors.map(v => v._id) } })
    .select('_id nepalcanId lead_status last_nepalcan_status converted_at').lean();
  const exMap = new Map(existingLeads.map(e => [String(e.nepalcanId), e]));
  // ponytail: fuzzy pool so batch path converts instead of duplicating null-nepalcanId leads
  const { normEmail, normPhone, normName, rankCandidate } = require('./nepalcanVendorSyncService');
  const unmatched = vendors.filter(v => !exMap.has(String(v._id)));
  let fuzzyPool = [];
  if (unmatched.length) {
    const ors = [];
    for (const v of unmatched) {
      const nn = normName(v.name);
      if (nn) ors.push({ business_name: { $regex: `^${nn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
      const ne = normEmail(v.email);
      if (ne) ors.push({ email: ne });
      const np = normPhone(v.phone);
      if (np) ors.push({ phone: np });
    }
    if (ors.length) {
      fuzzyPool = await Lead.find({
        $and: [
          { $or: [{ nepalcanId: { $exists: false } }, { nepalcanId: null }] },
          { $or: [{ type: 'lead' }, { type: { $exists: false } }] },
          { $or: ors }
        ]
      }).select('_id business_name email phone lead_status last_nepalcan_status converted_at').lean();
    }
  }
  const bulkOps = [], activities = [];
  let successful = 0, failed = 0, converted = 0;
  const claimedNids = new Set();
  for (const v of vendors) {
    try {
      const leadData = buildLeadData(v);
      const ex = exMap.get(String(v._id));
      if (ex) {
        const prev = ex.last_nepalcan_status;
        // ponytail: Active Seller guard replicated without .save() hooks
        const set = (ex.lead_status === 'Active Seller' && leadData.lead_status !== 'Active Seller')
          ? { business_name: leadData.business_name, contact_person: leadData.contact_person, email: leadData.email, phone: leadData.phone, location: leadData.location, expected_product_count: leadData.expected_product_count, is_verified: leadData.is_verified, verification_status: leadData.verification_status, onboarding_stage: leadData.onboarding_stage, activation_status: leadData.activation_status, nepalcanId: leadData.nepalcanId, vendorCanId: leadData.vendorCanId, vendorSlug: leadData.vendorSlug, rawData: leadData.rawData, type: 'vendor', last_nepalcan_status: leadData.lead_status, updated_at: now }
          : { ...leadData, last_nepalcan_status: leadData.lead_status, updated_at: now,
              ...(leadData.lead_status === 'Activated' && prev !== 'Activated' && !ex.converted_at ? { converted_at: now } : {}) };
        bulkOps.push({ updateOne: { filter: { _id: ex._id }, update: { $set: set } } });
        if (syncUserId && prev && prev !== leadData.lead_status)
          activities.push({ lead_id: ex._id, user_id: syncUserId, activity_type: 'status_change', description: `Pipeline changed (sync): ${prev} → ${leadData.lead_status}`, status: 'completed' });
      } else {
        // ponytail: same-_id convert before upsert-new — never a second account
        const ranked = fuzzyPool
          .filter(c => !claimedNids.has(String(c._id)))
          .map(c => ({ c, r: rankCandidate(c, v) }))
          .filter(x => x.r > 0)
          .sort((a, b) => b.r - a.r);
        if (ranked.length && !(ranked.length > 1 && ranked[0].r === ranked[1].r)) {
          const c = ranked[0].c;
          claimedNids.add(String(c._id));
          const prev = c.last_nepalcan_status;
          const set = (c.lead_status === 'Active Seller' && leadData.lead_status !== 'Active Seller')
            ? { business_name: leadData.business_name, contact_person: leadData.contact_person, email: leadData.email, phone: leadData.phone, location: leadData.location, expected_product_count: leadData.expected_product_count, is_verified: leadData.is_verified, verification_status: leadData.verification_status, onboarding_stage: leadData.onboarding_stage, activation_status: leadData.activation_status, nepalcanId: leadData.nepalcanId, vendorCanId: leadData.vendorCanId, vendorSlug: leadData.vendorSlug, rawData: leadData.rawData, type: 'vendor', last_nepalcan_status: leadData.lead_status, updated_at: now }
            : { ...leadData, last_nepalcan_status: leadData.lead_status, updated_at: now,
                ...(leadData.lead_status === 'Activated' && prev !== 'Activated' && !c.converted_at ? { converted_at: now } : {}) };
          bulkOps.push({ updateOne: { filter: { _id: c._id }, update: { $set: set } } });
          if (syncUserId && prev && prev !== leadData.lead_status)
            activities.push({ lead_id: c._id, user_id: syncUserId, activity_type: 'status_change', description: `Pipeline changed (sync): ${prev} → ${leadData.lead_status}`, status: 'completed' });
          converted++;
          successful++;
          continue;
        }
        if (ranked.length > 1) console.warn(`[Vendor Batch] Ambiguous match for ${v.name} — skipped, needs human review`);
        bulkOps.push({ updateOne: { filter: { nepalcanId: v._id }, update: { $set: { ...leadData, last_nepalcan_status: leadData.lead_status, updated_at: now, ...(leadData.lead_status === 'Activated' ? { converted_at: now } : {}) } }, upsert: true } });
      }
      successful++;
    } catch (e) { failed++; pushError(job, v._id || v.name, e.message); }
  }
  if (bulkOps.length) await Lead.bulkWrite(bulkOps, { ordered: false });
  if (activities.length) { const A = require('../models/Activity'); await A.insertMany(activities, { ordered: false }); }
  // ponytail: totalApi known — done when page covers it, not only on short page
  return { done: !!(vendors.length < VENDORS_LIMIT || (totalApi && page * VENDORS_LIMIT >= totalApi)), totalApi, successful, failed, count: vendors.length };
};

// --- BRANCHES: slice of 25 vendors after last_processed_id (small dataset, still bounded) ---
const processBranchesBatch = async (job, token) => {
  const filter = { type: 'vendor', nepalcanId: { $exists: true, $ne: null } };
  if (job.last_processed_id) filter._id = { $gt: job.last_processed_id };
  const vendors = await Lead.find(filter).sort({ _id: 1 }).limit(25).select('nepalcanId business_name').lean();
  if (!vendors.length) return { done: true, successful: 0, failed: 0, count: 0 };
  const DG = require('../models/DeliveryZoneGroup');
  const groups = await DG.find({}).lean();
  const lookup = {};
  for (const g of groups) for (const b of (g.branches || [])) lookup[b.nepalcanId] = b.name;
  const ops = [];
  let successful = 0, failed = 0;
  for (const vendor of vendors) {
    try {
      const apiBranches = await fetchVendorServiceBranches(vendor.nepalcanId, token);
      const matched = [];
      for (const b of apiBranches) {
        const id = b._id || b.id || b.branchId || b.nepalcanId;
        if (id) matched.push({ branchId: String(id), name: lookup[id] || b.name || b.branchName || String(id) });
      }
      if (matched.length) ops.push({ updateOne: { filter: { _id: vendor._id }, update: { $set: { service_branches: matched } } } });
      successful++;
      await new Promise(r => setTimeout(r, 100)); // ponytail: gentle on external API
    } catch (e) { failed++; pushError(job, vendor.nepalcanId, e.message); }
  }
  if (ops.length) await Lead.bulkWrite(ops, { ordered: false });
  const lastId = String(vendors[vendors.length - 1]._id);
  job.last_processed_id = lastId;
  const remaining = await Lead.countDocuments({ type: 'vendor', nepalcanId: { $exists: true, $ne: null }, _id: { $gt: lastId } });
  return { done: remaining === 0, last_processed_id: lastId, successful, failed, count: vendors.length };
};

module.exports = {
  processOrdersPage, processDetailsBatch, processTrackingBatch, processVendorsPage, processBranchesBatch,
  buildLeadData, fetchOrdersPage, fetchVendorsPage
};
