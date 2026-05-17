const PipelineStage = require('../models/PipelineStage');

exports.getAllStages = async (req, res) => {
  try {
    const { category } = req.query;
    const query = category ? { category } : {};
    const stages = await PipelineStage.find(query).sort('order');
    res.status(200).json({ status: 'success', data: { stages } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getStage = async (req, res) => {
  try {
    const stage = await PipelineStage.findById(req.params.id);
    if (!stage) return res.status(404).json({ status: 'fail', message: 'No stage found' });
    res.status(200).json({ status: 'success', data: { stage } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.createStage = async (req, res) => {
  try {
    const stage = await PipelineStage.create(req.body);
    res.status(201).json({ status: 'success', data: { stage } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.updateStage = async (req, res) => {
  try {
    const stage = await PipelineStage.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!stage) return res.status(404).json({ status: 'fail', message: 'No stage found' });
    res.status(200).json({ status: 'success', data: { stage } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.deleteStage = async (req, res) => {
  try {
    const stage = await PipelineStage.findByIdAndDelete(req.params.id);
    if (!stage) return res.status(404).json({ status: 'fail', message: 'No stage found' });
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.reorderStages = async (req, res) => {
  try {
    const { stages } = req.body;
    
    // Group stages by category and update orders within each category
    const categoryGroups = {};
    stages.forEach(stage => {
      if (!categoryGroups[stage.category]) categoryGroups[stage.category] = [];
      categoryGroups[stage.category].push(stage);
    });
    
    // Update order for each stage, maintaining relative position within category
    for (const stage of stages) {
      const catStages = categoryGroups[stage.category];
      const positionInCat = catStages.findIndex(s => s._id === stage._id) + 1;
      await PipelineStage.findByIdAndUpdate(stage._id, { order: positionInCat });
    }
    
    const updatedStages = await PipelineStage.find({}).sort({ category: 1, order: 1 });
    res.status(200).json({ status: 'success', data: { stages: updatedStages } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};