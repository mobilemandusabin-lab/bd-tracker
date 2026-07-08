import NepaliDate from 'nepali-date-converter';

const NEPAL_MONTH_NAMES = [
  'Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra',
  'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

/**
 * Convert an AD date string to a formatted Nepali date
 * @param {string|Date} date - AD date string or Date object
 * @returns {string} e.g. "3 Jestha 2083"
 */
export function formatNepaliDate(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const nd = new NepaliDate(d);
  return nd.format('D MMMM YYYY');
}

/**
 * Convert an AD date string to long format showing both BS and AD
 * @param {string|Date} date
 * @returns {string} e.g. "Jestha 3, 2083 (May 17, 2026)"
 */
export function formatNepaliDateLong(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const nd = new NepaliDate(d);
  const bsStr = `${NEPAL_MONTH_NAMES[nd.getMonth()]} ${nd.getDate()}, ${nd.getYear()}`;
  const adStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  return `${bsStr} (${adStr})`;
}

/**
 * Get Nepali month name from 0-indexed month number
 * @param {number} month - 0-indexed (0=Baisakh)
 * @returns {string}
 */
export function getNepaliMonthName(month) {
  return NEPAL_MONTH_NAMES[month] || '';
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kathmandu', hour12: true
  }) + ' NPT';
}

export { NEPAL_MONTH_NAMES };
