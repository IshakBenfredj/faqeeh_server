const Course = require("../models/Course");
const User = require("../models/User");
const Pack = require("../models/Pack");
const Message = require("../models/Message");
const Rating = require("../models/Rating");
const Category = require("../models/Category");

exports.getPlatformStatistics = async (req, res) => {
  try {
    // Count all documents
    const totalCourses = await Course.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalPacks = await Pack.countDocuments();
    const totalMessages = await Message.countDocuments();
    const totalCategories = await Category.countDocuments();

    // Get recent data
    const recentCourses = await Course.find().sort({ createdAt: -1 }).limit(5);
    const recentMessages = await Message.find()
      .sort({ createdAt: -1 })
      .limit(5);
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5);

    // Get rating statistics
    const ratings = await Rating.aggregate([
      {
        $group: {
          _id: "$stars",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          stars: "$_id",
          count: 1,
        },
      },
    ]);

    // بناء مصفوفة تحتوي على التوزيع من 1 إلى 5 في الكود خارج MongoDB
    const ratingDistribution = [0, 0, 0, 0, 0];
    ratings.forEach((r) => {
      const index = r.stars - 1;
      if (index >= 0 && index < 5) {
        ratingDistribution[index] = r.count;
      }
    });

    // استخدام المتوسط وعدد التقييمات:
    const avgAndTotal = await Rating.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$stars" },
          totalRatings: { $sum: 1 },
        },
      },
    ]);

    const ratingsResult = avgAndTotal[0] || {
      averageRating: 0,
      totalRatings: 0,
    };
    ratingsResult.ratingDistribution = ratingDistribution;

    // Get course enrollment statistics
    const popularCourses = await Course.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "purchasedCourses",
          as: "enrolledUsers",
        },
      },
      {
        $project: {
          title: 1,
          enrollmentCount: { $size: "$enrolledUsers" },
        },
      },
      { $sort: { enrollmentCount: -1 } },
      { $limit: 5 },
    ]);

    // Get revenue statistics (simplified - you might need a payment model)
    const revenueStats = await Pack.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$price" },
          averagePackPrice: { $avg: "$price" },
        },
      },
    ]);

    res.json({
      totals: {
        courses: totalCourses,
        users: totalUsers,
        packs: totalPacks,
        messages: totalMessages,
        categories: totalCategories,
      },
      recent: {
        courses: recentCourses,
        messages: recentMessages,
        users: recentUsers,
      },
      ratings: ratingsResult,
      popularCourses,
      revenue: revenueStats[0] || {
        totalRevenue: 0,
        averagePackPrice: 0,
      },
    });
  } catch (error) {
    console.error("Error fetching platform statistics:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getUserGrowth = async (req, res) => {
  try {
    const userGrowth = await User.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      {
        $project: {
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: {
                $dateFromParts: {
                  year: "$_id.year",
                  month: "$_id.month",
                  day: "$_id.day",
                },
              },
            },
          },
          count: 1,
          _id: 0,
        },
      },
    ]);

    res.json(userGrowth);
  } catch (error) {
    console.error("Error fetching user growth statistics:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getCourseStatistics = async (req, res) => {
  try {
    const courseStats = await Course.aggregate([
      {
        $lookup: {
          from: "ratings",
          localField: "_id",
          foreignField: "course",
          as: "ratings",
        },
      },
      {
        $project: {
          title: 1,
          ratingCount: { $size: "$ratings" },
          averageRating: { $avg: "$ratings.stars" },
          enrollmentCount: {
            $size: {
              $ifNull: ["$enrolledUsers", []],
            },
          },
        },
      },
      { $sort: { enrollmentCount: -1 } },
    ]);

    res.json(courseStats);
  } catch (error) {
    console.error("Error fetching course statistics:", error);
    res.status(500).json({ message: error.message });
  }
};
