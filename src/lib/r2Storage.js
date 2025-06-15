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
const path = require("path");
const os = require("os");
const { NodeHttpHandler } = require("@smithy/node-http-handler");

require("dotenv").config();

const s3Client = new S3({
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
  region: "auto",
  signatureVersion: "v4",
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 300000, // 5 minutes
    socketTimeout: 300000, // 5 minutes
  }),
});

async function getVideoDuration(buffer) {
  const tempPath = path.join(os.tmpdir(), `video-${Date.now()}.mp4`);
  await fs.promises.writeFile(tempPath, buffer);

  try {
    const duration = await getVideoDurationInSeconds(tempPath);
    return Math.round(duration);
  } finally {
    fs.unlink(tempPath, (err) => {
      if (err) console.warn("Temp file cleanup failed:", err.message);
    });
  }
}

async function checkIfTranscodingNeeded(file) {
  return new Promise(async (resolve, reject) => {
    const isBuffer = Buffer.isBuffer(file);
    const tempPath = isBuffer
      ? path.join(os.tmpdir(), `video-${Date.now()}.mp4`)
      : file;

    try {
      if (isBuffer) {
        await fs.promises.writeFile(tempPath, file);
      }

      ffmpeg.ffprobe(tempPath, (err, metadata) => {
        // Clean up if we created a temp file
        if (isBuffer) {
          fs.unlink(tempPath, () => {});
        }

        if (err) return reject(err);

        const format = metadata.format;
        const videoStream = metadata.streams.find(
          (s) => s.codec_type === "video"
        );
        const audioStream = metadata.streams.find(
          (s) => s.codec_type === "audio"
        );

        const isMp4 = format.format_name.includes("mp4");
        const isH264 = videoStream?.codec_name === "h264";
        const isAAC = audioStream?.codec_name === "aac";
        console.log("!(isMp4 && isH264 && isAAC)", !(isMp4 && isH264 && isAAC));
        resolve(!(isMp4 && isH264 && isAAC));
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function transcodeToMp4(input) {
  return new Promise(async (resolve, reject) => {
    const isBuffer = Buffer.isBuffer(input);
    const inputPath = isBuffer
      ? path.join(os.tmpdir(), `video-${Date.now()}.mp4`)
      : input;
    const outputPath = path.join(
      os.tmpdir(),
      `video-${Date.now()}-transcoded.mp4`
    );

    try {
      if (isBuffer) {
        await fs.promises.writeFile(inputPath, input);
      }

      if (!fs.existsSync(inputPath)) {
        return reject(new Error("Input file does not exist"));
      }

      ffmpeg(inputPath)
        .outputOptions(["-c:v libx264", "-preset veryfast", "-crf 23"])
        .toFormat("mp4")
        .on("end", () => {
          if (isBuffer) {
            fs.unlink(inputPath, () => {});
          }
          resolve(outputPath);
        })
        .on("error", (err) => {
          // Clean up input if we created it
          if (isBuffer) {
            fs.unlink(inputPath, () => {});
          }
          reject(new Error("Video transcoding failed: " + err.message));
        })
        .save(outputPath);
    } catch (err) {
      reject(err);
    }
  });
}

async function uploadToR2(file, key, contentType) {
  const isBuffer = Buffer.isBuffer(file);
  let tempPath;
  let pathToUpload;

  try {
    // If input is a Buffer, write it to a temporary file
    if (isBuffer) {
      tempPath = path.join(os.tmpdir(), `video-${Date.now()}.mp4`);
      await fs.promises.writeFile(tempPath, file);
      pathToUpload = tempPath;
    } else {
      pathToUpload = file;
    }

    const fileSize = fs.statSync(pathToUpload).size;
    const maxSingleUploadSize = 100 * 1024 * 1024; // 100MB

    if (fileSize <= maxSingleUploadSize) {
      const fileContent = fs.readFileSync(pathToUpload);
      await s3Client.putObject({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
      });
    } else {
      await uploadLargeVideo(pathToUpload, key, contentType);
    }

    return {
      key,
      url: `https://${process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN}/${key}`,
    };
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    if (!isBuffer && fs.existsSync(file)) {
      fs.unlinkSync(file); // Delete original uploaded file if needed
    }
  }
}

async function uploadLargeVideo(filePath, key, contentType) {
  const startTime = Date.now(); // 🕒 البداية

  const fileSize = fs.statSync(filePath).size;
  const chunkSize = 10 * 1024 * 1024; // 10MB
  const maxRetries = 3;

  const createMultipartParams = {
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  };

  const { UploadId } = await s3Client.send(
    new CreateMultipartUploadCommand(createMultipartParams)
  );

  const parts = [];
  let partNumber = 1;
  let position = 0;

  console.log(`🚀 بدء رفع الفيديو: ${filePath} (${Math.round(fileSize / 1024 / 1024)} MB)`);

  try {
    while (position < fileSize) {
      const start = position;
      const end = Math.min(position + chunkSize, fileSize);
      const partRange = `[${start} - ${end}]`;

      let retries = 0;
      let success = false;
      let result;

      const stream = fs.createReadStream(filePath, { start, end: end - 1 });

      console.log(`📤 رفع الجزء ${partNumber} ${partRange}`);

      while (!success && retries < maxRetries) {
        try {
          result = await s3Client.send(
            new UploadPartCommand({
              Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
              Key: key,
              PartNumber: partNumber,
              UploadId,
              Body: stream,
            })
          );
          success = true;
        } catch (err) {
          retries++;
          console.warn(`⚠️ فشل رفع الجزء ${partNumber} (محاولة ${retries}/${maxRetries}): ${err.message}`);
          if (retries === maxRetries) throw new Error(`❌ فشل الجزء ${partNumber} بعد ${maxRetries} محاولات`);
        }
      }

      parts.push({
        ETag: result.ETag,
        PartNumber: partNumber,
      });

      position = end;
      partNumber++;
    }

    await s3Client.send(
      new CompleteMultipartUploadCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
        UploadId,
        MultipartUpload: { Parts: parts },
      })
    );

    const durationMs = Date.now() - startTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);

    console.log(`✅ اكتمل رفع الفيديو في ${minutes} دقيقة و ${seconds} ثانية`);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);

    console.error(`⛔️ فشل رفع الفيديو بعد ${minutes} دقيقة و ${seconds} ثانية: ${error.message}`);

    try {
      await s3Client.send(
        new AbortMultipartUploadCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
          Key: key,
          UploadId,
        })
      );
      console.log("🔁 تم إلغاء الرفع.");
    } catch (abortErr) {
      console.error("⚠️ فشل إلغاء عملية الرفع:", abortErr.message);
    }

    throw error;
  }
}


// async function uploadLargeVideo(filePath, key, contentType) {
//   const fileSize = fs.statSync(filePath).size;
//   const chunkSize = 50 * 1024 * 1024; // 50MB
//   const concurrency = 2;

//   const createMultipartParams = {
//     Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
//     Key: key,
//     ContentType: contentType,
//   };

//   const { UploadId } = await s3Client.send(
//     new CreateMultipartUploadCommand(createMultipartParams)
//   );
//   const parts = [];

//   let partNumber = 1;
//   let position = 0;

//   const uploadTasks = [];

//   try {
//     while (position < fileSize) {
//       const start = position;
//       const end = Math.min(position + chunkSize, fileSize);

//       const partParams = {
//         Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
//         Key: key,
//         PartNumber: partNumber,
//         UploadId,
//         Body: fs.createReadStream(filePath, { start, end: end - 1 }),
//       };

//       const currentPartNumber = partNumber;

//       const uploadTask = s3Client
//         .send(new UploadPartCommand(partParams))
//         .then((result) => ({
//           ETag: result.ETag,
//           PartNumber: currentPartNumber,
//         }));

//       uploadTasks.push(uploadTask);

//       if (uploadTasks.length === concurrency) {
//         const resolved = await Promise.all(uploadTasks);
//         parts.push(...resolved);
//         uploadTasks.length = 0;
//       }

//       position = end;
//       partNumber++;
//     }

//     // Final batch
//     if (uploadTasks.length > 0) {
//       const resolved = await Promise.all(uploadTasks);
//       parts.push(...resolved);
//     }

//     const completeParams = {
//       Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
//       Key: key,
//       UploadId,
//       MultipartUpload: {
//         Parts: parts,
//       },
//     };

//     await s3Client.send(new CompleteMultipartUploadCommand(completeParams));
//   } catch (error) {
//     try {
//       await s3Client.send(
//         new AbortMultipartUploadCommand({
//           Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
//           Key: key,
//           UploadId,
//         })
//       );
//     } catch (abortErr) {
//       console.error("Raw response body:", abortErr?.$response?.body);
//       throw abortErr;
//       console.error("Failed to abort multipart upload:", abortErr);
//     }
//     throw error;
//   }
// }

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
  s3Client,
};

// async function uploadToR2(file, key, contentType) {
//   const isBuffer = Buffer.isBuffer(file);
//   let tempPath;
//   let pathToUpload;

//   try {
//     // 1. If buffer (from frontend), write it to temp file
//     if (isBuffer) {
//       tempPath = path.join(os.tmpdir(), `video-${Date.now()}.mp4`);
//       await fs.promises.writeFile(tempPath, file);
//       pathToUpload = tempPath;
//     } else {
//       pathToUpload = file;
//     }

//     // 2. Get file size
//     const fileSize = fs.statSync(pathToUpload).size;
//     const maxSingleUploadSize = 100 * 1024 * 1024; // 100 MB

//     // 3. Upload
//     if (fileSize <= maxSingleUploadSize) {
//       // Small upload
//       const fileContent = fs.readFileSync(pathToUpload);
//       await s3Client.putObject({
//         Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
//         Key: key,
//         Body: fileContent,
//         ContentType: contentType,
//       });
//     } else {
//       // Multipart upload for large files
//       await uploadLargeVideo(pathToUpload, key, contentType);
//     }

//     return {
//       key,
//       url: `https://${process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN}/${key}`, // permanent public URL
//     };
//   } finally {
//     // Cleanup temp file
//     if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
//     if (!isBuffer && fs.existsSync(file)) fs.unlinkSync(file); // remove uploaded file
//   }
// }

// async function uploadToR2(file, key, contentType) {
//   const isBuffer = Buffer.isBuffer(file);
//   let tempPath;
//   let transcodedPath;
//   let pathToUpload;

//   try {
//     if (isBuffer) {
//       tempPath = path.join(os.tmpdir(), `video-${Date.now()}.mp4`);
//       await fs.promises.writeFile(tempPath, file);
//       pathToUpload = tempPath;
//     } else {
//       pathToUpload = file;
//     }

//     const needsTranscoding = await checkIfTranscodingNeeded(
//       isBuffer ? file : pathToUpload
//     );
//     if (needsTranscoding) {
//       console.log('needsTranscoding', needsTranscoding)
//       transcodedPath = await transcodeToMp4(isBuffer ? file : pathToUpload);
//       console.log('transcodedPath', transcodedPath)
//       pathToUpload = transcodedPath;
//     }

//     const fileSize = fs.statSync(pathToUpload).size;
//     const maxSingleUploadSize = 100 * 1024 * 1024;

//     if (fileSize <= maxSingleUploadSize) {
//       const fileContent = fs.readFileSync(pathToUpload);
//       await s3Client.putObject({
//         Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
//         Key: key,
//         Body: fileContent,
//         ContentType: contentType,
//       });
//     } else {
//       await uploadLargeVideo(pathToUpload, key, contentType);
//     }

//     return {
//       key,
//       url: `https://${process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN}/${key}`,
//     };
//   } finally {
//     if (tempPath && fs.existsSync(tempPath)) {
//       fs.unlinkSync(tempPath);
//     }
//     if (transcodedPath && fs.existsSync(transcodedPath)) {
//       fs.unlinkSync(transcodedPath);
//     }
//     if (isBuffer === false && fs.existsSync(file)) {
//       fs.unlinkSync(file); // Clean up original file if it was a path
//     }
//   }
// }

{
  /* 

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
const path = require("path");

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

const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;
const ffmpeg = require("fluent-ffmpeg");

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const getVideoDuration = async (filePath) => {
  const duration = await getVideoDurationInSeconds(filePath);
  return duration;
};

const checkIfTranscodingNeeded = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);

      const format = metadata.format;
      const videoStream = metadata.streams.find(s => s.codec_type === "video");
      const audioStream = metadata.streams.find(s => s.codec_type === "audio");

      const isMp4 = format.format_name.includes("mp4");
      const isH264 = videoStream?.codec_name === "h264";
      const isAAC = audioStream?.codec_name === "aac";

      // Only transcode if it's not already mp4+h264+aac
      resolve(!(isMp4 && isH264 && isAAC));
    });
  });
};

const transcodeToMp4 = (inputPath) => {
  return new Promise((resolve, reject) => {
    const ext = path.extname(inputPath);
    const base = path.basename(inputPath, ext);
    const dir = path.dirname(inputPath);

    const outputPath = path.join(dir, `${base}-transcoded.mp4`);

    if (!fs.existsSync(inputPath)) {
      return reject(new Error("Input file does not exist"));
    }

    ffmpeg(inputPath)
      .outputOptions(["-c:v libx264", "-preset veryfast", "-crf 23"])
      .toFormat("mp4")
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(new Error("Video transcoding failed: " + err.message)))
      .save(outputPath);
  });
};


const uploadToR2 = async (filePath, key, contentType) => {
  let pathToUpload = filePath;
  let transcodedPath;

  const needsTranscoding = await checkIfTranscodingNeeded(filePath);
  if (needsTranscoding) {
    transcodedPath = await transcodeToMp4(filePath);
    pathToUpload = transcodedPath;
  }

  const fileSize = fs.statSync(pathToUpload).size;
  const maxSingleUploadSize = 100 * 1024 * 1024; // 100MB

  try {
    if (fileSize <= maxSingleUploadSize) {
      const fileContent = fs.readFileSync(pathToUpload);

      const params = {
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
      };

      await s3Client.putObject(params);
    } else {
      await uploadLargeVideo(pathToUpload, key, contentType);
    }

    // Clean up
    fs.unlinkSync(filePath);
    if (transcodedPath && fs.existsSync(transcodedPath)) {
      fs.unlinkSync(transcodedPath);
    }

    return {
      key,
      url: `https://${process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN}/${key}`,
    };
  } catch (error) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (transcodedPath && fs.existsSync(transcodedPath)) fs.unlinkSync(transcodedPath);
    throw error;
  }
};


// const uploadToR2 = async (filePath, key, contentType) => {
//   const fileSize = fs.statSync(filePath).size;
//   const maxSingleUploadSize = 100 * 1024 * 1024; // 100MB

//   try {
//     if (fileSize <= maxSingleUploadSize) {
//       // Small file: simple upload
//       const fileContent = fs.readFileSync(filePath);

//       const params = {
//         Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
//         Key: key,
//         Body: fileContent,
//         ContentType: contentType,
//       };

//       await s3Client.putObject(params);
//     } else {
//       // Large file: multipart upload
//       await uploadLargeVideo(filePath, key, contentType);
//     }

//     // Clean up
//     fs.unlinkSync(filePath);

//     return {
//       key,
//       url: `https://${process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN}/${key}`,
//     };
//   } catch (error) {
//     if (fs.existsSync(filePath)) {
//       fs.unlinkSync(filePath);
//     }
//     throw error;
//   }
// };

const uploadLargeVideo = async (filePath, key, contentType) => {
  const fileSize = fs.statSync(filePath).size;
  const chunkSize = 100 * 1024 * 1024; // 100MB
  const concurrency = 3;

  const createMultipartParams = {
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  };

  const { UploadId } = await s3Client.send(
    new CreateMultipartUploadCommand(createMultipartParams)
  );
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

      const uploadTask = s3Client
        .send(new UploadPartCommand(partParams))
        .then((result) => ({
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
      await s3Client.send(
        new AbortMultipartUploadCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
          Key: key,
          UploadId,
        })
      );
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
   */
}
