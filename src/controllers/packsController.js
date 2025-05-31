const asyncHandler = require("express-async-handler");
const {
  uploadImageToCloudinary,
  deleteFromCloudinary,
} = require("../lib/cloudinary");
const Pack = require("../models/Pack");
const User = require("../models/User");
const extractIdFromUrl = require("../lib/extractIdFromUrl");

// @desc    Get all packs
// @route   GET /api/packs
// @access  Public
const getPacks = asyncHandler(async (req, res) => {
  try {
    const packs = await Pack.find().populate("courses");
    // Get studentsCount for each pack
    const packsWithStudentsCount = await Promise.all(
      packs.map(async (pack) => {
        const studentsCount = await User.countDocuments({
          purchasedPacks: pack._id,
        });
        return { ...pack.toObject(), studentsCount };
      })
    );
    res.json(packsWithStudentsCount);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء جلب الباقات" });
  }
});

// @desc    Get single pack
// @route   GET /api/packs/:id
// @access  Public
const getPack = asyncHandler(async (req, res) => {
  try {
    const pack = await Pack.findById(req.params.id).populate({
      path: "courses",
      populate: { path: "category" },
    });
    if (!pack) {
      return res
        .status(404)
        .json({ success: false, message: "الباقة غير موجودة" });
    }

    const studentsCount = await User.countDocuments({
      purchasedPacks: pack._id,
    });

    let hasAccess = false;
    if (req.user) {
      const user = await User.findById(req.user._id).select("purchasedPacks");
      if (user && user.purchasedPacks.some(id => id.equals(pack._id))) {
        hasAccess = true;
      }
    }

    res.json({ ...pack.toObject(), studentsCount, hasAccess });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء جلب الباقة" });
  }
});

// @desc    Create pack
// @route   POST /api/packs
// @access  Private/Admin
const createPack = asyncHandler(async (req, res) => {
  try {
    const { title, description, price, courses } = req.body;
    let imageUrl = "";

    if (req.file) {
      const result = await uploadImageToCloudinary(req.file.path);
      imageUrl = result.secure_url;
    }

    const pack = await Pack.create({
      title,
      description,
      price,
      courses,
      image: imageUrl,
    });

    const populatedPack = await pack.populate("courses");

    res.status(201).json({
      success: true,
      pack: populatedPack,
      message: "تم إنشاء الباقة بنجاح",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء إنشاء الباقة",
    });
  }
});

// @desc    Update pack
// @route   PUT /api/packs/:id
// @access  Private/Admin
const updatePack = asyncHandler(async (req, res) => {
  try {
    const { title, description, price, courses, image } = req.body;
    const pack = await Pack.findById(req.params.id);

    if (!pack) {
      return res
        .status(404)
        .json({ success: false, message: "الباقة غير موجودة" });
    }

    pack.title = title || pack.title;
    pack.description = description || pack.description;
    pack.price = price || pack.price;
    pack.courses = courses || pack.courses;

    if (typeof image !== "string" && req.file) {
      if (pack.image) {
        const imageId = extractIdFromUrl(pack.image);
        if (imageId) {
          await deleteFromCloudinary(imageId);
        }
      }
      const result = await uploadImageToCloudinary(req.file.path);
      pack.image = result.secure_url;
    }

    const updatedPack = await pack.save();
    const populatedPack = await updatedPack.populate("courses");
    res.json({
      message: "تم تحديث الباقة بنجاح",
      success: true,
      updated: populatedPack,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء تحديث الباقة" });
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
        .json({ success: false, message: "الباقة غير موجودة" });
    }
    const imageId = extractIdFromUrl(pack.image);
    if (imageId) {
      await deleteFromCloudinary(imageId);
    }

    await pack.deleteOne();
    res.json({ success: true, message: "تم حذف الباقة بنجاح" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء حذف الباقة" });
  }
});

// @desc    Get packs purchased by user
// @route   GET /api/packs/purchased
// @access  Private
const getPurchasedPacks = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("purchasedPacks");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "المستخدم غير موجود" });
    }
    const packs = await Pack.find({
      _id: { $in: user.purchasedPacks },
    }).populate("courses");
    res.json(packs);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء جلب الباقات المشتراة" });
  }
});

module.exports = {
  getPacks,
  getPack,
  createPack,
  updatePack,
  deletePack,
  getPurchasedPacks,
};
