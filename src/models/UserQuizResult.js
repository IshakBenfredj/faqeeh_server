const mongoose = require("mongoose");

const userQuizResultSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  score: Number,
  answeredAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("UserQuizResult", userQuizResultSchema);
