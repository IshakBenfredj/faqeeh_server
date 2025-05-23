const express = require("express");
const {
  getLists,
  getList,
  createList,
  updateList,
  deleteList,
} = require("../controllers/listsController");
const { protect, admin } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

const router = express.Router();

router
  .route("/")
  .get(getLists)
  .post(protect, admin, upload.single("image"), createList); // ✅

router
  .route("/:id")
  .get(getList)
  .put(protect, admin, upload.single("image"), updateList)
  .delete(protect, admin, deleteList);

module.exports = router;
