const { body, validationResult } = require("express-validator");
const Rating = require("../models/Rating");
const User = require("../models/User");

// @desc    Add rating to course
// @route   POST /api/ratings
// @access  Private
const addRating = async (req, res) => {
  try {
    const { stars, comment, course } = req.body;
    const user = req.user._id;

    if (!user) {
      res.status(400);
      throw new Error("المستخدم غير موجود");
    }
    if (!course) {
      res.status(400);
      throw new Error("معرف الدورة مطلوب");
    }
    if (!stars) {
      res.status(400);
      throw new Error("التقييم مطلوب");
    }

    // Check if user has purchased the course
    const userDoc = await User.findById(user);
    if (!userDoc.purchasedCourses.includes(course)) {
      res.status(400);
      throw new Error("لا يمكنك تقييم دورة غير مشترك بها");
    }

    const existingRating = await Rating.findOne({ user, course });
    if (existingRating) {
      res.status(400);
      throw new Error("لقد قمت بتقييم هذه الدورة بالفعل");
    }

    const rating = await Rating.create({
      stars,
      comment,
      user,
      course,
    });

    await rating.populate("user");

    res
      .status(201)
      .json({ data: rating, success: true, message: "تم إضافة التقييم بنجاح" });
  } catch (error) {
    res.status(res.statusCode || 500).json({ message: error.message });
  }
};

// @desc    Get ratings for a course
// @route   GET /api/ratings/course/:courseId
// @access  Public
const getCourseRatings = async (req, res) => {
  try {
    const ratings = await Rating.find({ course: req.params.courseId })
      .populate("user", "fullName")
      .sort({ createdAt: -1 });

    res.json(ratings);
  } catch (error) {
    res.status(res.statusCode || 500).json({ message: error.message });
  }
};


/**
 * @desc    Get all ratings by user id, populate course
 * @route   GET /api/ratings/user/:userId
 * @access  Public or Private (depending on your needs)
 */
const getUserRatings = async (req, res) => {
  try {
    const ratings = await Rating.find({ user: req.params.userId })
      .populate("course")
      .populate("user")
      .sort({ createdAt: -1 });

    res.json(ratings);
  } catch (error) {
    res.status(res.statusCode || 500).json({ message: error.message });
  }
};

// @desc    Update rating
// @route   PUT /api/ratings/:id
// @access  Private
const updateRating = async (req, res) => {
  try {
    const { stars, comment } = req.body;

    const rating = await Rating.findById(req.params.id);
    if (!rating) {
      res.status(404);
      throw new Error("التقييم غير موجود");
    }

    // Check if the rating belongs to the user
    if (rating.user.toString() !== req.user._id.toString()) {
      res.status(500);
      throw new Error("غير مصرح لك بتحديث هذا التقييم");
    }

    rating.stars = stars || rating.stars;
    rating.comment = comment || rating.comment;

    const updatedRating = await rating.save();
    res.json(updatedRating);
  } catch (error) {
    res.status(res.statusCode || 500).json({ message: error.message });
  }
};

// @desc    Delete rating
// @route   DELETE /api/ratings/:id
// @access  Private
const deleteRating = async (req, res) => {
  try {
    const rating = await Rating.findById(req.params.id);
    if (!rating) {
      res.status(404);
      throw new Error("التقييم غير موجود");
    }

    // Check if the rating belongs to the user or if user is admin
    if (
      rating.user.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      res.status(500);
      throw new Error("غير مصرح لك بحذف هذا التقييم");
    }

    await rating.deleteOne();
    res.json({ message: "تم حذف التقييم" });
  } catch (error) {
    res.status(res.statusCode || 500).json({ message: error.message });
  }
};

// Validation middleware
const validateRating = [
  body("stars")
    .isInt({ min: 1, max: 5 })
    .withMessage("يجب أن يكون التقييم بين 1 و 5"),
  body("course").notEmpty().withMessage("معرف الدورة مطلوب"),
];

module.exports = {
  addRating,
  getCourseRatings,
  updateRating,
  deleteRating,
  validateRating,
  getUserRatings
};
