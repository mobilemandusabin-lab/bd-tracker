const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Cron job to detect and process overdue follow-ups
 * Should be called every X minutes (e.g., every 15 minutes)
 */
const checkOverdueFollowups = async () => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Find all pending follow-ups where the scheduled date is before today
    // or date is today and time has passed
    const overdueFollowups = await Activity.find({
      follow_up_required: true,
      status: 'pending',
      $or: [
        { follow_up_date: { $lt: today } },
        { 
          follow_up_date: today,
          follow_up_time: { $lt: currentTime }
        }
      ]
    }).populate('lead_id user_id');

    console.log(`[Overdue Check] Found ${overdueFollowups.length} overdue follow-ups`);

    for (const followup of overdueFollowups) {
      // Mark as overdue
      followup.status = 'overdue';
      await followup.save();

      // Notify the assigned user
      await Notification.createUnlessSilenced({
        recipient: followup.user_id._id,
        title: 'Overdue Follow-up',
        message: `Follow-up for ${followup.lead_id?.business_name || 'Unknown Lead'} is overdue!`,
        type: 'follow_up_overdue',
        related_id: followup.lead_id?._id,
        related_model: 'Lead',
        priority: 'high'
      });

      // If follow-up is more than 24 hours overdue, notify the manager/super_admin
      const overdueTime = now - new Date(followup.follow_up_date);
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (overdueTime > twentyFourHours) {
        // Find managers/super_admins to notify
        const managers = await User.find({
          role: { $in: ['super_admin', 'admin'] }
        });

        for (const manager of managers) {
          await Notification.createUnlessSilenced({
            recipient: manager._id,
            title: 'Critical: Overdue Follow-up',
            message: `${followup.user_id.name} has a follow-up overdue by ${Math.floor(overdueTime / twentyFourHours)} day(s) for ${followup.lead_id?.business_name}`,
            type: 'follow_up_critical',
            related_id: followup.lead_id?._id,
            related_model: 'Lead',
            priority: 'critical'
          });
        }
      }
    }

    return overdueFollowups.length;
  } catch (err) {
    console.error('[Overdue Check] Error:', err.message);
    return 0;
  }
};

/**
 * Auto-escalate if user has 3+ overdue follow-ups
 */
const checkEscalationTriggers = async () => {
  try {
    const overdueCounts = await Activity.aggregate([
      {
        $match: {
          status: 'overdue',
          follow_up_required: true
        }
      },
      {
        $group: {
          _id: '$user_id',
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gte: 3 }
        }
      }
    ]);

    for (const item of overdueCounts) {
      const userId = item._id;
      const count = item.count;

      // Notify supervisors
      const managers = await User.find({
        role: { $in: ['super_admin', 'admin'] }
      });

      for (const manager of managers) {
        await Notification.createUnlessSilenced({
          recipient: manager._id,
          title: 'Escalation Alert',
          message: `User has ${count} overdue follow-ups. Immediate attention required.`,
          type: 'escalation',
          related_id: userId,
          related_model: 'User',
          priority: 'critical'
        });
      }
    }
  } catch (err) {
    console.error('[Escalation Check] Error:', err.message);
  }
};

module.exports = {
  checkOverdueFollowups,
  checkEscalationTriggers
};
