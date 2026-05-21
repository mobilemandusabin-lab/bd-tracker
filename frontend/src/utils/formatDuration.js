/**
 * Format a duration in hours to a human-readable string.
 * - < 1 hour: "Xm" (minutes)
 * - < 24 hours: "Xh"
 * - >= 24 hours: "Xd Yh"
 * - null/undefined: "--"
 */
export function formatDuration(hours) {
  if (hours === null || hours === undefined || isNaN(hours)) return '--';
  if (hours === 0) return '0h';

  const totalMinutes = Math.round(hours * 60);

  if (totalMinutes < 60) return `${totalMinutes}m`;

  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);

  if (days === 0) return `${Math.round(hours)}h`;
  if (remainingHours === 0) return `${days}d`;
  return `${days}d ${remainingHours}h`;
}
