const EXTENSION_RAW_DAYS = 30;
const ACTIVITY_RAW_DAYS = 30;
const ORDER_PAYLOAD_DAYS = 30;
const LOG_RETENTION_DAYS = 30;
const NOTIFICATION_RETENTION_DAYS = 30;
const CHAT_RETENTION_DAYS = 30;
const AUDIT_RETENTION_DAYS = 90;

const utcStartOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const daysAgo = (days, now = new Date()) => {
  const d = utcStartOfDay(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
};

const dateKey = (date) => new Date(date).toISOString().slice(0, 10);

module.exports = {
  EXTENSION_RAW_DAYS,
  ACTIVITY_RAW_DAYS,
  ORDER_PAYLOAD_DAYS,
  LOG_RETENTION_DAYS,
  NOTIFICATION_RETENTION_DAYS,
  CHAT_RETENTION_DAYS,
  AUDIT_RETENTION_DAYS,
  utcStartOfDay,
  daysAgo,
  dateKey
};
