const NepaliDate = require('nepali-date-converter').default;

const NEPAL_MONTH_NAMES = [
  'Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra',
  'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

/**
 * Convert a JS Date to a Nepali date object
 * @param {Date} date - JavaScript Date object
 * @returns {{ year: number, month: number, day: number, monthName: string, formatted: string, dayOfWeek: number }}
 */
function toNepaliDateObject(date) {
  const nd = new NepaliDate(date);
  const month = nd.getMonth(); // 0-indexed (0=Baisakh)

  return {
    year: nd.getYear(),
    month: month,
    day: nd.getDate(),
    monthName: NEPAL_MONTH_NAMES[month],
    formatted: nd.format('D MMMM YYYY'),
    dayOfWeek: nd.getDay()
  };
}

/**
 * Convert a JS Date to a formatted Nepali date string
 * @param {Date} date
 * @returns {string} e.g. "3 Jestha 2083"
 */
function toNepaliDate(date) {
  const nd = new NepaliDate(date);
  return nd.format('D MMMM YYYY');
}

/**
 * Get the current Nepali date
 * @returns {{ year: number, month: number, day: number, monthName: string, formatted: string, dayOfWeek: number }}
 */
function getCurrentNepaliDate() {
  return toNepaliDateObject(new Date());
}

module.exports = { toNepaliDateObject, toNepaliDate, getCurrentNepaliDate, NEPAL_MONTH_NAMES };
