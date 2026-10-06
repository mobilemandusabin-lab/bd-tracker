const assert = require('assert');
const {
  ORDERS_API_URL,
  buildOrderRequestParams,
  isLastOrderPage,
  parseOrderResponse
} = require('../backend/src/services/nepalcanOrderWindow');
const NepalcanOrder = require('../backend/src/models/NepalcanOrder');
const { buildOrderUpdate } = require('../backend/src/services/nepalcanOrderSyncService');

assert.strictEqual(
  ORDERS_API_URL,
  'https://commerce.thecanbrand.com/api/vendor/orders/super-admin/list',
  'default endpoint must be the verified JSON orders API'
);

const params = buildOrderRequestParams(2, 50, new Date('2026-10-06T01:00:00.000Z'));
assert.deepStrictEqual(params, {
  tab: 'marketplace',
  page: 2,
  limit: 50,
  unattendedOrders: '',
  status: 'Active',
  fromDate: '2026-09-17',
  toDate: '2026-10-06'
});
assert.strictEqual(Object.hasOwn(params, 'perPage'), false, 'perPage is ignored by the live API');

const valid = parseOrderResponse({
  headers: { 'content-type': 'application/json; charset=utf-8' },
  data: {
    data: [{
      _id: 'mongo-id',
      orderId: 'ORDER-1',
      customer: 'Customer',
      orderStatus: 'pending',
      totalAmount: 100,
      createdAt: '2026-10-06T01:00:00.000Z'
    }],
    totalItems: 349
  }
});
assert.strictEqual(valid.total, 349);
assert.strictEqual(valid.orders.length, 1);
assert.strictEqual(valid.orders[0].orderStatus, 'Pending');

assert.throws(
  () => parseOrderResponse({ headers: { 'content-type': 'text/html; charset=utf-8' }, data: '<html></html>' }),
  (error) => error.code === 'NEPALCAN_ORDER_RESPONSE_INVALID' && error.nonRetryable === true,
  'HTTP 200 HTML must fail instead of looking like an empty page'
);
assert.throws(
  () => parseOrderResponse({ headers: { 'content-type': 'application/json' }, data: { items: [], totalItems: 0 } }),
  (error) => error.code === 'NEPALCAN_ORDER_RESPONSE_INVALID',
  'unexpected JSON shapes must fail loudly'
);

assert.strictEqual(isLastOrderPage({ page: 6, limit: 50, count: 50, total: 349 }), false);
assert.strictEqual(isLastOrderPage({ page: 7, limit: 50, count: 49, total: 349 }), true);

const firstUpsert = buildOrderUpdate(valid.orders[0], null, null);
const repeatedUpsert = buildOrderUpdate(valid.orders[0], null, null);
assert.deepStrictEqual(firstUpsert.filter, { orderId: 'ORDER-1' });
assert.deepStrictEqual(repeatedUpsert.filter, firstUpsert.filter);
assert.strictEqual(firstUpsert.isNew, true);
assert.strictEqual(NepalcanOrder.schema.path('orderId').options.unique, true, 'orderId must remain unique');

console.log('ORDER_SYNC_CONTRACT_OK — endpoint, schema, pagination, rejection, and idempotence checks passed');
