const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

// All routes require authentication
router.use(protect);

// GET /api/v1/tickets - Get all tickets based on role
router.get('/', requirePermission('tickets.view'), ticketController.getAllTickets);

// GET /api/v1/tickets/admins - Get all admins (for ticket creation)
router.get('/admins', requirePermission('tickets.view'), ticketController.getAllAdmins);

// GET /api/v1/tickets/:id - Get single ticket
router.get('/:id', requirePermission('tickets.view'), ticketController.getTicket);

// POST /api/v1/tickets - Create new ticket
router.post('/', requirePermission('tickets.create'), ticketController.createTicket);

// PUT /api/v1/tickets/:id - Update ticket
router.put('/:id', requirePermission('tickets.update'), ticketController.updateTicket);

// DELETE /api/v1/tickets/:id - Delete ticket
router.delete('/:id', requirePermission('tickets.delete'), ticketController.deleteTicket);

module.exports = router;
