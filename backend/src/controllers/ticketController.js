const Ticket = require('../models/Ticket');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// Logging helper
const logAction = async (userId, action, details) => {
  try {
    await AuditLog.create({
      user: userId,
      action,
      details,
      created_at: new Date()
    });
  } catch (err) {
    console.error('Failed to log action:', err);
  }
};

// Get all tickets based on user role
exports.getAllTickets = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user._id;
    let query = {};

    // Role-based filtering
    if (userRole === 'super_admin') {
      // SuperAdmin can view all tickets
      // No filter applied
    } else if (userRole === 'admin') {
      // Admin can view tickets they sent or received
      query.$or = [
        { from_user: userId },
        { to_user: userId }
      ];
    } else {
      // Regular users cannot view tickets
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to view tickets'
      });
    }

    const tickets = await Ticket.find(query)
      .populate('from_user', 'name email')
      .populate('to_user', 'name email')
      .sort({ created_at: -1 });

    res.status(200).json({
      status: 'success',
      results: tickets.length,
      data: tickets
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// Get single ticket
exports.getTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('from_user', 'name email')
      .populate('to_user', 'name email')
      .populate('comments.user', 'name email');

    if (!ticket) {
      return res.status(404).json({ status: 'fail', message: 'Ticket not found' });
    }

    // Authorization check
    const userId = req.user._id;
    const userRole = req.user.role;
    const isSuperAdmin = userRole === 'super_admin';
    const isSender = ticket.from_user?._id?.toString() === userId.toString();
    const isReceiver = ticket.to_user?._id?.toString() === userId.toString();

    if (!isSuperAdmin && !isSender && !isReceiver) {
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to view this ticket'
      });
    }

    res.status(200).json({
      status: 'success',
      data: ticket
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// Create new ticket
exports.createTicket = async (req, res) => {
  try {
    const { subject, description, to_admin_id } = req.body;
    const userRole = req.user.role;
    const userId = req.user._id;

    // Validation
    if (!subject || subject.trim().length === 0) {
      return res.status(400).json({ status: 'fail', message: 'Subject is required' });
    }

    if (subject.length > 255) {
      return res.status(400).json({ status: 'fail', message: 'Subject cannot exceed 255 characters' });
    }

    // Only admins and super admins can create tickets
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can create tickets'
      });
    }

    // Check if target user exists and is an admin
    if (!to_admin_id) {
      return res.status(400).json({ status: 'fail', message: 'Please specify the admin to send ticket to' });
    }

    const targetUser = await User.findById(to_admin_id);
    if (!targetUser) {
      return res.status(404).json({ status: 'fail', message: 'Target admin not found' });
    }

    if (targetUser.role !== 'admin' && targetUser.role !== 'super_admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Tickets can only be sent to admins'
      });
    }

    // Cannot create ticket to self
    if (to_admin_id === userId.toString()) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot create ticket to yourself'
      });
    }

    const ticket = await Ticket.create({
      subject,
      description,
      from_user: userId,
      to_user: to_admin_id
    });

    await ticket.populate('from_user', 'name email');
    await ticket.populate('to_user', 'name email');

    // Log the action
    logAction(userId, 'ticket_created', {
      ticketId: ticket._id,
      subject: ticket.subject,
      to_admin: to_admin_id
    });

    res.status(201).json({
      status: 'success',
      data: ticket
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// Update ticket
exports.updateTicket = async (req, res) => {
  try {
    const { status, comment } = req.body;
    const ticketId = req.params.id;
    const userId = req.user._id;
    const userRole = req.user.role;

    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({ status: 'fail', message: 'Ticket not found' });
    }

    // Authorization check
    const isSuperAdmin = userRole === 'super_admin';
    const isSender = ticket.from_user?.toString() === userId.toString();
    const isReceiver = ticket.to_user?.toString() === userId.toString();

    if (!isSuperAdmin && !isSender && !isReceiver) {
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to update this ticket'
      });
    }

    // Update status
    if (status) {
      if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid status value'
        });
      }
      ticket.status = status;
    }

    // Add comment
    if (comment && comment.trim().length > 0) {
      ticket.comments.push({
        text: comment,
        user: userId
      });
    }

    await ticket.save();
    await ticket.populate('from_user', 'name email');
    await ticket.populate('to_user', 'name email');
    await ticket.populate('comments.user', 'name email');

    // Log the action
    logAction(userId, 'ticket_updated', {
      ticketId: ticket._id,
      changes: { status, hasComment: !!comment }
    });

    res.status(200).json({
      status: 'success',
      data: ticket
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// Delete ticket
exports.deleteTicket = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user._id;
    const userRole = req.user.role;

    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({ status: 'fail', message: 'Ticket not found' });
    }

    // Only sender or super admin can delete
    const isSender = ticket.from_user?.toString() === userId.toString();
    const isSuperAdmin = userRole === 'super_admin';

    if (!isSender && !isSuperAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to delete this ticket'
      });
    }

    await Ticket.findByIdAndDelete(ticketId);

    // Log the action
    logAction(userId, 'ticket_deleted', {
      ticketId,
      subject: ticket.subject
    });

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// Get all admins (for ticket creation)
exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({
      role: { $in: ['admin', 'super_admin'] },
      status: 'active'
    }).select('name email department');

    res.status(200).json({
      status: 'success',
      results: admins.length,
      data: admins
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};
