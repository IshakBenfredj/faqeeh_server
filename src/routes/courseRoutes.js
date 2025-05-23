const express = require('express');
const {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  updateCourseStatus
} = require('../controllers/coursesController');
const { protect, admin } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

const router = express.Router();

router.route('/').get(getCourses).post(protect, admin, upload.single("image"), createCourse);
router.route('/:id').get(getCourse).put(protect, admin, upload.single("image"), updateCourse).delete(protect, admin, deleteCourse);
router.put('/:id/activate', protect, admin, updateCourseStatus);

module.exports = router;