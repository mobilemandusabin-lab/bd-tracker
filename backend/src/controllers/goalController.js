const Goal = require('../models/Goal');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const NepalcanOrder = require('../models/NepalcanOrder');

exports.createGoal = async (req, res) => {
  try {
    // Check permissions: super_admin can set goals for anyone, admin/manager can set for users
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      // Managers can only set goals for users (not super_admin or other managers)
      const targetUser = await User.findById(req.body.assigned_to);
      if (!targetUser) {
        return res.status(404).json({ status: 'fail', message: 'Target user not found' });
      }
      if (targetUser.role === 'super_admin' || targetUser.role === 'admin' || targetUser.role === 'manager') {
        return res.status(403).json({ 
          status: 'fail', 
          message: 'Managers can only set goals for regular users' 
        });
      }
    } else if (req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        status: 'fail', 
        message: 'Only Super Admin and Managers can set goals' 
      });
    }

    // Set the user who is creating the goal
    const goalData = { ...req.body, set_by: req.user._id };
    
    const newGoal = await Goal.create(goalData);
    
    res.status(201).json({ 
      status: 'success', 
      data: { goal: newGoal } 
    });
  } catch (err) {
    res.status(400).json({ 
      status: 'fail', 
      message: err.message 
    });
  }
};

exports.getAllGoals = async (req, res) => {
  try {
    const filter = {};
    
    // Users can only see their own goals unless they are admin/super_admin
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin' && req.user.role !== 'manager') {
      filter.assigned_to = req.user._id;
    }
    
    // Optional: filter by period
    if (req.query.period) {
      filter.period = req.query.period;
    }
    
    // Optional: filter by status
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    const goals = await Goal.find(filter)
      .populate('assigned_to', 'name email role')
      .populate('set_by', 'name email role')
      .sort('-created_at')
      .lean();

    // Compute live progress for each goal using its own date range
    const now = new Date();
    const goalsWithProgress = await Promise.all(goals.map(async (goal) => {
      const goalUserId = goal.assigned_to?._id || goal.assigned_to;
      const goalStart = goal.start_date || new Date(0);
      const goalEnd = goal.end_date ? new Date(Math.min(new Date(goal.end_date).getTime(), now.getTime())) : now;
      const goalDateFilter = { $gte: goalStart, $lte: goalEnd };
      const goalMatch = { assigned_user: goalUserId, created_at: goalDateFilter };

      let currentValue = 0;
      switch (goal.unit) {
        case 'leads':
          currentValue = await Lead.countDocuments(goalMatch);
          break;
        case 'conversions':
          currentValue = await Lead.countDocuments({ ...goalMatch, lead_status: { $in: ['Activated', 'Active Seller'] } });
          break;
        case 'revenue':
          const revData = await NepalcanOrder.aggregate([
            { $match: { orderStatus: 'Delivered', createdAt: goalDateFilter } },
            { $lookup: { from: 'leads', localField: 'vendor_lead_id', foreignField: '_id', as: 'lead' } },
            { $unwind: { path: '$lead', preserveNullAndEmptyArrays: false } },
            { $match: { 'lead.assigned_user': goalUserId } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]);
          currentValue = revData[0]?.total || 0;
          break;
        case 'activated_vendors':
          currentValue = await Lead.countDocuments({ assigned_user: goalUserId, $or: [{ active_seller: true }, { lead_status: 'Active Seller' }], converted_at: goalDateFilter });
          break;
        case 'activities':
        case 'calls':
          currentValue = await Activity.countDocuments({ user_id: goalUserId, created_at: goalDateFilter });
          break;
        default:
          currentValue = goal.current_value || 0;
      }

      const progress = goal.target_value > 0 ? Math.min(Math.round((currentValue / goal.target_value) * 100), 100) : 0;
      return { ...goal, currentValue, progress, remaining: Math.max(goal.target_value - currentValue, 0) };
    }));

    res.status(200).json({
      status: 'success',
      results: goalsWithProgress.length,
      data: { goals: goalsWithProgress }
    });
  } catch (err) {
    res.status(400).json({ 
      status: 'fail', 
      message: err.message 
    });
  }
};

exports.getGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id)
      .populate('assigned_to', 'name email role')
      .populate('set_by', 'name email role');
    
    if (!goal) {
      return res.status(404).json({ 
        status: 'fail', 
        message: 'Goal not found' 
      });
    }
    
    // Check permission to view this goal
    if (req.user.role !== 'super_admin' && 
        req.user.role !== 'admin' && 
        req.user.role !== 'manager' &&
        goal.assigned_to._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        status: 'fail', 
        message: 'Not authorized to view this goal' 
      });
    }
    
    res.status(200).json({ 
      status: 'success', 
      data: { goal } 
    });
  } catch (err) {
    res.status(400).json({ 
      status: 'fail', 
      message: err.message 
    });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    let goal = await Goal.findById(req.params.id);
    
    if (!goal) {
      return res.status(404).json({ 
        status: 'fail', 
        message: 'Goal not found' 
      });
    }
    
    // Check permission to update this goal
    const isOwner = goal.set_by._id.toString() === req.user._id.toString();
    const isSuperAdmin = req.user.role === 'super_admin';
    
    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({ 
        status: 'fail', 
        message: 'Not authorized to update this goal' 
      });
    }
    
    // Additional permission checks for managers updating goals
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      // Managers can only update goals for users they manage
      if (goal.assigned_to.role === 'super_admin' || 
          goal.assigned_to.role === 'admin' || 
          goal.assigned_to.role === 'manager') {
        return res.status(403).json({ 
          status: 'fail', 
          message: 'Managers can only update goals for regular users' 
        });
      }
    }
    
    goal = await Goal.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('assigned_to', 'name email role')
      .populate('set_by', 'name email role');
    
    res.status(200).json({ 
      status: 'success', 
      data: { goal } 
    });
  } catch (err) {
    res.status(400).json({ 
      status: 'fail', 
      message: err.message 
    });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    
    if (!goal) {
      return res.status(404).json({ 
        status: 'fail', 
        message: 'Goal not found' 
      });
    }
    
    // Check permission to delete this goal
    const isOwner = goal.set_by._id.toString() === req.user._id.toString();
    const isSuperAdmin = req.user.role === 'super_admin';
    
    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({ 
        status: 'fail', 
        message: 'Not authorized to delete this goal' 
      });
    }
    
    await Goal.findByIdAndDelete(req.params.id);
    
    res.status(204).json({ 
      status: 'success', 
      data: null 
    });
  } catch (err) {
    res.status(400).json({ 
      status: 'fail', 
      message: err.message 
    });
  }
};

exports.updateGoalProgress = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    
    if (!goal) {
      return res.status(404).json({ 
        status: 'fail', 
        message: 'Goal not found' 
      });
    }
    
    // Only the assigned user or super_admin can update progress
    const isAssigned = goal.assigned_to._id.toString() === req.user._id.toString();
    const isSuperAdmin = req.user.role === 'super_admin';
    
    if (!isAssigned && !isSuperAdmin) {
      return res.status(403).json({ 
        status: 'fail', 
        message: 'Not authorized to update progress for this goal' 
      });
    }
    
    const { current_value } = req.body;
    
    if (current_value === undefined) {
      return res.status(400).json({ 
        status: 'fail', 
        message: 'Current value is required' 
      });
    }
    
    goal.current_value = current_value;
    
    // Auto-update status if goal is achieved
    if (goal.is_achieved && goal.status === 'active') {
      goal.status = 'completed';
    }
    
    await goal.save();
    
    res.status(200).json({ 
      status: 'success', 
      data: { 
        goal: goal,
        progress_percentage: goal.progress_percentage,
        is_achieved: goal.is_achieved
      } 
    });
  } catch (err) {
    res.status(400).json({ 
      status: 'fail', 
      message: err.message 
    });
  }
};