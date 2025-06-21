// routes/uploadRoutes.js أو controller
const express = require("express");
const { S3, PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const router = express.Router();

require('dotenv').config()

const s3 = new S3({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

router.post("/get-upload-url", async (req, res) => {
  try {
    const key = `videos/${uuidv4()}.mp4`;

    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
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
