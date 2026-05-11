const mongoose = require('mongoose');
const Activity = require('../models/Activity');
const Lead = require('../models/Lead');
const Notification = require('../models/Notification');
const appEventEmitter = require('../services/eventService');

// Check if current time is at or after scheduled follow-up time
const isAtOrAfterScheduledTime = (followUpDate) => {
  const now = new Date();
  const scheduled = new Date(followUpDate);
  return now >= scheduled;
};

// Check if current time is on the same day as follow-up
const isSameDay = (followUpDate) => {
  if (!followUpDate) return false;
  const now = new Date();
  const scheduled = new Date(followUpDate);
  return now.getFullYear() === scheduled.getFullYear() &&
         now.getMonth() === scheduled.getMonth() &&
         now.getDate() === scheduled.getDate();
};

// Check if the follow-up date is overdue (before today)
const isOverdueDay = (followUpDate) => {
  if (!followUpDate) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const scheduled = new Date(followUpDate);
  scheduled.setHours(0, 0, 0, 0);
  
  return now.getTime() > scheduled.getTime();
};

// Check if the follow-up is scheduled for a future day (after today)
const isFutureDay = (followUpDate) => {
  if (!followUpDate) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const scheduled = new Date(followUpDate);
  scheduled.setHours(0, 0, 0, 0);
  
  return now.getTime() < scheduled.getTime();
};

// Check if current time is before the follow-up time on the same day
const isBeforeTime = (followUpDate, followUpTime) => {
  if (!followUpDate || !followUpTime) return false;
  
  const now = new Date();
  const [hours, minutes] = followUpTime.split(':');
  
  const scheduled = new Date(followUpDate);
  scheduled.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  // Only return true if it's the SAME day and before the time
  return isSameDay(followUpDate) && now.getTime() < scheduled.getTime();
};

exports.createActivity = async (req, res) => {
  try {
    const Lead = require('../models/Lead');
    const activityData = { ...req.body, user_id: req.user._id };
    
    // If follow-up is required, ensure status is pending for the tracker
    if (activityData.follow_up_required) {
      activityData.status = 'pending';
    }

    const activity = await Activity.create(activityData);

    // Auto-assign lead to user if it's currently unassigned
    await Lead.findOneAndUpdate(
      { _id: activity.lead_id, assigned_user: null },
      { assigned_user: req.user._id }
    );

    if (activity.follow_up_required) {
      // Create a notification for the follow-up
      let scheduledFor = new Date();
      if (activity.follow_up_date) {
        scheduledFor = new Date(activity.follow_up_date);
        if (activity.follow_up_time) {
          const [hours, minutes] = activity.follow_up_time.split(':');
          scheduledFor.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        }
      }

      await Notification.create({
        recipient: req.user._id,
        title: `Follow-up Required: ${activity.description.slice(0, 20)}...`,
        message: `Scheduled follow-up for lead: ${activity.description}`,
        type: 'follow_up',
        related_id: activity.lead_id,
        related_model: 'Lead',
        scheduled_for: scheduledFor
      });

      appEventEmitter.emit('activity.followup.created', {
        activity,
        user: req.user
      });
    }

    res.status(201).json({ status: 'success', data: { activity } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// Log a call and handle follow-up logic
exports.logCallWithFollowupCheck = async (req, res) => {
  try {
    const Lead = require('../models/Lead');
    const { lead_id, description } = req.body;
    
    // Find pending follow-ups for this lead
    const pendingFollowups = await Activity.find({
      lead_id,
      follow_up_required: true,
      status: 'pending'
    }).sort('follow_up_date');
    
    // Log the call activity
    const callActivity = await Activity.create({
      lead_id,
      user_id: req.user._id,
      activity_type: 'call',
      description: description || 'Call from lead list',
      status: 'completed'
    });

    // Auto-assign lead to user if it's currently unassigned
    await Lead.findOneAndUpdate(
      { _id: lead_id, assigned_user: null },
      { assigned_user: req.user._id }
    );
    
    let autoCancelled = false;
    let needsConfirmation = false;
    let followupInfo = null;
    
    // Process follow-ups in order (earliest first)
    for (const followup of pendingFollowups) {
      const scheduledDate = followup.follow_up_date;
      const scheduledTime = followup.follow_up_time;
      
      if (isSameDay(scheduledDate) && isBeforeTime(scheduledDate, scheduledTime)) {
        // Same day but before time - auto-cancel follow-up
        followup.original_follow_up_date = followup.follow_up_date;
        followup.original_follow_up_time = followup.follow_up_time;
        followup.follow_up_required = false;
        followup.status = 'completed';
        followup.early_call_status = 'cancelled_same_day';
        followup.early_call_at = new Date();
        await followup.save();
        autoCancelled = true;
      } else if (isFutureDay(scheduledDate)) {
        // Follow-up is scheduled for a future day - ask for decision
        if (!needsConfirmation) {
          needsConfirmation = true;
          followupInfo = {
            activity_id: followup._id,
            scheduled_for: followup.follow_up_date,
            scheduled_time: followup.follow_up_time,
            message: followup.description,
            type: 'future_followup',
            question: 'This follow-up is scheduled for a future date. Would you like to delete it?'
          };
        }
      } else if (isOverdueDay(scheduledDate)) {
        // Past due follow-up - ask for confirmation
        if (!needsConfirmation) {
          needsConfirmation = true;
          followupInfo = {
            activity_id: followup._id,
            scheduled_for: followup.follow_up_date,
            scheduled_time: followup.follow_up_time,
            message: followup.description,
            type: 'before_day'
          };
        }
      }
    }
    
    res.status(201).json({ 
      status: 'success', 
      data: { 
        activity: callActivity,
        autoCancelled,
        needsConfirmation,
        followupInfo
      } 
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// Handle user decision for early follow-up call
exports.handleEarlyCallDecision = async (req, res) => {
  try {
    const { activity_id } = req.params;
    const { decision } = req.body; // 'continue' or 'cancel'
    
    const followup = await Activity.findOne({ _id: activity_id, follow_up_required: true });
    
    if (!followup) {
      return res.status(404).json({ status: 'fail', message: 'Follow-up not found' });
    }
    
    followup.early_call_at = new Date();
    
    if (decision === 'continue') {
      followup.early_call_status = 'continued';
      // Keep follow_up_required = true and status = pending
    } else {
      followup.early_call_status = 'cancelled_early';
      followup.follow_up_required = false;
      followup.status = 'completed';
      followup.original_follow_up_date = followup.follow_up_date;
      followup.original_follow_up_time = followup.follow_up_time;
    }
    
    await followup.save();
    
    res.status(200).json({ status: 'success', data: { followup } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getActivitiesByLead = async (req, res) => {
  try {
    const activities = await Activity.find({ lead_id: req.params.leadId })
      .populate('user_id', 'name email')
      .sort('-created_at');
    res.status(200).json({ status: 'success', results: activities.length, data: { activities } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getPendingFollowups = async (req, res) => {
  try {
    const query = {
      follow_up_required: true,
      status: 'pending'
    };

    // Role-based filtering:
    // 1. Super Admin: See everything.
    // 2. Others: See ONLY leads assigned to them.
    if (req.user.role !== 'super_admin') {
      const currentUserId = new mongoose.Types.ObjectId(req.user._id);
      const myLeads = await Lead.find({ assigned_user: currentUserId }).select('_id');
      const myLeadIds = myLeads.map(l => l._id);
      query.lead_id = { $in: myLeadIds };
    }

    const followups = await Activity.find(query).populate('lead_id user_id');
    res.status(200).json({ status: 'success', results: followups.length, data: { followups } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getTodayFollowups = async (req, res) => {
  try {
    const now = new Date();
    
    // Calculate start and end of today in local time for consistency
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    // Build base query - include pending, overdue, AND completed for visibility
    const query = {
      follow_up_required: true,
      status: { $in: ['pending', 'overdue', 'completed'] },
      follow_up_date: { 
        $gte: startOfToday,
        $lte: endOfToday
      }
    };

    // Role-based filtering:
    // 1. Super Admin: See everything across the entire platform.
    // 2. Others (Admin, User, Manager): See ONLY leads where they are the assigned manager.
    if (req.user.role !== 'super_admin') {
      const currentUserId = new mongoose.Types.ObjectId(req.user._id);
      
      // Find all leads assigned to this user
      const myLeads = await Lead.find({ assigned_user: currentUserId }).select('_id');
      const myLeadIds = myLeads.map(l => l._id);
      
      // Strictly filter activities to only those belonging to these leads
      query.lead_id = { $in: myLeadIds };
    } else {
      // Super Admin: Default to all, but can filter by a specific manager if userId is passed
      const { userId } = req.query;
      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        const targetUserId = new mongoose.Types.ObjectId(userId);
        const targetLeads = await Lead.find({ assigned_user: targetUserId }).select('_id');
        const targetLeadIds = targetLeads.map(l => l._id);
        query.lead_id = { $in: targetLeadIds };
      }
    }

    const activities = await Activity.find(query)
      .populate({
        path: 'lead_id',
        populate: {
          path: 'assigned_user',
          select: 'name email'
        }
      })
      .populate('user_id', 'name email')
      .sort('follow_up_date follow_up_time');

    const enriched = await Promise.all(activities.map(async (act) => {
      const lead = act.lead_id;
      if (!lead) return null; // Safety check

      const businessName = lead.business_name || 'Unknown Enterprise';
      const manager = lead.assigned_user || act.user_id;
      const managerName = manager?.name || 'Unassigned';
      
      const localStartOfDay = new Date();
      localStartOfDay.setHours(0, 0, 0, 0);
      const isOverdue = act.status === 'overdue' || (act.follow_up_date && new Date(act.follow_up_date) < localStartOfDay);
      
      // Check if there's an activity logged AFTER the follow-up was created
      // This indicates the follow-up was actually done
      const followUpCreatedAt = act.created_at || act.follow_up_date;
      const followUpActivities = await Activity.find({
        lead_id: lead._id,
        activity_type: { $ne: 'follow_up' },
        created_at: { $gt: followUpCreatedAt }
      }).limit(1);
      
      const hasActivity = followUpActivities.length > 0 || act.status === 'completed';

      return {
        _id: lead._id,
        activity_id: act._id,
        title: `Follow‑up: ${businessName}`,
        message: act.description || 'Follow‑up required',
        scheduled_for: act.follow_up_date,
        scheduled_time: act.follow_up_time,
        is_read: act.status === 'completed',
        business_name: businessName,
        contact_person: lead.contact_person || 'N/A',
        phone: lead.phone || 'N/A',
        email: lead.email || 'N/A',
        location: lead.location || 'N/A',
        category: lead.category || 'N/A',
        lead_status: lead.lead_status || 'New',
        priority: lead.priority || 'Cold',
        created_at: lead.created_at || act.created_at,
        assigned_user: manager,
        manager: manager ? { _id: manager._id, name: managerName, email: manager.email } : null,
        hasActivity,
        follow_up_date: act.follow_up_date,
        is_overdue: isOverdue,
        status: act.status
      };
    }));

    res.status(200).json({ 
      status: 'success', 
      results: enriched.length, 
      data: { followUps: enriched.filter(item => item !== null) } 
    });
  } catch (err) {
    console.error('Error in getTodayFollowups:', err);
    res.status(400).json({ status: 'fail', message: err.message });
  }
};
