const fs = require("fs");
const cloudinary = require("cloudinary").v2;

require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadImageToCloudinary = async (filePath) => {
  const result = await cloudinary.uploader.upload(filePath);
  // fs.unlinkSync(filePath);
  return result;
};

const uploadVideoToCloudinary = async (filePath) => {
  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: "video",
  });
  // fs.unlinkSync(filePath);
  return {
    url: result.secure_url,
    publicId: result.public_id,
    durationInSeconds: result.duration,
  };
};

const generateSignedVideoUrl = (publicId, expiresInSeconds = 3) => {
  const timestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;

  const signature = cloudinary.utils.api_sign_request(
    {
      public_id: publicId,
      timestamp: timestamp,
    },
    process.env.CLOUDINARY_API_SECRET
  );

  const url =
    `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload` +
    `/v${timestamp}/${publicId}.mp4` +
    `?timestamp=${timestamp}&signature=${signature}&api_key=${process.env.CLOUDINARY_API_KEY}`;

  return url;
};

// const generateSignedVideoUrl = (publicId, expiresInSeconds = 300) => {
//   const timestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;

//   const url = cloudinary.url(publicId, {
//     resource_type: 'video',
//     type: 'authenticated', // This must match Cloudinary delivery settings
//     sign_url: true,
//     timestamp,
//     secure: true,
//   });

//   return url;
// };


const deleteFromCloudinary = async (publicId) => {
  return await cloudinary.uploader.destroy(publicId);
};

module.exports = {
  uploadImageToCloudinary,
  uploadVideoToCloudinary,
  generateSignedVideoUrl,
  deleteFromCloudinary,
};
