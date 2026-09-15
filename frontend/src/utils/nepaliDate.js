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
  const nd = new NepaliDate(toNptWall(d));
  return nd.format('D MMMM YYYY');
}

/**
 * Convert an AD date string to long BS format (BS only, no AD)
 * @param {string|Date} date
 * @returns {string} e.g. "Jestha 3, 2083"
 */
export function formatNepaliDateLong(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const nd = new NepaliDate(toNptWall(d));
  return `${NEPAL_MONTH_NAMES[nd.getMonth()]} ${nd.getDate()}, ${nd.getYear()}`;
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

const NEPALI_WEEKDAYS = [
  'आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार'
];

// ponytail: shift any instant to NPT wall-clock so BS conversion is viewer-tz independent
function toNptWall(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' }));
}

function bsParts(date) {
  const nd = new NepaliDate(toNptWall(date));
  return { day: nd.getDate(), month: NEPAL_MONTH_NAMES[nd.getMonth()], year: nd.getYear() };
}

/** Compact BS label for chart axes: e.g. "3 Jes" */
export function formatNepaliDateShort(date) {
  const { day, month } = bsParts(date);
  return `${day} ${month.slice(0, 3)}`;
}

/** BS date + NPT time: e.g. "3 Jestha 2083, 2:15 PM NPT" */
export function formatNepaliDateTime(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${formatNepaliDate(d)}, ${formatTime(d)}`;
}

/** Nepali weekday: e.g. "शुक्रबार" (weekday is calendar-independent) */
export function formatNepaliWeekday(date) {
  return NEPALI_WEEKDAYS[toNptWall(date).getDay()] || '';
}

/** BS month label for an AD month bucket: e.g. {year:2026, month:9} -> "Ashwin 2083" (mid-month) */
export function formatNepaliMonthYear(adYear, adMonth1) {
  const { month, year } = bsParts(new Date(adYear, adMonth1 - 1, 15));
  return `${month} ${year}`;
}

/** BS label for a YYYY-MM-DD picker value: e.g. "2026-09-15" -> "30 Ashwin 2083" */
export function bsLabelForInput(yyyyMmDd) {
  if (!yyyyMmDd) return '';
  return formatNepaliDate(`${yyyyMmDd}T00:00:00+05:45`);
}

export { NEPAL_MONTH_NAMES, NEPALI_WEEKDAYS };
