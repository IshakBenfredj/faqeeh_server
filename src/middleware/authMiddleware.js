const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");

const protect = asyncHandler(async (req, res, next) => {
  let token;

  try {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        res.status(401).json({ message: "المستخدم غير موجود", tokenError: true });
        return;
      }

      next();
    } else {
      res
        .status(401)
        .json({ message: "غير مصرح، لا يوجد رمز", tokenError: true });
    }
  } catch (error) {
    console.error(error);

    if (error.name === "JsonWebTokenError") {
      res.status(401).json({ message: "رمز غير صالح", tokenError: true });
    } else if (error.name === "TokenExpiredError") {
      res.status(401).json({ message: "جلسة منتهية الصلاحية", tokenError: true });
    } else {
      res.status(500).json({ message: "خطأ في الخادم", tokenError: true });
    }
  }
});

const admin = (req, res, next) => {
  try {
    if (req.user && req.user.role === "admin") {
      next();
    } else {
      res
        .status(403)
        .json({ message: "غير مصرح كمسؤول", tokenError: true });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "خطأ في الخادم", tokenError: true });
  }
};

module.exports = { protect, admin };
