const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const Task = require('../models/Task');
const NepalcanOrder = require('../models/NepalcanOrder');
const SystemSyncLog = require('../models/SystemSyncLog');
const NepalcanSyncLog = require('../models/NepalcanSyncLog');
const Goal = require('../models/Goal');
const User = require('../models/User');

exports.getStats = async (req, res) => {
  try {
    const leadStats = await Lead.aggregate([
      {
        $group: {
          _id: '$lead_status',
          count: { $sum: 1 }
        }
      }
    ]);

    const onboardingStats = await Lead.aggregate([
      {
        $match: { type: 'vendor' }
      },
      {
        $group: {
          _id: '$onboarding_stage',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalLeads = await Lead.countDocuments();
    const activeSellers = await Lead.countDocuments({ lead_status: 'Active Seller' });
    const pendingTasks = await Task.countDocuments({ status: 'pending' });
    const pendingFollowups = await Activity.countDocuments({ follow_up_required: true, status: 'pending' });

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
        onboardingStats,
        __userRole: req.user.role
      }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getLeadGrowth = async (req, res) => {
  try {
    const growth = await Lead.aggregate([
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

// Comprehensive BD Leaderboard with conversion tracking and revenue
exports.getBDLeaderboardFull = async (req, res) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;
    
    // Calculate date range
    const now = new Date();
    let start = new Date();
    let end = new Date();
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      switch(period) {
        case 'today':
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          break;
        case 'week':
          start.setDate(now.getDate() - 7);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          break;
        case 'month':
          start.setMonth(now.getMonth() - 1);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          break;
        case 'quarter':
          start.setMonth(now.getMonth() - 3);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          break;
        case 'year':
          start.setFullYear(now.getFullYear() - 1);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          break;
        default:
          start.setMonth(now.getMonth() - 1);
      }
    }

    // Get BD Leaderboard Data
    const leaderboard = await Lead.aggregate([
      {
        $match: {
          assigned_user: { $exists: true, $ne: null },
          created_at: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$assigned_user',
          bd_name: { $first: '$assigned_user_name' },
          total_leads: { $sum: 1 },
          converted_leads: {
            $sum: { $cond: [{ $eq: ['$lead_status', 'Activated'] }, 1, 0] }
          },
          active_sellers: {
            $sum: { $cond: [{ $eq: ['$lead_status', 'Active Seller'] }, 1, 0] }
          },
          total_sales: { $sum: { $cond: [{ $ifNull: ['$total_revenue', 0] }, '$total_revenue', 0] } },
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
                    { $gte: ['$created_at', start] },
                    { $lte: ['$created_at', end] }
                  ]
                }
              }
            },
            { $count: 'count' }
          ],
          as: 'activity_count'
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
        $addFields: {
          activities: { $ifNull: [{ $arrayElemAt: ['$activity_count.count', 0] }, 0] },
          bd_name: '$user.name',
          conversion_rate: {
            $cond: [
              { $eq: ['$total_leads', 0] },
              0,
              { $multiply: [{ $divide: ['$converted_leads', '$total_leads'] }, 100] }
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          bd_name: 1,
          total_leads: 1,
          converted_leads: 1,
          active_sellers: 1,
          conversion_rate: 1,
          activities: 1,
          total_sales: 1,
          avg_lead_score: { $ifNull: ['$avg_lead_score', 0] },
          avg_conversion_days: {
            $cond: [
              { $eq: ['$converted_leads', 0] },
              0,
              { $divide: [{ $divide: ['$total_conversion_time', 1000 * 60 * 60 * 24] }, '$converted_leads'] }
            ]
          }
        }
      }
    ]);

    // Calculate overall scores and sort
    const leaderboardWithScores = leaderboard.map(item => ({
      ...item,
      overall_score: parseFloat((
        (item.conversion_rate || 0) * 0.4 +
        Math.min(100, (item.activities || 0)) * 0.2 +
        (item.total_sales || 0) / 10000 * 0.2 +
        (100 - Math.min(100, item.avg_conversion_days || 0)) * 0.2
      ).toFixed(2))
    }));

    leaderboardWithScores.sort((a, b) => b.overall_score - a.overall_score);

    res.status(200).json({
      status: 'success',
      data: { leaderboard: leaderboardWithScores }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// Get detailed drill-down data for a specific BD
exports.getBDDrillDown = async (req, res) => {
  try {
    const { bdId } = req.params;
    const { period = 'month', startDate, endDate } = req.query;
    
    const now = new Date();
    let start = new Date();
    let end = new Date();
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      start.setMonth(now.getMonth() - 1);
    }

    // Get orders for this BD (from NepalcanOrder)
    const orders = await NepalcanOrder.aggregate([
      {
        $lookup: {
          from: 'leads',
          localField: 'vendor_lead_id',
          foreignField: '_id',
          as: 'lead'
        }
      },
      { $unwind: '$lead' },
      {
        $match: {
          'lead.assigned_user': bdId,
          orderStatus: 'Delivered',
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $project: {
          _id: 1,
          orderId: 1,
          vendor: 1,
          totalAmount: 1,
          createdAt: 1,
          deliveredAt: '$updatedAt'
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    // Get vendors for this BD
    const vendors = await Lead.find({
      assigned_user: bdId,
      type: 'vendor',
      created_at: { $gte: start, $lte: end }
    }).select('business_name lead_status total_revenue delivered_order_count created_at');

    // Get leads for this BD
    const leads = await Lead.find({
      assigned_user: bdId,
      created_at: { $gte: start, $lte: end }
    }).select('business_name lead_status created_at converted_at');

    // Get activities for this BD
    const activities = await Activity.find({
      user_id: bdId,
      created_at: { $gte: start, $lte: end }
    }).select('activity_type description created_at lead_id').populate('lead_id', 'business_name');

    res.status(200).json({
      status: 'success',
      data: { orders, vendors, leads, activities }
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

        // Prepare lead data with proper handling of empty/undefined values
        const leadPayload = {
          business_name: normalizedData['vendor name'] || 'Unknown Vendor',
          contact_person: normalizedData['contact name'] && normalizedData['contact name'].trim() !== '' 
            ? normalizedData['contact name'] 
            : 'TBD',
          phone: normalizedData['phone'] && normalizedData['phone'].trim() !== '' 
            ? normalizedData['phone'] 
            : 'TBD',
          email: normalizedData['email'] && normalizedData['email'].trim() !== '' 
            ? normalizedData['email'] 
            : 'TBD',
          category: normalizedData['category'] && normalizedData['category'].trim() !== '' 
            ? normalizedData['category'] 
            : 'Other',
          location: normalizedData['location'] && normalizedData['location'].trim() !== '' 
            ? normalizedData['location'] 
            : 'TBD',
          lead_status: normalizedData['status'] && normalizedData['status'].trim() !== '' 
            ? normalizedData['status'] 
            : 'Interested',
          lead_source: 'Bulk Upload',
          assigned_user: assigned_user || req.user._id,
          assignment_status: 'accepted',
          creator_id: req.user._id,
          notes: normalizedData['discussion details'] || normalizedData['remark'] || normalizedData['notes'] || 'Bulk uploaded lead intelligence'
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

exports.getAnalytics = async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    const now = new Date();
    let startDate;
    switch (period) {
      case '30d': startDate = new Date(now - 30 * 24 * 60 * 60 * 1000); break;
      case '90d': startDate = new Date(now - 90 * 24 * 60 * 60 * 1000); break;
      case '6m': startDate = new Date(now - 180 * 24 * 60 * 60 * 1000); break;
      case '1y': startDate = new Date(now - 365 * 24 * 60 * 60 * 1000); break;
      case 'all': startDate = new Date(0); break;
      default: startDate = new Date(0);
    }

    const [funnel, monthlyTrends, sourceConversion, categoryConversion, dropReasons, activityHeatmap, revenueTrend, scoreDistribution, avgConversionTime, totalLeads, totalConverted, totalLost, totalRevenue, totalVendors, activeVendors, vendorTrends, allGoals] = await Promise.all([
      Lead.aggregate([
        { $match: { created_at: { $gte: startDate } } },
        { $group: { _id: '$lead_status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Lead.aggregate([
        { $match: { created_at: { $gte: startDate } } },
        {
          $group: {
            _id: { year: { $year: '$created_at' }, month: { $month: '$created_at' } },
            created: { $sum: 1 },
            converted: { $sum: { $cond: [{ $in: ['$lead_status', ['Activated', 'Active Seller']] }, 1, 0] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      Lead.aggregate([
        { $match: { created_at: { $gte: startDate } } },
        {
          $group: {
            _id: '$lead_source',
            total: { $sum: 1 },
            converted: { $sum: { $cond: [{ $in: ['$lead_status', ['Activated', 'Active Seller']] }, 1, 0] } }
          }
        },
        { $sort: { total: -1 } }
      ]),
      Lead.aggregate([
        { $match: { created_at: { $gte: startDate }, category: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$category',
            total: { $sum: 1 },
            converted: { $sum: { $cond: [{ $in: ['$lead_status', ['Activated', 'Active Seller']] }, 1, 0] } }
          }
        },
        { $sort: { total: -1 } },
        { $limit: 10 }
      ]),
      Lead.aggregate([
        { $match: { lead_status: 'Lost', drop_reason: { $exists: true, $ne: null }, created_at: { $gte: startDate } } },
        { $group: { _id: '$drop_reason', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Activity.aggregate([
        { $match: { created_at: { $gte: startDate } } },
        { $group: { _id: { day: { $dayOfWeek: '$created_at' }, hour: { $hour: '$created_at' } }, count: { $sum: 1 } } }
      ]),
      NepalcanOrder.aggregate([
        { $match: { createdAt: { $gte: startDate }, orderStatus: 'Delivered' } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      Lead.aggregate([
        { $match: { created_at: { $gte: startDate } } },
        { $bucket: { groupBy: '$lead_score', boundaries: [0, 21, 41, 61, 81, 101], default: '100+', output: { count: { $sum: 1 } } } }
      ]),
      Lead.aggregate([
        { $match: { converted_at: { $exists: true, $ne: null }, created_at: { $gte: startDate } } },
        { $project: { daysToConvert: { $divide: [{ $subtract: ['$converted_at', '$created_at'] }, 86400000] } } },
        { $group: { _id: null, avgDays: { $avg: '$daysToConvert' }, minDays: { $min: '$daysToConvert' }, maxDays: { $max: '$daysToConvert' } } }
      ]),
      Lead.countDocuments({ created_at: { $gte: startDate } }),
      Lead.countDocuments({ lead_status: { $in: ['Activated', 'Active Seller'] }, created_at: { $gte: startDate } }),
      Lead.countDocuments({ lead_status: 'Lost', created_at: { $gte: startDate } }),
      NepalcanOrder.aggregate([
        { $match: { orderStatus: 'Delivered', createdAt: { $gte: startDate } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ]),
      Lead.countDocuments({ type: 'vendor', created_at: { $gte: startDate } }),
      Lead.countDocuments({ type: 'vendor', active_seller: true, created_at: { $gte: startDate } }),
      // Vendor monthly trends - total vs verified
      Lead.aggregate([
        { $match: { type: 'vendor', created_at: { $gte: startDate } } },
        {
          $group: {
            _id: { year: { $year: '$created_at' }, month: { $month: '$created_at' } },
            total: { $sum: 1 },
            verified: {
              $sum: {
                $cond: [
                  { $in: ['$lead_status', ['Activated', 'Active Seller', 'Verification']] },
                  1, 0
                ]
              }
            },
            activeSellers: {
              $sum: { $cond: ['$active_seller', 1, 0] }
            }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      // All active goals for admin goal vs achieved view
      Goal.find({ status: 'active', $or: [{ end_date: { $gte: now } }, { end_date: null }] })
        .populate('assigned_to', 'name email')
        .sort({ start_date: -1 }).lean()
    ]);

    // === NEW ANALYTICS SECTION ===

    // 1. Pipeline Stage Velocity — how long do leads stay in each stage?
    const stageVelocity = await Lead.aggregate([
      { $match: { lead_status: { $ne: null }, created_at: { $gte: startDate } } },
      { $group: {
        _id: '$lead_status',
        count: { $sum: 1 },
        avgDaysInStage: {
          $avg: {
            $divide: [
              { $subtract: ['$updated_at', '$created_at'] },
              86400000
            ]
          }
        }
      }},
      { $sort: { count: -1 } }
    ]);

    // For converted leads: avg days per stage (approximation using created_at → converted_at spread)
    const stageVelocityConverted = await Lead.aggregate([
      { $match: { converted_at: { $exists: true, $ne: null }, created_at: { $gte: startDate } } },
      { $project: {
        lead_status: 1,
        totalDays: { $divide: [{ $subtract: ['$converted_at', '$created_at'] }, 86400000] },
        created_at: 1
      }},
      { $bucket: {
        groupBy: '$totalDays',
        boundaries: [0, 7, 14, 30, 60, 90, 180, 365, 9999],
        default: '365+',
        output: { count: { $sum: 1 }, avgDays: { $avg: '$totalDays' } }
      }}
    ]);

    // 2. Loss Analysis Deep Dive — by BD, by source, by category, time-to-loss
    const lossByBD = await Lead.aggregate([
      { $match: { lead_status: 'Lost', created_at: { $gte: startDate } } },
      { $group: { _id: '$assigned_user', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: { name: '$user.name', count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const lossBySource = await Lead.aggregate([
      { $match: { lead_status: 'Lost', created_at: { $gte: startDate } } },
      { $group: { _id: '$lead_source', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const lossByCategory = await Lead.aggregate([
      { $match: { lead_status: 'Lost', category: { $exists: true, $ne: null }, created_at: { $gte: startDate } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const lossTimeline = await Lead.aggregate([
      { $match: { lead_status: 'Lost', drop_date: { $exists: true, $ne: null }, created_at: { $gte: startDate } } },
      { $project: {
        daysToLoss: { $divide: [{ $subtract: ['$drop_date', '$created_at'] }, 86400000] }
      }},
      { $bucket: {
        groupBy: '$daysToLoss',
        boundaries: [0, 7, 14, 30, 60, 90, 180, 365, 9999],
        default: '365+',
        output: { count: { $sum: 1 } }
      }}
    ]);

    // Source conversion rates with revenue
    const sourceROI = await Lead.aggregate([
      { $match: { lead_source: { $exists: true, $ne: null }, created_at: { $gte: startDate } } },
      { $group: {
        _id: '$lead_source',
        total: { $sum: 1 },
        converted: { $sum: { $cond: [{ $in: ['$lead_status', ['Activated', 'Active Seller']] }, 1, 0] } },
        lost: { $sum: { $cond: [{ $eq: ['$lead_status', 'Lost'] }, 1, 0] } },
        avgLeadScore: { $avg: '$lead_score' }
      }},
      { $addFields: {
        conversionRate: { $cond: [{ $gt: ['$total', 0] }, { $multiply: [{ $divide: ['$converted', '$total'] }, 100] }, 0] }
      }},
      { $sort: { total: -1 } }
    ]);

    // Revenue by source (join through leads → orders)
    const revenueBySource = await NepalcanOrder.aggregate([
      { $match: { orderStatus: 'Delivered', createdAt: { $gte: startDate } } },
      { $lookup: { from: 'leads', localField: 'vendor_lead_id', foreignField: '_id', as: 'lead' } },
      { $unwind: { path: '$lead', preserveNullAndEmptyArrays: false } },
      { $group: {
        _id: '$lead.lead_source',
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 }
      }},
      { $sort: { revenue: -1 } }
    ]);

    // Merge revenue into sourceROI
    const revenueSourceMap = {};
    for (const r of revenueBySource) {
      if (r._id) revenueSourceMap[r._id] = r;
    }
    const enrichedSourceROI = sourceROI.map(s => ({
      ...s,
      revenue: revenueSourceMap[s._id]?.revenue || 0,
      orders: revenueSourceMap[s._id]?.orders || 0
    }));

    // 3. Sync Health — from SystemSyncLog + NepalcanSyncLog
    const SystemSyncLog = require('../models/SystemSyncLog');
    const NepalcanSyncLog = require('../models/NepalcanSyncLog');

    const syncHealth = await SystemSyncLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: {
        _id: null,
        total: { $sum: 1 },
        successful: { $sum: { $cond: ['$success', 1, 0] } },
        failed: { $sum: { $cond: ['$success', 0, 1] } },
        avgDurationMs: { $avg: '$durationMs' }
      }}
    ]);

    const syncTimeline = await SystemSyncLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $project: {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        success: 1,
        durationMs: 1
      }},
      { $group: {
        _id: '$date',
        total: { $sum: 1 },
        successful: { $sum: { $cond: ['$success', 1, 0] } },
        avgDuration: { $avg: '$durationMs' }
      }},
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ]);

    // BD Self-Comparison data
    const allUsers = await User.find({ role: { $in: ['user', 'admin'] }, status: 'active' })
      .select('name role team').lean();

    const bdMetrics = await Lead.aggregate([
      { $match: { assigned_user: { $exists: true, $ne: null }, created_at: { $gte: startDate } } },
      { $group: {
        _id: '$assigned_user',
        totalLeads: { $sum: 1 },
        converted: { $sum: { $cond: [{ $in: ['$lead_status', ['Activated', 'Active Seller']] }, 1, 0] } },
        lost: { $sum: { $cond: [{ $eq: ['$lead_status', 'Lost'] }, 1, 0] } },
        avgScore: { $avg: '$lead_score' }
      }}
    ]);

    const bdActivityCounts = await Activity.aggregate([
      { $match: { created_at: { $gte: startDate } } },
      { $group: { _id: '$user_id', activities: { $sum: 1 } } }
    ]);

    const bdRevenue = await NepalcanOrder.aggregate([
      { $match: { orderStatus: 'Delivered', createdAt: { $gte: startDate } } },
      { $lookup: { from: 'leads', localField: 'vendor_lead_id', foreignField: '_id', as: 'lead' } },
      { $unwind: { path: '$lead', preserveNullAndEmptyArrays: false } },
      { $match: { 'lead.assigned_user': { $exists: true, $ne: null } } },
      { $group: { _id: '$lead.assigned_user', revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }
    ]);

    // Build BD comparison data
    const activityMap = {};
    for (const a of bdActivityCounts) activityMap[a._id?.toString()] = a.activities;
    const revenueMap = {};
    for (const r of bdRevenue) revenueMap[r._id?.toString()] = r;

    const bdComparison = bdMetrics.map(m => {
      const userId = m._id?.toString();
      const rev = revenueMap[userId] || { revenue: 0, orders: 0 };
      const userInfo = allUsers.find(u => u._id?.toString() === userId);
      return {
        user_id: userId,
        user_name: userInfo?.name || 'Unknown',
        user_team: userInfo?.team || '',
        totalLeads: m.totalLeads,
        converted: m.converted,
        lost: m.lost,
        conversionRate: m.totalLeads > 0 ? Math.round((m.converted / m.totalLeads) * 1000) / 10 : 0,
        avgLeadScore: Math.round(m.avgScore || 0),
        activities: activityMap[userId] || 0,
        revenue: rev.revenue || 0,
        orders: rev.orders || 0
      };
    });

    // Team averages for BD comparison
    const teamAvg = bdComparison.length > 0 ? {
      totalLeads: Math.round(bdComparison.reduce((s, b) => s + b.totalLeads, 0) / bdComparison.length),
      converted: Math.round(bdComparison.reduce((s, b) => s + b.converted, 0) / bdComparison.length),
      conversionRate: Math.round(bdComparison.reduce((s, b) => s + b.conversionRate, 0) / bdComparison.length * 10) / 10,
      avgLeadScore: Math.round(bdComparison.reduce((s, b) => s + b.avgLeadScore, 0) / bdComparison.length),
      activities: Math.round(bdComparison.reduce((s, b) => s + b.activities, 0) / bdComparison.length),
      revenue: Math.round(bdComparison.reduce((s, b) => s + b.revenue, 0) / bdComparison.length),
      orders: Math.round(bdComparison.reduce((s, b) => s + b.orders, 0) / bdComparison.length)
    } : {};

    // 4. Customer Cohort Retention — first order month → return rate
    const customerFirstOrder = await NepalcanOrder.aggregate([
      { $match: { orderStatus: 'Delivered', createdAt: { $gte: startDate } } },
      { $group: {
        _id: '$customer',
        firstOrder: { $min: '$createdAt' },
        orderCount: { $sum: 1 },
        totalSpent: { $sum: '$totalAmount' }
      }},
      { $match: { orderCount: { $gt: 0 } } },
      { $project: {
        firstOrderMonth: { $dateToString: { format: '%Y-%m', date: '$firstOrder' } },
        orderCount: 1,
        totalSpent: 1,
        isRepeat: { $cond: [{ $gt: ['$orderCount', 1] }, true, false] }
      }},
      { $group: {
        _id: '$firstOrderMonth',
        totalCustomers: { $sum: 1 },
        repeatCustomers: { $sum: { $cond: ['$isRepeat', 1, 0] } },
        avgOrders: { $avg: '$orderCount' },
        avgSpent: { $avg: '$totalSpent' }
      }},
      { $addFields: {
        retentionRate: { $cond: [{ $gt: ['$totalCustomers', 0] }, { $multiply: [{ $divide: ['$repeatCustomers', '$totalCustomers'] }, 100] }, 0] }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Compute goal progress using each goal's own date range and assigned user
    const goalProgress = await Promise.all(allGoals.map(async (goal) => {
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
      data: {
        period,
        summary: {
          totalLeads,
          totalConverted,
          totalLost,
          totalVendors,
          activeVendors,
          conversionRate: totalLeads > 0 ? ((totalConverted / totalLeads) * 100).toFixed(1) : 0,
          totalRevenue: totalRevenue[0]?.total || 0,
          totalOrders: totalRevenue[0]?.count || 0,
          avgConversionDays: avgConversionTime[0]?.avgDays?.toFixed(1) || 0
        },
        funnel,
        monthlyTrends,
        sourceConversion,
        categoryConversion,
        dropReasons,
        activityHeatmap,
        revenueTrend,
        scoreDistribution,
        vendorTrends,
        goals: goalProgress,
        stageVelocity,
        stageVelocityConverted,
        lossAnalysis: { byBD: lossByBD, bySource: lossBySource, byCategory: lossByCategory, timeline: lossTimeline },
        sourceROI: enrichedSourceROI,
        syncHealth: syncHealth[0] || { total: 0, successful: 0, failed: 0, avgDurationMs: 0 },
        syncTimeline,
        bdComparison: { users: bdComparison, teamAvg },
        customerCohorts: customerFirstOrder
      }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// GET /dashboard/bd-tiers — BD tier scores for all users
exports.getBDTiers = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
        break;
      case 'quarter': {
        const qStart = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), qStart, 1);
        endDate = now;
        break;
      }
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = now;
        break;
      case 'all':
        startDate = new Date(2020, 0, 1);
        endDate = now;
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
    }

    const dateFilter = { $gte: startDate, $lte: endDate };

    // Get all active BD users
    const bdUsers = await User.find({ role: { $in: ['user', 'admin'] }, status: 'active' })
      .select('name role team').lean();

    // Get leads per user (BD leads only, no vendor/listing/QC)
    const leadsPerUser = await Lead.aggregate([
      { $match: { type: 'lead', assigned_user: { $exists: true, $ne: null }, created_at: dateFilter } },
      { $group: {
        _id: '$assigned_user',
        total: { $sum: 1 },
        converted: { $sum: { $cond: [{ $in: ['$lead_status', ['Activated', 'Active Seller']] }, 1, 0] } }
      }}
    ]);

    // Get activities per user
    const activitiesPerUser = await Activity.aggregate([
      { $match: { created_at: dateFilter } },
      { $group: { _id: '$user_id', total: { $sum: 1 } } }
    ]);

    // Get follow-ups completed on time per user
    const followupsPerUser = await Activity.aggregate([
      { $match: { follow_up_required: true, status: 'completed', created_at: dateFilter } },
      { $group: { _id: '$user_id', total: { $sum: 1 } } }
    ]);

    // Get revenue per user (through leads → orders)
    const revenuePerUser = await NepalcanOrder.aggregate([
      { $match: { orderStatus: 'Delivered', createdAt: dateFilter } },
      { $lookup: { from: 'leads', localField: 'vendor_lead_id', foreignField: '_id', as: 'lead' } },
      { $unwind: { path: '$lead', preserveNullAndEmptyArrays: false } },
      { $match: { 'lead.assigned_user': { $exists: true, $ne: null } } },
      { $group: { _id: '$lead.assigned_user', revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }
    ]);

    // Build lookup maps
    const leadsMap = {};
    for (const l of leadsPerUser) leadsMap[l._id?.toString()] = l;
    const activitiesMap = {};
    for (const a of activitiesPerUser) activitiesMap[a._id?.toString()] = a.total;
    const followupsMap = {};
    for (const f of followupsPerUser) followupsMap[f._id?.toString()] = f.total;
    const revenueMap = {};
    for (const r of revenuePerUser) revenueMap[r._id?.toString()] = r;

    // Calculate streak: count months in last 6 where user hit their target
    const streakMonths = 6;
    const streakPromises = [];
    for (let m = 0; m < streakMonths; m++) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - m + 1, 0, 23, 59, 59);
      streakPromises.push(
        Lead.aggregate([
          { $match: { type: 'lead', assigned_user: { $exists: true, $ne: null }, created_at: { $gte: mStart, $lte: mEnd } } },
          { $group: {
            _id: '$assigned_user',
            total: { $sum: 1 },
            converted: { $sum: { $cond: [{ $in: ['$lead_status', ['Activated', 'Active Seller']] }, 1, 0] } }
          }}
        ])
      );
    }
    const streakResults = await Promise.all(streakPromises);

    // Target: 5 leads + 1 activation per month counts as a streak month
    const streakMap = {};
    for (const monthData of streakResults) {
      for (const entry of monthData) {
        const uid = entry._id?.toString();
        if (!uid) continue;
        if (entry.total >= 5 && entry.converted >= 1) {
          streakMap[uid] = (streakMap[uid] || 0) + 1;
        }
      }
    }

    // Calculate tier scores
    const POINTS = { lead: 5, activity: 3, activation: 40, revenue: 8, followup: 5, streak: 75, bonus35: 40, bonus50: 80 };
    const TIERS = [
      { id: 'rookie', name: 'Rookie', icon: '🌱', min: 0, max: 999, color: 'slate' },
      { id: 'riser', name: 'Riser', icon: '📈', min: 1000, max: 2499, color: 'blue' },
      { id: 'hunter', name: 'Hunter', icon: '⚡', min: 2500, max: 4999, color: 'emerald' },
      { id: 'ace', name: 'Ace', icon: '🏆', min: 5000, max: 8999, color: 'amber' },
      { id: 'elite', name: 'Elite', icon: '👑', min: 9000, max: Infinity, color: 'violet' }
    ];

    const bdScores = bdUsers.map(user => {
      const uid = user._id.toString();
      const ld = leadsMap[uid] || { total: 0, converted: 0 };
      const actCount = activitiesMap[uid] || 0;
      const fupCount = followupsMap[uid] || 0;
      const rev = revenueMap[uid] || { revenue: 0, orders: 0 };
      const streak = streakMap[uid] || 0;
      const convRate = ld.total > 0 ? (ld.converted / ld.total) * 100 : 0;
      const revenueLakhs = Math.floor(rev.revenue / 100000);

      const leadPts = ld.total * POINTS.lead;
      const activityPts = actCount * POINTS.activity;
      const activatedPts = ld.converted * POINTS.activation;
      const revenuePts = revenueLakhs * POINTS.revenue;
      const followupPts = fupCount * POINTS.followup;
      const streakPts = streak * POINTS.streak;
      let convBonus = 0;
      if (convRate >= 50) convBonus = POINTS.bonus50;
      else if (convRate >= 35) convBonus = POINTS.bonus35;

      const total = leadPts + activityPts + activatedPts + revenuePts + followupPts + streakPts + convBonus;

      let tier = TIERS[0];
      for (let i = TIERS.length - 1; i >= 0; i--) {
        if (total >= TIERS[i].min) { tier = TIERS[i]; break; }
      }

      return {
        user_id: uid,
        name: user.name,
        team: user.team || '',
        role: user.role,
        score: total,
        tier: { id: tier.id, name: tier.name, icon: tier.icon, color: tier.color },
        breakdown: {
          leads: { count: ld.total, points: leadPts },
          activities: { count: actCount, points: activityPts },
          activated: { count: ld.converted, points: activatedPts },
          revenue: { amount: rev.revenue, lakhs: revenueLakhs, points: revenuePts },
          followups: { count: fupCount, points: followupPts },
          streak: { months: streak, points: streakPts },
          convBonus: { rate: Math.round(convRate * 10) / 10, points: convBonus }
        }
      };
    }).sort((a, b) => b.score - a.score);

    res.status(200).json({
      status: 'success',
      data: {
        period,
        tiers: bdScores,
        tierSummary: TIERS.map(t => ({
          ...t,
          count: bdScores.filter(b => b.tier.id === t.id).length
        }))
      }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// GET /dashboard/my-analytics — User-specific analytics (super_admin can view any user)
exports.getMyAnalytics = async (req, res) => {
  try {
    const { period = 'all', userId: targetUserId, startDate: customStartDate, endDate: customEndDate } = req.query;

    // Super admin can view any user; others see only their own
    const userId = (req.user.role === 'super_admin' && targetUserId) ? targetUserId : req.user._id;

    // Fetch the target user's info for display
    const User = require('../models/User');
    const targetUser = await User.findById(userId).select('name email role').lean();

    const now = new Date();
    let startDate;
    let endDate;
    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (period) {
        case '30d': startDate = new Date(now - 30 * 24 * 60 * 60 * 1000); break;
        case '90d': startDate = new Date(now - 90 * 24 * 60 * 60 * 1000); break;
        case '6m': startDate = new Date(now - 180 * 24 * 60 * 60 * 1000); break;
        case '1y': startDate = new Date(now - 365 * 24 * 60 * 60 * 1000); break;
        case 'all': startDate = new Date(0); break;
        default: startDate = new Date(0);
      }
    }

    const dateFilter = customStartDate && customEndDate
      ? { $gte: startDate, $lte: endDate }
      : { $gte: startDate };

    const matchBase = { assigned_user: userId, created_at: dateFilter };

    const [
      totalLeads,
      totalConverted,
      totalLost,
      myActivities,
      monthlyTrends,
      funnel,
      activityHeatmap,
      conversionTime,
      revenueData,
      goals,
      activatedVendorsCount
    ] = await Promise.all([
      // Total leads assigned to user
      Lead.countDocuments(matchBase),

      // Converted leads
      Lead.countDocuments({ ...matchBase, lead_status: { $in: ['Activated', 'Active Seller'] } }),

      // Lost leads
      Lead.countDocuments({ ...matchBase, lead_status: 'Lost' }),

      // Activity count
      Activity.countDocuments({ user_id: userId, created_at: dateFilter }),

      // Monthly trends
      Lead.aggregate([
        { $match: matchBase },
        {
          $group: {
            _id: { year: { $year: '$created_at' }, month: { $month: '$created_at' } },
            created: { $sum: 1 },
            converted: { $sum: { $cond: [{ $in: ['$lead_status', ['Activated', 'Active Seller']] }, 1, 0] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),

      // Funnel
      Lead.aggregate([
        { $match: matchBase },
        { $group: { _id: '$lead_status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Activity heatmap
      Activity.aggregate([
        { $match: { user_id: userId, created_at: dateFilter } },
        { $group: { _id: { day: { $dayOfWeek: '$created_at' }, hour: { $hour: '$created_at' } }, count: { $sum: 1 } } }
      ]),

      // Average conversion time
      Lead.aggregate([
        { $match: { ...matchBase, converted_at: { $exists: true, $ne: null } } },
        { $project: { daysToConvert: { $divide: [{ $subtract: ['$converted_at', '$created_at'] }, 86400000] } } },
        { $group: { _id: null, avgDays: { $avg: '$daysToConvert' } } }
      ]),

      // Revenue from user's vendors (match by vendor_lead_id)
      NepalcanOrder.aggregate([
        {
          $lookup: {
            from: 'leads',
            localField: 'vendor_lead_id',
            foreignField: '_id',
            as: 'lead'
          }
        },
        { $unwind: { path: '$lead', preserveNullAndEmptyArrays: false } },
        { $match: { 'lead.assigned_user': userId, orderStatus: 'Delivered', createdAt: dateFilter } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            revenue: { $sum: '$totalAmount' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),

      // User's active goals
      Goal.find({
        assigned_to: userId,
        status: 'active',
        $or: [
          { end_date: { $gte: now } },
          { end_date: null }
        ]
      }).sort({ start_date: -1 }).lean(),

      // Activated vendors count for user
      Lead.countDocuments({ assigned_user: userId, $or: [{ active_seller: true }, { lead_status: 'Active Seller' }], created_at: dateFilter })
    ]);

    // Calculate goal progress using each goal's own date range
    const goalProgress = await Promise.all(goals.map(async (goal) => {
      const goalStart = goal.start_date || new Date(0);
      const goalEnd = goal.end_date ? new Date(Math.min(new Date(goal.end_date).getTime(), now.getTime())) : now;
      const goalDateFilter = { $gte: goalStart, $lte: goalEnd };
      const goalMatch = { assigned_user: userId, created_at: goalDateFilter };

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
            { $match: { 'lead.assigned_user': userId } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]);
          currentValue = revData[0]?.total || 0;
          break;
        case 'activated_vendors':
          currentValue = await Lead.countDocuments({ assigned_user: userId, $or: [{ active_seller: true }, { lead_status: 'Active Seller' }], converted_at: goalDateFilter });
          break;
        case 'activities':
        case 'calls':
          currentValue = await Activity.countDocuments({ user_id: userId, created_at: goalDateFilter });
          break;
        default:
          currentValue = goal.current_value || 0;
      }

      const progress = goal.target_value > 0 ? Math.min(Math.round((currentValue / goal.target_value) * 100), 100) : 0;
      return { ...goal, currentValue, progress, remaining: Math.max(goal.target_value - currentValue, 0) };
    }));

    const totalRevenue = revenueData.reduce((sum, r) => sum + r.revenue, 0);
    const totalOrders = revenueData.reduce((sum, r) => sum + r.orders, 0);

    res.status(200).json({
      status: 'success',
      data: {
        period,
        userId,
        targetUser,
        summary: {
          totalLeads,
          totalConverted,
          totalLost,
          conversionRate: totalLeads > 0 ? ((totalConverted / totalLeads) * 100).toFixed(1) : 0,
          totalRevenue,
          totalOrders,
          avgConversionDays: conversionTime[0]?.avgDays?.toFixed(1) || 0,
          totalActivities: myActivities
        },
        funnel,
        monthlyTrends,
        activityHeatmap,
        revenueTrend: revenueData,
        goals: goalProgress
      }
    });
  } catch (err) {
    console.error('Get my analytics error:', err);
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// Helper: get summary stats for a single day
async function getDaySummary(startOfDay, endOfDay) {
  const [activityTypes, totalActivities, leadsConverted, leadsCreated, leadsLost, contactedLeadIds] = await Promise.all([
    Activity.aggregate([
      { $match: { created_at: { $gte: startOfDay, $lte: endOfDay } } },
      { $group: { _id: '$activity_type', count: { $sum: 1 } } }
    ]),
    Activity.countDocuments({ created_at: { $gte: startOfDay, $lte: endOfDay } }),
    Lead.countDocuments({ converted_at: { $gte: startOfDay, $lte: endOfDay } }),
    Lead.countDocuments({ created_at: { $gte: startOfDay, $lte: endOfDay } }),
    Lead.countDocuments({ drop_date: { $gte: startOfDay, $lte: endOfDay } }),
    Activity.distinct('lead_id', { created_at: { $gte: startOfDay, $lte: endOfDay } })
  ]);

  const by_type = {};
  activityTypes.forEach(t => { by_type[t._id] = t.count; });

  return {
    total_activities: totalActivities,
    by_type,
    leads_converted: leadsConverted,
    leads_created: leadsCreated,
    leads_lost: leadsLost,
    leads_contacted: contactedLeadIds.length
  };
}

// GET /dashboard/day-detail?date=2026-05-15
exports.getDayDetail = async (req, res) => {
  try {
    const { date } = req.query;
    let targetDate;
    if (date) {
      const [y, m, d] = date.split('-').map(Number);
      targetDate = new Date(y, m - 1, d);
    } else {
      targetDate = new Date();
    }
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

    const [summary, activities, userBreakdown, convertedLeads, createdLeads, lostLeads, activatedVendors, activeSellers] = await Promise.all([
      getDaySummary(startOfDay, endOfDay),
      Activity.find({ created_at: { $gte: startOfDay, $lte: endOfDay } })
        .populate('user_id', 'name email')
        .populate({ path: 'lead_id', select: 'business_name lead_status' })
        .sort('-created_at')
        .lean(),
      Activity.aggregate([
        { $match: { created_at: { $gte: startOfDay, $lte: endOfDay } } },
        { $group: { _id: { user_id: '$user_id', activity_type: '$activity_type' }, count: { $sum: 1 } } },
        { $group: { _id: '$_id.user_id', types: { $push: { type: '$_id.activity_type', count: '$count' } }, total_activities: { $sum: '$count' } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { _id: 1, 'user.name': 1, 'user.email': 1, types: 1, total_activities: 1 } },
        { $sort: { total_activities: -1 } }
      ]),
      Lead.find({ converted_at: { $gte: startOfDay, $lte: endOfDay } })
        .select('business_name lead_status converted_at assigned_user')
        .populate('assigned_user', 'name')
        .lean(),
      Lead.find({ created_at: { $gte: startOfDay, $lte: endOfDay } })
        .select('business_name lead_status lead_source created_at assigned_user')
        .populate('assigned_user', 'name')
        .lean(),
      Lead.find({ drop_date: { $gte: startOfDay, $lte: endOfDay } })
        .select('business_name drop_reason drop_date assigned_user')
        .populate('assigned_user', 'name')
        .lean(),
      Lead.find({ converted_at: { $gte: startOfDay, $lte: endOfDay } })
        .select('business_name assigned_user converted_at lead_status')
        .populate('assigned_user', 'name')
        .lean(),
      Lead.find({ lead_status: 'Active Seller', converted_at: { $gte: startOfDay, $lte: endOfDay } })
        .select('business_name assigned_user converted_at')
        .populate('assigned_user', 'name')
        .lean()
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        date: dateStr,
        summary,
        user_breakdown: userBreakdown,
        activities,
        converted_leads: convertedLeads,
        created_leads: createdLeads,
        lost_leads: lostLeads,
        activated_vendors: activatedVendors,
        active_sellers: activeSellers
      }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// GET /dashboard/day-compare?date1=2026-05-15&date2=2026-05-14
exports.getDayCompare = async (req, res) => {
  try {
    const { date1, date2 } = req.query;

    const parseDate = (d) => {
      const [y, m, day] = d.split('-').map(Number);
      return new Date(y, m - 1, day);
    };

    const dt1 = parseDate(date1);
    const dt2 = parseDate(date2);

    const start1 = new Date(dt1); start1.setHours(0, 0, 0, 0);
    const end1 = new Date(dt1); end1.setHours(23, 59, 59, 999);
    const start2 = new Date(dt2); start2.setHours(0, 0, 0, 0);
    const end2 = new Date(dt2); end2.setHours(23, 59, 59, 999);

    const [summary1, summary2] = await Promise.all([
      getDaySummary(start1, end1),
      getDaySummary(start2, end2)
    ]);

    const pct = (a, b) => b > 0 ? parseFloat((((a - b) / b) * 100).toFixed(1)) : null;

    const delta = {
      total_activities: summary1.total_activities - summary2.total_activities,
      total_activities_pct: pct(summary1.total_activities, summary2.total_activities),
      calls: (summary1.by_type.call || 0) - (summary2.by_type.call || 0),
      calls_pct: pct(summary1.by_type.call || 0, summary2.by_type.call || 0),
      leads_converted: summary1.leads_converted - summary2.leads_converted,
      leads_converted_pct: pct(summary1.leads_converted, summary2.leads_converted),
      leads_created: summary1.leads_created - summary2.leads_created,
      leads_created_pct: pct(summary1.leads_created, summary2.leads_created),
      leads_lost: summary1.leads_lost - summary2.leads_lost,
      leads_lost_pct: pct(summary1.leads_lost, summary2.leads_lost),
      leads_contacted: summary1.leads_contacted - summary2.leads_contacted,
      leads_contacted_pct: pct(summary1.leads_contacted, summary2.leads_contacted)
    };

    res.status(200).json({
      status: 'success',
      data: {
        date1: { date: date1, summary: summary1 },
        date2: { date: date2, summary: summary2 },
        delta
      }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// GET /dashboard/week-compare?date=2026-05-21
// Compares Sunday-to-selected-date vs previous week same period
exports.getWeekCompare = async (req, res) => {
  try {
    const { date } = req.query;
    const [y, m, d] = date.split('-').map(Number);
    const selectedDate = new Date(y, m - 1, d);

    // Find Sunday of the current week
    const dayOfWeek = selectedDate.getDay(); // 0=Sun, 1=Mon, ...
    const currentSunday = new Date(selectedDate);
    currentSunday.setDate(selectedDate.getDate() - dayOfWeek);
    currentSunday.setHours(0, 0, 0, 0);

    // End is the selected date end of day
    const currentEnd = new Date(selectedDate);
    currentEnd.setHours(23, 59, 59, 999);

    // Previous week: same day-of-week range
    const prevSunday = new Date(currentSunday);
    prevSunday.setDate(prevSunday.getDate() - 7);

    const prevEnd = new Date(currentEnd);
    prevEnd.setDate(prevEnd.getDate() - 7);

    const [currentSummary, prevSummary, currentActivated, prevActivated, currentActiveSellers, prevActiveSellers] = await Promise.all([
      getDaySummary(currentSunday, currentEnd),
      getDaySummary(prevSunday, prevEnd),
      Lead.countDocuments({ converted_at: { $gte: currentSunday, $lte: currentEnd } }),
      Lead.countDocuments({ converted_at: { $gte: prevSunday, $lte: prevEnd } }),
      Lead.countDocuments({ lead_status: 'Active Seller', converted_at: { $gte: currentSunday, $lte: currentEnd } }),
      Lead.countDocuments({ lead_status: 'Active Seller', converted_at: { $gte: prevSunday, $lte: prevEnd } })
    ]);

    const pct = (a, b) => b > 0 ? parseFloat((((a - b) / b) * 100).toFixed(1)) : null;

    const currentWeekLabel = `Sun ${currentSunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    const prevWeekLabel = `Sun ${prevSunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${prevEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    res.status(200).json({
      status: 'success',
      data: {
        current_week: {
          label: currentWeekLabel,
          summary: { ...currentSummary, activated: currentActivated, active_sellers: currentActiveSellers }
        },
        previous_week: {
          label: prevWeekLabel,
          summary: { ...prevSummary, activated: prevActivated, active_sellers: prevActiveSellers }
        },
        delta: {
          total_activities: currentSummary.total_activities - prevSummary.total_activities,
          total_activities_pct: pct(currentSummary.total_activities, prevSummary.total_activities),
          calls: (currentSummary.by_type.call || 0) - (prevSummary.by_type.call || 0),
          calls_pct: pct(currentSummary.by_type.call || 0, prevSummary.by_type.call || 0),
          leads_converted: currentSummary.leads_converted - prevSummary.leads_converted,
          leads_converted_pct: pct(currentSummary.leads_converted, prevSummary.leads_converted),
          leads_created: currentSummary.leads_created - prevSummary.leads_created,
          leads_created_pct: pct(currentSummary.leads_created, prevSummary.leads_created),
          leads_lost: currentSummary.leads_lost - prevSummary.leads_lost,
          leads_lost_pct: pct(currentSummary.leads_lost, prevSummary.leads_lost),
          leads_contacted: currentSummary.leads_contacted - prevSummary.leads_contacted,
          leads_contacted_pct: pct(currentSummary.leads_contacted, prevSummary.leads_contacted),
          activated: currentActivated - prevActivated,
          activated_pct: pct(currentActivated, prevActivated),
          active_sellers: currentActiveSellers - prevActiveSellers,
          active_sellers_pct: pct(currentActiveSellers, prevActiveSellers)
        }
      }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// POST /dashboard/sync-all — Manual full sync (super_admin only)
exports.triggerFullSync = async (req, res) => {
  try {
    const { runFullSync } = require('../services/unifiedSyncService');
    const log = await runFullSync('manual', req.user?._id);
    res.status(200).json({
      status: 'success',
      message: log.success ? 'Full sync completed' : 'Sync completed with errors',
      data: log
    });
  } catch (err) {
    console.error('[Sync] Manual sync failed:', err);
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// GET /dashboard/sync-logs — Get recent sync logs
exports.getSyncLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const logs = await SystemSyncLog.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('userId', 'name email')
      .lean();
    res.status(200).json({
      status: 'success',
      data: logs
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};
