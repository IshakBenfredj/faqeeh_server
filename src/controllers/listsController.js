const asyncHandler = require("express-async-handler");
const {
  uploadImageToCloudinary,
  deleteFromCloudinary,
} = require("../lib/cloudinary");
const List = require("../models/List");
const extractIdFromUrl = require("../lib/extractIdFromUrl");



// @desc    Get all lists with ratings and courses
// @route   GET /api/lists
// @access  Public
const getLists = asyncHandler(async (req, res) => {
  try {
    const lists = await List.find().populate("category");

    res.json(lists);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء جلب القوائم" });
  }
});

// @desc    Get single list with ratings and courses
// @route   GET /api/lists/:id
// @access  Public
const getList = asyncHandler(async (req, res) => {
  try {
    const list = await List.findById(req.params.id).populate("category");

    if (!list) {
      return res
        .status(404)
        .json({ success: false, message: "القائمة غير موجودة" });
    }

    res.json(list);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء جلب القائمة" });
  }
});

// @desc    Create list
// @route   POST /api/lists
// @access  Private/Admin
const createList = asyncHandler(async (req, res) => {
  try {
    const { title, category } = req.body;
    let imageUrl = "";

    if (req.file) {
      const result = await uploadImageToCloudinary(req.file.path);
      imageUrl = result.secure_url;
    }

    const list = await List.create({
      title,
      category,
      image: imageUrl,
    });

    list.courses = [];

    const populatedList = await list.populate("category");

    res.status(201).json({
      success: true,
      list: populatedList,
      message: "تم إنشاء القائمة بنجاح",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء إنشاء القائمة",
    });
  }
});


// @desc    Update list
// @route   PUT /api/lists/:id
// @access  Private/Admin
const updateList = asyncHandler(async (req, res) => {
  try {
    const { title, category,image } = req.body;

    console.log('image', image);
    
    const list = await List.findById(req.params.id);

    if (!list) {
      return res
        .status(404)
        .json({ success: false, message: "القائمة غير موجودة" });
    }

    list.title = title || list.title;
    list.category = category || list.category;

    if (typeof image != 'string') {
      if (list.image) {
        const imageId = extractIdFromUrl(list.image);
        if (imageId) {
          await deleteFromCloudinary(imageId);
        }
      }

      // ارفع الصورة الجديدة
      const result = await uploadImageToCloudinary(req.file.path);
      list.image = result.secure_url;
    }

    const updatedList = await list.save();
    const populatedList = await updatedList.populate("category");
    res.json({
      message: "تم تحديث القائمة بنجاح",
      success: true,
      updated: populatedList,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء تحديث القائمة" });
  }
});

// @desc    Delete list
// @route   DELETE /api/lists/:id
// @access  Private/Admin
const deleteList = asyncHandler(async (req, res) => {
  try {
    const list = await List.findById(req.params.id);

    if (!list) {
      return res
        .status(404)
        .json({ success: false, message: "القائمة غير موجودة" });
    }
    const imageId = extractIdFromUrl(list.image);
    if (imageId) {
      await deleteFromCloudinary(imageId);
    }

    await list.deleteOne();
    res.json({ success: true, message: "تم حذف القائمة بنجاح" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء حذف القائمة" });
  }
});

module.exports = {
  getLists,
  getList,
  createList,
  updateList,
  deleteList,
};
