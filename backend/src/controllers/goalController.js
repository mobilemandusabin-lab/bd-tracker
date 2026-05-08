const Goal = require('../models/Goal');
const User = require('../models/User');

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
      .sort('-created_at');
    
    res.status(200).json({ 
      status: 'success', 
      results: goals.length,
      data: { goals } 
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