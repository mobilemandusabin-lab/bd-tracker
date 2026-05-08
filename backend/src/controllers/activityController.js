const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const appEventEmitter = require('../services/eventService');

exports.createActivity = async (req, res) => {
  try {
    const activityData = { ...req.body, user_id: req.user._id };
    
    // If follow-up is required, ensure status is pending for the tracker
    if (activityData.follow_up_required) {
      activityData.status = 'pending';
    }

    const activity = await Activity.create(activityData);

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
    const followups = await Activity.find({
      follow_up_required: true,
      status: 'pending'
    }).populate('lead_id user_id');
    res.status(200).json({ status: 'success', results: followups.length, data: { followups } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getTodayFollowups = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const followups = await Activity.find({
      follow_up_required: true,
      status: 'pending',
      follow_up_date: { $gte: startOfDay, $lte: endOfDay }
    })
    .populate('lead_id user_id')
    .sort('follow_up_time');

    res.status(200).json({
      status: 'success',
      results: followups.length,
      data: { followups }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};
