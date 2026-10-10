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
  duplicateSurvey,
} from "../controllers/surveyController.js";
import {
  submitSurveyResponse,
  submitBulkSurveyResponses, // ✅ NEW
  listSurveyResponses,
  listUserSurveySummary,
  adminSurveyResponseSummary,
  approveSurveyResponse,
  getAssignedSurveyResponsesForQC, // ✅ NEW SECURE ROUTE FOR QC
  getQCResponseDetail, // ✅ ON-DEMAND SINGLE RESPONSE DETAIL FOR QC
  // ⬇️ NEW PUBLIC CONTROLLERS
  publicSurveyResponsesWithApproval,
  publicSetSurveyResponseApproval,
    publicPinQuestionToDashboard,       
  publicListDashboardPinnedQuestions,  
    publicDeleteDashboardPinnedQuestion, 
} from "../controllers/surveyResponseController.js";
import { requireAuth, requirePermission, requireAdminOnly, requireSuperAdminOnly, optionalAuth } from "../middleware/auth.js";
import upload, { uploadSurveyAudio } from "../middleware/upload.js";

const router = express.Router();

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

// ✅ SECURE QC PANEL: get only assigned surveys for the logged in QC
router.get("/qc/responses/assigned", requireAuth, requireQualityEngineerOnly, getAssignedSurveyResponsesForQC);

// ✅ SECURE QC PANEL: get single response detail on demand
router.get("/qc/responses/:responseId", requireAuth, requireQualityEngineerOnly, getQCResponseDetail);

// ✅ PUBLIC: list surveys for SURVEY_USER app (no token)
// default: sirf ACTIVE surveys
// optional: ?userCode=USR-XXXX => sirf usko assigned surveys (ya global)
router.get("/public/list", listPublicSurveys);

// ✅ 🚨PUBLIC: sabhi surveys + unke responses + approval info
router.get("/public/responses/all", optionalAuth, publicSurveyResponsesWithApproval);

// ✅ 🚨PUBLIC: set approvalStatus for a specific response (NO AUTH)
router.patch(
  "/public/responses/:responseId/approval",
  publicSetSurveyResponseApproval
);

// ✅ Create survey (Super Admin & Sub Admin with surveys permission)
router.post("/create", requireAuth, requirePermission("surveys"), createSurvey);

// ✅ Update survey (Super Admin & Sub Admin with surveys permission)
router.put(
  "/:surveyIdOrCode",
  requireAuth,
  requirePermission("surveys"),
  updateSurvey
);

// ✅ Delete survey (Super Admin & Sub Admin with surveys permission)
router.delete(
  "/:surveyIdOrCode",
  requireAuth,
  requirePermission("surveys"),
  deleteSurvey
);

// ✅ Duplicate survey (Super Admin & Sub Admin with surveys permission)
router.post(
  "/:surveyIdOrCode/duplicate",
  requireAuth,
  requirePermission("surveys"),
  duplicateSurvey
);

// ✅ Upload party symbol image (Super Admin & Sub Admin with surveys permission)
router.post(
  "/upload-symbol",
  requireAuth,
  requirePermission("surveys"),
  upload.single("image"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }
      const url = req.file.location || req.file.path;
      return res.json({ message: "Symbol uploaded successfully", url });
    } catch (err) {
      console.error("upload-symbol error:", err);
      return res.status(500).json({ message: "Failed to upload symbol" });
    }
  }
);

// ✅ Add question (Super Admin & Sub Admin with surveys permission)
router.post(
  "/:surveyIdOrCode/questions",
  requireAuth,
  requirePermission("surveys"),
  addSurveyQuestion
);

// ✅ Update question (Super Admin & Sub Admin with surveys permission)
router.put(
  "/questions/:questionId",
  requireAuth,
  requirePermission("surveys"),
  updateSurveyQuestion
);

// ✅ Delete question (Super Admin & Sub Admin with surveys permission)
router.delete(
  "/questions/:questionId",
  requireAuth,
  requirePermission("surveys"),
  deleteSurveyQuestion
);

// ✅ List surveys (Super Admin & Sub Admin with surveys permission)
router.get("/list", requireAuth, requirePermission("surveys"), listSurveys);

// ✅ NEW: Admin summary — sabhi surveys + response count + users
router.get(
  "/responses/summary",
  requireAuth,
  requirePermission("surveyResponses"),
  adminSurveyResponseSummary
);

// ✅ Get survey + questions
// SURVEY_USER app me: ?userCode=USR-XXXX bhejoge to punch-in + assignment check hoga
router.get("/:surveyIdOrCode", optionalAuth, getSurveyWithQuestions);

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
  requirePermission("surveyResponses"),
  listSurveyResponses
);

// ✅ kis user ne kaun-kaun se surveys ka answer de diya (userCode se)
router.get("/responses/user/:userCode", optionalAuth, listUserSurveySummary);

// ✅ NEW: QUALITY_ENGINEER sets approvalStatus for a specific response
// (route naam thoda generic kiya /approval)
router.patch(
  "/responses/:responseId/approval",
  requireAuth,
  requireQualityEngineerOnly,
  approveSurveyResponse
);

// ⭐ PUBLIC: pin a question to dashboard
router.post("/public/dashboard/pin", optionalAuth, publicPinQuestionToDashboard);

// ⭐ PUBLIC: list pinned questions with analytics (dashboard)
router.get(
  "/public/dashboard/pins",
  optionalAuth,
  publicListDashboardPinnedQuestions
);

// ⭐ PUBLIC: delete a pinned question from dashboard
router.delete(
  "/public/dashboard/pins/:pinId",
  optionalAuth,
  publicDeleteDashboardPinnedQuestion
);

export default router;
