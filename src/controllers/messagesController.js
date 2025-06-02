const Message = require("../models/Message");

// @desc    Add a new message
// @route   POST /api/messages
// @access  Public
const addMessage = async (req, res) => {
    try {
        const { name, content, email, phone } = req.body;
        const message = new Message({ name, content, email, phone });
        await message.save();
        res.status(201).json({ success: true, message: "تم إضافة الرسالة بنجاح", data: message });
    } catch (error) {
        res.status(500).json({ success: false, message: "فشل في إضافة الرسالة", error: error.message });
    }
};

// @desc    Get all messages
// @route   GET /api/messages
// @access  Private/Admin
const getAllMessages = async (req, res) => {
    try {
        const messages = await Message.find().sort({ createdAt: -1 });
        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ success: false, message: "فشل في جلب الرسائل", error: error.message });
    }
};

// @desc    Delete a message
// @route   DELETE /api/messages/:id
// @access  Private/Admin
const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Message.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "الرسالة غير موجودة" });
        }
        res.status(200).json({ success: true, message: "تم حذف الرسالة بنجاح" });
    } catch (error) {
        res.status(500).json({ success: false, message: "فشل في حذف الرسالة", error: error.message });
    }
};

module.exports = {
    addMessage,
    getAllMessages,
    deleteMessage,
};
