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
} = require("../controllers/userController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/confirmEmail", confirmEmail);
router.post("/addFreeCourse",protect, addFreeCourseToUser);
router.put("/addCourse", protect, admin, addCourseToUsers);
router.put("/:userId/updateInfo", protect, updateUserInfo);
router.put("/:userId/updatePassword", protect, updateUserPassword);
router.delete("/:userId/removeCourse/:courseId", protect, admin, removeCourseFromUser);
router.get("/withCourse/:courseId", protect, admin, getUsersWithCourse);
router.get("/withoutCourse/:courseId", protect, admin, getUsersWithoutCourse);


module.exports = router;
