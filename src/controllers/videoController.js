const asyncHandler = require("express-async-handler");
const Video = require("../models/Video");
const extractIdFromUrl = require("../lib/extractIdFromUrl");
const {
  uploadToR2,
  getVideoDuration,
  generateSignedUrl,
  deleteFromR2,
  s3Client,
} = require("../lib/r2Storage");
const fs = require("fs");
const path = require("path");
const os = require("os");

const generateRandomFileName = (originalName) => {
  const ext = originalName.split('.').pop();
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${ext}`;
};


const generateUploadUrl = async (req, res) => {
  const { key, contentType } = req.body;

  const url = await s3Client.getSignedUrlPromise('putObject', {
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    Expires: 900, 
  });

  res.json({ url });
};

// @desc    Upload a new video
// @route   POST /api/videos
// @access  Private/Admin
const uploadVideo = asyncHandler(async (req, res) => {
  try {
    const { title, course, description, isFree, videoLink, duration, section } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: "العنوان مطلوب" });
    }

    if (!description && !videoLink && !req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "يجب تقديم وصف أو رابط فيديو أو ملف فيديو",
      });
    }

    let url, durationInSeconds;

    if (videoLink) {
      // Handle external video link
      url = videoLink;
      durationInSeconds = parseInt(duration);
      if (!duration || isNaN(durationInSeconds)) {
        return res.status(400).json({
          success: false,
          message: "مدة الفيديو مطلوبة للروابط الخارجية",
        });
      }
    } else if (req.file?.buffer) {
      // Handle file upload
      try {
        // First validate the video file
        if (!req.file.mimetype.startsWith('video/')) {
          return res.status(400).json({
            success: false,
            message: "الملف المرفوع ليس ملف فيديو صالح",
          });
        }

        // Get duration and upload to R2
        durationInSeconds = await getVideoDuration(req.file.buffer);
        const fileName = generateRandomFileName(req.file.originalname);
        const key = `videos/${fileName}`;
        
        const uploadResult = await uploadToR2(req.file.buffer, key, req.file.mimetype);
        url = uploadResult.url;
      } catch (uploadError) {
        console.error("Upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "خطأ في رفع الملف",
          error: uploadError.message,
        });
      }
    }

    // Create the video record
    const newVideo = await Video.create({
      title: title.trim(),
      video: url,
      duration: durationInSeconds,
      course,
      description: description?.trim() || "",
      isFree: Boolean(isFree),
      section: section?.trim() || null,
    });

    res.status(201).json({
      success: true,
      message: "تم رفع المقطع بنجاح",
      data: newVideo,
    });
  } catch (error) {
    console.error("Video upload error:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في رفع المقطع",
      error: error.message,
    });
  }
});

// @desc    Update a video
// @route   PUT /api/videos/:id
// @access  Private/Admin
const updateVideo = asyncHandler(async (req, res) => {
  try {
    const { title, course, description, isFree, videoLink, duration } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: "العنوان مطلوب" });
    }

    if (!description && !videoLink && !req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "يجب تقديم وصف أو رابط فيديو أو ملف فيديو",
      });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: "المقطع غير موجود" });
    }

    let url = video.video;
    let durationInSeconds = video.duration;
    const isR2Video = (videoUrl) => videoUrl?.includes("/videos/");

    if (videoLink) {
      // Handle external video link update
      if (videoLink !== video.video && isR2Video(video.video)) {
        const oldKey = extractIdFromUrl(video.video);
        if (oldKey) await deleteFromR2(oldKey).catch(console.warn);
      }

      url = videoLink;
      durationInSeconds = parseInt(duration) || video.duration;
    } else if (req.file?.buffer) {
      // Handle file upload update
      try {
        if (!req.file.mimetype.startsWith('video/')) {
          return res.status(400).json({
            success: false,
            message: "الملف المرفوع ليس ملف فيديو صالح",
          });
        }

        // Delete old video if it exists in R2
        if (isR2Video(video.video)) {
          const oldKey = extractIdFromUrl(video.video);
          if (oldKey) await deleteFromR2(oldKey).catch(console.warn);
        }

        // Upload new video
        durationInSeconds = await getVideoDuration(req.file.buffer);
        const fileName = generateRandomFileName(req.file.originalname);
        const key = `videos/${fileName}`;
        
        const uploadResult = await uploadToR2(req.file.buffer, key, req.file.mimetype);
        url = uploadResult.url;
      } catch (uploadError) {
        console.error("Upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "خطأ في رفع الملف",
          error: uploadError.message,
        });
      }
    }

    // Update video record
    video.title = title.trim();
    video.course = course || video.course;
    video.description = description?.trim() || video.description;
    video.isFree = isFree !== undefined ? Boolean(isFree) : video.isFree;
    video.video = url;
    video.duration = durationInSeconds;

    const updated = await video.save();

    res.json({
      success: true,
      message: "تم تحديث الفيديو",
      data: updated,
    });
  } catch (error) {
    console.error("Video update error:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في تحديث الفيديو",
      error: error.message,
    });
  }
});

// @route GET /api/videos/secure-url/:id
// @access Private/Protected
const getSecureVideoUrl = asyncHandler(async (req, res) => {
  console.log('start')
  try {
    const video = await Video.findById(req.params.id).populate("course");
    if (!video || !video.video) {
      return res.status(404).json({ success: false, message: "الفيديو غير موجود" });
    }

    const isFree = video.isFree || (video.course && video.course.price === 0);

    if (!isFree && !req.user) {
      return res.status(401).json({ 
        success: false,
        message: "يجب تسجيل الدخول للوصول إلى هذا الفيديو" 
      });
    }

    // Only generate signed URL for R2 videos
    if (video.video.includes("/videos/")) {
      const key = extractIdFromUrl(video.video);
      console.log('key',key)
      const signedUrl = await generateSignedUrl(`videos/${key}`, parseInt(video.duration) * 3);
      return res.json({ success: true, url: signedUrl });
    }

    // For external video links, return the URL directly
    res.json({ success: true, url: video.video });
  } catch (error) {
    console.error("Error generating secure URL:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في توليد رابط الفيديو",
      error: error.message,
    });
  }
});

// @desc    Delete a video
// @route   DELETE /api/videos/:id
// @access  Private/Admin
const deleteVideo = asyncHandler(async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: "المقطع غير موجود" 
      });
    }

    // Delete from R2 if it's an R2 video
    if (video.video && video.video.includes("/videos/")) {
      const key = extractIdFromUrl(video.video);
      if (key) {
        await deleteFromR2(key).catch(error => {
          console.error("Error deleting from R2:", error);
        });
      }
    }

    await video.deleteOne();
    res.json({ 
      success: true, 
      message: "تم حذف المقطع" 
    });
  } catch (error) {
    console.error("Error deleting video:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في حذف المقطع",
      error: error.message,
    });
  }
});

// @desc    Update only the section of a video
// @route   PUT /api/videos/:id/:section
// @access  Private/Admin
// const updateVideoSection = asyncHandler(async (req, res) => {
//   try {
//     const video = await Video.findById(req.params.id);
//     if (!video) {
//       return res.status(404).json({ 
//         success: false, 
//         message: "المقطع غير موجود" 
//       });
//     }

//     // Handle section update
//     const sectionParam = req.params.section;
//     if (["no-section", "null", "undefined"].includes(sectionParam)) {
//       video.section = null;
//     } else {
//       video.section = sectionParam;
//     }

//     const updatedVideo = await video.save();

//     res.json({
//       success: true,
//       message: "تم تحديث الوحدة",
//       data: updatedVideo,
//     });
//   } catch (error) {
//     console.error("Error updating video section:", error);
//     res.status(500).json({
//       success: false,
//       message: "خطأ في تحديث القسم",
//       error: error.message,
//     });
//   }
// });

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



module.exports = {
  uploadVideo,
  deleteVideo,
  updateVideo,
  updateVideoSection,
  getSecureVideoUrl,
};



{
  /**
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
    console.error("Video upload error:", error);

    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn("Failed to cleanup uploaded file:", cleanupError.message);
      }
    }
    res.status(500).json({
      success: false,
      message: "خطأ في رفع المقطع",
      error: error.message,
    });
  }
});
// @desc    Update a video
// @route   PUT /api/videos/:id
// @access  Private/Admin
const updateVideo = asyncHandler(async (req, res) => {
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

    const existingVideo = await Video.findById(req.params.id);
    if (!existingVideo) {
      return res
        .status(404)
        .json({ success: false, message: "المقطع غير موجود" });
    }

    let url = existingVideo.video;
    let durationInSeconds = existingVideo.duration;

    const isR2Video = (videoUrl) => {
      return videoUrl && videoUrl.startsWith("https:///videos/");
    };

    if (videoLink) {
      // Only delete if the new link is different and old video was from R2
      if (videoLink !== existingVideo.video && isR2Video(existingVideo.video)) {
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
      if (isR2Video(existingVideo.video)) {
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

      // Upload new file to R2
      try {
        durationInSeconds = await getVideoDuration(req.file.path);
        const key = `videos/${Date.now()}-${req.file.originalname}`;
        const uploadResult = await uploadToR2(
          req.file.path,
          key,
          req.file.mimetype
        );
        url = uploadResult.url; // Should return something like: "/videos/filename.mp4"
      } catch (uploadError) {
        // Clean up uploaded file on error
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        throw uploadError;
      }
    }

    // Update the video fields
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
    // Clean up uploaded file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn("Failed to cleanup uploaded file:", cleanupError.message);
      }
    }

    console.error("Video update error:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في تحديث الفيديو",
      error: error.message,
    });
  }
});

// @route GET /api/videos/secure-url/:id
// @access Private/Protected
const getSecureVideoUrl = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id).populate("course");
  if (!video || !video.video) {
    return res.status(404).json({ message: "الفيديو غير موجود" });
  }

  const isFree = video.isFree || (video.course && video.course.price === 0);

  if (!isFree && !req.user) {
    return res
      .status(500)
      .json({ message: "يجب تسجيل الدخول للوصول إلى هذا الفيديو" });
  }

  const key = extractIdFromUrl(video.video);
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
   */
}