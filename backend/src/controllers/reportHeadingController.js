const ReportHeading = require('../models/ReportHeading');
const Department = require('../models/Department');

exports.getHeadings = async (req, res) => {
  try {
    const { departmentId } = req.query;
    const query = departmentId ? { departmentId } : {};
    const headings = await ReportHeading.find(query)
      .populate('departmentId', 'name')
      .sort({ departmentId: 1, order: 1 });
    res.status(200).json({ status: 'success', data: headings });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getHeading = async (req, res) => {
  try {
    const heading = await ReportHeading.findById(req.params.id)
      .populate('departmentId', 'name');
    if (!heading) {
      return res.status(404).json({ status: 'fail', message: 'Heading not found' });
    }
    res.status(200).json({ status: 'success', data: heading });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.createHeading = async (req, res) => {
  try {
    const { departmentId, name, key, dataType, order, hasChart,
            hasPrevValue, hasCurrentValue, hasTargetValue, hasNotes, suffix } = req.body;

    const dept = await Department.findById(departmentId);
    if (!dept) {
      return res.status(400).json({ status: 'fail', message: 'Department not found' });
    }

    const existing = await ReportHeading.findOne({ departmentId, key });
    if (existing) {
      return res.status(400).json({ status: 'fail', message: 'Heading with this key already exists in this department' });
    }

    const heading = await ReportHeading.create({
      departmentId, name, key, dataType, order: order || 0,
      hasChart: hasChart || false,
      hasPrevValue: hasPrevValue !== false,
      hasCurrentValue: hasCurrentValue !== false,
      hasTargetValue: hasTargetValue !== false,
      hasNotes: hasNotes || false,
      suffix: suffix || ''
    });

    res.status(201).json({ status: 'success', data: heading });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.updateHeading = async (req, res) => {
  try {
    const heading = await ReportHeading.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!heading) {
      return res.status(404).json({ status: 'fail', message: 'Heading not found' });
    }
    res.status(200).json({ status: 'success', data: heading });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.deleteHeading = async (req, res) => {
  try {
    const heading = await ReportHeading.findByIdAndDelete(req.params.id);
    if (!heading) {
      return res.status(404).json({ status: 'fail', message: 'Heading not found' });
    }
    res.status(200).json({ status: 'success', message: 'Heading deleted' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.reorderHeadings = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ status: 'fail', message: 'items must be an array of { _id, order }' });
    }
    const ops = items.map(item => ({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: { order: item.order } }
      }
    }));
    await ReportHeading.bulkWrite(ops);
    res.status(200).json({ status: 'success', message: 'Reordered' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
