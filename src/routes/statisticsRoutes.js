// routes/statisticsRoutes.js
const express = require('express');
const statisticsController = require('../controllers/statisticsController');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, admin, statisticsController.getPlatformStatistics);

router.get('/user-growth', protect, admin, statisticsController.getUserGrowth);

router.get('/courses', protect, admin, statisticsController.getCourseStatistics);

module.exports = router;