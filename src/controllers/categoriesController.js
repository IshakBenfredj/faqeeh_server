const asyncHandler = require("express-async-handler");
const Category = require("../models/Category");

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getCategories = asyncHandler(async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "حدث خطأ أثناء جلب الفئات", success: false });
  }
});

// @desc    Create category
// @route   POST /api/categories
// @access  Private/Admin
const createCategory = async (req, res) => {
  try {
    console.log(req.body); // this line returns undefined when sending data from client
    const { name, color, iconName, iconLibrary } = req.body;

    const categoryExists = await Category.findOne({ name });
    if (categoryExists) {
      return res
        .status(400)
        .json({ message: "الفئة موجودة بالفعل", success: false });
    }

    const category = await Category.create({
      name,
      color,
      iconName,
      iconLibrary,
    });

    res
      .status(201)
      .json({ message: "تم إنشاء الفئة بنجاح", success: true, category });
  } catch (error) {
    console.log(error);
    
    res.status(500).json({ message: "حدث خطأ أثناء إنشاء الفئة", success: false });
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private/Admin
const updateCategory = asyncHandler(async (req, res) => {
  try {
    const { name, color, iconName, iconLibrary } = req.body;

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res
        .status(404)
        .json({ message: "الفئة غير موجودة", success: false });
    }

    category.name = name || category.name;
    category.color = color || category.color;
    category.iconName = iconName || category.iconName;
    category.iconLibrary = iconLibrary || category.iconLibrary;

    const updatedCategory = await category.save();
    res.json({
      message: "تم تحديث الفئة بنجاح",
      success: true,
      updated: updatedCategory,
    });
  } catch (error) {
    res.status(500).json({ message: "حدث خطأ أثناء تحديث الفئة", success: false });
  }
});

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
const deleteCategory = asyncHandler(async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res
        .status(404)
        .json({ message: "الفئة غير موجودة", success: false });
    }

    await category.deleteOne();
    res.json({ message: "تم حذف الفئة بنجاح", success: true });
  } catch (error) {
    res.status(500).json({ message: "حدث خطأ أثناء حذف الفئة", success: false });
  }
});

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
