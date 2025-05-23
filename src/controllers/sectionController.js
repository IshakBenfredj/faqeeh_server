const asyncHandler = require("express-async-handler");
const Section = require("../models/Section");

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

// @desc    Delete a section
// @route   DELETE /api/sections/:id/:deleteVideosAlso
// @access  Private/Admin
const deleteSection = asyncHandler(async (req, res) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ success: false, message: "الوحدة غير موجود" });
    }

    await section.deleteOne();
    res.json({ success: true, message: "تم حذف الوحدة" });
  } catch (error) {
    res.status(500).json({ success: false, message: "خطأ في الخادم", error: error.message });
  }
});

module.exports = { getSections, addSection,editSection, deleteSection };
