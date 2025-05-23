const mongoose = require("mongoose");

const listSchema = new mongoose.Schema(
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
listSchema.virtual("courses", {
  ref: "Course",
  localField: "_id",
  foreignField: "list",
});

listSchema.set("toJSON", { virtuals: true });
listSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("List", listSchema);
