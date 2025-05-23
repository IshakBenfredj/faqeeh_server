const express = require('express');
const {
  addRating,
  getCourseRatings,
  updateRating,
  deleteRating,
  validateRating
} = require('../controllers/ratingsController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/').post(protect, validateRating, addRating);
router.route('/course/:courseId').get(getCourseRatings);
router.route('/:id').put(protect, validateRating, updateRating).delete(protect, deleteRating);

module.exports = router;