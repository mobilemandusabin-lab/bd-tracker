const axios = require('axios');
const User = require('../models/User');

const API_BASE = 'https://commerce.thecanbrand.com/api';
const NEPA_CAN_EMAIL = process.env.NEPA_CAN_EMAIL || 'sabin.awal@buy.nepalcan.com';
const NEPA_CAN_PASSWORD = process.env.NEPA_CAN_PASSWORD || '1';

let defaultSyncUser = null;

const getDefaultSyncUser = async () => {
  if (defaultSyncUser) return defaultSyncUser;
  try {
    defaultSyncUser = await User.findOne({ role: 'super_admin' }).select('_id');
    return defaultSyncUser;
  } catch (err) {
    console.error('[Sync] Could not find default user:', err.message);
    return null;
  }
};

const loginToNepalcan = async () => {
  try {
    console.log('[Nepalcan Login] Attempting login with email:', NEPA_CAN_EMAIL);
    const response = await axios.post(
      `${API_BASE}/users/login`,
      { email: NEPA_CAN_EMAIL, password: NEPA_CAN_PASSWORD },
      {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://commerce.thecanbrand.com',
          'Referer': 'https://commerce.thecanbrand.com/',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        },
        timeout: 30000
      }
    );
    console.log('[Nepalcan Login] Response status:', response.status);
    if (response.data?.token) {
      console.log('[Nepalcan Login] Success - token received');
      return response.data.token;
    }
    throw new Error('No token received from Nepalcan login');
  } catch (error) {
    const errMsg = error.response?.data?.message || error.message || 'Unknown error';
    console.error('[Nepalcan Login] Error:', errMsg);
    console.error('[Nepalcan Login] Full error:', error.response?.data || error.stack);
    throw error;
  }
};

module.exports = { loginToNepalcan, getDefaultSyncUser };