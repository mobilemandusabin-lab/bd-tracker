const axios = require('axios');
const DeliveryZoneGroup = require('../models/DeliveryZoneGroup');
const { loginToNepalcan } = require('../services/nepalcanAuthService');

const NEPA_CAN_API = 'https://commerce.thecanbrand.com/api';
const NEPA_CAN_HEADERS = {
  'Content-Type': 'application/json',
  'Origin': 'https://commerce.thecanbrand.com',
  'Referer': 'https://commerce.thecanbrand.com/',
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
};

// GET /api/v1/delivery-zones
exports.getZoneGroups = async (req, res) => {
  try {
    const groups = await DeliveryZoneGroup.find().sort({ name: 1 });
    res.status(200).json({
      status: 'success',
      data: { groups }
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// POST /api/v1/delivery-zones/sync
exports.syncZoneGroups = async (req, res) => {
  try {
    const token = await loginToNepalcan();

    const response = await axios.get(
      `${NEPA_CAN_API}/delivery-zone-group/list?active=true&page=1&limit=50`,
      { timeout: 15000, headers: { ...NEPA_CAN_HEADERS, Authorization: `Bearer ${token}` } }
    );

    const zoneGroups = response.data.data || [];
    const syncedAt = new Date();
    let syncedCount = 0;

    for (const group of zoneGroups) {
      const branches = (group.branches || []).map(b => ({
        nepalcanId: b._id,
        name: b.name
      }));

      await DeliveryZoneGroup.findOneAndUpdate(
        { nepalcanId: group._id },
        {
          nepalcanId: group._id,
          name: group.name,
          branches,
          isActive: group.isActive,
          syncedAt
        },
        { upsert: true, new: true }
      );
      syncedCount++;
    }

    const groups = await DeliveryZoneGroup.find().sort({ name: 1 });

    res.status(200).json({
      status: 'success',
      data: { groups, synced: syncedCount }
    });
  } catch (err) {
    console.error('[DeliveryZone] Sync error:', err.message);
    res.status(500).json({ status: 'fail', message: err.message });
  }
};
