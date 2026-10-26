const axios = require('axios');
const NepalcanOrder = require('../models/NepalcanOrder');
const { loginToNepalcan } = require('./nepalcanAuthService');

const API_BASE = 'https://commerce.thecanbrand.com/api';

const authHeaders = (token) => ({
  'Content-Type': 'application/json',
  'Origin': 'https://commerce.thecanbrand.com',
  'Referer': 'https://commerce.thecanbrand.com/',
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  ...(token ? { Authorization: `Bearer ${token}` } : {})
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ponytail: only customerProfile.phone is encoded; validate decoded value so plain numbers pass through
const decodePhone = (value) => {
  if (typeof value !== 'string' || !value) return value;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) return value;
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8').trim();
    return /^\+?\d[\d\s()-]{5,}$/.test(decoded) ? decoded : value;
  } catch {
    return value;
  }
};

const urlOnly = (images) => (Array.isArray(images) ? images : [])
  .map((image) => {
    if (typeof image === 'string') return { url: image };
    if (image?.url) return { url: image.url };
    return null;
  })
  .filter(Boolean);

const normalizeItem = (item) => {
  if (!item || typeof item !== 'object') return item;
  const product = item.product;
  if (product && typeof product === 'object') {
    if (product.productName === 'Unknown Product' && !urlOnly(product.productImages).length) return null;
    if (!Object.keys(product).length && !item.quantity && !item.price) return null;
    return {
      ...item,
      product: {
        ...product,
        productImages: urlOnly(product.productImages)
      }
    };
  }
  if (!product && !item.productName && !item.name && !item.quantity && !item.price && !item.images?.length) {
    return null;
  }
  return {
    ...item,
    product: {
      productName: typeof product === 'string' ? product : item.productName || item.name,
      productImages: urlOnly(item.images)
    }
  };
};

const normalizeItems = (items) => (
  Array.isArray(items) ? items.map(normalizeItem).filter(Boolean) : []
);

const normalizeOrderDetail = (raw) => {
  if (!raw || typeof raw !== 'object') return raw;

  const detail = { ...raw };
  detail.items = normalizeItems(detail.items);

  if (detail.customerProfile && typeof detail.customerProfile === 'object') {
    detail.customerProfile = {
      ...detail.customerProfile,
      phone: decodePhone(detail.customerProfile.phone)
    };
  }

  if (Array.isArray(detail.notes)) {
    detail.notes = detail.notes.map((note) => (
      note && typeof note === 'object'
        ? { ...note, attachments: urlOnly(note.attachments) }
        : note
    ));
  }
  detail.podAttachments = urlOnly(detail.podAttachments);

  const originBranch = raw.originBranch;
  const destinationBranch = raw.destinationBranch;
  detail.originBranch = originBranch?._id || originBranch || null;
  detail.destinationBranch = destinationBranch?._id || destinationBranch || null;
  detail.originBranchName = originBranch?.name || null;
  detail.destinationBranchName = destinationBranch?.name || null;

  return detail;
};

const fetchOrderDetail = async (nepalcanId) => {
  if (!nepalcanId) throw new Error('nepalcanId is required');

  let token = await loginToNepalcan();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await axios.get(
        `${API_BASE}/marketplace-orders/${encodeURIComponent(nepalcanId)}`,
        { headers: authHeaders(token), timeout: 15000 }
      );
      if (!response.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
        throw new Error('Invalid Commerce order detail response');
      }
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      if (status === 401 && attempt === 0) {
        token = await loginToNepalcan(true);
        continue;
      }
      if (status === 404) {
        error.nonRetryable = true;
        throw error;
      }
      const transient = status === 429 || status >= 500 ||
        error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
      if (!transient || attempt === 2) throw error;
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
};

const saveOrderDetail = async (orderId, detail) => {
  await NepalcanOrder.updateOne(
    { _id: orderId },
    { $set: { detailData: detail, detailFetchedAt: new Date() } }
  );
};

const fetchAndSaveOrderDetail = async (order) => {
  const raw = await fetchOrderDetail(order.nepalcanId);
  const detail = normalizeOrderDetail(raw);
  await saveOrderDetail(order._id, detail);
  return detail;
};

module.exports = {
  decodePhone,
  fetchAndSaveOrderDetail,
  fetchOrderDetail,
  normalizeItems,
  normalizeOrderDetail,
  saveOrderDetail
};
