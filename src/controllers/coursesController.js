const asyncHandler = require("express-async-handler");
const Course = require("../models/Course");
const { uploadImageToCloudinary, deleteFromCloudinary } = require("../lib/cloudinary");
const Rating = require("../models/Rating");
const Video = require("../models/Video");
const Section = require("../models/Section");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const extractIdFromUrl = require("../lib/extractIdFromUrl");
const Quiz = require("../models/Quiz");
const UserQuizResult = require("../models/UserQuizResult");
const Pack = require("../models/Pack");

// @desc    Get all courses
// @route   GET /api/courses
// @access  Public
const getCourses = asyncHandler(async (req, res) => {
  try {
    let user = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer")) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id).select("-password");
      } catch (err) {
        console.warn("Invalid token, proceeding as guest.");
      }
    }

    let matchStage = {};
    if (!user || user.role !== "admin") {
      matchStage = { isActive: true };
    }

    const courses = await Course.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: "videos",
          localField: "_id",
          foreignField: "course",
          as: "videos",
        },
      },
      {
        $lookup: {
          from: "ratings",
          localField: "_id",
          foreignField: "course",
          as: "ratings",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          totalRatings: { $size: "$ratings" },
          averageRating: {
            $cond: [
              { $gt: [{ $size: "$ratings" }, 0] },
              {
                $avg: "$ratings.stars",
              },
              0,
            ],
          },
          duration: {
            $sum: "$videos.duration",
          },
        },
      },
      {
        $project: {
          title: 1,
          description: 1,
          price: 1,
          originalPrice: 1,
          image: 1,
          category: 1,
          numOfVideos: { $size: "$videos" },
          averageRating: 1,
          totalRatings: 1,
          duration: 1,
          ratings: 1,
          videos: 1,
          isActive: 1,
        },
      },
    ]);

    res.json(courses);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء جلب الدورات" });
  }
});

// @desc    Get single course with access-controlled videos
// @route   GET /api/courses/:id
// @access  Public
const getCourse = asyncHandler(async (req, res) => {
  try {
    let user = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer")) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id).select("-password");
      } catch (err) {
        console.warn("Invalid token, proceeding as guest.");
      }
    }

    const course = await Course.findById(req.params.id).populate("category");
    if (!course) {
      res.json({});
      return;
    }

    if (!course.isActive && (!user || user.role !== "admin")) {
      res.json({});
      return;
    }

    const ratings = await Rating.find({ course: course._id }).populate("user");

    const videos = await Video.find({ course: course._id }).select(
      "title duration section video isFree description"
    );

    const sections = await Section.find({ course: course._id }).sort({
      order: 1,
    });

    const studentsCount = await User.countDocuments({
      purchasedCourses: course._id,
    });

    // Check if user has access: admin, purchased course, or purchased a pack containing the course
    let hasAccess = false;
    if (user) {
      if (user.role === "admin" || user.purchasedCourses.includes(course._id)) {
        hasAccess = true;
      } else if (user.purchasedPacks && user.purchasedPacks.length > 0) {
        const packs = await Pack.find({ _id: { $in: user.purchasedPacks }, courses: course._id });
        if (packs && packs.length > 0) {
          hasAccess = true;
        }
      }
    }

    const videosBySection = {};

    for (const video of videos) {
      const key = video.section ? video.section.toString() : "no-section";

      if (!videosBySection[key]) videosBySection[key] = [];

      const isAccessible = hasAccess || video.isFree;

      videosBySection[key].push({
        _id: video._id,
        title: video.title,
        duration: video.duration ?? 0,
        isFree: video.isFree || isAccessible,
        locked: !isAccessible,
        ...(isAccessible && { video: video.video }),
        ...(isAccessible &&
          video.description && { description: video.description }),
      });
    }

    const structuredSections = [];

    // Always include 'no-section', even if empty
    structuredSections.push({
      _id: "no-section",
      title: course.title,
      order: 0,
      videos: videosBySection["no-section"] || [],
    });

    for (const section of sections) {
      structuredSections.push({
        _id: section._id,
        title: section.title,
        order: section.order,
        videos: videosBySection[section._id.toString()] || [],
      });
    }

    structuredSections.sort((a, b) => a.order - b.order);

    const totalDuration = videos.reduce(
      (acc, curr) => acc + (curr.duration ?? 0),
      0
    );

    // Check if this course has a quiz
    const hasQuiz = await Quiz.exists({ course: course._id });

    // If user is a normal user, check if he answered the quiz and get his note
    let userQuizInfo = null;
    if (user && user.role === "user" && hasQuiz) {
      const quizResult = await UserQuizResult.findOne({
        user: user._id,
        course: course._id,
      });
      if (quizResult) {
        userQuizInfo = {
          note: quizResult.score,
          isAnswered: true,
        };
      } else {
        userQuizInfo = {
          note: null,
          isAnswered: false,
        };
      }
    }

    const courseData = {
      ...course._doc,
      ratings,
      sections: structuredSections,
      numOfVideos: videos.length,
      averageRating:
        ratings.length > 0
          ? ratings.reduce((acc, curr) => acc + curr.stars, 0) / ratings.length
          : 0,
      totalRatings: ratings.length,
      duration: totalDuration,
      studentsCount,
      hasAccess,
      hasQuiz: !!hasQuiz,
      ...(userQuizInfo && { userQuizInfo }),
    };

    res.json(courseData);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
    });
  }
});

// @desc    Create course
// @route   POST /api/courses
// @access  Private/Admin
const createCourse = asyncHandler(async (req, res) => {
  try {
    const { title, description, price, originalPrice, category } = req.body;
    const filePath = req.file.path;

    const result = await uploadImageToCloudinary(filePath);

    const course = await Course.create({
      title,
      description,
      price: parseFloat(price),
      originalPrice: parseFloat(originalPrice),
      image: result.secure_url,
      duration: result.secure_url,
      category,
    });

    res
      .status(201)
      .json({ success: true, message: "تم إنشاء الدورة بنجاح", data: course });
  } catch (error) {
    console.log("create course error", error);

    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء إنشاء الدورة", error });
  }
});

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private/Admin
const updateCourse = asyncHandler(async (req, res) => {
  try {
    const { title, description, price, originalPrice, duration, category } =
      req.body;
    const course = await Course.findById(req.params.id);
    if (!course) {
      res.status(404).json({ success: false, message: "الدورة غير موجودة" });
      return;
    }

    console.log('price', price)

    let url = "";
    if (req.file?.path) {
      const oldImgId = course.image ? extractIdFromUrl(course.image) : "";
      if (oldImgId) {
        await deleteFromCloudinary(oldImgId);
      }

      const uploadResult = await uploadImageToCloudinary(req.file.path);
      url = uploadResult.url;
    }

    course.title = title || course.title;
    course.description = description || course.description;
    if (price !== undefined) course.price = price;
    if (originalPrice !== undefined) course.originalPrice = originalPrice;
    course.image = url || course.image;
    course.duration = duration || course.duration;
    course.category = category || course.category;

    const updatedCourse = await course.save();
    res.json({
      success: true,
      message: "تم تحديث الدورة بنجاح",
      data: updatedCourse,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء تحديث الدورة" });
  }
});

// @desc    Update course's isActive status
// @route   PATCH /api/courses/:id/activate
// @access  Private/Admin
const updateCourseStatus = asyncHandler(async (req, res) => {
  try {
    const { isActive } = req.body;

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "الوحدة غير موجود" });
    }

    course.isActive = isActive;
    await course.save();

    res.json({
      success: true,
      message: `تم تحديث حالة الوحدة إلى ${isActive ? "نشطة" : "غير نشطة"}`,
      data: course,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "خطأ في الخادم", error: error.message });
  }
});

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private/Admin
const deleteCourse = asyncHandler(async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      res.status(404).json({ success: false, message: "الدورة غير موجودة" });
      return;
    }

    const oldImgId = course.image ? extractIdFromUrl(course.image) : "";
    await course.deleteOne();
    if (oldImgId) {
      await deleteFromCloudinary(oldImgId);
    }
    res.json({ success: true, message: "تم حذف الدورة بنجاح" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء حذف الدورة" });
  }
});

module.exports = {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  updateCourseStatus,
};
