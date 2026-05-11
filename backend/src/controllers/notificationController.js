const Notification = require('../models/Notification');
const User = require('../models/User');
const Activity = require('../models/Activity');
const Lead = require('../models/Lead');

exports.getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user._id,
      scheduled_for: { $lte: new Date() } // Only show notifications that are due
    })
    .sort('-created_at')
    .limit(20);

    res.status(200).json({
      status: 'success',
      results: notifications.length,
      data: { notifications }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { is_read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ status: 'fail', message: 'Notification not found' });
    }

    res.status(200).json({ status: 'success', data: { notification } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, is_read: false },
      { is_read: true }
    );

    res.status(200).json({ status: 'success', message: 'All notifications marked as read' });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      is_read: false,
      scheduled_for: { $lte: new Date() }
    });

    res.status(200).json({ status: 'success', data: { count } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// Follow-up today list — queries Activity (source of truth)
exports.getTodayFollowUps = async (req, res) => {
  try {
    const now = new Date();
    // End of tomorrow (UTC) - captures everything from the past up to tomorrow
    const finalEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 23, 59, 59, 999));

    // Build base query
    const query = {
      follow_up_required: true,
      status: { $in: ['pending', 'overdue'] },
      follow_up_date: { $lte: finalEnd } // Include all past follow-ups (overdue) + today's
    };

    // Role-based filtering
    // Allow all roles to access, but filter results based on their role
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
      // For regular users and others, they see activities they created OR leads assigned to them
      const assignedLeads = await Lead.find({ assigned_user: req.user._id }).select('_id');
      const assignedLeadIds = assignedLeads.map(l => l._id);
      
      query.$or = [
        { user_id: req.user._id },
        { lead_id: { $in: assignedLeadIds } }
      ];
    }

    // Find activities
    const activities = await Activity.find(query)
      .populate({
        path: 'lead_id',
        populate: {
          path: 'assigned_user',
          select: 'name email'
        }
      })
      .populate('user_id', 'name email')
      .sort('follow_up_date');

    const enriched = activities.map((act) => {
      const lead = act.lead_id;
      const businessName = lead && lead.business_name ? lead.business_name : 'Unknown Enterprise';
      
      // PRIORITY for Manager: 
      // 1. Official Lead Owner (assigned_user)
      // 2. Activity Creator (the person who scheduled this task)
      const manager = (lead && lead.assigned_user) ? lead.assigned_user : act.user_id;
      
      const isOverdue = act.status === 'overdue' || (act.follow_up_date && new Date(act.follow_up_date) < new Date(now.setHours(0,0,0,0)));

      return {
        _id: (lead && lead._id) ? lead._id : act._id,
        activity_id: act._id,
        title: `Follow‑up: ${businessName}`,
        message: act.description || 'Follow‑up required',
        scheduled_for: act.follow_up_date || act.created_at,
        is_read: false,
        business_name: businessName,
        contact_person: lead ? lead.contact_person : null,
        phone: lead ? lead.phone : null,
        email: lead ? lead.email : null,
        location: lead ? lead.location : null,
        category: lead ? lead.category : null,
        lead_status: lead ? lead.lead_status : null,
        priority: lead ? lead.priority : null,
        lead_score: lead ? lead.lead_score : null,
        lead_source: lead ? lead.lead_source : null,
        created_at: lead ? lead.created_at : act.created_at,
        assigned_user: manager,
        manager: manager ? { _id: manager._id, name: manager.name, email: manager.email } : null,
        hasActivity: true,
        follow_up_date: act.follow_up_date || null,
        is_overdue: isOverdue
      };
    });

    res.status(200).json({ status: 'success', results: enriched.length, data: { followUps: enriched } });
  } catch (err) {
    console.error('Error in getTodayFollowUps:', err);
    res.status(500).json({ status: 'fail', message: err.message });
  }
};