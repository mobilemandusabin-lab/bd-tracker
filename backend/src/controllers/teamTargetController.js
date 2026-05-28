const TeamTarget = require('../models/TeamTarget');

// GET /api/v1/team-targets — Get all team targets (any authenticated user)
exports.getTargets = async (req, res) => {
  try {
    const targets = await TeamTarget.find().lean();
    // Return as map for easy lookup
    const result = { listing: 30, qc: 50 }; // defaults
    targets.forEach(t => { result[t.team] = t.daily_target; });
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// PUT /api/v1/team-targets/:team — Update team daily target (admin only)
exports.updateTarget = async (req, res) => {
  try {
    const { team } = req.params;
    const { daily_target } = req.body;

    if (!['listing', 'qc'].includes(team)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid team. Must be listing or qc.' });
    }
    if (!daily_target || daily_target < 1) {
      return res.status(400).json({ status: 'fail', message: 'daily_target must be at least 1' });
    }

    const target = await TeamTarget.findOneAndUpdate(
      { team },
      { daily_target, updated_by: req.user._id, updated_at: new Date() },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ status: 'success', data: target });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
