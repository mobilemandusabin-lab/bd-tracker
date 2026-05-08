const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

// All routes require authentication
router.use(protect);

// GET /api/v1/tickets - Get all tickets based on role
router.get('/', restrictTo('admin', 'super_admin'), ticketController.getAllTickets);

// GET /api/v1/tickets/admins - Get all admins (for ticket creation)
router.get('/admins', restrictTo('admin', 'super_admin'), ticketController.getAllAdmins);

// GET /api/v1/tickets/:id - Get single ticket
router.get('/:id', restrictTo('admin', 'super_admin'), ticketController.getTicket);

// POST /api/v1/tickets - Create new ticket
router.post('/', restrictTo('admin', 'super_admin'), ticketController.createTicket);

// PUT /api/v1/tickets/:id - Update ticket
router.put('/:id', restrictTo('admin', 'super_admin'), ticketController.updateTicket);

// DELETE /api/v1/tickets/:id - Delete ticket
router.delete('/:id', restrictTo('admin', 'super_admin'), ticketController.deleteTicket);

module.exports = router;
