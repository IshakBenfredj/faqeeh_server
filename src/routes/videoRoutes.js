const express = require("express");
const router = express.Router();
const {
  getVideos,
  uploadVideo,
  deleteVideo,
  updateVideo,
  updateVideoSection,
  getSecureVideoUrl,
} = require("../controllers/videoController");
const { protect, admin } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

router.post("/", protect, admin, upload.single("video"), uploadVideo);
router.delete("/:id", protect, admin, deleteVideo);
router
  .put("/:id", protect, admin, upload.single("video"), updateVideo)
  .put("/:id/:section", protect, admin, updateVideoSection);

router.get("/secure-url/:id", getSecureVideoUrl);

module.exports = router;
