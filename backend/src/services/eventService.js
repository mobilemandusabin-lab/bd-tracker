const EventEmitter = require('events');
const Lead = require('../models/Lead');
const AuditLog = require('../models/AuditLog');
const Activity = require('../models/Activity');
const Goal = require('../models/Goal');
const Task = require('../models/Task');
const User = require('../models/User');

class AppEventEmitter extends EventEmitter {}
const appEventEmitter = new AppEventEmitter();

/**
 * Automated Task Generation Rules
 * These functions create tasks based on specific triggers
 */

// Rule 1: Lead stuck in "Negotiation" for 7+ days → Escalate
const checkNegotiationStal = async (lead) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Check if lead has been in Negotiation for 7+ days without update
    if (lead.lead_status === 'Negotiation' && lead.updated_at < sevenDaysAgo) {
      // Check if task already exists
      const existingTask = await Task.findOne({
        title: { $regex: new RegExp(`lead.*${lead._id}.*stuck.*Negotiation`, 'i') },
        status: { $ne: 'Done' }
      });

      if (!existingTask) {
        await Task.create({
          title: `Lead Stuck: ${lead.business_name} in Negotiation > 7 days`,
          description: `This lead has been in Negotiation stage for over 7 days. Please follow up immediately.`,
          status: 'Open',
          priority: 1, // Highest priority
          due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Due in 2 days
          created_by: lead.assigned_user,
          assigned_to: lead.assigned_user,
          department: lead.department
        });
        console.log(`[Auto Task] Created escalation task for lead ${lead.business_name}`);
      }
    }
  } catch (err) {
    console.error('[Auto Task] Error checking negotiation stal:', err.message);
  }
};

// Rule 3: High-value lead with no follow-up in 48 hours
const checkHighValueLeadFollowup = async (lead) => {
  try {
    if (lead.lead_score >= 70 && lead.assigned_user) {
      const fortyEightHoursAgo = new Date();
      fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
      
      // Check last activity
      const lastActivity = await Activity.findOne({
        lead_id: lead._id,
        status: 'completed'
      }).sort({ created_at: -1 });

      if (!lastActivity || lastActivity.created_at < fortyEightHoursAgo) {
        const existingTask = await Task.findOne({
          title: { $regex: new RegExp(`high.*value.*${lead._id}.*follow.*up`, 'i') },
          status: { $ne: 'Done' }
        });

        if (!existingTask) {
          await Task.create({
            title: `URGENT: High-Value Lead ${lead.business_name} Needs Follow-up`,
            description: `This hot lead (score: ${lead.lead_score}) hasn't been contacted in 48+ hours. Immediate action required!`,
            status: 'Open',
            priority: 1,
            due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
            created_by: lead.assigned_user,
            assigned_to: lead.assigned_user,
            department: lead.department
          });
          console.log(`[Auto Task] Created urgent follow-up task for high-value lead ${lead.business_name}`);
        }
      }
    }
  } catch (err) {
    console.error('[Auto Task] Error checking high-value lead:', err.message);
  }
};

// Helper function to update goal progress when lead reaches target stage
const updateGoalProgress = async (lead, userId) => {
  try {
    // Convert lead.assigned_user to string if it's an ObjectId
    const assignedUserId = lead.assigned_user ? lead.assigned_user.toString() : null;
    
    if (!assignedUserId) {
      console.log('No assigned user for lead, skipping goal update');
      return;
    }

    // Find active goals assigned to this user with matching pipeline stage
    const goals = await Goal.find({
      assigned_to: assignedUserId,
      status: 'active',
      pipeline_stage: lead.lead_status
    });

    console.log(`Found ${goals.length} goals for user ${assignedUserId} with pipeline stage ${lead.lead_status}`);

    for (const goal of goals) {
      // Check if the goal period includes today
      const now = new Date();
      const startDate = new Date(goal.start_date);
      const endDate = new Date(goal.end_date);

      if (now >= startDate && now <= endDate) {
        // Increment the current value
        goal.current_value += 1;
        
        // Auto-complete if target reached
        if (goal.current_value >= goal.target_value) {
          goal.status = 'completed';
        }
        
        await goal.save();
        console.log(`Goal progress updated: ${goal.title} now at ${goal.current_value}/${goal.target_value}`);
      } else {
        console.log(`Goal ${goal.title} not in date range: ${startDate} - ${endDate}, now: ${now}`);
      }
    }
  } catch (err) {
    console.error('Error updating goal progress:', err);
  }
};

// Lead Status Change Handler
appEventEmitter.on('lead.status.changed', async ({ lead, user, previous_status }) => {
  // First three are independent — fire in parallel
  await Promise.all([
    Activity.create({
      lead_id: lead._id,
      user_id: user._id,
      activity_type: 'status_change',
      description: `Pipeline changed: ${previous_status} → ${lead.lead_status}`,
      status: 'completed'
    }),
    AuditLog.create({
      user_id: user._id,
      action_type: 'UPDATE',
      module_name: 'Lead',
      record_id: lead._id,
      previous_value: { lead_status: previous_status },
      updated_value: { lead_status: lead.lead_status },
      ip_address: lead.ip
    }),
    updateGoalProgress(lead, user._id)
  ]);

  // Auto-task checks run after; independent of each other
  await Promise.all([
    checkNegotiationStal(lead),
    checkHighValueLeadFollowup(lead)
  ]);
});

// Lead Created Handler - check for goals when new lead is created
appEventEmitter.on('lead.created', async ({ lead, user }) => {
  // If the lead is created with a specific status that matches a goal, update progress
  if (lead.lead_status && lead.assigned_user) {
    await updateGoalProgress(lead, user._id);
  }
});

// Follow-up handler
appEventEmitter.on('activity.followup.created', async ({ activity, user }) => {
  await AuditLog.create({
    user_id: user._id,
    action_type: 'CREATE',
    module_name: 'Activity',
    record_id: activity._id,
    updated_value: activity
  });
});

module.exports = appEventEmitter;
