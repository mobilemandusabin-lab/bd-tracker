const Lead = require('../models/Lead');
const Vendor = require('../models/Vendor');
const Activity = require('../models/Activity');
const Task = require('../models/Task');

exports.getStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let leadFilter = {};
    let taskFilter = {};
    let activityFilter = {};

    if (userRole === 'user') {
      leadFilter = { $or: [{ assigned_user: userId }, { creator_id: userId }] };
      taskFilter = { assigned_to: userId };
      activityFilter = { user_id: userId };
    }

    const leadStats = await Lead.aggregate([
      ...(userRole !== 'user' ? [] : [{ $match: leadFilter }]),
      {
        $group: {
          _id: '$lead_status',
          count: { $sum: 1 }
        }
      }
    ]);

    const onboardingStats = await Vendor.aggregate([
      ...(userRole !== 'user' ? [] : [
        {
          $lookup: {
            from: 'leads',
            localField: 'lead_id',
            foreignField: '_id',
            as: 'lead'
          }
        },
        { $unwind: '$lead' },
        { $match: { $or: [{ 'lead.assigned_user': userId }, { 'lead.creator_id': userId }] } }
      ]),
      {
        $group: {
          _id: '$onboarding_stage',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalLeads = await Lead.countDocuments(leadFilter);
    const activeSellers = await Lead.countDocuments({ ...leadFilter, lead_status: 'Active Seller' });
    const pendingTasks = await Task.countDocuments(taskFilter);
    const pendingFollowups = await Activity.countDocuments({ ...activityFilter, follow_up_required: true, status: 'pending' });

    res.status(200).json({
      status: 'success',
      data: {
        summary: {
          totalLeads,
          activeSellers,
          pendingTasks,
          pendingFollowups
        },
        leadStats,
        onboardingStats
      }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getLeadGrowth = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    const matchStage = userRole === 'user' 
      ? { $or: [{ assigned_user: userId }, { creator_id: userId }] }
      : {};

    const growth = await Lead.aggregate([
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: { $month: "$created_at" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    res.status(200).json({ status: 'success', data: growth });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getDailyCallReport = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const report = await Activity.find({
      activity_type: 'call',
      created_at: { $gte: startOfDay, $lte: endOfDay }
    })
    .populate('user_id', 'name')
    .populate({
      path: 'lead_id',
      select: 'business_name lead_status'
    })
    .sort('-created_at');

    res.status(200).json({
      status: 'success',
      results: report.length,
      data: { report }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getUserPerformanceReport = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const performance = await Activity.aggregate([
      {
        $match: {
          activity_type: 'call',
          created_at: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $lookup: {
          from: 'leads',
          localField: 'lead_id',
          foreignField: '_id',
          as: 'lead'
        }
      },
      { $unwind: '$lead' },
      {
        $group: {
          _id: {
            user_id: '$user_id',
            lead_id: '$lead_id'
          },
          status: { $first: '$lead.lead_status' }
        }
      },
      {
        $group: {
          _id: '$_id.user_id',
          stats: {
            $push: {
              status: '$status',
              count: 1
            }
          },
          total_vendors_touched: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id',
          stats: { $first: '$stats' },
          total_vendors_touched: { $first: '$total_vendors_touched' }
        }
      },
      // Recalculate total calls separately since we grouped by lead
      {
        $lookup: {
          from: 'activities',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$user_id', '$$userId'] },
                    { $eq: ['$activity_type', 'call'] },
                    { $gte: ['$created_at', startOfDay] },
                    { $lte: ['$created_at', endOfDay] }
                  ]
                }
              }
            },
            { $count: 'count' }
          ],
          as: 'call_count'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          'user.name': 1,
          'user.email': 1,
          stats: 1,
          total_calls: { $ifNull: [{ $arrayElemAt: ['$call_count.count', 0] }, 0] },
          total_vendors_touched: 1
        }
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: { performance }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getBDPerformanceSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchQuery = {};
    if (startDate && endDate) {
      matchQuery.created_at = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const performance = await Lead.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$assigned_user',
          total_assigned: { $sum: 1 },
          converted: {
            $sum: { $cond: [{ $eq: ['$lead_status', 'Activated'] }, 1, 0] }
          },
          lost: {
            $sum: { $cond: [{ $eq: ['$lead_status', 'Lost'] }, 1, 0] }
          },
          total_conversion_time: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$lead_status', 'Activated'] }, { $ne: ['$converted_at', null] }] },
                { $subtract: ['$converted_at', '$created_at'] },
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          'user.name': 1,
          'user.email': 1,
          total_assigned: 1,
          converted: 1,
          lost: 1,
          conversion_rate: {
            $cond: [
              { $eq: ['$total_assigned', 0] },
              0,
              { $multiply: [{ $divide: ['$converted', '$total_assigned'] }, 100] }
            ]
          },
          avg_conversion_days: {
            $cond: [
              { $eq: ['$converted', 0] },
              0,
              { $divide: [{ $divide: ['$total_conversion_time', 1000 * 60 * 60 * 24] }, '$converted'] }
            ]
          }
        }
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: { performance }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getDropReasonAnalytics = async (req, res) => {
  try {
    const analytics = await Lead.aggregate([
      { $match: { lead_status: 'Lost', drop_reason: { $ne: null } } },
      {
        $group: {
          _id: '$drop_reason',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      status: 'success',
      data: { analytics }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getBDLeaderboard = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch(period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    const leaderboard = await Lead.aggregate([
      {
        $match: {
          assigned_user: { $exists: true, $ne: null },
          created_at: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$assigned_user',
          total_assigned: { $sum: 1 },
          converted: {
            $sum: { $cond: [{ $eq: ['$lead_status', 'Activated'] }, 1, 0] }
          },
          lost: {
            $sum: { $cond: [{ $eq: ['$lead_status', 'Lost'] }, 1, 0] }
          },
          avg_lead_score: { $avg: '$lead_score' },
          total_conversion_time: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$lead_status', 'Activated'] }, { $ne: ['$converted_at', null] }] },
                { $subtract: ['$converted_at', '$created_at'] },
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'activities',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$user_id', '$$userId'] },
                    { $eq: ['$activity_type', 'call'] },
                    { $gte: ['$created_at', startDate] }
                  ]
                }
              }
            },
            { $count: 'count' }
          ],
          as: 'call_stats'
        }
      },
      {
        $lookup: {
          from: 'tasks',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$assigned_to', '$$userId'] },
                    { $eq: ['$status', 'Done'] },
                    { $gte: ['$created_at', startDate] }
                  ]
                }
              }
            },
            { $count: 'count' }
          ],
          as: 'completed_tasks'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          'user.name': 1,
          'user.email': 1,
          'user.role': 1,
          total_assigned: 1,
          converted: 1,
          lost: 1,
          conversion_rate: {
            $cond: [
              { $eq: ['$total_assigned', 0] },
              0,
              { $multiply: [{ $divide: ['$converted', '$total_assigned'] }, 100] }
            ]
          },
          avg_conversion_days: {
            $cond: [
              { $eq: ['$converted', 0] },
              0,
              { $divide: [{ $divide: ['$total_conversion_time', 1000 * 60 * 60 * 24] }, '$converted'] }
            ]
          },
          avg_lead_score: { $ifNull: ['$avg_lead_score', 0] },
          total_calls: { $ifNull: [{ $arrayElemAt: ['$call_stats.count', 0] }, 0] },
          completed_tasks: { $ifNull: [{ $arrayElemAt: ['$completed_tasks.count', 0] }, 0] }
        }
      },
      // Calculate Overall Score (0-100)
      {
        $addFields: {
          overall_score: {
            $add: [
              { $multiply: [{ $divide: ['$conversion_rate', 100] }, 40] }, // 40% weight
              { $multiply: [{ $divide: [{ $cond: [{ $eq: ['$avg_conversion_days', 0] }, 100, { $subtract: [100, '$avg_conversion_days'] }] }, 100] }, 30] }, // 30% weight
              { $multiply: [{ $divide: ['$avg_lead_score', 100] }, 20] }, // 20% weight
              { $multiply: [{ $cond: [{ $eq: ['$total_calls', 0] }, 0, { $min: [1, { $divide: ['$total_calls', '$total_assigned'] }] }] }, 10] } // 10% weight
            ]
          }
        }
      },
      { $sort: { overall_score: -1 } }
    ]);

    // Add badges based on performance
    const badgeMappings = {
      0: { badge: '🥇', title: 'Top Converter', condition: (item, index) => index === 0 },
      1: { badge: '⚡', title: 'Fast Responder', condition: (item) => item.avg_conversion_days < 7 },
      2: { badge: '📞', title: 'Call Master', condition: (item) => item.total_calls > 50 },
      3: { badge: '🎯', title: 'Target Hunter', condition: (item) => item.conversion_rate > 50 },
      4: { badge: '⭐', title: 'Rising Star', condition: (item) => item.overall_score > 70 && item.total_assigned < 20 },
      5: { badge: '💎', title: 'Quality Master', condition: (item) => item.avg_lead_score > 70 }
    };

    const leaderboardWithBadges = leaderboard.map((item, index) => {
      const badges = [];
      Object.values(badgeMappings).forEach(mapping => {
        if (mapping.condition(item, index)) {
          badges.push({ emoji: mapping.badge, title: mapping.title });
        }
      });
      return { ...item, badges, rank: index + 1 };
    });

    res.status(200).json({
      status: 'success',
      results: leaderboardWithBadges.length,
      data: { leaderboard: leaderboardWithBadges }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getFullExportReport = async (req, res) => {
  try {
    const activities = await Activity.find({ activity_type: 'call' })
      .populate({
        path: 'lead_id',
        select: 'business_name contact_person'
      })
      .populate('user_id', 'name')
      .sort('-created_at');

    const reportData = activities.map(activity => ({
      'Vendor Name': activity.lead_id?.business_name || 'N/A',
      'Contact Name': activity.lead_id?.contact_person || 'N/A',
      'Officer Name': activity.user_id?.name || 'N/A',
      'Discussion Details': activity.description || 'N/A',
      'Follow-up Date': activity.follow_up_date ? new Date(activity.follow_up_date).toLocaleDateString() : 'N/A',
      'Follow-up Time': activity.follow_up_time || 'N/A',
      'Activity Date': new Date(activity.created_at).toLocaleString()
    }));

    res.status(200).json({
      status: 'success',
      data: { report: reportData }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.bulkUploadLeads = async (req, res) => {
  try {
    const { leads, assigned_user } = req.body;
    const Lead = require('../models/Lead');
    const Activity = require('../models/Activity');
    const Notification = require('../models/Notification');

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ status: 'fail', message: 'Please provide lead data' });
    }

    const createdLeads = [];
    const errors = [];

    for (const leadData of leads) {
      try {
        // Normalize headers (case-insensitive)
        const normalizedData = {};
        Object.keys(leadData).forEach(key => {
          normalizedData[key.trim().toLowerCase()] = leadData[key];
        });

        // Prepare lead data
        const leadPayload = {
          business_name: normalizedData['vendor name'] || 'Unknown Vendor',
          contact_person: normalizedData['contact name'] || normalizedData['email'] || 'Unknown Contact',
          phone: normalizedData['phone'] || `Unknown_${Math.floor(Math.random() * 1000000)}`,
          email: normalizedData['email'] || `bulk_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`,
          category: normalizedData['category'] || 'Other',
          location: normalizedData['location'] || 'Unknown Location',
          lead_status: normalizedData['status'] || 'Interested',
          lead_source: 'Bulk Upload',
          assigned_user: assigned_user || req.user._id,
          assignment_status: 'accepted',
          creator_id: req.user._id,
          notes: normalizedData['discussion details'] || normalizedData['remark'] || 'Bulk uploaded lead intelligence'
        };

        const newLead = await Lead.create(leadPayload);
        createdLeads.push(newLead);

        // Create Activity
        await Activity.create({
          lead_id: newLead._id,
          user_id: leadPayload.assigned_user,
          activity_type: 'call',
          description: leadPayload.notes,
          follow_up_required: !!normalizedData['follow-up date'],
          follow_up_date: normalizedData['follow-up date'] ? new Date(normalizedData['follow-up date']) : null,
          follow_up_time: normalizedData['follow-up time'] || null,
          status: 'completed'
        });

        // Create Notification if follow-up exists
        if (leadData['Follow-up Date']) {
          let scheduledFor = new Date(leadData['Follow-up Date']);
          if (leadData['Follow-up Time']) {
            const [hours, minutes] = leadData['Follow-up Time'].split(':');
            scheduledFor.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          }

          await Notification.create({
            recipient: assigned_user,
            title: `Follow-up: ${newLead.business_name}`,
            message: `Bulk uploaded follow-up for ${newLead.business_name}`,
            type: 'follow_up',
            related_id: newLead._id,
            related_model: 'Lead',
            scheduled_for: scheduledFor
          });
        }

        // Assignment Notification (Always notify if assigned to someone else)
        if (assigned_user && assigned_user.toString() !== req.user._id.toString()) {
          await Notification.create({
            recipient: assigned_user,
            title: 'New Lead Directly Assigned',
            message: `Lead directly assigned via bulk upload: ${newLead.business_name}`,
            type: 'lead_assigned',
            related_id: newLead._id,
            related_model: 'Lead'
          });
        }
      } catch (err) {
        errors.push({ vendor: leadData['Vendor Name'], error: err.message });
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        processed: createdLeads.length,
        failed: errors.length,
        errors
      }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};
