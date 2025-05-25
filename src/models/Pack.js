const mongoose = require("mongoose");

const packSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    image: { type: String, required: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
  },
  { timestamps: true }
);

// Virtual for getting courses in this list
packSchema.virtual("courses", {
  ref: "Course",
  localField: "_id",
  foreignField: "list",
});

packSchema.set("toJSON", { virtuals: true });
packSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("List", packSchema);
