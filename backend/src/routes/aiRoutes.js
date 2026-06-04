const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware.protect);

router.post('/ask', aiController.ask);
router.get('/sessions', aiController.getSessions);
router.get('/sessions/:id', aiController.getSession);
router.delete('/sessions/:id', aiController.deleteSession);

module.exports = router;
