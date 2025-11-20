// routes/surveyRoutes.js
import express from "express";
import {
  createSurvey,
  addSurveyQuestion,
  listSurveys,
  getSurveyWithQuestions,
  listPublicSurveys,
  updateSurvey,
  deleteSurvey,
  updateSurveyQuestion,
  deleteSurveyQuestion,
} from "../controllers/surveyController.js";
import {
  submitSurveyResponse,
  submitBulkSurveyResponses, // ✅ NEW
  listSurveyResponses,
  listUserSurveySummary,
  adminSurveyResponseSummary,
  approveSurveyResponse,
  // ⬇️ NEW PUBLIC CONTROLLERS
  publicSurveyResponsesWithApproval,
  publicSetSurveyResponseApproval,
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

// QUALITY_ENGINEER-only guard
const requireQualityEngineerOnly = (req, res, next) => {
  if (
    !req.user ||
    req.user.type !== "USER" ||
    req.user.role !== "QUALITY_ENGINEER"
  ) {
    return res.status(403).json({ message: "Quality Engineer access only" });
  }
  next();
};

// ✅ PUBLIC: list surveys for SURVEY_USER app (no token)
// default: sirf ACTIVE surveys
// optional: ?userCode=USR-XXXX => sirf usko assigned surveys (ya global)
router.get("/public/list", listPublicSurveys);

// ✅ 🚨PUBLIC: sabhi surveys + unke responses + approval info (NO AUTH)
router.get("/public/responses/all", publicSurveyResponsesWithApproval);

// ✅ 🚨PUBLIC: set approvalStatus for a specific response (NO AUTH)
router.patch(
  "/public/responses/:responseId/approval",
  publicSetSurveyResponseApproval
);

// ✅ Create survey (Admin)
router.post("/create", requireAuth, requireAdminOnly, createSurvey);

// ✅ Update survey (Admin)
router.put(
  "/:surveyIdOrCode",
  requireAuth,
  requireAdminOnly,
  updateSurvey
);

// ✅ Delete survey (Admin)
router.delete(
  "/:surveyIdOrCode",
  requireAuth,
  requireAdminOnly,
  deleteSurvey
);

// ✅ Add question (Admin)
router.post(
  "/:surveyIdOrCode/questions",
  requireAuth,
  requireAdminOnly,
  addSurveyQuestion
);

// ✅ Update question (Admin)
router.put(
  "/questions/:questionId",
  requireAuth,
  requireAdminOnly,
  updateSurveyQuestion
);

// ✅ Delete question (Admin)
router.delete(
  "/questions/:questionId",
  requireAuth,
  requireAdminOnly,
  deleteSurveyQuestion
);

// ✅ List surveys (Admin)
router.get("/list", requireAuth, requireAdminOnly, listSurveys);

// ✅ NEW: Admin summary — sabhi surveys + response count + users
router.get(
  "/responses/summary",
  requireAuth,
  requireAdminOnly,
  adminSurveyResponseSummary
);

// ✅ Get survey + questions
// SURVEY_USER app me: ?userCode=USR-XXXX bhejoge to punch-in + assignment check hoga
router.get("/:surveyIdOrCode", getSurveyWithQuestions);

// ✅ SURVEY_USER submit SINGLE response + audio (userCode based, no token)
router.post(
  "/:surveyIdOrCode/respond",
  uploadSurveyAudio,
  submitSurveyResponse
);

// ✅ SURVEY_USER submit MULTIPLE responses (bulk) + single audio
router.post(
  "/:surveyIdOrCode/respond/bulk",
  uploadSurveyAudio,
  submitBulkSurveyResponses
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

// ✅ NEW: QUALITY_ENGINEER sets approvalStatus for a specific response
// (route naam thoda generic kiya /approval)
router.patch(
  "/responses/:responseId/approval",
  requireAuth,
  requireQualityEngineerOnly,
  approveSurveyResponse
);

export default router;
