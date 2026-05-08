const Lead = require('../models/Lead');
const appEventEmitter = require('../services/eventService');

exports.createLead = async (req, res) => {
  try {
    const leadData = { ...req.body, creator_id: req.user._id };
    const authMiddleware = require('../middlewares/authMiddleware');
    
    // Check if trying to assign to someone else
    if (leadData.assigned_user && leadData.assigned_user !== req.user._id.toString()) {
      // Check if current user can assign to the target user
      const targetUser = await User.findById(leadData.assigned_user);
      if (!targetUser) {
        return res.status(404).json({ status: 'fail', message: 'Target user not found' });
      }

      // Check hierarchy permissions
      const userRoleLevel = authMiddleware.ROLE_HIERARCHY[req.user.role] || 0;
      const targetRoleLevel = authMiddleware.ROLE_HIERARCHY[targetUser.role] || 0;

      // Can only assign to lower or equal hierarchy roles
      if (targetRoleLevel > userRoleLevel) {
        return res.status(403).json({
          status: 'fail',
          message: 'You can only assign leads to users at your level or below'
        });
      }
    }

    // Auto-assign to creator if no assigned_user provided
    if (!leadData.assigned_user || leadData.assigned_user === "") {
      leadData.assigned_user = req.user._id;
      leadData.assignment_status = 'accepted';
    } else {
      // If assigned to someone else, set status to pending unless assigned to self
      if (leadData.assigned_user.toString() === req.user._id.toString()) {
        leadData.assignment_status = 'accepted';
      } else {
        leadData.assignment_status = 'pending';
      }
    }

    const newLead = await Lead.create(leadData);    
    // Calculate and save lead score
    newLead.lead_score = newLead.calculateLeadScore();
    await newLead.save();

    // Emit event for goal tracking if lead is created with a specific status
    if (newLead.lead_status && newLead.assigned_user) {
      appEventEmitter.emit('lead.created', {
        lead: newLead,
        user: req.user
      });
    }

    // Notification for newly assigned user if assigned to someone else
    if (newLead.assignment_status === 'pending') {
      const Notification = require('../models/Notification');
      await Notification.create({
        recipient: newLead.assigned_user,
        title: 'New Lead Assigned',
        message: `You have been assigned a new lead: ${newLead.business_name}. Please accept the assignment.`,
        type: 'lead_assigned',
        related_id: newLead._id,
        related_model: 'Lead'
      });
    }

    res.status(201).json({ status: 'success', data: { lead: newLead } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.checkDuplicity = async (req, res) => {
  try {
    const { field, value } = req.query;
    if (!field || !value) return res.status(400).json({ status: 'fail', message: 'Field and value required' });
    
    const query = {};
    query[field] = value;
    
    const exists = await Lead.findOne(query);
    res.status(200).json({ status: 'success', exists: !!exists });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.acceptAssignment = async (req, res) => {
  try {
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, assigned_user: req.user._id },
      { assignment_status: 'accepted' },
      { new: true }
    );
    if (!lead) return res.status(404).json({ status: 'fail', message: 'No pending assignment found' });
    res.status(200).json({ status: 'success', data: { lead } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getAllLeads = async (req, res) => {
  try {
    const query = {};
    const user = req.user;
    
    // Implement role-based hierarchy for viewing leads
    if (user.role === 'super_admin') {
      // Can see all leads - no filter needed
    } else if (user.role === 'admin') {
      // Can see leads assigned to 'user' role staff, plus own leads
      const juniorUsers = await User.find({ role: 'user' }).select('_id');
      const juniorUserIds = juniorUsers.map(u => u._id);
      juniorUserIds.push(user._id); // Include own ID
      
      query.$or = [
        { assigned_user: { $in: juniorUserIds } },
        { creator_id: { $in: juniorUserIds } }
      ];
    } else {
      // Regular users can only see their own leads
      query.$or = [
        { assigned_user: user._id },
        { creator_id: user._id }
      ];
    }

    // Filter by assignment status if provided
    if (req.query.assignment_status) {
      query.assignment_status = req.query.assignment_status;
    }

    // Filter by lead status if provided
    if (req.query.lead_status) {
      query.lead_status = req.query.lead_status;
    }

    // Pagination support
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 0; // 0 means no limit (for backward compatibility)
    const skip = limit > 0 ? (page - 1) * limit : 0;

    let leadsQuery = Lead.find(query)
      .populate('assigned_user', 'name email role')
      .populate('creator_id', 'name email role')
      .sort({ created_at: -1 });

    // Apply pagination only if limit is specified
    if (limit > 0) {
      leadsQuery = leadsQuery.skip(skip).limit(limit);
    }

    const leads = await leadsQuery;
    
    // Get total count for pagination info (only if pagination is used)
    let totalCount = null;
    if (limit > 0) {
      totalCount = await Lead.countDocuments(query);
    }
    
    const response = {
      status: 'success',
      results: leads.length,
      data: { leads }
    };
    
    if (totalCount !== null) {
      response.pagination = {
        total: totalCount,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalCount / limit)
      };
    }
    
    res.status(200).json(response);
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).populate('assigned_user', 'name email');
    if (!lead) return res.status(404).json({ status: 'fail', message: 'No lead found' });
    res.status(200).json({ status: 'success', data: { lead } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const oldLead = await Lead.findById(req.params.id);
    if (!oldLead) return res.status(404).json({ status: 'fail', message: 'No lead found' });

    const previousStatus = oldLead.lead_status;
    
    // Add logic for tracking conversion and drops
    if (req.body.lead_status === 'Activated' && previousStatus !== 'Activated') {
      req.body.converted_at = Date.now();
    } else if (req.body.lead_status === 'Lost' && previousStatus !== 'Lost') {
      req.body.drop_date = Date.now();
    }

    const updatedLead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    // Recalculate lead score after update
    updatedLead.lead_score = updatedLead.calculateLeadScore();
    await updatedLead.save();

    // Create Activity Log for the note/status change
    const Activity = require('../models/Activity');
    const Notification = require('../models/Notification');

    // Create Activity Log for the current interaction (always completed)
    await Activity.create({
      lead_id: updatedLead._id,
      user_id: req.user._id,
      activity_type: req.body.activity_type || 'follow_up',
      description: req.body.notes || `Status changed to ${updatedLead.lead_status}`,
      status: 'completed'
    });

    // Create a NEW Pending Activity if a future follow-up is scheduled
    if (req.body.follow_up_date) {
      await Activity.create({
        lead_id: updatedLead._id,
        user_id: req.user._id,
        activity_type: 'follow_up',
        description: `Follow-up regarding: ${req.body.notes || updatedLead.lead_status}`,
        follow_up_required: true,
        follow_up_date: req.body.follow_up_date,
        follow_up_time: req.body.follow_up_time || null,
        status: 'pending'
      });

      // Create Notification for the follow-up
      let scheduledFor = new Date(req.body.follow_up_date);
      if (req.body.follow_up_time) {
        const [hours, minutes] = req.body.follow_up_time.split(':');
        scheduledFor.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }

      await Notification.create({
        recipient: req.user._id,
        title: `Follow-up Due: ${updatedLead.business_name}`,
        message: `Time to follow up with ${updatedLead.business_name}.`,
        type: 'follow_up',
        related_id: updatedLead._id,
        related_model: 'Lead',
        scheduled_for: scheduledFor
      });
    }

    if (previousStatus !== updatedLead.lead_status) {
      appEventEmitter.emit('lead.status.changed', {
        lead: updatedLead,
        user: req.user,
        previous_status: previousStatus
      });
    }

    res.status(200).json({ status: 'success', data: { lead: updatedLead } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ status: 'fail', message: 'No lead found' });
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// Bulk upload leads from Excel/CSV (Simplified - only Vendor Name, Phone, Remarks)
exports.bulkUploadLeads = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'fail', message: 'No file uploaded' });
    }

    const XLSX = require('xlsx');
    
    // Read the Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return res.status(400).json({ status: 'fail', message: 'Excel file is empty' });
    }

    const results = {
      total: data.length,
      created: 0,
      skipped: 0,
      errors: []
    };

    for (const row of data) {
      try {
        // Only extract the 3 fields you need
        const vendorName = row['Vendor Name'] || row['Business Name'] || row['business_name'] || '';
        const phone = String(row['Phone Number'] || row['Contact Number'] || row['phone'] || '').trim();
        const remarks = row['Remarks'] || row['remarks'] || '';
        
        // Skip if missing required fields
        if (!vendorName) {
          results.skipped++;
          results.errors.push(`Skipped row: Missing vendor name`);
          continue;
        }

        if (!phone) {
          results.skipped++;
          results.errors.push(`Skipped: Missing phone number for ${vendorName}`);
          continue;
        }

        // Check for duplicates (by phone)
        const existingLead = await Lead.findOne({ phone: phone });
        if (existingLead) {
          results.skipped++;
          results.errors.push(`Skipped duplicate: ${vendorName} (${phone})`);
          continue;
        }

        // Create lead with minimal data
        const assignedUser = req.body.assigned_user || req.user._id;
        // Super admin assignments are auto-accepted, others depend on whether assigned to self
        const assignmentStatus = req.user.role === 'super_admin' || assignedUser.toString() === req.user._id.toString() ? 'accepted' : 'pending';
        
        const newLead = await Lead.create({
          business_name: vendorName,
          contact_person: vendorName, // Default to vendor name
          phone: phone,
          email: `vendor_${Date.now()}_${Math.random().toString(36).substr(2, 5)}@nepalcan.com`, // Dummy email
          category: 'General',
          location: 'TBD', // To be filled by BD
          lead_source: 'Bulk Upload',
          assigned_user: assignedUser,
          creator_id: req.user._id,
          lead_status: 'New',
          assignment_status: assignmentStatus,
          notes: remarks || 'Bulk uploaded - pending details'
        });

        // Calculate lead score
        newLead.lead_score = newLead.calculateLeadScore();
        await newLead.save();

        // Create initial activity log with remarks
        const Activity = require('../models/Activity');
        await Activity.create({
          lead_id: newLead._id,
          user_id: req.user._id,
          activity_type: 'note',
          description: `Initial log: ${remarks || 'No remarks provided'}`,
          status: 'completed'
        });

        // Create notification if assigned to another user
        if (assignmentStatus === 'pending') {
          const Notification = require('../models/Notification');
          await Notification.create({
            recipient: assignedUser,
            title: 'New Lead Assigned',
            message: `You have been assigned a new lead via bulk upload: ${newLead.business_name}. Please accept the assignment.`,
            type: 'lead_assigned',
            related_id: newLead._id,
            related_model: 'Lead'
          });
        }

        results.created++;
      } catch (err) {
        results.errors.push(`Error processing "${row['Vendor Name'] || 'Unknown'}": ${err.message}`);
      }
    }

    res.status(200).json({
      status: 'success',
      data: results
    });

  } catch (err) {
    console.error('Bulk upload error:', err);
    res.status(400).json({ status: 'fail', message: err.message });
  }
};
