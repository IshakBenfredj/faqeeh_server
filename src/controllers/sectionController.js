const asyncHandler = require("express-async-handler");
const Section = require("../models/Section");
const Video = require("../models/Video");
const extractIdFromUrl = require("../lib/extractIdFromUrl");
const {
  uploadToR2,
  getVideoDuration,
  generateSignedUrl,
  deleteFromR2,
} = require("../lib/r2Storage");

// @desc    Get all sections for a course
// @route   GET /api/sections/:courseId
// @access  Public
const getSections = asyncHandler(async (req, res) => {
  try {
    const sections = await Section.find({ course: req.params.courseId });
    res.json(sections);
  } catch (error) {
    res.status(500).json({ success: false, message: "خطأ في الخادم", error: error.message });
  }
});


/**
 * @desc    Get sections by course ID
 * @route   GET /api/sections/by-course/:courseId
 * @access  Public
 */
const getSectionsByCourseId = asyncHandler(async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const sections = await Section.find({ course: courseId }).sort({ order: 1 });
    res.json({ success: true, data: sections });
  } catch (error) {
    res.status(500).json({ success: false, message: "خطأ في الخادم", error: error.message });
  }
});

// @desc    Add a new section
// @route   POST /api/sections
// @access  Private/Admin
const addSection = asyncHandler(async (req, res) => {
  try {
    const { title, course, order } = req.body;

    let finalOrder = order;

    if (finalOrder === undefined) {
      const lastSection = await Section.find({ course }).sort({ order: -1 }).limit(1);
      finalOrder = lastSection.length > 0 ? lastSection[0].order + 1 : 1;
    }

    const section = await Section.create({
      title,
      course,
      order: finalOrder,
    });

    res.status(201).json({ success: true, message: "تم إنشاء الوحدة", data: section });
  } catch (error) {
    res.status(500).json({ success: false, message: "خطأ في الخادم", error: error.message });
  }
});


/**
 * @desc    Edit a section
 * @route   PUT /api/sections/:id
 * @access  Private/Admin
 */
const editSection = asyncHandler(async (req, res) => {
  try {
    const { title, order } = req.body;
    const section = await Section.findById(req.params.id);

    if (!section) {
      return res.status(404).json({ success: false, message: "الوحدة غير موجود" });
    }

    if (title !== undefined) section.title = title;
    if (order !== undefined) section.order = order;

    await section.save();

    res.json({ success: true, message: "تم تحديث الوحدة", data: section });
  } catch (error) {
    res.status(500).json({ success: false, message: "خطأ في الخادم", error: error.message });
  }
});

// @desc    Delete a section and optionally its videos
// @route   DELETE /api/sections/:id/:deleteVideosAlso
// @access  Private/Admin
const deleteSection = asyncHandler(async (req, res) => {
  try {
    const sectionId = req.params.id;
    const deleteVideosAlso = req.params.deleteVideosAlso === 'yes';

    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ 
        success: false, 
        message: "الوحدة غير موجودة" 
      });
    }

    if (deleteVideosAlso) {
      const videos = await Video.find({ section: sectionId });

      for (const video of videos) {
        if (video.video && video.video.includes("/videos/")) {
          const key = extractIdFromUrl(video.video);
          if (key) {
            await deleteFromR2(key).catch(error => {
              console.error("Error deleting video from R2:", error);
            });
          }
        }
        await video.deleteOne();
      }
    } else {
      // Just remove section reference from videos
      await Video.updateMany(
        { section: sectionId },
        { $unset: { section: 1 } }
      );
    }

    // Delete the section
    await section.deleteOne();

    res.json({ 
      success: true, 
      message: deleteVideosAlso 
        ? "تم حذف الوحدة وجميع مقاطع الفيديو التابعة لها" 
        : "تم حذف الوحدة وتم إزالة رابطها من المقاطع" 
    });

  } catch (error) {
    console.error("Error deleting section:", error);
    res.status(500).json({ 
      success: false, 
      message: "خطأ في حذف الوحدة", 
      error: error.message 
    });
  }
});

module.exports = { getSections, addSection,editSection, deleteSection, getSectionsByCourseId };
