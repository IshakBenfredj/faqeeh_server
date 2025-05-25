const express = require("express");
const {
  getPacks,
  getPack,
  updatePack,
  deletePack,
  createPack,
} = require("../controllers/packsController");
const { protect, admin } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

const router = express.Router();

router
  .route("/")
  .get(getPacks)
  .post(protect, admin, upload.single("image"), createPack); // ✅

router
  .route("/:id")
  .get(getPack)
  .put(protect, admin, upload.single("image"), updatePack)
  .delete(protect, admin, deletePack);

module.exports = router;
