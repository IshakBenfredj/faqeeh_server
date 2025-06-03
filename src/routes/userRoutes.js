const express = require("express");
const {
  register,
  login,
  confirmEmail,
  addCourseToUsers,
  removeCourseFromUser,
  getUsersWithCourse,
  getUsersWithoutCourse,
  addFreeCourseToUser,
  updateUserInfo,
  updateUserPassword,
  getUsers,
  deleteUser,
  getUsersWithoutPack,
  getUsersWithPack,
  addPackToUsers,
  removePackFromUser,
  addFreePackToUser,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  logout,
} = require("../controllers/userController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

// Auth Routes
router.post("/register", register);
router.post("/login", login);
router.post("/confirmEmail", confirmEmail);
router.post("/forgotPassword", forgotPassword);
router.post("/resetPassword", resetPassword);
router.post("/logout",protect, logout);

// User Management Routes
router.get("/", protect, admin, getUsers);
router.put("/:userId/updateInfo", protect, updateUserInfo);
router.put("/:userId/updatePassword", protect, updateUserPassword);
router.delete("/:userId", protect, admin, deleteUser);

// Course Management Routes
router.post("/addFreeCourse", protect, addFreeCourseToUser);
router.put("/addCourse", protect, admin, addCourseToUsers);
router.delete(
  "/:userId/removeCourse/:courseId",
  protect,
  admin,
  removeCourseFromUser
);
router.get("/withCourse/:courseId", protect, admin, getUsersWithCourse);
router.get("/withoutCourse/:courseId", protect, admin, getUsersWithoutCourse);
router.get("/me", protect, getCurrentUser);

// Pack Management Routes
router.post("/addFreePack", protect, addFreePackToUser);
router.put("/addPack", protect, admin, addPackToUsers);
router.delete(
  "/:userId/removePack/:packId",
  protect,
  admin,
  removePackFromUser
);
router.get("/withPack/:packId", protect, admin, getUsersWithPack);
router.get("/withoutPack/:packId", protect, admin, getUsersWithoutPack);

module.exports = router;
