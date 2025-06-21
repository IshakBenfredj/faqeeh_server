const {
  S3,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");

const s3Client = new S3({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

exports.initiateUpload = async (req, res) => {
  const key = `videos/${uuidv4()}.mp4`;

  const command = new CreateMultipartUploadCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    ContentType: "video/mp4",
  });

  const { UploadId } = await s3Client.send(command);
  res.json({ key, uploadId: UploadId });
};

exports.uploadPart = async (req, res) => {
  try {
    const { key, uploadId, partNumber } = req.query;
    const buffer = req.body;

    const command = new UploadPartCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      PartNumber: parseInt(partNumber),
      Body: buffer,
      ContentLength: buffer.length,
    });

    const result = await s3Client.send(command);
    res.json({ ETag: result.ETag });
  } catch (error) {
    console.error("uploadPart error:", error);
    res
      .status(500)
      .json({
        message: "UploadPart failed",
        error: error.message,
        stack: error.stack,
      });
  }
};

exports.completeUpload = async (req, res) => {
  const { key, uploadId, parts } = req.body;

  const command = new CompleteMultipartUploadCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  });

  try {
    await s3Client.send(command);
    res.json({
      message: "Upload complete",
      url: `https://${process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN}/${key}`,
    });
  } catch (err) {
    console.error("completeUpload error:", err);
    res.status(500).json({ error: "Complete upload failed" });
  }
};
