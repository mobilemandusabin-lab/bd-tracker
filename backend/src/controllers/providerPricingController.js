const ProviderPricing = require('../models/ProviderPricing');
const { syncProviderPricing, resolvePricing, findMatchingSlab } = require('../services/providerPricingService');
const { loginToNepalcan } = require('../services/nepalcanAuthService');

exports.listPricing = async (req, res) => {
  try {
    const pricing = await ProviderPricing.find().sort({ deliveryZoneGroupName: 1, serviceType: 1 });
    res.json({ status: 'success', data: pricing });
  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

exports.syncPricing = async (req, res) => {
  try {
    const token = await loginToNepalcan();
    const result = await syncProviderPricing(token);
    const pricing = await ProviderPricing.find().sort({ deliveryZoneGroupName: 1, serviceType: 1 });
    res.json({ status: 'success', data: { pricing, ...result } });
  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

exports.resolvePricingForOrder = async (req, res) => {
  try {
    const { branchId, serviceType, totalValue } = req.query;

    if (!branchId || !serviceType) {
      return res.status(400).json({ status: 'fail', message: 'branchId and serviceType are required' });
    }

    const pricing = await resolvePricing(branchId, serviceType);
    if (!pricing) {
      return res.json({ status: 'success', data: null, message: 'No matching pricing found' });
    }

    const total = parseFloat(totalValue) || 0;
    const slab = findMatchingSlab(pricing, total);

    res.json({
      status: 'success',
      data: {
        zoneGroupName: pricing.zoneGroupName,
        serviceType: pricing.serviceType,
        totalValue: total,
        slab,
        returnChargeDelivered: pricing.returnChargeDelivered,
        returnChargeNotDelivered: pricing.returnChargeNotDelivered,
        fallbackPrice: pricing.fallbackPrice,
        entityName: pricing.entityName
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
};
