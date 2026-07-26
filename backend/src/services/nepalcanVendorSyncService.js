const Lead = require('../models/Lead');
const NepalcanSyncLog = require('../models/NepalcanSyncLog');
const axios = require('axios');
const { loginToNepalcan, getDefaultSyncUser } = require('./nepalcanAuthService');

const API_BASE = 'https://commerce.thecanbrand.com/api';

const fetchVendorServiceBranches = async (vendorNepalcanId, authToken) => {
  try {
    const response = await axios.get(
      `${API_BASE}/vendor-profile/serviceBranches`,
      {
        params: { vendor: vendorNepalcanId, status: true },
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Origin': 'https://commerce.thecanbrand.com',
          'Referer': 'https://commerce.thecanbrand.com/'
        },
        timeout: 15000
      }
    );
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data?.data && Array.isArray(data.data)) return data.data;
    if (data?.branches && Array.isArray(data.branches)) return data.branches;
    if (data?.data?.branches && Array.isArray(data.data.branches)) return data.data.branches;
    return [];
  } catch (err) {
    return [];
  }
};

const extractVendors = (response) => {
  const data = response.data;
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.vendors && Array.isArray(data.vendors)) return data.vendors;
  if (data?.data?.vendors && Array.isArray(data.data.vendors)) return data.data.vendors;
  if (typeof data === 'object') {
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key]) && data[key].length > 0 && typeof data[key][0] === 'object') {
        return data[key];
      }
    }
  }
  return [];
};

const getTotalCount = (response) => {
  const data = response.data;
  if (typeof data?.totalItems === 'number') return data.totalItems;
  if (typeof data?.data?.totalItems === 'number') return data.data.totalItems;
  if (typeof data?.total === 'number') return data.total;
  if (typeof data?.data?.total === 'number') return data.data.total;
  return 0;
};

const syncServiceBranches = async (token = null) => {
  const DeliveryZoneGroup = require('../models/DeliveryZoneGroup');
  const startTime = Date.now();
  let authToken = token;

  if (!authToken) {
    try {
      authToken = await loginToNepalcan();
    } catch (err) {
      console.error('[Service Branches] Failed to login:', err.message);
      return { updated: 0, message: 'Login failed' };
    }
  }

  const zoneGroups = await DeliveryZoneGroup.find({}).lean();
  const branchLookup = {};
  for (const group of zoneGroups) {
    for (const branch of group.branches) {
      branchLookup[branch.nepalcanId] = branch.name;
    }
  }

  const vendors = await Lead.find({
    type: 'vendor',
    nepalcanId: { $exists: true, $ne: null }
  }).select('nepalcanId business_name service_branches').lean();

  console.log(`[Service Branches] Checking ${vendors.length} vendors...`);
  let updated = 0;

  for (const vendor of vendors) {
    const apiBranches = await fetchVendorServiceBranches(vendor.nepalcanId, authToken);
    if (apiBranches.length === 0) continue;

    const matched = [];
    for (const branch of apiBranches) {
      const branchId = branch._id || branch.id || branch.branchId || branch.nepalcanId;
      const branchName = branch.name || branch.branchName || branch.label;
      if (branchId) {
        const zoneName = branchLookup[branchId];
        matched.push({ branchId: String(branchId), name: zoneName || branchName || String(branchId) });
      }
    }

    if (matched.length > 0) {
      await Lead.findByIdAndUpdate(vendor._id, { service_branches: matched });
      updated++;
      console.log(`[Service Branches] Updated ${vendor.business_name}: ${matched.length} branches`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  const durationMs = Date.now() - startTime;
  console.log(`[Service Branches] Done — ${updated} vendors updated in ${durationMs}ms`);
  return { updated, message: `Updated ${updated} vendors with service branches` };
};

const syncNepalcanVendors = async (token = null, userId = null) => {
  const startTime = Date.now();
  let synced = 0;
  let updated = 0;
  let created = 0;
  let errorMessage = null;

  let authToken = token;
  if (!authToken) {
    try {
      console.log('[Nepalcan Vendor Sync] No token provided, logging in...');
      authToken = await loginToNepalcan();
    } catch (loginErr) {
      errorMessage = 'Failed to login to Nepalcan: ' + (loginErr.message || 'Unknown error');
      console.log(`[Nepalcan Vendor Sync] ${errorMessage}`);
      await NepalcanSyncLog.create({
        type: 'vendors',
        success: false,
        vendorsSynced: 0,
        leadsSynced: 0,
        mergedRecords: 0,
        errorMessage,
        durationMs: Date.now() - startTime
      });
      return { synced: 0, updated: 0, created: 0, message: errorMessage };
    }
  }

  try {
    console.log('[Nepalcan Vendor Sync] Fetching page 1...');
    const firstResponse = await axios.get(
      `${API_BASE}/vendor/super-admin/list`,
      {
        params: { page: 1, limit: 100, type: 'Business' },
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Origin': 'https://commerce.thecanbrand.com',
          'Referer': 'https://commerce.thecanbrand.com/'
        },
        timeout: 30000
      }
    );

    const totalItems = getTotalCount(firstResponse);
    const totalPages = Math.ceil(totalItems / 100);

    console.log(`[Nepalcan Vendor Sync] API Response keys: ${Object.keys(firstResponse.data).join(', ')}`);
    console.log(`[Nepalcan Vendor Sync] Total items reported: ${totalItems}, Calculated pages: ${totalPages}`);

    let allVendors = extractVendors(firstResponse);
    console.log(`[Nepalcan Vendor Sync] Page 1: extracted ${allVendors.length} vendors`);

    for (let page = 2; page <= totalPages && page <= 50; page++) {
      try {
        console.log(`[Nepalcan Vendor Sync] Fetching page ${page}/${totalPages}...`);
        const pageResponse = await axios.get(
          `${API_BASE}/vendor/super-admin/list`,
          {
            params: { page, limit: 100, type: 'Business' },
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              'Origin': 'https://commerce.thecanbrand.com',
              'Referer': 'https://commerce.thecanbrand.com/'
            },
            timeout: 30000
          }
        );
        console.log(`[Nepalcan Vendor Sync] Page ${page} raw response keys: ${Object.keys(pageResponse.data).join(', ')}`);
        const pageVendors = extractVendors(pageResponse);
        allVendors = [...allVendors, ...pageVendors];
        console.log(`[Nepalcan Vendor Sync] Page ${page}: extracted ${pageVendors.length} vendors, total so far: ${allVendors.length}`);
      } catch (pageErr) {
        console.error(`[Nepalcan Vendor Sync] Error fetching page ${page}:`, pageErr.message);
        console.error(`[Nepalcan Vendor Sync] Full error for page ${page}:`, pageErr.response?.status, pageErr.response?.data);
        break;
      }
    }

    console.log(`[Nepalcan Vendor Sync] Total vendors to process: ${allVendors.length}`);

    for (const vendor of allVendors) {
      const { _id, name, email, phone, isVerified, activeMarketplaceProductCount, productCount, activeProductsCount, address, createdAt, updatedAt, canId, slug } = vendor;

      const productCountFromAPI = activeMarketplaceProductCount || productCount || activeProductsCount || 0;
      console.log(`[Sync Vendor] ${name}: activeMarketplaceProductCount=${activeMarketplaceProductCount}, productCount=${productCount}, activeProductsCount=${activeProductsCount}`);

      const leadData = {
        business_name: name,
        contact_person: name,
        email: email || 'TBD',
        phone: phone || 'TBD',
        location: address || 'TBD',
        lead_source: 'Nepalcan',
        expected_product_count: productCountFromAPI,
        nepalcanId: _id,
        type: 'vendor',
        is_verified: isVerified,
        verification_status: isVerified ? 'verified' : 'pending',
        onboarding_stage: isVerified ? 'seller_activated' : 'documents_pending',
        activation_status: isVerified ? 'active' : 'inactive',
        lead_status: isVerified ? 'Activated' : 'Document Pending',
        rawData: {
          canId: canId?.canId,
          slug,
          createdAt,
          updatedAt,
          address
        }
      };

      try {
        const existingLead = await Lead.findOne({ nepalcanId: _id });

        if (existingLead) {
          const previousNepalcanStatus = existingLead.last_nepalcan_status;
          const newNepalcanStatus = leadData.lead_status;

          if (existingLead.lead_status === 'Active Seller' && newNepalcanStatus === 'Activated') {
            existingLead.business_name = leadData.business_name;
            existingLead.contact_person = leadData.contact_person;
            existingLead.email = leadData.email;
            existingLead.phone = leadData.phone;
            existingLead.location = leadData.location;
            existingLead.expected_product_count = leadData.expected_product_count;
            existingLead.is_verified = leadData.is_verified;
            existingLead.verification_status = leadData.verification_status;
            existingLead.onboarding_stage = leadData.onboarding_stage;
            existingLead.activation_status = leadData.activation_status;
            existingLead.last_nepalcan_status = newNepalcanStatus;
            await existingLead.save();
            updated++;
            synced++;
            continue;
          }

          Object.assign(existingLead, leadData);
          existingLead.last_nepalcan_status = newNepalcanStatus;
          if (previousNepalcanStatus && newNepalcanStatus === 'Activated' && previousNepalcanStatus !== 'Activated') {
            if (!existingLead.converted_at) existingLead.converted_at = new Date();
          }
          await existingLead.save();

          if (previousNepalcanStatus && previousNepalcanStatus !== newNepalcanStatus) {
            const Activity = require('../models/Activity');
            const syncUserId = userId || (await getDefaultSyncUser())?._id;
            if (syncUserId) {
              await Activity.create({
                lead_id: existingLead._id,
                user_id: syncUserId,
                activity_type: 'status_change',
                description: `Pipeline changed (sync): ${previousNepalcanStatus} → ${newNepalcanStatus}`,
                status: 'completed'
              });
            }
          }

          updated++;
          synced++;
          console.log(`[Sync Vendor] Updated lead ${name}`);
        } else {
          const creatorId = userId || (await getDefaultSyncUser())?._id;
          const upsertData = {
            ...leadData,
            creator_id: creatorId,
            last_nepalcan_status: leadData.lead_status
          };
          if (upsertData.lead_status === 'Activated') {
            upsertData.converted_at = new Date();
          }

          await Lead.findOneAndUpdate(
            { nepalcanId: _id },
            { $set: upsertData },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          created++;
          synced++;
          console.log(`[Sync Vendor] Upserted lead ${name}`);
        }
      } catch (err) {
        if (err.code === 11000 && err.keyPattern?.nepalcanId) {
          console.warn(`[Sync Vendor] Duplicate nepalcanId for ${name}, retrying with find+update`);
          const existingLead = await Lead.findOne({ nepalcanId: _id });
          if (existingLead) {
            Object.assign(existingLead, leadData);
            existingLead.last_nepalcan_status = leadData.lead_status;
            await existingLead.save();
            updated++;
            synced++;
            console.log(`[Sync Vendor] Retried update for lead ${name}`);
          } else {
            console.error(`[Sync Vendor] Could not resolve duplicate for ${name}`);
          }
        } else {
          throw err;
        }
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[Nepalcan Vendor Sync] COMPLETE - Total: ${synced}, Updated: ${updated}, Created: ${created}`);

    console.log('[Nepalcan Vendor Sync] Syncing service branches...');
    const branchesResult = await syncServiceBranches(authToken);
    console.log(`[Nepalcan Vendor Sync] Service branches sync complete: ${branchesResult.updated} vendors updated`);

    const NepalcanOrder = require('../models/NepalcanOrder');
    const deliveredOrdersAgg = await NepalcanOrder.aggregate([
      { $match: { orderStatus: 'Delivered', vendor_lead_id: { $ne: null } } },
      { $group: {
        _id: '$vendor_lead_id',
        deliveredCount: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        lastOrderDate: { $max: '$updatedAt' }
      } }
    ]);

    for (const vendorData of deliveredOrdersAgg) {
      const { _id: vendorLeadId, deliveredCount, totalAmount, lastOrderDate } = vendorData;
      if (!vendorLeadId) continue;
      const leadToUpdate = await Lead.findById(vendorLeadId);
      if (leadToUpdate) {
        const previousNepalcanStatus = leadToUpdate.last_nepalcan_status;
        leadToUpdate.delivered_order_count = deliveredCount;
        leadToUpdate.active_seller = deliveredCount > 0;
        leadToUpdate.last_order_date = lastOrderDate;
        leadToUpdate.total_revenue = totalAmount;
        leadToUpdate.lead_status = 'Active Seller';
        leadToUpdate.last_nepalcan_status = 'Active Seller';
        if (!leadToUpdate.converted_at) leadToUpdate.converted_at = new Date();
        await leadToUpdate.save();
        if (previousNepalcanStatus && previousNepalcanStatus !== 'Active Seller') {
          const Activity = require('../models/Activity');
          const syncUserId = userId || (await getDefaultSyncUser())?._id;
          if (syncUserId) {
            await Activity.create({
              lead_id: leadToUpdate._id,
              user_id: syncUserId,
              activity_type: 'status_change',
              description: `Pipeline changed (sync): ${previousNepalcanStatus} → Active Seller`,
              status: 'completed'
            });
          }
        }
      }
    }

    const ordersToFix = await NepalcanOrder.find({
      orderStatus: 'Delivered',
      vendor_lead_id: null,
      vendor: { $exists: true, $ne: null }
    });

    if (ordersToFix.length > 0) {
      console.log(`[Nepalcan Vendor Sync] Fixing ${ordersToFix.length} orders with missing vendor_lead_id`);
      for (const order of ordersToFix) {
        const vendorLead = await Lead.findOne({
          $or: [
            { business_name: { $regex: order.vendor, $options: 'i' } },
            { nepalcanId: order.vendor }
          ]
        });
        if (vendorLead) {
          order.vendor_lead_id = vendorLead._id;
          await order.save();
          console.log(`[Nepalcan Vendor Sync] Fixed order ${order.orderId} -> ${vendorLead.business_name}`);
        }
      }
    }

    await NepalcanSyncLog.create({
      type: 'vendors',
      success: !errorMessage,
      vendorsSynced: synced,
      leadsSynced: created,
      mergedRecords: updated,
      totalProcessed: allVendors.length,
      errorMessage,
      durationMs
    });

    return { synced, updated, created, message: errorMessage || 'Success' };
  } catch (error) {
    errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    console.error('[Nepalcan Vendor Sync] Error:', errorMessage);

    const durationMs = Date.now() - startTime;
    await NepalcanSyncLog.create({
      type: 'vendors',
      success: false,
      vendorsSynced: synced,
      leadsSynced: created,
      mergedRecords: updated,
      errorMessage,
      durationMs
    });

    return { synced, updated, created, message: errorMessage };
  }
};

module.exports = {
  syncNepalcanVendors,
  syncServiceBranches,
  fetchVendorServiceBranches,
  extractVendors,
  getTotalCount
};