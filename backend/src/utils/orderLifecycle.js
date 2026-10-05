const STATUS_FIELD = {
  Processing: 'processingAt',
  Shipped: 'shippedAt',
  Delivered: 'deliveredAt',
  Cancelled: 'cancelledAt',
  Returned: 'returnedAt'
};

const TRACKING_PROCESS_STATUS = {
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  'delivery failed': 'Delivered',
  returned: 'Returned',
  'return processing': 'Returned',
  'return delivered': 'Returned',
  'return in progress': 'Returned',
  'return dispatched': 'Returned',
  'return initiated': 'Delivered',
  'return declined': 'Delivered'
};

const validDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const eventKey = (event) => `${event.status}|${validDate(event.timestamp)?.toISOString() || ''}`;

const normalizeStatusHistory = (history = []) => {
  const seen = new Set();
  return history
    .map(event => ({
      status: event.status,
      timestamp: validDate(event.timestamp),
      source: event.source || 'legacy',
      accuracy: event.accuracy || 'estimated'
    }))
    .filter(event => event.status && event.timestamp)
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter(event => {
      const key = eventKey(event);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    // Repeated adjacent statuses are duplicate observations, not transitions.
    .filter((event, index, events) => index === 0 || events[index - 1].status !== event.status);
};

const mergeStatusHistory = (...histories) => normalizeStatusHistory(histories.flat().filter(Boolean));

const trackingEvents = (trackingData) => {
  const processes = trackingData?.marketplaceProcesses;
  const events = Array.isArray(processes) ? processes.map(proc => {
    const status = TRACKING_PROCESS_STATUS[String(proc.process || '').trim().toLowerCase()];
    const timestamp = validDate(proc.createdAt);
    return status && timestamp
      ? { status, timestamp, source: 'logistics_api', accuracy: 'exact' }
      : null;
  }).filter(Boolean) : [];

  // The Commerce tracking API currently returns an empty marketplaceProcesses
  // array for many orders and puts the real timeline in processHistory.
  const history = Array.isArray(trackingData?.processHistory) ? trackingData.processHistory : [];
  const labelStatus = (label) => {
    const value = String(label || '').trim().toLowerCase();
    if (!value) return null;
    if (value.includes('delivery completed') || value.includes('delivered')) return 'Delivered';
    if (value.includes('return') || value.includes('rto')) return 'Returned';
    if (value.includes('cancel')) return 'Cancelled';
    if (value.includes('shipment dispatched') || value.includes('shipment arrived') || value.includes('sent for delivery') || value.includes('shipped')) return 'Shipped';
    if (value.includes('order dispatched') || value.includes('dropoff collected') || value.includes('pickup completed') || value.includes('processing')) return 'Processing';
    if (value.includes('order created') || value.includes('pending')) return 'Pending';
    return null;
  };
  history.forEach(item => {
    const status = labelStatus(item.label || item.status || item.process);
    const timestamp = validDate(item.date || item.timestamp || item.createdAt);
    // deliveryDate is the provider's explicit completion date; avoid adding a
    // second, less authoritative Delivery Completed history event.
    if (status && status !== 'Delivered' && timestamp) events.push({ status, timestamp, source: 'logistics_api', accuracy: 'exact' });
  });

  const directDates = [
    ['Delivered', trackingData?.deliveryDate],
    ['Returned', trackingData?.returnProgress?.deliveredAt || trackingData?.rtoProcessedAt]
  ];
  directDates.forEach(([status, value]) => {
    const timestamp = validDate(value);
    if (timestamp) events.push({ status, timestamp, source: 'logistics_api', accuracy: 'exact' });
  });
  return events;
};

const statusEvent = (order, status) => {
  const field = STATUS_FIELD[status];
  const explicit = field ? validDate(order?.[field]) : null;
  const normalized = normalizeStatusHistory(order?.statusHistory || []);
  const historyEvent = normalized.find(event => event.status === status);
  const trackingEvent = trackingEvents(order?.trackingData)
    .filter(event => event.status === status)
    .sort((a, b) => a.timestamp - b.timestamp)[0];
  const at = trackingEvent?.timestamp || explicit || historyEvent?.timestamp || null;
  if (!at) return { at: null, source: 'missing', accuracy: 'unknown' };

  if (trackingEvent) return { at, source: trackingEvent.source, accuracy: trackingEvent.accuracy };

  return {
    at,
    source: historyEvent?.source || 'legacy',
    accuracy: historyEvent?.accuracy || 'estimated'
  };
};

const lifecycleFields = (order) => {
  const processing = statusEvent(order, 'Processing');
  const shipped = statusEvent(order, 'Shipped');
  const delivered = statusEvent(order, 'Delivered');
  const cancelled = statusEvent(order, 'Cancelled');
  const returned = statusEvent(order, 'Returned');
  return {
    processingAt: processing.at,
    shippedAt: shipped.at,
    deliveredAt: delivered.at,
    cancelledAt: cancelled.at,
    returnedAt: returned.at,
    dateQuality: { processing, shipped, delivered, cancelled, returned }
  };
};

// Return the last known lifecycle status at a cutoff date. This is intentionally
// timeline-based: an order delivered after the cutoff remains Processing or
// Shipped at the cutoff if that is the last recorded state, rather than being
// counted as Delivered merely because its current status is Delivered.
const statusAt = (order, cutoff) => {
  const end = validDate(cutoff);
  if (!end) return null;
  const dates = lifecycleFields(order);
  const events = [
    ...(Array.isArray(order?.statusHistory) ? order.statusHistory : []),
    ...(order?.createdAt ? [{ status: 'Pending', timestamp: order.createdAt, source: 'created_at', accuracy: 'exact' }] : []),
    ...[
      ['Processing', dates.processingAt],
      ['Shipped', dates.shippedAt],
      ['Delivered', dates.deliveredAt],
      ['Cancelled', dates.cancelledAt],
      ['Returned', dates.returnedAt]
    ].filter(([, timestamp]) => timestamp).map(([status, timestamp]) => ({ status, timestamp }))
  ];
  const timeline = normalizeStatusHistory(events).filter(event => event.timestamp <= end);
  return timeline.length ? timeline[timeline.length - 1] : null;
};

// Mongo expression: prefer the indexed lifecycle field, then fall back to the
// earliest matching legacy history entry while old rows are being backfilled.
const statusDateExpression = (status) => {
  const field = STATUS_FIELD[status];
  if (!field) throw new Error(`No lifecycle field for status ${status}`);
  return {
    $ifNull: [
      `$${field}`,
      {
        $min: {
          $map: {
            input: {
              $filter: {
                input: { $ifNull: ['$statusHistory', []] },
                as: 'event',
                cond: { $eq: ['$$event.status', status] }
              }
            },
            as: 'event',
            in: '$$event.timestamp'
          }
        }
      }
    ]
  };
};

const statusDateField = (status) => STATUS_FIELD[status];

module.exports = {
  lifecycleFields,
  mergeStatusHistory,
  normalizeStatusHistory,
  statusDateExpression,
  statusDateField,
  statusEvent,
  statusAt,
  trackingEvents,
  validDate
};
