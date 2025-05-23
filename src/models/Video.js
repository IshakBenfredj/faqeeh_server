const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: null,
  },
  video: {
    type: String,
    default: null,
  },
  duration: {
    type: Number,
    validate: {
      validator: function (value) {
        return this.video ? value != null : true;
      },
      message: "Duration is required when a video is provided.",
    },
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Section",
    required: false,
  },
  isFree: {
    type: Boolean,
    default: false,
  },
});

videoSchema.pre("validate", function (next) {
  if (!this.video && !this.description) {
    next(new Error("يجب أن يكون لديك على الأقل فيديو أو وصف"));
  } else {
    next();
  }
});

module.exports = mongoose.model("Video", videoSchema);
