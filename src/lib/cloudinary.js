const fs = require("fs");
const cloudinary = require("cloudinary").v2;

require('dotenv').config()

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


const deleteFromCloudinary = async (publicId) => {
  return await cloudinary.uploader.destroy(publicId);
};

module.exports = {
  uploadImageToCloudinary,
  uploadVideoToCloudinary,
  deleteFromCloudinary,
};
