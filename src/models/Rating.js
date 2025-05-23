const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
  {
    stars: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Rating", ratingSchema);
