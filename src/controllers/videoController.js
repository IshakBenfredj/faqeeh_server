const asyncHandler = require("express-async-handler");
const Video = require("../models/Video");
const { uploadVideoToCloudinary, generateSignedVideoUrl } = require("../lib/cloudinary");
const extractIdFromUrl = require("../lib/extractIdFromUrl");

// @desc    Get all videos for a course
// @route   GET /api/videos/:courseId
// @access  Public
const getVideos = asyncHandler(async (req, res) => {
  try {
    const videos = await Video.find({ course: req.params.courseId });
    res.json(videos);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "خطأ في جلب المقاطع",
      error: error.message,
    });
  }
});

// @desc    Upload a new video
// @route   POST /api/videos
// @access  Private/Admin
const uploadVideo = asyncHandler(async (req, res) => {
  try {
    const {
      title,
      course,
      description,
      isFree,
      video,
      videoLink,
      duration,
      section,
    } = req.body;
    let url, durationInSeconds;

    if (videoLink) {
      url = videoLink;
      durationInSeconds = parseInt(duration);
    } else if (req.file?.path) {
      const uploadResult = await uploadVideoToCloudinary(req.file.path);
      url = uploadResult.url;
      console.log("uploadResult", uploadResult);
      durationInSeconds = uploadResult.durationInSeconds;
    }

    const newVideo = await Video.create({
      title,
      video: url,
      duration: durationInSeconds,
      course,
      description,
      isFree,
      section: section !== "" ? section : null,
    });

    res
      .status(201)
      .json({ success: true, message: "تم رفع المقطع", data: newVideo });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "خطأ في رفع المقطع",
      error: error.message,
    });
    console.log(error);
  }
});

// @route GET /api/videos/secure-url/:id
// @access Private/Protected
const getSecureVideoUrl = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video || !video.video) {
    return res.status(404).json();
  }

  const publicId = extractIdFromUrl(video.video);
  console.log('publicId', publicId);
  
  const signedUrl = generateSignedVideoUrl(publicId);

  res.json(signedUrl);
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

    const vidId = video.video ? extractIdFromUrl(video.video) : "";
    if (vidId) {
      await deleteFromCloudinary(vidId);
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
  console.log(req.body, req.file?.path);
  try {
    const { title, course, description, isFree, video, videoLink, duration } =
      req.body;

    const existingVideo = await Video.findById(req.params.id);
    if (!existingVideo) {
      return res
        .status(404)
        .json({ success: false, message: "المقطع غير موجود" });
    }

    let url = "";
    let durationInSeconds = "";

    if (videoLink) {
      url = videoLink;
      durationInSeconds = parseInt(duration);
    } else if (req.file?.path) {
      const oldVidId = existingVideo.video
        ? extractIdFromUrl(existingVideo.video)
        : "";
      if (oldVidId) {
        await deleteFromCloudinary(oldVidId);
      }

      const uploadResult = await uploadVideoToCloudinary(req.file.path);
      url = uploadResult.url;
      durationInSeconds = uploadResult.durationInSeconds;
    }

    existingVideo.title = title || existingVideo.title;
    existingVideo.course = course || existingVideo.course;
    existingVideo.description = description || existingVideo.description;
    existingVideo.isFree = isFree !== undefined ? isFree : existingVideo.isFree;
    existingVideo.video = url;
    existingVideo.duration = durationInSeconds;

    const updatedVideo = await existingVideo.save();

    res.json({
      success: true,
      message: "تم تحديث الفيديو",
      data: updatedVideo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "خطأ في تحديث الفيديو",
      error: error.message,
    });
    console.log(error);
  }
});

/**
 * @desc    Update only the section of a video
 * @route   PUT /api/videos/:id/:section
 * @access  Private/Admin
 */
const updateVideoSection = asyncHandler(async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res
        .status(404)
        .json({ success: false, message: "المقطع غير موجود" });
    }
    video.section =
      req.params.section === "no-section" ? "" : req.params.section;
    await video.save();
    res.json({ success: true, message: "تم تحديث الوحدة", data: video });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "خطأ في تحديث القسم",
      error: error.message,
    });
  }
});

module.exports = {
  getVideos,
  uploadVideo,
  deleteVideo,
  updateVideo,
  updateVideoSection,
  getSecureVideoUrl
};
