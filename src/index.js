const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const morgan = require('morgan');
const authRoutes = require('./routes/userRoutes');
const courseRoutes = require('./routes/courseRoutes');
const listRoutes = require('./routes/listRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const videosRoutes = require('./routes/videoRoutes');
const sectionRoutes = require('./routes/sectionRoutes');
const errorHandler = require('./lib/errorHandler');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/users', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/sections', sectionRoutes);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});