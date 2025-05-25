const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  text: String,
  isCorrect: Boolean,
});

const questionSchema = new mongoose.Schema({
  text: String,
  options: [optionSchema],
});

const quizSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  questions: [questionSchema],
});

module.exports = mongoose.model('Quiz', quizSchema);