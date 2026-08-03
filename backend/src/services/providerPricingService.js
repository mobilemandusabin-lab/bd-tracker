const axios = require('axios');
const ProviderPricing = require('../models/ProviderPricing');
const DeliveryZoneGroup = require('../models/DeliveryZoneGroup');

const NEPA_CAN_API = 'https://commerce.thecanbrand.com/api';
const NEPA_CAN_HEADERS = {
  'Content-Type': 'application/json',
  'Origin': 'https://commerce.thecanbrand.com',
  'Referer': 'https://commerce.thecanbrand.com/',
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
};

const ZONE_PRIORITY = [
  'Inside Valley',
  'To Major Cities',
  'Except Major city'
];

exports.syncProviderPricing = async (token) => {
  try {
    const response = await axios.get(
      `${NEPA_CAN_API}/provider-pricing?page=1&limit=10&keywords=&isActive=true`,
      { timeout: 15000, headers: { ...NEPA_CAN_HEADERS, Authorization: `Bearer ${token}` } }
    );

    const items = response.data.data || [];
    const syncedAt = new Date();
    let syncedCount = 0;

    for (const item of items) {
      await ProviderPricing.findOneAndUpdate(
        { nepalcanId: item._id },
        {
          nepalcanId: item._id,
          entity: item.entity,
          serviceType: item.serviceType,
          deliveryZoneGroup: item.deliveryZoneGroup,
          deliveryZoneGroupName: item.deliveryZoneGroupName,
          pricingSlabs: item.pricingSlabs || [],
          returnChargeDelivered: item.returnChargeDelivered,
          returnChargeNotDelivered: item.returnChargeNotDelivered,
          fallbackPrice: item.fallbackPrice,
          isActive: item.isActive,
          entityName: item.entityName,
          syncedAt
        },
        { upsert: true, new: true }
      );
      syncedCount++;
    }

    return { synced: syncedCount };
  } catch (error) {
    console.error('[ProviderPricing] Sync error:', error.message);
    throw error;
  }
};

exports.resolvePricing = async (branchId, serviceType) => {
  if (!branchId || !serviceType) return null;

  const groups = await DeliveryZoneGroup.find({
    'branches.nepalcanId': branchId
  }).sort({ name: 1 });

  if (!groups.length) return null;

  const pickGroup = (groups) => {
    for (const priority of ZONE_PRIORITY) {
      const match = groups.find(g => g.name.startsWith(priority));
      if (match) return match;
    }
    return groups[0];
  };

  const group = pickGroup(groups);
  if (!group) return null;

  const pricing = await ProviderPricing.findOne({
    deliveryZoneGroup: group.nepalcanId,
    serviceType: serviceType.toUpperCase(),
    isActive: true
  });

  if (!pricing) return null;

  return {
    zoneGroupName: group.zoneGroupName || group.name,
    zoneGroupId: group.nepalcanId,
    serviceType: pricing.serviceType,
    pricingSlabs: pricing.pricingSlabs,
    returnChargeDelivered: pricing.returnChargeDelivered,
    returnChargeNotDelivered: pricing.returnChargeNotDelivered,
    fallbackPrice: pricing.fallbackPrice,
    entityName: pricing.entityName
  };
};

exports.findMatchingSlab = (pricing, totalValue) => {
  if (!pricing || !pricing.pricingSlabs?.length) return null;

  const sorted = [...pricing.pricingSlabs].sort((a, b) => a.productPriceFrom - b.productPriceFrom);

  for (const slab of sorted) {
    if (totalValue >= slab.productPriceFrom) {
      if (slab.productPriceTo === 0 || totalValue <= slab.productPriceTo) {
        return slab;
      }
    }
  }

  return {
    customerDeliveryCharge: pricing.fallbackPrice,
    vendorDropCharge: 0,
    vendorPickupCharge: 0
  };
};
