require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });

const mongoose = require('mongoose');
const NepalcanOrder = require('../src/models/NepalcanOrder');
const Lead = require('../src/models/Lead');
const { lifecycleFields, validDate } = require('../src/utils/orderLifecycle');

const apply = process.argv.includes('--apply');
const normalize = (value) => String(value || '').trim().toLowerCase();

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, family: 4 });

  const [orders, leads] = await Promise.all([
    NepalcanOrder.find({}).select('_id orderStatus vendor vendor_lead_id totalAmount deliveredAt statusHistory trackingData').lean(),
    Lead.find({ type: 'vendor' }).select('_id business_name nepalcanId delivered_order_count total_revenue last_order_date active_seller').lean()
  ]);

  const byName = new Map();
  const byNepalcanId = new Map();
  for (const lead of leads) {
    const name = normalize(lead.business_name);
    if (name && !byName.has(name)) byName.set(name, lead);
    else if (name) byName.set(name, null); // ambiguous names are never auto-linked
    if (lead.nepalcanId) byNepalcanId.set(String(lead.nepalcanId), lead);
  }

  const links = [];
  const effectiveLeadByOrder = new Map();
  for (const order of orders) {
    const existingLead = order.vendor_lead_id
      ? leads.find(item => String(item._id) === String(order.vendor_lead_id))
      : null;
    let lead = existingLead;
    if (!lead && order.vendor) {
      lead = byName.get(normalize(order.vendor)) || byNepalcanId.get(String(order.vendor)) || null;
      // Repair both missing references and references to deleted/orphan leads,
      // but never override a valid existing relationship from the provider.
      if (lead && String(order.vendor_lead_id || '') !== String(lead._id)) links.push({ order, lead });
    }
    if (lead) effectiveLeadByOrder.set(String(order._id), lead);
  }

  const aggregates = new Map();
  for (const order of orders) {
    if (order.orderStatus !== 'Delivered') continue;
    const lead = effectiveLeadByOrder.get(String(order._id));
    if (!lead) continue;
    const key = String(lead._id);
    const item = aggregates.get(key) || { count: 0, revenue: 0, lastOrderDate: null };
    item.count += 1;
    item.revenue += Number(order.totalAmount) || 0;
    const deliveredAt = lifecycleFields(order).deliveredAt;
    if (validDate(deliveredAt) && (!item.lastOrderDate || deliveredAt > item.lastOrderDate)) item.lastOrderDate = deliveredAt;
    aggregates.set(key, item);
  }

  const leadUpdates = [];
  for (const [leadId, aggregate] of aggregates) {
    const lead = leads.find(item => String(item._id) === leadId);
    if (!lead) continue;
    const countDiff = Number(lead.delivered_order_count || 0) !== aggregate.count;
    const revenueDiff = Math.abs(Number(lead.total_revenue || 0) - aggregate.revenue) > 0.01;
    const oldDate = validDate(lead.last_order_date);
    const dateDiff = Boolean(oldDate || aggregate.lastOrderDate) && (!oldDate || !aggregate.lastOrderDate || Math.abs(oldDate - aggregate.lastOrderDate) > 1000);
    const activeDiff = lead.active_seller !== true;
    if (countDiff || revenueDiff || dateDiff || activeDiff) {
      leadUpdates.push({ lead, aggregate, countDiff, revenueDiff, dateDiff, activeDiff });
    }
  }

  const report = {
    mode: apply ? 'applied' : 'dry-run',
    ordersScanned: orders.length,
    deliveredOrders: orders.filter(order => order.orderStatus === 'Delivered').length,
    exactVendorLinksAvailable: links.length,
    ambiguousOrUnmatchedLinks: orders.filter(order => order.orderStatus === 'Delivered' && !effectiveLeadByOrder.has(String(order._id))).length,
    leadMetricsNeedingUpdate: leadUpdates.length,
    modifiedOrders: 0,
    modifiedLeads: 0
  };

  if (apply) {
    if (links.length) {
      const result = await NepalcanOrder.bulkWrite(links.map(({ order, lead }) => ({
        updateOne: { filter: { _id: order._id }, update: { $set: { vendor_lead_id: lead._id } } }
      })), { ordered: false });
      report.modifiedOrders = result.modifiedCount;
    }
    if (leadUpdates.length) {
      const result = await Lead.bulkWrite(leadUpdates.map(({ lead, aggregate }) => ({
        updateOne: {
          filter: { _id: lead._id },
          update: { $set: {
            delivered_order_count: aggregate.count,
            total_revenue: Math.round(aggregate.revenue * 100) / 100,
            last_order_date: aggregate.lastOrderDate,
            active_seller: true
          } }
        }
      })), { ordered: false });
      report.modifiedLeads = result.modifiedCount;
    }
  }

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error.stack || error.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
