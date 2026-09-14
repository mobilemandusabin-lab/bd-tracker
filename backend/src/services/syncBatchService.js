// ponytail: one batch per function, reuses existing pure logic. No orchestration loops.
const axios = require('axios');
const NepalcanOrder = require('../models/NepalcanOrder');
const Lead = require('../models/Lead');
const {
  batchFetchTracking, buildOrderUpdate, retryWithBackoff
} = require('./nepalcanOrderSyncService');
const { loginToNepalcan, getDefaultSyncUser } = require('./nepalcanAuthService');
const {
  extractVendors, getTotalCount, fetchVendorServiceBranches
} = require('./nepalcanVendorSyncService');

const API_BASE = 'https://commerce.thecanbrand.com/api';
const MAX_RETRIES = parseInt(process.env.SYNC_MAX_RETRIES) || 3;
// ponytail: tiny batches fit Hobby 10s / Render throttle; override via env
const ORDERS_LIMIT = parseInt(process.env.SYNC_ORDERS_LIMIT) || 50;
const TRACKING_LIMIT = parseInt(process.env.SYNC_TRACKING_LIMIT) || 25;
const VENDORS_LIMIT = parseInt(process.env.SYNC_VENDORS_LIMIT) || 25;
const TRACKING_CONCURRENCY = parseInt(process.env.SYNC_TRACKING_CONCURRENCY) || 5;

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
  retryWithBackoff(() => axios.get(`${API_BASE}/vendor/orders/super-admin/list`, {
    params: { tab: 'marketplace', page, limit, unattendedOrders: '', status: 'Active' },
    headers: authHeaders(token), timeout: 20000
  }).then(r => r.data), MAX_RETRIES);

const parseOrdersList = (data) =>
  data?.data?.orders || data?.orders || (Array.isArray(data?.data) ? data.data : []) || [];

const processOrdersPage = async (job, token) => {
  const page = job.current_page || 1;
  const data = await fetchOrdersPage(token, page);
  const ordersList = parseOrdersList(data);
  const totalApi = data?.totalItems ?? data?.total ?? data?.data?.total ?? ordersList.length;
  if (ordersList.length === 0) return { done: true, totalApi, successful: 0, failed: 0, count: 0 };

  const ids = ordersList.map(o => o.orderId || o._id).filter(Boolean);
  const existing = await NepalcanOrder.find({ orderId: { $in: ids } })
    .select('orderId apiUpdatedAt orderStatus totalAmount shippingAmount priceHistory').lean();
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
  let successful = 0, failed = 0;
  for (const orderData of ordersList) {
    try {
      const orderId = orderData.orderId || orderData._id;
      const ex = existingMap.get(orderId);
      const apiTs = orderData.updatedAt ? new Date(orderData.updatedAt).getTime() : 0;
      const storedTs = ex?.apiUpdatedAt ? new Date(ex.apiUpdatedAt).getTime() : 0;
      if (ex && apiTs > 0 && storedTs > 0 && apiTs === storedTs) { successful++; continue; } // unchanged skip
      const u = buildOrderUpdate(orderData, trackingMap.get(orderId), ex || null);
      const vl = orderData.vendor ? (vlMap.get(String(orderData.vendor).toLowerCase()) || vlMap.get(orderData.vendor)) : null;
      if (u.isNew) { if (vl) u.update.$setOnInsert.vendor_lead_id = vl; ops.push({ updateOne: { ...u, upsert: true } }); }
      else { if (vl) u.update.$set.vendor_lead_id = vl; ops.push({ updateOne: u }); }
      successful++;
    } catch (e) { failed++; pushError(job, orderData.orderId || orderData._id, e.message); }
  }
  if (ops.length) await NepalcanOrder.bulkWrite(ops, { ordered: false });
  const isLast = ordersList.length < ORDERS_LIMIT;
  return { done: isLast, totalApi, successful, failed, count: ordersList.length };
};

// --- TRACKING: small slice after last_processed_id ---
const processTrackingBatch = async (job) => {
  const filter = { orderStatus: { $in: ['Pending', 'Processing', 'Shipped', 'Delivered'] } };
  if (job.last_processed_id) filter._id = { $gt: job.last_processed_id };
  const batch = await NepalcanOrder.find(filter).sort({ _id: 1 }).limit(TRACKING_LIMIT)
    .select('_id orderId orderStatus statusHistory rawData').lean();
  if (!batch.length) return { done: true, successful: 0, failed: 0, count: 0 };
  const { deriveStatusFromTracking, extractStatusTimeline, resolveStatus } = require('./nepalcanOrderSyncService');
  const trackingMap = await batchFetchTracking(batch.map(o => o.orderId), TRACKING_CONCURRENCY);
  const ops = [];
  let successful = 0, failed = 0;
  for (const order of batch) {
    try {
      const td = trackingMap.get(order.orderId);
      if (!td?.marketplaceProcesses) { successful++; continue; }
      const ns = deriveStatusFromTracking(td.marketplaceProcesses);
      const resolved = resolveStatus(order.orderStatus, ns, 'logistics_api');
      const set = { 'rawData.trackingProcesses': td.marketplaceProcesses, trackingData: td, lastSyncedAt: new Date() };
      if (resolved.status !== order.orderStatus) {
        set.orderStatus = resolved.status; set.statusSource = resolved.source;
        const tl = extractStatusTimeline(td.marketplaceProcesses);
        if (tl.length) set.statusHistory = tl;
      }
      ops.push({ updateOne: { filter: { _id: order._id }, update: { $set: set } } });
      successful++;
    } catch (e) { failed++; pushError(job, order.orderId, e.message); }
  }
  if (ops.length) await NepalcanOrder.bulkWrite(ops, { ordered: false });
  job.last_processed_id = String(batch[batch.length - 1]._id);
  return { done: batch.length < TRACKING_LIMIT, successful, failed, count: batch.length };
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
  const bulkOps = [], activities = [];
  let successful = 0, failed = 0;
  for (const v of vendors) {
    try {
      const leadData = buildLeadData(v);
      const ex = exMap.get(String(v._id));
      if (ex) {
        const prev = ex.last_nepalcan_status;
        // ponytail: Active Seller guard replicated without .save() hooks
        const set = (ex.lead_status === 'Active Seller' && leadData.lead_status === 'Activated')
          ? { business_name: leadData.business_name, contact_person: leadData.contact_person, email: leadData.email, phone: leadData.phone, location: leadData.location, expected_product_count: leadData.expected_product_count, is_verified: leadData.is_verified, verification_status: leadData.verification_status, onboarding_stage: leadData.onboarding_stage, activation_status: leadData.activation_status, nepalcanId: leadData.nepalcanId, type: 'vendor', last_nepalcan_status: leadData.lead_status, updated_at: now }
          : { ...leadData, last_nepalcan_status: leadData.lead_status, updated_at: now,
              ...(prev && leadData.lead_status === 'Activated' && prev !== 'Activated' && !ex.converted_at ? { converted_at: now } : {}) };
        bulkOps.push({ updateOne: { filter: { _id: ex._id }, update: { $set: set } } });
        if (syncUserId && prev && prev !== leadData.lead_status)
          activities.push({ lead_id: ex._id, user_id: syncUserId, activity_type: 'status_change', description: `Pipeline changed (sync): ${prev} → ${leadData.lead_status}`, status: 'completed' });
      } else {
        bulkOps.push({ updateOne: { filter: { nepalcanId: v._id }, update: { $set: { ...leadData, last_nepalcan_status: leadData.lead_status, updated_at: now, ...(leadData.lead_status === 'Activated' ? { converted_at: now } : {}) } }, upsert: true } });
      }
      successful++;
    } catch (e) { failed++; pushError(job, v._id || v.name, e.message); }
  }
  if (bulkOps.length) await Lead.bulkWrite(bulkOps, { ordered: false });
  if (activities.length) { const A = require('../models/Activity'); await A.insertMany(activities, { ordered: false }); }
  return { done: vendors.length < VENDORS_LIMIT, totalApi, successful, failed, count: vendors.length };
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
  job.last_processed_id = String(vendors[vendors.length - 1]._id);
  const remaining = await Lead.countDocuments({ type: 'vendor', nepalcanId: { $exists: true, $ne: null }, _id: { $gt: job.last_processed_id } });
  return { done: remaining === 0, successful, failed, count: vendors.length };
};

module.exports = {
  processOrdersPage, processTrackingBatch, processVendorsPage, processBranchesBatch,
  buildLeadData, fetchOrdersPage, fetchVendorsPage
};
