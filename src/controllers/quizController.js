const Quiz = require("../models/Quiz");
const UserQuizResult = require("../models/UserQuizResult");
const User = require("../models/User");

// Create a new quiz for a course
exports.createQuiz = async (req, res) => {
  try {
    const { courseId, questions } = req.body;
    const quiz = new Quiz({ course: courseId, questions });
    await quiz.save();
    res.status(201).json({ message: "تم إنشاء الاختبار بنجاح", quiz });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "حدث خطأ أثناء إنشاء الاختبار", error });
  }
};

// Get 10 random questions for a course
exports.getRandomQuestions = async (req, res) => {
  try {
    const { courseId } = req.params;
    const quiz = await Quiz.findOne({ course: courseId });
    if (!quiz) {
      return res
        .status(404)
        .json({ message: "لم يتم العثور على اختبار لهذا المقرر" });
    }

    // Get user and check if admin
    const user = await User.findById(req.user._id);
    const isAdmin = user && user.role === "admin";

    const questions = quiz.questions
      .sort(() => 0.5 - Math.random())
      .slice(0, 10)
      .map((q) => ({
        _id: q._id,
        text: q.text,
        options: q.options.map((opt) => {
          const optionObj = {
            _id: opt._id,
            text: opt.text
          };
          if (isAdmin) {
            optionObj.isCorrect = opt.isCorrect;
          }
          return optionObj;
        })
      }));

    res.json({ questions });
  } catch (error) {
    res.status(500).json({ message: "حدث خطأ أثناء جلب الأسئلة", error });
  }
};

// Submit quiz answers
exports.submitQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { userId, answers } = req.body;

    const quiz = await Quiz.findOne({ course: courseId });
    if (!quiz) {
      return res
        .status(404)
        .json({ message: "لم يتم العثور على اختبار لهذا المقرر" });
    }

    let score = 0;
    answers.forEach((answer) => {
      const question = quiz.questions.id(answer.questionId);
      // In your backend scoring logic:
      if (question) {
        const correctOptionIds = question.options
          .filter((opt) => opt.isCorrect)
          .map((opt) => opt._id.toString());

        const selectedOptionIds = (answer.selectedOptionIds || []).map((id) =>
          id.toString()
        );

        // For multiple correct answers, require all correct ones to be selected
        if (correctOptionIds.length > 1) {
          if (correctOptionIds.every((id) => selectedOptionIds.includes(id))) {
            score += 1;
          }
        }
        // For single correct answer
        else if (selectedOptionIds.includes(correctOptionIds[0])) {
          score += 1;
        }
      }
    });

    // Update or create user's quiz result
    await UserQuizResult.findOneAndUpdate(
      { user: userId, course: courseId },
      { score, answeredAt: new Date() },
      { upsert: true, new: true }
    );

    res.json(score);
  } catch (error) {
    res.status(500).json({ message: "حدث خطأ أثناء إرسال الاختبار", error });
  }
};


// Delete quiz (Admin only)
exports.deleteQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    
    await Promise.all([
      Quiz.findOneAndDelete({ course: courseId }),
      UserQuizResult.deleteMany({ course: courseId })
    ]);
    
    res.json({ message: "تم حذف الاختبار بنجاح" });
  } catch (error) {
    res.status(500).json({ message: "حدث خطأ أثناء حذف الاختبار", error });
  }
};