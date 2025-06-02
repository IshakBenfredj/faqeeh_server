const express = require("express");

const router = express.Router();
const {
    addMessage,
    getAllMessages,
    deleteMessage,
} = require("../controllers/messagesController");
const { protect, admin } = require("../middleware/authMiddleware");

router.post("/", addMessage);

router.get("/", protect, admin, getAllMessages);

router.delete("/:id", protect, admin, deleteMessage);

module.exports = router;