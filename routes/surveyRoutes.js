// routes/surveyRoutes.js
import express from "express";
import {
  createSurvey,
  addSurveyQuestion,
  listSurveys,
  getSurveyWithQuestions,
  listPublicSurveys,          // ✅ NEW
} from "../controllers/surveyController.js";
import {
  submitSurveyResponse,
  listSurveyResponses,
  listUserSurveySummary,
} from "../controllers/surveyResponseController.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadSurveyAudio } from "../config/cloudinary.js";

const router = express.Router();

// Admin-only guard
const requireAdminOnly = (req, res, next) => {
  if (!req.user || !req.user.adminId) {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};

// ✅ PUBLIC: list surveys for SURVEY_USER app (no token)
// default: sirf ACTIVE surveys
router.get("/public/list", listPublicSurveys);

// ✅ Create survey (Admin)
router.post("/create", requireAuth, requireAdminOnly, createSurvey);

// ✅ Add question (Admin)
router.post(
  "/:surveyIdOrCode/questions",
  requireAuth,
  requireAdminOnly,
  addSurveyQuestion
);

// ✅ List surveys (Admin)
router.get("/list", requireAuth, requireAdminOnly, listSurveys);

// ✅ Get survey + questions
// SURVEY_USER app me: ?userCode=USR-XXXX bhejoge to punch-in check hoga
router.get("/:surveyIdOrCode", getSurveyWithQuestions);

// ✅ SURVEY_USER submit responses + audio (userCode based, no token)
router.post(
  "/:surveyIdOrCode/respond",
  uploadSurveyAudio,
  submitSurveyResponse
);

// ✅ Admin: list all responses for a survey
router.get(
  "/:surveyIdOrCode/responses",
  requireAuth,
  requireAdminOnly,
  listSurveyResponses
);

// ✅ kis user ne kaun-kaun se surveys ka answer de diya (userCode se)
router.get("/responses/user/:userCode", listUserSurveySummary);

export default router;
