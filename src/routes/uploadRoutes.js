// routes/uploadRoutes.js أو controller
const express = require("express");
const { S3, PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const router = express.Router();

require('dotenv').config()

const s3 = new S3({
  region: "auto",
  endpoint: `https://${'7f6ead12839373560eba49dd39d50ec2'}.eu.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: '41c7a5867876b99927f5e22a7615c0e9',
    secretAccessKey: '456283ce75f6050e296bd58b86b0194e897d4dc88aa29d21cdd61df14c8bd34e',
  },
});

router.post("/get-upload-url", async (req, res) => {
  try {
    const key = `videos/${uuidv4()}.mp4`;

    const command = new PutObjectCommand({
      Bucket: 'faqeeh',
      Key: key,
      ContentType: "video/mp4",
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 100 }); // 5 دقائق صلاحية

    return res.json({
      uploadUrl: signedUrl,
      key,
    });
  } catch (err) {
    console.error("Error generating signed URL", err);
    return res.status(500).json({ error: "Failed to generate signed URL" });
  }
});

module.exports = router;
