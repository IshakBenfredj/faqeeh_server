const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
require('dotenv').config();

cloudinary.config({
  cloud_name: 'divbldppz',
  api_key: '938211877471192',
  api_secret: process.env.CLOUDINARY_SECRET,
});

const uploadWatermark = async () => {
  try {
    const result = await cloudinary.uploader.upload('assets/watermark.png', {
      folder: 'watermarks',
      public_id: 'my_watermark',
      resource_type: 'image',
    });
    console.log('✅ Upload successful:', result.secure_url);
    return result;
  } catch (error) {
    console.error('❌ Upload failed:', error);
  }
};

// Call and handle the upload
uploadWatermark();
