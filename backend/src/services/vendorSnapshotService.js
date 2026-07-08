const VendorSnapshot = require('../models/VendorSnapshot');

/**
 * Manually take a snapshot of the given type
 */
async function takeSnapshot(type, targets = null) {
  const snapshot = await VendorSnapshot.captureSnapshot(type, targets);
  console.log(`[Snapshot] Manual ${type} snapshot captured: ${snapshot.nepaliDate}`);
  return snapshot;
}

module.exports = { takeSnapshot };
