// Order status sync is intentionally limited to recent orders.  Older orders
// remain available for reporting, but their current status is not rewritten by
// routine syncs because Commerce does not change them after this window.
const TIME_ZONE = 'Asia/Kathmandu';
const DEFAULT_STATUS_SYNC_DAYS = 19;
const ORDER_STATUS_SYNC_DAYS = Math.max(
  1,
  Number.parseInt(process.env.NEPALCAN_ORDER_STATUS_SYNC_DAYS || DEFAULT_STATUS_SYNC_DAYS, 10) || DEFAULT_STATUS_SYNC_DAYS
);

const toYmd = (date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(date);

const shiftYmd = (ymd, days) => {
  const [year, month, day] = String(ymd).split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
};

const getOrderSyncWindow = (now = new Date()) => {
  const toDate = toYmd(now);
  // Include orders exactly 19 days old; anything older is deliberately left
  // untouched by the order-status sync.
  const fromDate = shiftYmd(toDate, -ORDER_STATUS_SYNC_DAYS);
  return {
    fromDate,
    toDate,
    from: new Date(`${fromDate}T00:00:00+05:45`),
    to: new Date(`${toDate}T23:59:59.999+05:45`)
  };
};

const buildOrderRequestParams = (page = 1, limit = 50, now = new Date()) => {
  const { fromDate, toDate } = getOrderSyncWindow(now);
  return {
    tab: 'marketplace',
    page,
    limit,
    unattendedOrders: '',
    status: 'Active',
    fromDate,
    toDate
  };
};

const invalidOrderResponse = (message) => {
  const error = new Error(`Invalid Nepalcan orders response: ${message}`);
  error.code = 'NEPALCAN_ORDER_RESPONSE_INVALID';
  error.nonRetryable = true;
  return error;
};

const getContentType = (headers = {}) => {
  if (typeof headers.get === 'function') return String(headers.get('content-type') || '');
  return String(headers['content-type'] || headers['Content-Type'] || '');
};

// The live Commerce contract is { data: Order[], totalItems: number }.
// Validate it explicitly because an invalid API path returns the frontend HTML
// shell with HTTP 200, which must never be mistaken for an empty order page.
const parseOrderResponse = (response) => {
  const contentType = getContentType(response?.headers).toLowerCase();
  if (!contentType.includes('application/json')) {
    throw invalidOrderResponse(`expected application/json but received ${contentType || 'no content type'}`);
  }

  const payload = response?.data;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw invalidOrderResponse('expected a JSON object');
  }
  if (!Array.isArray(payload.data)) {
    throw invalidOrderResponse('expected data to be an array');
  }

  const total = Number(payload.totalItems);
  if (!Number.isFinite(total) || total < 0) {
    throw invalidOrderResponse('expected totalItems to be a non-negative number');
  }

  return {
    orders: payload.data.map(normalizeOrderRecord),
    total
  };
};

const isLastOrderPage = ({ page, limit, count, total }) =>
  count < limit || (total > 0 && page * limit >= total);

const normalizeOrderRecord = (record) => {
  if (!record || typeof record !== 'object') return record;
  const order = { ...record };
  order.orderId = order.orderId || order._id || order.id || order.orderNumber;
  order._id = order._id || order.id || order.orderId;
  order.orderStatus = order.orderStatus || order.status;
  if (typeof order.orderStatus === 'string') {
    const statusMap = { pending: 'Pending', hold: 'Hold', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', canceled: 'Cancelled', returned: 'Returned' };
    order.orderStatus = statusMap[order.orderStatus.trim().toLowerCase()] || order.orderStatus;
  }
  order.createdAt = order.createdAt || order.created_at || order.orderDate || order.order_date;
  order.updatedAt = order.updatedAt || order.updated_at || order.lastUpdatedAt;
  order.customer = order.customer || order.customerName || order.buyer?.name || order.buyer?.fullName;
  order.vendor = order.vendor || order.vendorName || order.seller?.name || order.seller?.business_name;
  if (order.totalAmount === undefined) {
    order.totalAmount = order.total ?? order.grandTotal ?? order.amount ?? order.total_price;
  }
  if (order.shippingAmount === undefined) {
    order.shippingAmount = order.shipping ?? order.deliveryCharge ?? order.delivery_charge ?? 0;
  }
  return order;
};

const ORDERS_API_URL = process.env.NEPA_CAN_ORDERS_API_URL
  || 'https://commerce.thecanbrand.com/api/vendor/orders/super-admin/list';

module.exports = {
  ORDER_STATUS_SYNC_DAYS,
  ORDERS_API_URL,
  buildOrderRequestParams,
  getOrderSyncWindow,
  isLastOrderPage,
  normalizeOrderRecord,
  parseOrderResponse,
  shiftYmd,
  toYmd
};
