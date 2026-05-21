const Lead = require('../models/Lead');
const NepalcanOrder = require('../models/NepalcanOrder');
const User = require('../models/User');
const PipelineStage = require('../models/PipelineStage');
const appEventEmitter = require('../services/eventService');

const LEAD_STATUSES = ['New', 'Contacted', 'Interested', 'Meeting Scheduled'];
const VENDOR_STATUSES = ['Negotiation', 'Document Pending', 'Verification', 'Onboarding', 'Activated', 'Active Seller', 'Lost', 'Self Registered'];

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

    // Set default email to TBD if not provided
    if (!leadData.email || leadData.email.trim() === '') {
      leadData.email = 'TBD';
    }

    // Set default contact_person to TBD if not provided
    if (!leadData.contact_person || leadData.contact_person.trim() === '') {
      leadData.contact_person = 'TBD';
    }
    
    // Set default phone to TBD if not provided
    if (!leadData.phone || leadData.phone.trim() === '') {
      leadData.phone = 'TBD';
    }

    // Set default category to Other if not provided
    if (!leadData.category || leadData.category.trim() === '') {
      leadData.category = 'Other';
    }

    // Set default location to TBD if not provided
    if (!leadData.location || leadData.location.trim() === '') {
      leadData.location = 'TBD';
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
    
    // Database search mode (all=true with search) allows searching entire database for all users
    const isGlobalSearch = req.query.all === 'true' && req.query.search;
    
    // Filter by type to determine visibility rules
    const isVendorView = req.query.type === 'vendor';

    // Super admin sees all leads/vendors by default
    // Regular users see only their assigned leads
    // For vendors: regular users see all vendors EXCEPT when unassigned filter is used
    if (user.role !== 'super_admin' && !isGlobalSearch) {
      if (!isVendorView) {
        query.assigned_user = user._id;
      } else if (isVendorView && req.query.unassigned !== 'true') {
        // For vendor view, non-super-admin users only see their assigned vendors
        query.assigned_user = user._id;
      }
    }

    // Unassigned vendors filter - visible to all users
    if (isVendorView && req.query.unassigned === 'true') {
      query.assigned_user = null;
    }

    // Filter by assignment status if provided
    if (req.query.assignment_status && !isGlobalSearch) {
      query.assignment_status = req.query.assignment_status;
    }

    // Special handling for "recent" - show both pending and accepted (newly assigned leads)
    if (req.query.recent === 'true') {
      query.assignment_status = { $in: ['pending', 'accepted'] };
    }

    // Filter by type field (lead or vendor) - supports vendor management
    if (req.query.type === 'vendor') {
      query.lead_status = { $in: VENDOR_STATUSES };
    } else if (req.query.type === 'lead') {
      query.lead_status = { $in: LEAD_STATUSES };
    }

    // Filter by lead status if provided (overrides type filter)
    if (req.query.lead_status) {
      query.lead_status = req.query.lead_status;
    }

    // Filter by verification status
    if (req.query.verification_status) {
      query.verification_status = req.query.verification_status;
    }

    // Filter by active_seller flag
    if (req.query.active_seller === 'true') {
      query.active_seller = true;
    }

    // Filter by category (leads or vendors) - super_admin only
    if (req.query.category && req.user.role === 'super_admin') {
      const allowedStatuses = req.query.category === 'vendors' ? VENDOR_STATUSES : LEAD_STATUSES;
      query.lead_status = { $in: allowedStatuses };
    }

    // Search functionality - search by business_name, contact_person, phone, email, location
    if (req.query.search) {
      const searchTerm = req.query.search.trim();
      query.$or = [
        { business_name: { $regex: searchTerm, $options: 'i' } },
        { contact_person: { $regex: searchTerm, $options: 'i' } },
        { phone: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { location: { $regex: searchTerm, $options: 'i' } }
      ];
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
    const query = { _id: req.params.id };
    
    // Visibility check - super_admin sees all, others see assigned leads
    // Use $or to allow access if lead is either assigned to user OR created by user
    if (req.user.role !== 'super_admin') {
      query.assigned_user = req.user._id;
    }
    
    const lead = await Lead.findOne(query).populate('assigned_user', 'name email');
    if (!lead) return res.status(404).json({ status: 'fail', message: 'No lead found or access denied' });
    res.status(200).json({ status: 'success', data: { lead } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.updateLead = async (req, res) => {
  try {
    // Validate phone number (must be 10 digits if provided)
    if (req.body.phone && !/^\d{10}$/.test(req.body.phone)) {
      return res.status(400).json({ status: 'fail', message: 'Phone number must be exactly 10 digits' });
    }

    const query = { _id: req.params.id };
    
    // Strict visibility check for update
    if (req.user.role !== 'super_admin') {
      query.assigned_user = req.user._id;
    }

    const oldLead = await Lead.findOne(query);
    if (!oldLead) return res.status(404).json({ status: 'fail', message: 'No lead found or access denied' });

    const previousStatus = oldLead.lead_status;
    
    // Auto-assign lead to current user if it's unassigned and they are taking an action
    if (!oldLead.assigned_user) {
      req.body.assigned_user = req.user._id;
    }

    // Add logic for tracking activated leads
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

exports.getUnassignedNepalcanLeads = async (req, res) => {
  try {
    const query = {
      assigned_user: null,
      nepalcanId: { $exists: true, $ne: null }
    };

    const leads = await Lead.find(query)
      .populate('assigned_user', 'name email role')
      .populate('creator_id', 'name email role')
      .sort({ created_at: -1 });

    res.status(200).json({
      status: 'success',
      results: leads.length,
      data: { leads }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getLeadsByCategory = async (req, res) => {
  try {
    const category = req.params.category; // 'leads' or 'vendors'
    
    if (!['leads', 'vendors'].includes(category)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid category. Use "leads" or "vendors"' });
    }

    // Get dynamic stages from database based on category
    const stageCategory = category === 'vendors' ? 'vendor' : 'lead';
    const stages = await PipelineStage.find({ category: stageCategory, isActive: true })
      .sort('order')
      .select('name');
    
    const allowedStatuses = stages.map(s => s.name);

    // Only filter by assigned_user if specifically requested (for unassigned-vendors view)
    const query = {
      lead_status: { $in: allowedStatuses }
    };

    // Optional filter for unassigned leads only
    if (req.query.unassigned === 'true') {
      query.assigned_user = null;
    }

    // Role-based visibility
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
      query.assigned_user = req.user._id;
    }

    // Search functionality
    if (req.query.search) {
      const searchTerm = req.query.search.trim();
      query.$or = [
        { business_name: { $regex: searchTerm, $options: 'i' } },
        { contact_person: { $regex: searchTerm, $options: 'i' } },
        { phone: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { location: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    const leads = await Lead.find(query)
      .populate('assigned_user', 'name email role')
      .populate('creator_id', 'name email role')
      .sort({ created_at: -1 });

    res.status(200).json({
      status: 'success',
      results: leads.length,
      data: { leads, category, type: category === 'vendors' ? 'Vendor' : 'Lead' }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.deleteLead = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    
    // Strict visibility check for delete
    if (req.user.role !== 'super_admin') {
      query.assigned_user = req.user._id;
    }

    const lead = await Lead.findOneAndDelete(query);
    if (!lead) return res.status(404).json({ status: 'fail', message: 'No lead found or access denied' });
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// Get Active Sellers - vendors with delivered orders from NepalcanOrder
exports.getActiveSellers = async (req, res) => {
  try {
    // Get unique vendor_lead_ids from delivered orders with metrics
    const vendorOrders = await NepalcanOrder.aggregate([
      { $match: { orderStatus: 'Delivered' } },
      { $group: { 
        _id: '$vendor_lead_id', 
        vendorName: { $first: '$vendor' },
        orderCount: { $sum: 1 }, 
        totalAmount: { $sum: '$totalAmount' }, 
        lastOrderDate: { $max: '$updatedAt' } 
      } },
      { $sort: { orderCount: -1 } },
      { $limit: 1000 }
    ]);
    
    // Get lead IDs (for vendor_lead_id matches)
    const leadIds = vendorOrders.map(v => v._id).filter(Boolean);
    
    // Get vendor names for fallback matching
    const vendorNames = vendorOrders.map(v => v.vendorName).filter(Boolean);
    
    // Find Lead records matching these vendor_lead_ids first, then by vendor name
    const leadsMap = new Map();
    const leadsByNameMap = new Map();
    
    if (leadIds.length > 0) {
      const leads = await Lead.find({
        _id: { $in: leadIds }
      })
        .populate('assigned_user', 'name email role')
        .populate('creator_id', 'name email role')
        .sort({ last_order_date: -1, created_at: -1 });
      
      leads.forEach(lead => {
        leadsMap.set(lead._id.toString(), lead);
      });
    }
    
    if (vendorNames.length > 0) {
      const leadsByName = await Lead.find({
        type: 'vendor',
        business_name: { $in: vendorNames }
      })
        .populate('assigned_user', 'name email role')
        .populate('creator_id', 'name email role');
      
      leadsByName.forEach(lead => {
        leadsByNameMap.set(lead.business_name.toLowerCase(), lead);
      });
    }
    
    // Build active sellers list
    const activeSellers = vendorOrders.map(vendorData => {
      const { _id: leadId, vendorName, orderCount, totalAmount, lastOrderDate } = vendorData;
      let lead = null;
      
      // First try vendor_lead_id match
      if (leadId) {
        lead = leadsMap.get(leadId.toString());
      }
      
      // Fallback to vendor name match
      if (!lead && vendorName) {
        lead = leadsByNameMap.get(vendorName.toLowerCase());
      }
      
      if (lead) {
        return {
          ...lead.toObject(),
          delivered_order_count: orderCount,
          total_revenue: totalAmount,
          last_order_date: lastOrderDate,
          total_products_listed: lead.total_products_listed || lead.expected_product_count || 0
        };
      }
      
      // No matching lead - create placeholder entry
      return {
        _id: `vendor-${leadId || vendorName}`,
        business_name: vendorName || 'Unknown Vendor',
        contact_person: 'Not Found',
        phone: 'Not Found',
        email: 'Not Found',
        location: 'Not Found',
        lead_status: 'Active Seller',
        type: 'vendor',
        delivered_order_count: orderCount,
        total_revenue: totalAmount,
        last_order_date: lastOrderDate,
        total_products_listed: 0,
        expected_product_count: 0,
        assigned_user: null,
        creator_id: null,
        notes: 'Vendor from Nepalcan orders - no matching lead record'
      };
    });

    // Apply search filter if provided
    let filteredSellers = activeSellers;
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filteredSellers = activeSellers.filter(s =>
        searchRegex.test(s.business_name || '') ||
        searchRegex.test(s.contact_person || '') ||
        searchRegex.test(s.phone || '') ||
        searchRegex.test(s.location || '')
      );
    }

    // Calculate totals from full unfiltered set
    const totalRevenue = vendorOrders.reduce((sum, v) => sum + (v.totalAmount || 0), 0);
    const totalOrders = vendorOrders.reduce((sum, v) => sum + (v.orderCount || 0), 0);

    // Apply pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const startIndex = (page - 1) * limit;
    const paginatedSellers = filteredSellers.slice(startIndex, startIndex + limit);

    res.status(200).json({
      status: 'success',
      results: paginatedSellers.length,
      data: {
        leads: paginatedSellers,
        totalRevenue,
        totalOrders
      },
      pagination: {
        total: filteredSellers.length,
        page,
        limit,
        totalPages: Math.ceil(filteredSellers.length / limit)
      }
    });
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
        
        // Prepare lead data with proper handling of empty/undefined values
        const leadPayload = {
          business_name: vendorName,
          contact_person: vendorName, // Default to vendor name as contact person
          phone: phone,
          email: 'TBD', // To be filled by BD
          category: 'General',
          location: 'TBD', // To be filled by BD
          lead_source: 'Bulk Upload',
          assigned_user: assignedUser,
          creator_id: req.user._id,
          lead_status: 'New',
          assignment_status: assignmentStatus,
          notes: remarks || 'Bulk uploaded - pending details'
        };
        
        const newLead = await Lead.create(leadPayload);

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
