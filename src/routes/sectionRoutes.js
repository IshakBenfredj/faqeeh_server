const express = require("express");
const router = express.Router();
const { getSections, addSection, deleteSection, editSection, getSectionsByCourseId } = require("../controllers/sectionController");
const { protect, admin } = require("../middleware/authMiddleware");

router.get("/:courseId", getSections);
router.post("/", protect, admin, addSection);
router.get("/by-course/:courseId", getSectionsByCourseId);
router.delete("/:id/:deleteVideosAlso", protect, admin, deleteSection).put("/:id", protect, admin, editSection);

module.exports = router;