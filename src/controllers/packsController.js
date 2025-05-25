const asyncHandler = require("express-async-handler");
const {
  uploadImageToCloudinary,
  deleteFromCloudinary,
} = require("../lib/cloudinary");
const Pack = require("../models/Pack");
const extractIdFromUrl = require("../lib/extractIdFromUrl");



// @desc    Get all packs with ratings and courses
// @route   GET /api/packs
// @access  Public
const getPacks = asyncHandler(async (req, res) => {
  try {
    const packs = await Pack.find().populate("category");

    res.json(packs);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء جلب الحزم" });
  }
});

// @desc    Get single pack with ratings and courses
// @route   GET /api/packs/:id
// @access  Public
const getPack = asyncHandler(async (req, res) => {
  try {
    const pack = await Pack.findById(req.params.id).populate("category");

    if (!pack) {
      return res
        .status(404)
        .json({ success: false, message: "الحزمة غير موجودة" });
    }

    res.json(pack);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء جلب الحزمة" });
  }
});

// @desc    Create pack
// @route   POST /api/packs
// @access  Private/Admin
const createPack = asyncHandler(async (req, res) => {
  try {
    const { title, category } = req.body;
    let imageUrl = "";

    if (req.file) {
      const result = await uploadImageToCloudinary(req.file.path);
      imageUrl = result.secure_url;
    }

    const pack = await Pack.create({
      title,
      category,
      image: imageUrl,
    });

    pack.courses = [];

    const populatedPack = await pack.populate("category");

    res.status(201).json({
      success: true,
      pack: populatedPack,
      message: "تم إنشاء الحزمة بنجاح",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء إنشاء الحزمة",
    });
  }
});


// @desc    Update pack
// @route   PUT /api/packs/:id
// @access  Private/Admin
const updatePack = asyncHandler(async (req, res) => {
  try {
    const { title, category,image } = req.body;

    console.log('image', image);
    
    const pack = await Pack.findById(req.params.id);

    if (!pack) {
      return res
        .status(404)
        .json({ success: false, message: "الحزمة غير موجودة" });
    }

    pack.title = title || pack.title;
    pack.category = category || pack.category;

    if (typeof image != 'string') {
      if (pack.image) {
        const imageId = extractIdFromUrl(pack.image);
        if (imageId) {
          await deleteFromCloudinary(imageId);
        }
      }

      // ارفع الصورة الجديدة
      const result = await uploadImageToCloudinary(req.file.path);
      pack.image = result.secure_url;
    }

    const updatedPack = await pack.save();
    const populatedPack = await updatedPack.populate("category");
    res.json({
      message: "تم تحديث الحزمة بنجاح",
      success: true,
      updated: populatedPack,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء تحديث الحزمة" });
  }
});

// @desc    Delete pack
// @route   DELETE /api/packs/:id
// @access  Private/Admin
const deletePack = asyncHandler(async (req, res) => {
  try {
    const pack = await Pack.findById(req.params.id);

    if (!pack) {
      return res
        .status(404)
        .json({ success: false, message: "الحزمة غير موجودة" });
    }
    const imageId = extractIdFromUrl(pack.image);
    if (imageId) {
      await deleteFromCloudinary(imageId);
    }

    await pack.deleteOne();
    res.json({ success: true, message: "تم حذف الحزمة بنجاح" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء حذف الحزمة" });
  }
});

module.exports = {
  getPacks,
  getPack,
  createPack,
  updatePack,
  deletePack,
};
