const fs = require("fs");
const {
  S3,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { getVideoDurationInSeconds } = require("get-video-duration");
require("dotenv").config();

const s3Client = new S3({
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
  region: "auto",
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
  maxAttempts: 3,
});

const getVideoDuration = async (filePath) => {
  const duration = await getVideoDurationInSeconds(filePath);
  return duration;
};

const uploadToR2 = async (filePath, key, contentType) => {
  const fileSize = fs.statSync(filePath).size;
  const maxSingleUploadSize = 100 * 1024 * 1024; // 100MB

  try {
    if (fileSize <= maxSingleUploadSize) {
      // Small file: simple upload
      const fileContent = fs.readFileSync(filePath);

      const params = {
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
      };

      await s3Client.putObject(params);
    } else {
      // Large file: multipart upload
      await uploadLargeVideo(filePath, key, contentType);
    }

    // Clean up
    fs.unlinkSync(filePath);

    return {
      key,
      url: `https://${process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN}/${key}`,
    };
  } catch (error) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw error;
  }
};

const uploadLargeVideo = async (filePath, key, contentType) => {
  const fileSize = fs.statSync(filePath).size;
  const chunkSize = 100 * 1024 * 1024; // 100MB
  const concurrency = 3;

  const createMultipartParams = {
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  };

  const { UploadId } = await s3Client.send(new CreateMultipartUploadCommand(createMultipartParams));
  const parts = [];

  let partNumber = 1;
  let position = 0;

  const uploadTasks = [];

  try {
    while (position < fileSize) {
      const start = position;
      const end = Math.min(position + chunkSize, fileSize);

      const partParams = {
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
        PartNumber: partNumber,
        UploadId,
        Body: fs.createReadStream(filePath, { start, end: end - 1 }),
      };

      const currentPartNumber = partNumber;

      const uploadTask = s3Client.send(new UploadPartCommand(partParams))
        .then(result => ({
          ETag: result.ETag,
          PartNumber: currentPartNumber,
        }));

      uploadTasks.push(uploadTask);

      if (uploadTasks.length === concurrency) {
        const resolved = await Promise.all(uploadTasks);
        parts.push(...resolved);
        uploadTasks.length = 0;
      }

      position = end;
      partNumber++;
    }

    // Final batch
    if (uploadTasks.length > 0) {
      const resolved = await Promise.all(uploadTasks);
      parts.push(...resolved);
    }

    const completeParams = {
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      UploadId,
      MultipartUpload: {
        Parts: parts,
      },
    };

    await s3Client.send(new CompleteMultipartUploadCommand(completeParams));

  } catch (error) {
    try {
      await s3Client.send(new AbortMultipartUploadCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
        UploadId,
      }));
    } catch (abortErr) {
      console.error("Failed to abort multipart upload:", abortErr);
    }
    throw error;
  }
};

const generateSignedUrl = async (key, expiresIn = 11) => {
  const command = new GetObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
};

const deleteFromR2 = async (key) => {
  const params = {
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: "videos/" + key,
  };

  return await s3Client.send(new DeleteObjectCommand(params));
};

module.exports = {
  uploadToR2,
  getVideoDuration,
  generateSignedUrl,
  deleteFromR2,
  uploadLargeVideo,
};
