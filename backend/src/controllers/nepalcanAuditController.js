const axios = require('axios');
const NepalcanOrderAudit = require('../models/NepalcanOrderAudit');
const DeliveryZoneGroup = require('../models/DeliveryZoneGroup');
const ProviderPricing = require('../models/ProviderPricing');

const ZONE_PRIORITY = ['Inside Valley', 'To Major Cities', 'Except Major city'];

function pickZoneGroup(groups) {
  for (const priority of ZONE_PRIORITY) {
    const match = groups.find(g => g.name.startsWith(priority));
    if (match) return match;
  }
  return groups[0];
}

function findMatchingSlab(slabs, totalValue) {
  const sorted = [...(slabs || [])].sort((a, b) => a.productPriceFrom - b.productPriceFrom);
  for (const slab of sorted) {
    if (totalValue >= slab.productPriceFrom && (slab.productPriceTo === 0 || totalValue <= slab.productPriceTo)) {
      return slab;
    }
  }
  return null;
}

exports.runAudit = async (req, res) => {
  try {
    const runAt = new Date();
    const audit = await NepalcanOrderAudit.create({ runAt, status: 'running', summary: { total: 0 }, items: [] });
    const auditId = audit._id;

    // Start background audit
    runAuditInBackground(auditId).catch(err =>
      console.error('[Audit] Background audit failed:', err)
    );

    res.json({ status: 'running', auditId, runAt });
  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

async function runAuditInBackground(auditId) {
  const NepalcanOrder = require('../models/NepalcanOrder');

  try {
    const orders = await NepalcanOrder.find({ orderStatus: { $ne: 'Cancelled' } })
      .sort({ createdAt: -1 })
      .lean();

    const groups = await DeliveryZoneGroup.find({}).lean();
    const pricings = await ProviderPricing.find({}).lean();

    const items = [];
    const summary = { total: orders.length, ok: 0, mismatch: 0, noPricing: 0, noZone: 0, missingBranch: 0, errors: 0 };

    for (const order of orders) {
      try {
        const res = await axios.get(
          `https://can-logistic-prod-84pie.ondigitalocean.app/api/public/marketplace-tracker/${order.orderId}`,
          { timeout: 10000 }
        );
        const t = res.data;
        const breakdown = t.deliveryChargeBreakdown;

        if (!breakdown) {
          items.push({ orderId: order.orderId, orderStatus: order.orderStatus, status: 'ERROR', error: 'No deliveryChargeBreakdown' });
          summary.errors++;
          continue;
        }

        const branchId = t.destinationBranch || t.originBranch;
        if (!branchId) {
          items.push({ orderId: order.orderId, orderStatus: order.orderStatus, status: 'MISSING_BRANCH', error: 'No branch info in tracking' });
          summary.missingBranch++;
          continue;
        }

        const matched = groups.filter(g => (g.branches || []).some(b => b.nepalcanId === branchId));
        if (!matched.length) {
          items.push({ orderId: order.orderId, orderStatus: order.orderStatus, status: 'NO_ZONE', error: `Branch ${branchId} not in any zone group` });
          summary.noZone++;
          continue;
        }

        const zoneGroup = pickZoneGroup(matched);
        const serviceTypeMap = { b2d: 'D2D', b2b: 'D2B', d2d: 'D2D', d2b: 'D2B' };
        const normalizedType = serviceTypeMap[(t.shippingType || '').toLowerCase()] || (t.shippingType || '').toUpperCase();
        const pricing = pricings.find(p => p.deliveryZoneGroup === zoneGroup.nepalcanId && p.serviceType === normalizedType);

        if (!pricing) {
          items.push({
            orderId: order.orderId, orderStatus: order.orderStatus, status: 'NO_PRICING',
            zoneGroup: zoneGroup.name, serviceType: t.shippingType,
            destinationBranch: t.destinationBranch, originBranch: t.originBranch,
            destinationBranchName: resolveBranchName(groups, t.destinationBranch),
            originBranchName: resolveBranchName(groups, t.originBranch)
          });
          summary.noPricing++;
          continue;
        }

        const totalValue = (t.items || []).reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0);
        const slab = findMatchingSlab(pricing.pricingSlabs, totalValue);

        if (!slab) {
          items.push({
            orderId: order.orderId, orderStatus: order.orderStatus, status: 'NO_PRICING',
            zoneGroup: zoneGroup.name, serviceType: t.shippingType, totalValue,
            destinationBranch: t.destinationBranch, originBranch: t.originBranch,
            destinationBranchName: resolveBranchName(groups, t.destinationBranch),
            originBranchName: resolveBranchName(groups, t.originBranch),
            error: 'No slab matched for total value'
          });
          summary.noPricing++;
          continue;
        }

        const actual = { customer: breakdown.customerDeliveryCharge, drop: breakdown.vendorDropCharge, pickup: breakdown.vendorPickupCharge, retD: breakdown.returnChargeDelivered, retND: breakdown.returnChargeNotDelivered };
        const expected = { customer: slab.customerDeliveryCharge, drop: slab.vendorDropCharge, pickup: slab.vendorPickupCharge, retD: pricing.returnChargeDelivered, retND: pricing.returnChargeNotDelivered };

        const diffs = [];
        if (actual.customer !== expected.customer) diffs.push('customerCharge');
        if (actual.drop !== expected.drop) diffs.push('dropCharge');
        if (actual.pickup !== expected.pickup) diffs.push('pickupCharge');
        if (actual.retD !== expected.retD) diffs.push('returnDelivered');
        if (actual.retND !== expected.retND) diffs.push('returnNotDelivered');

        const entry = {
          orderId: order.orderId, orderStatus: order.orderStatus,
          status: diffs.length ? 'MISMATCH' : 'OK',
          zoneGroup: zoneGroup.name, serviceType: t.shippingType,
          totalValue, actual, expected, diffs,
          destinationBranch: t.destinationBranch, originBranch: t.originBranch,
          destinationBranchName: resolveBranchName(groups, t.destinationBranch),
          originBranchName: resolveBranchName(groups, t.originBranch)
        };

        items.push(entry);
        if (diffs.length) summary.mismatch++;
        else summary.ok++;
      } catch (err) {
        items.push({ orderId: order.orderId, orderStatus: order.orderStatus, status: 'ERROR', error: err.message });
        summary.errors++;
      }
    }

    await NepalcanOrderAudit.findByIdAndUpdate(auditId, {
      status: 'completed', completedAt: new Date(), summary, items
    });
  } catch (err) {
    await NepalcanOrderAudit.findByIdAndUpdate(auditId, {
      status: 'failed', completedAt: new Date(), error: err.message
    });
    console.error('[Audit] Fatal error:', err);
  }
}

function resolveBranchName(groups, branchId) {
  if (!branchId) return null;
  for (const g of groups) {
    const b = (g.branches || []).find(b => b.nepalcanId === branchId);
    if (b) return b.name;
  }
  return branchId;
}

exports.getAuditResults = async (req, res) => {
  try {
    const audit = await NepalcanOrderAudit.findOne().sort({ runAt: -1 });
    if (!audit) return res.json({ status: 'success', data: null });
    res.json({ status: 'success', data: audit });
  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

const AuditDismissal = require('../models/AuditDismissal');

exports.dismissAuditOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ status: 'fail', message: 'orderId required' });
    await AuditDismissal.findOneAndUpdate(
      { orderId },
      { orderId, dismissedAt: new Date(), dismissedBy: req.user?._id },
      { upsert: true }
    );
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

exports.undismissAuditOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    await AuditDismissal.findOneAndDelete({ orderId });
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

exports.getDismissedOrders = async (req, res) => {
  try {
    const dismissed = await AuditDismissal.find({}).select('orderId dismissedAt').sort({ dismissedAt: -1 }).lean();
    res.json({ status: 'success', data: dismissed.map(d => d.orderId) });
  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
};
