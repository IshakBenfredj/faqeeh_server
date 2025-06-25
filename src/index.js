const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");
const authRoutes = require("./routes/userRoutes");
const courseRoutes = require("./routes/courseRoutes");
const packRoutes = require("./routes/packRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const ratingRoutes = require("./routes/ratingRoutes");
const videosRoutes = require("./routes/videoRoutes");
const sectionRoutes = require("./routes/sectionRoutes");
const quizRoutes = require("./routes/quizRoutes");
const messageRoutes = require("./routes/messageRoutes");
const statisticsRoutes = require("./routes/statisticsRoutes");
// const uploadsRoutes = require("./routes/uploadRoutes");
const errorHandler = require("./lib/errorHandler");
const job = require("./lib/cron");

dotenv.config();

const app = express();
// job.start();

const allowedOrigins = ["https://faqeeh.academy", "https://www.faqeeh.academy"];

// Middleware
const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json({ limit: "5gb" }));
app.use(express.urlencoded({ limit: "5gb", extended: true }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}
if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined"));
}

// Database connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/users", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/packs", packRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/videos", videosRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/statistics", statisticsRoutes);
// app.use((req, res, next) => {
//   if (req.path.startsWith("/api/uploads/upload-part")) {
//     return next();
//   }
//   express.json()(req, res, next);
// });
// app.use("/api/uploads", uploadsRoutes);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
