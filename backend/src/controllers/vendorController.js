const Vendor = require('../models/Vendor');
const appEventEmitter = require('../services/eventService');

exports.getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().populate('lead_id');
    res.status(200).json({ status: 'success', results: vendors.length, data: { vendors } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id).populate('lead_id');
    if (!vendor) return res.status(404).json({ status: 'fail', message: 'No vendor found' });
    res.status(200).json({ status: 'success', data: { vendor } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.updateVendor = async (req, res) => {
  try {
    const oldVendor = await Vendor.findById(req.params.id);
    if (!oldVendor) return res.status(404).json({ status: 'fail', message: 'No vendor found' });

    const previousStage = oldVendor.onboarding_stage;
    const updatedVendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (previousStage !== updatedVendor.onboarding_stage) {
      appEventEmitter.emit('vendor.stage.changed', {
        vendor: updatedVendor,
        user: req.user,
        previous_stage: previousStage
      });
    }

    res.status(200).json({ status: 'success', data: { vendor: updatedVendor } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};
