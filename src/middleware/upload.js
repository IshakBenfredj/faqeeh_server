const multer = require('multer');


const upload = multer({ dest: "uploads/" });

module.exports = upload;


// const path = require('path');

// const sanitizeFilename = (filename) => {
//   return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
// };

// const storage = multer.diskStorage({
//   destination: 'uploads/',
//   filename: (req, file, cb) => {
//     const timestamp = Date.now();
//     const ext = path.extname(file.originalname); 
//     const baseName = path.basename(file.originalname, ext);
//     const safeName = sanitizeFilename(baseName);
//     cb(null, `${timestamp}-${safeName}${ext}`);
//   }
// });

// const upload = multer({ storage });