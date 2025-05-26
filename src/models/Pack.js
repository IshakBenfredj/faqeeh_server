const mongoose = require("mongoose");

const packSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    image: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    courses : [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
        required: true
      }
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Pack", packSchema);
