const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");
const { protect, admin } = require("../middleware/authMiddleware");

// Create a new quiz
router.post("/", protect, admin, quizController.createQuiz);

// Get 10 random questions for a course
router.get("/:courseId/questions", protect, quizController.getRandomQuestions);

// Submit quiz answers
router.post("/:courseId/submit",protect, quizController.submitQuiz);
router.delete("/:courseId",protect, quizController.deleteQuiz);

module.exports = router;