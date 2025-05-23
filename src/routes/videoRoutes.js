const express = require("express");
const router = express.Router();
const {
  getVideos,
  uploadVideo,
  deleteVideo,
  updateVideo,
  updateVideoSection,
} = require("../controllers/videoController");
const { protect, admin } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

router.get("/:courseId", getVideos);
router.post("/", protect, admin, upload.single("video"), uploadVideo);
router.delete("/:id", protect, admin, deleteVideo);
router
  .put("/:id", protect, admin, upload.single("video"), updateVideo)
  .put("/:id/:section", protect, admin, updateVideoSection);

module.exports = router;
