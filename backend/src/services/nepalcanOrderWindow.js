// Order sync window controls:
//   ORDER_CREATED_FETCH_DAYS — how far back (by createdAt) to ask the API for orders.
//     Wide enough to catch any order still in flight. Default 60 days.
//   ORDER_TERMINAL_GRACE_DAYS — how many days after a terminal status (Delivered /
//     Cancelled / Returned) we still re-sync the order. After this grace period the
//     order is considered frozen and skipped. Default 10 days.
const TIME_ZONE = 'Asia/Kathmandu';
const DEFAULT_FETCH_DAYS = 60;
const DEFAULT_TERMINAL_GRACE_DAYS = 10;

const ORDER_CREATED_FETCH_DAYS = Math.max(
  1,
  Number.parseInt(process.env.NEPALCAN_ORDER_FETCH_DAYS || DEFAULT_FETCH_DAYS, 10) || DEFAULT_FETCH_DAYS
);

const ORDER_TERMINAL_GRACE_DAYS = Math.max(
  0,
  Number.parseInt(process.env.NEPALCAN_ORDER_TERMINAL_GRACE_DAYS || DEFAULT_TERMINAL_GRACE_DAYS, 10) || DEFAULT_TERMINAL_GRACE_DAYS
);

// Keep the old export name so nothing else breaks
const ORDER_STATUS_SYNC_DAYS = ORDER_CREATED_FETCH_DAYS;

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
  const fromDate = shiftYmd(toDate, -ORDER_CREATED_FETCH_DAYS);
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

// Returns true if an existing DB order should be skipped because it reached a
// terminal status and the grace period has passed. The grace period lets us
// re-sync recently-delivered/cancelled/returned orders in case of late
// tracking updates, then freeze them so we don't keep touching old records.
const TERMINAL_STATUSES = new Set(['Delivered', 'Cancelled', 'Returned']);
const isOrderFrozen = (existingOrder) => {
  if (!existingOrder) return false;
  if (!TERMINAL_STATUSES.has(existingOrder.orderStatus)) return false;
  if (ORDER_TERMINAL_GRACE_DAYS <= 0) return false;

  // Pick the most relevant terminal date field
  const terminalDate =
    existingOrder.deliveredAt ||
    existingOrder.cancelledAt ||
    existingOrder.returnedAt;

  if (!terminalDate) return false; // no date yet — don't freeze, might still get tracking update

  const graceCutoff = new Date(Date.now() - ORDER_TERMINAL_GRACE_DAYS * 24 * 60 * 60 * 1000);
  return new Date(terminalDate) < graceCutoff;
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

const isLastOrderPage = ({ page, limit, count, total }) => {
  // A short page is always the last page — this is the most reliable signal.
  if (count < limit) return true;
  // The Commerce API totalItems is the ALL-TIME vendor count, not the
  // date-filtered window count. Only use it as a stop signal when it is
  // smaller than what page math would predict (i.e. it genuinely bounds the
  // result set). If totalItems > page * limit we cannot trust it.
  if (total > 0 && total <= page * limit) return true;
  return false;
};

const normalizeOrderRecord = (record) => {
  if (!record || typeof record !== 'object') return record;
  const order = { ...record };
  order.orderId = order.orderId || order._id || order.id || order.orderNumber;
  order._id = order._id || order.id || order.orderId;
  order.orderStatus = order.orderStatus || order.status;
  if (typeof order.orderStatus === 'string') {
    const statusMap = { pending: 'Pending', hold: 'Hold', processing: 'Processing', confirmed: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', canceled: 'Cancelled', returned: 'Returned' };
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
  ORDER_CREATED_FETCH_DAYS,
  ORDER_TERMINAL_GRACE_DAYS,
  ORDERS_API_URL,
  buildOrderRequestParams,
  getOrderSyncWindow,
  isLastOrderPage,
  isOrderFrozen,
  normalizeOrderRecord,
  parseOrderResponse,
  shiftYmd,
  toYmd
};
