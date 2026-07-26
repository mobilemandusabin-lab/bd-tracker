const axios = require('axios');
const { loginToNepalcan } = require('./nepalcanAuthService');

const API_BASE = 'https://commerce.thecanbrand.com/api';

const fetchTotalMarketplaceProducts = async (token = null) => {
  let authToken = token;
  if (!authToken) {
    authToken = await loginToNepalcan();
  }
  const response = await axios.get(
    `${API_BASE}/vendor/products/super-admin/list`,
    {
      params: {
        status: 'Active',
        keywords: '',
        page: 1,
        limit: 10,
        marketplaceProduct: true,
        qcStatus: 'all'
      },
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Origin': 'https://commerce.thecanbrand.com',
        'Referer': 'https://commerce.thecanbrand.com/',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
      },
      timeout: 30000
    }
  );
  const totalItems = response.data?.totalItems || response.data?.data?.totalItems || 0;
  return totalItems;
};

module.exports = { fetchTotalMarketplaceProducts };