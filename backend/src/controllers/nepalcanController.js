const axios = require('axios');

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
