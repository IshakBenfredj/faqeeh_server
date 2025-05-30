const jwt = require("jsonwebtoken");
const User = require("../models/User");
const asyncHandler = require("express-async-handler");
const { sendMail, sendWelcomeEmail } = require("../lib/nodemailer");
const Course = require("../models/Course");
const Pack = require("../models/Pack");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// @desc    Confirm Email
// @route   POST /api/users/confirmEmail
// @access  Public
const confirmEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      return res
        .status(404)
        .json({ message: "هذا البريد الإلكتروني مستعمل بالفعل" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const message =
      "السلام عليكم , هذا هو الرمز الخاص بك لتأكيد البريد الإلكتروني خاصتك";
    const title = "تأكيد البريد الإلكتروني";
    await sendMail(email, code, title, message);

    res.status(201).json({ code, success: true });
  } catch (error) {
    res.status(500).json({ error: "Server error." });
  }
};

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  try {
    const { fullName, email, phoneNumber, password } = req.body;

    if (!fullName || !email || !phoneNumber || !password) {
      return res.status(400).json({
        message: "يرجى ملء جميع الحقول المطلوبة",
        success: false,
      });
    }

    const userExists = await User.findOne({
      $or: [{ email: phoneNumber.toLowerCase() }, { phoneNumber }],
    });
    if (userExists) {
      return res.status(400).json({
        message: "البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل",
        success: false,
      });
    }

    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      phoneNumber,
      password,
    });

    sendWelcomeEmail(user.email, user.fullName);
    res.status(201).json({
      user,
      token: generateToken(user._id),
      message: "تم إنشاء حسابك بنجاح",
      success: true,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "حدث خطأ أثناء إنشاء الحساب",
      success: false,
      // error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @desc    Authenticate user & get token
// @route   POST /api/users/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;

    const user = await User.findOne({
      $or: [
        { email: emailOrPhone.toLowerCase() },
        { phoneNumber: emailOrPhone },
      ],
    }).select("+password");

    if (!user) {
      return res.status(404).json({
        message: "لا يوجد حساب مطابق لمعلوماتك البريد",
        success: false,
      });
    }

    const passwordCorrect = await user.comparePassword(password);
    if (!passwordCorrect) {
      return res.status(401).json({
        message: "كلمة المرور غير صحيحة",
        success: false,
      });
    }

    user.password = undefined;

    res.json({
      user,
      token: generateToken(user._id),
      success: true,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "حدث خطأ أثناء تسجيل الدخول",
      success: false,
      // error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @desc    Get users 
// @route   GET /api/users
// @access  Private
const getUsers = asyncHandler(async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: "admin" } });

    res.status(200).json(users);
  } catch (error) {
    console.error("Get users with course error:", error);
    res
      .status(500)
      .json({ message: "حدث خطأ أثناء جلب المستخدمين", success: false });
  }
});

// @desc    Add course to user's purchasedCourses
// @route   PUT /api/users/addCourse
// @access  Private
const addCourseToUsers = asyncHandler(async (req, res) => {
  const { userIds, courseId } = req.body; 

  try {
    const users = await User.find({ _id: { $in: userIds } });
    if (users.length === 0) {
      return res
        .status(404)
        .json({ message: "لم يتم العثور على أي مستخدمين", success: false });
    }

    const updatedUsers = [];
    for (const user of users) {
      if (!user.purchasedCourses.includes(courseId)) {
        user.purchasedCourses.push(courseId);
        await user.save();
        updatedUsers.push(user);
      }
    }

    if (updatedUsers.length === 0) {
      return res
        .status(400)
        .json({
          message: "الدورة مضافة بالفعل لجميع المستخدمين",
          success: false,
        });
    }

    res
      .status(200)
      .json({
        message: "تمت إضافة الدورة بنجاح للمستخدمين",
        success: true,
        data :updatedUsers,
      });
  } catch (error) {
    console.error("Add course error:", error);
    res
      .status(500)
      .json({ message: "حدث خطأ أثناء إضافة الدورة", success: false });
  }
});

/**
 * @desc    Add a free course to the currently authenticated user's purchasedCourses
 * @route   POST /api/users/addFreeCourse
 * @access  Private
 */
const addFreeCourseToUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { courseId } = req.body;

  try {
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        message: "الدورة غير موجودة",
        success: false,
      });
    }

    if (course.price != 0) {
      return res.status(400).json({
        message: "يمكن إضافة الدورات المجانية فقط بهذه الطريقة",
        success: false,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "المستخدم غير موجود",
        success: false,
      });
    }

    if (user.purchasedCourses.includes(courseId)) {
      return res.status(400).json({
        message: "الدورة مضافة بالفعل",
        success: false,
      });
    }

    user.purchasedCourses.push(courseId);
    await user.save();

    res.status(200).json({
      message: "تمت إضافة الدورة المجانية بنجاح",
      success: true,
      user,
    });
  } catch (error) {
    console.error("Add free course error:", error);
    res.status(500).json({
      message: "حدث خطأ أثناء إضافة الدورة المجانية",
      success: false,
    });
  }
});

// @desc    Remove course from user's purchasedCourses
// @route   DELETE /api/users/:userId/removeCourse/:courseId
// @access  Private
const removeCourseFromUser = asyncHandler(async (req, res) => {
  const { userId, courseId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ message: "المستخدم غير موجود", success: false });
    }

    user.purchasedCourses = user.purchasedCourses.filter(
      (id) => id.toString() !== courseId
    );
    await user.save();

    res.status(200).json({ message: "تمت إزالة الدورة بنجاح", success: true });
  } catch (error) {
    console.error("Remove course error:", error);
    res
      .status(500)
      .json({ message: "حدث خطأ أثناء إزالة الدورة", success: false });
  }
});

// @desc    Get users who have a specific course
// @route   GET /api/users/withCourse/:courseId
// @access  Private
const getUsersWithCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  try {
    const users = await User.find({ purchasedCourses: courseId, role: { $ne: "admin" } });

    res.status(200).json(users);
  } catch (error) {
    console.error("Get users with course error:", error);
    res
      .status(500)
      .json({ message: "حدث خطأ أثناء جلب المستخدمين", success: false });
  }
});

// @desc    Get users who do not have a specific course
// @route   GET /api/users/withoutCourse/:courseId
// @access  Private
const getUsersWithoutCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  try {
    const users = await User.find({ purchasedCourses: { $ne: courseId } });

    res.status(200).json(users);
  } catch (error) {
    console.error("Get users without course error:", error);
    res
      .status(500)
      .json({ message: "حدث خطأ أثناء جلب المستخدمين", success: false });
  }
});

// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


// @desc    Add course to user's purchasedPacks
// @route   PUT /api/users/addPack
// @access  Private
const addPackToUsers = asyncHandler(async (req, res) => {
  const { userIds, packId } = req.body;

  try {
    const users = await User.find({ _id: { $in: userIds } });
    if (users.length === 0) {
      return res
        .status(404)
        .json({ message: "لم يتم العثور على أي مستخدمين", success: false });
    }

    const updatedUsers = [];
    for (const user of users) {
      if (!user.purchasedPacks.includes(packId)) {
        user.purchasedPacks.push(packId);
        await user.save();
        updatedUsers.push(user);
      }
    }

    if (updatedUsers.length === 0) {
      return res
        .status(400)
        .json({
          message: "الباقة مضافة بالفعل لجميع المستخدمين",
          success: false,
        });
    }

    res
      .status(200)
      .json({
        message: "تمت إضافة الباقة بنجاح للمستخدمين",
        success: true,
        data :updatedUsers,
      });
  } catch (error) {
    console.error("Add error:", error);
    res
      .status(500)
      .json({ message: "حدث خطأ أثناء إضافة الباقة", success: false });
  }
});

/**
 * @desc    Add a free pack to the currently authenticated user's purchasedPacks
 * @route   POST /api/users/addFreePack
 * @access  Private
 */
const addFreePackToUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { packId } = req.body;

  try {
    const pack = await Pack.findById(packId);
    if (!pack) {
      return res.status(404).json({
        message: "الباقة غير موجودة",
        success: false,
      });
    }

    if (pack.price != 0) {
      return res.status(400).json({
        message: "يمكن إضافة الباقات المجانية فقط بهذه الطريقة",
        success: false,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "المستخدم غير موجود",
        success: false,
      });
    }

    if (user.purchasedPacks.includes(packId)) {
      return res.status(400).json({
        message: "الباقة مضافة بالفعل",
        success: false,
      });
    }

    user.purchasedPacks.push(packId);
    await user.save();

    res.status(200).json({
      message: "تمت إضافة الباقة المجانية بنجاح",
      success: true,
      user,
    });
  } catch (error) {
    console.error("Add free pack error:", error);
    res.status(500).json({
      message: "حدث خطأ أثناء إضافة الدورة المجانية",
      success: false,
    });
  }
});

// @desc    Remove pack from user's purchasedPacks
// @route   DELETE /api/users/:userId/removePack/:packId
// @access  Private
const removePackFromUser = asyncHandler(async (req, res) => {
  const { userId, packId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ message: "المستخدم غير موجود", success: false });
    }

    user.purchasedPacks = user.purchasedPacks.filter(
      (id) => id.toString() !== packId
    );
    await user.save();

    res.status(200).json({ message: "تمت إزالة الباقة بنجاح", success: true });
  } catch (error) {
    console.error("Remove pack error:", error);
    res
      .status(500)
      .json({ message: "حدث خطأ أثناء إزالة الباقة", success: false });
  }
});

// @desc    Get users who have a specific pack
// @route   GET /api/users/withPack/:packId
// @access  Private
const getUsersWithPack = asyncHandler(async (req, res) => {
  const { packId } = req.params;

  try {
    const users = await User.find({ purchasedPacks: packId, role: { $ne: "admin" } });

    res.status(200).json(users);
  } catch (error) {
    console.error("Get users with pack error:", error);
    res
      .status(500)
      .json({ message: "حدث خطأ أثناء جلب المستخدمين", success: false });
  }
});

// @desc    Get users who do not have a specific pack
// @route   GET /api/users/withoutPack/:packId
// @access  Private
const getUsersWithoutPack = asyncHandler(async (req, res) => {
  const { packId } = req.params;

  try {
    const users = await User.find({ purchasedPacks: { $ne: packId } });

    res.status(200).json(users);
  } catch (error) {
    console.error("Get users without pack error:", error);
    res
      .status(500)
      .json({ message: "حدث خطأ أثناء جلب المستخدمين", success: false });
  }
});


/**
 * @desc    Update general user info (excluding role and password)
 * @route   PUT /api/users/:userId/updateInfo
 * @access  Private
 */
const updateUserInfo = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { fullName, email, phoneNumber } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "المستخدم غير موجود", success: false });
    }

    if (req.body.role || req.body.password) {
      return res.status(400).json({ message: "لا يمكن تعديل الدور أو كلمة المرور من هنا", success: false });
    }

    if (email && email.toLowerCase() !== user.email) {
      const emailExists = await User.findOne({ email: email.toLowerCase() });
      if (emailExists) {
        return res.status(400).json({ message: "البريد الإلكتروني مستخدم بالفعل", success: false });
      }
      user.email = email.toLowerCase();
    }

    if (fullName) user.fullName = fullName;
    if (phoneNumber) user.phoneNumber = phoneNumber;

    await user.save();

    res.status(200).json({ message: "تم تحديث المعلومات بنجاح", success: true, user });
  } catch (error) {
    console.error("Update user info error:", error);
    res.status(500).json({ message: "حدث خطأ أثناء تحديث المعلومات", success: false });
  }
});

/**
 * @desc    Update user password
 * @route   PUT /api/users/:userId/updatePassword
 * @access  Private
 */
const updateUserPassword = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { oldPassword, newPassword } = req.body;

  try {
    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({ message: "المستخدم غير موجود", success: false });
    }

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "كلمة المرور القديمة غير صحيحة", success: false });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "تم تحديث كلمة المرور بنجاح", success: true });
  } catch (error) {
    console.error("Update password error:", error);
    res.status(500).json({ message: "حدث خطأ أثناء تحديث كلمة المرور", success: false });
  }
});


/**
 * @desc    Delete a user (role not equal to admin)
 * @route   DELETE /api/users/:userId
 * @access  Private
 */
const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "المستخدم غير موجود", success: false });
    }

    if (user.role === "admin") {
      return res.status(403).json({ message: "لا يمكن حذف حساب المدير", success: false });
    }

    await user.deleteOne();

    res.status(200).json({ message: "تم حذف المستخدم بنجاح", success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "حدث خطأ أثناء حذف المستخدم", success: false });
  }
});

module.exports = {
  register,
  login,
  confirmEmail,
  getUsers,
  addCourseToUsers,
  removeCourseFromUser,
  getUsersWithCourse,
  getUsersWithoutCourse,
  getUsersWithPack,
  getUsersWithoutPack,
  updateUserInfo,
  updateUserPassword,
  addFreeCourseToUser,
  deleteUser,
  addPackToUsers,
  addFreePackToUser,
  removePackFromUser,
};
