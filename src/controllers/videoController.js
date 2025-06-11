const asyncHandler = require("express-async-handler");
const Video = require("../models/Video");
const extractIdFromUrl = require("../lib/extractIdFromUrl");
const {
  uploadToR2,
  getVideoDuration,
  generateSignedUrl,
  deleteFromR2,
} = require("../lib/r2Storage");

// @desc    Upload a new video
// @route   POST /api/videos
// @access  Private/Admin
const uploadVideo = asyncHandler(async (req, res) => {
  try {
    const { title, course, description, isFree, videoLink, duration, section } =
      req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "العنوان مطلوب",
      });
    }

    if (!description && !videoLink && !req.file?.path) {
      return res.status(400).json({
        success: false,
        message: "يجب تقديم وصف أو رابط فيديو أو ملف فيديو",
      });
    }

    let url, durationInSeconds;

    if (videoLink) {
      // External video link
      url = videoLink;
      durationInSeconds = parseInt(duration) || 0;

      if (!duration || isNaN(durationInSeconds)) {
        return res.status(400).json({
          success: false,
          message: "مدة الفيديو مطلوبة للروابط الخارجية",
        });
      }
    } else if (req.file?.path) {
      // File upload
      try {
        // Get video duration first
        durationInSeconds = await getVideoDuration(req.file.path);

        // Generate unique key for the video
        const fileExtension = req.file.originalname.split(".").pop();
        const key = `videos/${Date.now()}-${Math.random()
          .toString(36)
          .substring(2)}.${fileExtension}`;

        // Upload to R2 (removed progress callback)
        const uploadResult = await uploadToR2(
          req.file.path,
          key,
          req.file.mimetype
        );

        url = uploadResult.url;
      } catch (uploadError) {
        console.error("Upload error:", uploadError);
        if (req.file?.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.warn(
              "Failed to cleanup uploaded file:",
              cleanupError.message
            );
          }
        }

        return res.status(500).json({
          success: false,
          message: "خطأ في رفع الملف",
          error: uploadError.message,
        });
      }
    }

    // Create video record
    const newVideo = await Video.create({
      title: title.trim(),
      video: url,
      duration: durationInSeconds,
      course,
      description: description?.trim() || "",
      isFree: Boolean(isFree),
      section: section && section.trim() !== "" ? section.trim() : null,
    });

    res.status(201).json({
      success: true,
      message: "تم رفع المقطع بنجاح",
      data: newVideo,
    });
  } catch (error) {
    // Clean up any uploaded file on database error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn("Failed to cleanup uploaded file:", cleanupError.message);
      }
    }

    console.error("Video upload error:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في رفع المقطع",
      error: error.message,
    });
  }
});

// Helper function to validate video file
const validateVideoFile = (file) => {
  const allowedMimeTypes = [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo", // .avi
    "video/x-ms-wmv", // .wmv
    "video/webm",
  ];

  const maxSize = 2 * 1024 * 1024 * 1024; // 2GB in bytes

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error("نوع الملف غير مدعوم. يرجى رفع ملف فيديو صالح");
  }

  if (file.size > maxSize) {
    throw new Error("حجم الملف كبير جداً. الحد الأقصى 2GB");
  }

  return true;
};

// @route GET /api/videos/secure-url/:id
// @access Private/Protected
const getSecureVideoUrl = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video || !video.video) {
    return res.status(404).json();
  }

  const key = extractIdFromUrl(video.video); // will now return full key with folders and extension
  const newKey = "videos/" + key;
  const signedUrl = await generateSignedUrl(
    newKey,
    parseInt(video.duration) * 3
  );

  res.json({ url: signedUrl });
});

// @desc    Delete a video
// @route   DELETE /api/videos/:id
// @access  Private/Admin
const deleteVideo = asyncHandler(async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res
        .status(404)
        .json({ success: false, message: "المقطع غير موجود" });
    }

    const key = extractIdFromUrl(video.video);
    if (key) {
      await deleteFromR2(key);
    }

    await video.deleteOne();
    res.json({ success: true, message: "تم حذف المقطع" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "خطأ في حذف المقطع",
      error: error.message,
    });
    console.log(error);
  }
});

// @desc    Update a video
// @route   PUT /api/videos/:id
// @access  Private/Admin
const updateVideo = asyncHandler(async (req, res) => {
  try {
    const { title, course, description, isFree, videoLink, duration, section } =
      req.body;

    const existingVideo = await Video.findById(req.params.id);
    if (!existingVideo) {
      return res
        .status(404)
        .json({ success: false, message: "المقطع غير موجود" });
    }

    let url = existingVideo.video;
    let durationInSeconds = existingVideo.duration;

    if (videoLink) {
      // If switching to external video link, delete old file if it exists
      if (existingVideo.video && !existingVideo.video.startsWith("http")) {
        const oldKey = extractIdFromUrl(existingVideo.video);
        if (oldKey) {
          try {
            await deleteFromR2(oldKey);
          } catch (deleteError) {
            console.warn(
              "Failed to delete old video file:",
              deleteError.message
            );
          }
        }
      }
      url = videoLink;
      durationInSeconds = parseInt(duration) || existingVideo.duration;
    } else if (req.file?.path) {
      // Delete old uploaded file if it exists
      if (existingVideo.video && !existingVideo.video.startsWith("http")) {
        const oldKey = extractIdFromUrl(existingVideo.video);
        if (oldKey) {
          try {
            await deleteFromR2(oldKey);
          } catch (deleteError) {
            console.warn(
              "Failed to delete old video file:",
              deleteError.message
            );
          }
        }
      }

      // Upload new file
      try {
        durationInSeconds = await getVideoDuration(req.file.path);
        const key = `videos/${Date.now()}-${req.file.originalname}`;
        const uploadResult = await uploadToR2(
          req.file.path,
          key,
          req.file.mimetype
        );
        url = uploadResult.url;
      } catch (uploadError) {
        // Clean up uploaded file on error
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        throw uploadError;
      }
    }

    // Update video fields
    existingVideo.title = title || existingVideo.title;
    existingVideo.course = course || existingVideo.course;
    existingVideo.description = description || existingVideo.description;
    existingVideo.isFree = isFree !== undefined ? isFree : existingVideo.isFree;
    existingVideo.section =
      section !== undefined
        ? section !== ""
          ? section
          : null
        : existingVideo.section;
    existingVideo.video = url;
    existingVideo.duration = durationInSeconds;

    const updatedVideo = await existingVideo.save();

    res.json({
      success: true,
      message: "تم تحديث الفيديو",
      data: updatedVideo,
    });
  } catch (error) {
    // Clean up any uploaded file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn("Failed to cleanup uploaded file:", cleanupError.message);
      }
    }

    res.status(500).json({
      success: false,
      message: "خطأ في تحديث الفيديو",
      error: error.message,
    });
    console.log(error);
  }
});

// @desc    Update only the section of a video
// @route   PUT /api/videos/:id/:section
// @access  Private/Admin
const updateVideoSection = asyncHandler(async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res
        .status(404)
        .json({ success: false, message: "المقطع غير موجود" });
    }

    // Handle section update logic
    const sectionParam = req.params.section;
    if (
      sectionParam === "no-section" ||
      sectionParam === "null" ||
      sectionParam === "undefined"
    ) {
      video.section = null;
    } else {
      video.section = sectionParam;
    }

    const updatedVideo = await video.save();

    res.json({
      success: true,
      message: "تم تحديث الوحدة",
      data: updatedVideo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "خطأ في تحديث القسم",
      error: error.message,
    });
    console.log(error);
  }
});

// @desc    Bulk update video sections
// @route   PUT /api/videos/bulk-section
// @access  Private/Admin
const bulkUpdateVideoSections = asyncHandler(async (req, res) => {
  try {
    const { updates } = req.body; // Array of { videoId, section }

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "يجب تقديم مصفوفة من التحديثات",
      });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const { videoId, section } = update;

        if (!videoId) {
          errors.push({ videoId, error: "معرف الفيديو مطلوب" });
          continue;
        }

        const video = await Video.findById(videoId);
        if (!video) {
          errors.push({ videoId, error: "الفيديو غير موجود" });
          continue;
        }

        // Update section
        if (
          section === "no-section" ||
          section === "null" ||
          section === "undefined" ||
          section === ""
        ) {
          video.section = null;
        } else {
          video.section = section;
        }

        const updatedVideo = await video.save();
        results.push({ videoId, success: true, data: updatedVideo });
      } catch (updateError) {
        errors.push({ videoId: update.videoId, error: updateError.message });
      }
    }

    res.json({
      success: true,
      message: `تم تحديث ${results.length} فيديو بنجاح`,
      data: {
        successful: results,
        failed: errors,
        totalProcessed: updates.length,
        successCount: results.length,
        errorCount: errors.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "خطأ في التحديث المجمع",
      error: error.message,
    });
    console.log(error);
  }
});

module.exports = {
  uploadVideo,
  deleteVideo,
  updateVideo,
  updateVideoSection,
  getSecureVideoUrl,
};
