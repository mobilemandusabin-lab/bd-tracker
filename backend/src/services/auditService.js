const AuditLog = require('../models/AuditLog');

exports.logAction = async (userId, actionType, moduleName, recordId, previousValue, updatedValue, ipAddress) => {
  try {
    await AuditLog.create({
      user_id: userId,
      action_type: actionType,
      module_name: moduleName,
      record_id: recordId,
      previous_value: previousValue,
      updated_value: updatedValue,
      ip_address: ipAddress
    });
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
};
