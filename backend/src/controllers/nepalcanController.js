const axios = require('axios');
const Lead = require('../models/Lead');
const NepalcanSyncLog = require('../models/NepalcanSyncLog');

const NEPLCCAN_API_BASE = 'https://commerce.thecanbrand.com/api';

// Login to Nepalcan.com and get token
exports.loginToNepalcan = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email and password are required'
      });
    }

    const loginRes = await axios.post(`${NEPLCCAN_API_BASE}/users/login`, 
      { email, password },
      {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://commerce.thecanbrand.com',
          'Referer': 'https://commerce.thecanbrand.com/',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        }
      }
    );

    if (!loginRes.data || !loginRes.data.token) {
      return res.status(401).json({
        status: 'fail',
        message: 'Failed to get token from Nepalcan',
        details: loginRes.data
      });
    }

    const token = loginRes.data.token;
    
    res.status(200).json({
      status: 'success',
      data: { token }
    });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      status: 'fail',
      message: err.response?.data?.message || 'Failed to login to Nepalcan',
      error: err.message,
      details: err.response?.data
    });
  }
};

// Get active vendor orders from Nepalcan
exports.getNepalcanSales = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        status: 'fail',
        message: 'Token is required'
      });
    }

    const response = await axios.get(
      `${NEPLCCAN_API_BASE}/vendor/orders/super-admin/list`,
      {
        params: {
          tab: 'marketplace',
          page: req.query.page || 1,
          limit: req.query.limit || 10,
          unattendedOrders: req.query.unattendedOrders || '',
          status: 'Active'
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Origin': 'https://commerce.thecanbrand.com',
          'Referer': 'https://commerce.thecanbrand.com/',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        }
      }
    );

    res.status(200).json({
      status: 'success',
      data: response.data
    });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      status: 'fail',
      message: err.response?.data?.message || 'Failed to fetch Nepalcan sales data',
      error: err.message,
      details: err.response?.data
    });
  }
};

// Fetch and sync vendors from Nepalcan
exports.syncVendorsFromNepalcan = async (req, res) => {
  try {
     const { syncNepalcanVendors } = require('../services/nepalcanSyncService');
     
     console.log('[Sync Vendors] Starting sync...');
     const result = await syncNepalcanVendors(null, req.user?._id);
     console.log('[Sync Vendors] Result:', result);
     
     res.status(200).json({
       status: 'success',
       message: result.message || 'Sync completed',
       data: {
         total: result.syncedVendors + result.syncedLeads,
         vendorsSynced: result.syncedVendors,
         leadsSynced: result.syncedLeads,
         created: result.syncedLeads,
         updated: result.syncedVendors
       }
     });
   } catch (err) {
     console.error('[Sync Vendors] Error:', err);
     res.status(err.response?.status || 500).json({
       status: 'fail',
       message: err.response?.data?.message || err.message || 'Failed to sync vendors from Nepalcan',
       error: err.message,
       details: err.response?.data
     });
   }
};

// Get sync logs for vendors
exports.getVendorSyncLogs = async (req, res) => {
  try {
    const logs = await NepalcanSyncLog.find({ type: 'vendors' })
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({
      status: 'success',
      data: { logs }
    });
  } catch (err) {
    res.status(500).json({
      status: 'fail',
      message: 'Failed to fetch sync logs',
      error: err.message
    });
  }
};

// Sync vendors manually with progress tracking
exports.syncVendorsManual = async (req, res) => {
  try {
    const { syncNepalcanVendors } = require('../services/nepalcanSyncService');

    console.log('[Manual Sync] Starting vendor sync...');
    const result = await syncNepalcanVendors(null, req.user?._id);
    console.log('[Manual Sync] Result:', result);

    res.status(200).json({
      status: 'success',
      message: result.message || 'Sync completed',
      data: {
        total: result.synced,
        created: result.created,
        updated: result.updated
      }
    });
  } catch (err) {
    console.error('[Manual Sync] Error:', err);
    res.status(err.response?.status || 500).json({
      status: 'fail',
      message: err.response?.data?.message || err.message || 'Failed to sync vendors',
      error: err.message
    });
  }
};

// Fetch vendors directly from Nepalcan API (requires token in body)
exports.fetchVendorsFromNepalcan = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        status: 'fail',
        message: 'Token is required'
      });
    }

    const response = await axios.get(
      `${NEPLCCAN_API_BASE}/vendor/super-admin/list`,
      {
        params: {
          page: 1,
          limit: 100,
          type: 'Business'
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Origin': 'https://commerce.thecanbrand.com',
          'Referer': 'https://commerce.thecanbrand.com/',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        }
      }
    );

    const vendors = response.data.vendors || response.data || [];

    res.status(200).json({
      status: 'success',
      data: {
        vendors,
        count: vendors.length
      }
    });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      status: 'fail',
      message: err.response?.data?.message || 'Failed to fetch vendors from Nepalcan',
      error: err.message,
      details: err.response?.data
    });
  }
};
