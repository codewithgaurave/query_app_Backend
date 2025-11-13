// routes/surveyRoutes.js
import express from "express";
import {
  createSurvey,
  addSurveyQuestion,
  listSurveys,
  getSurveyWithQuestions,
} from "../controllers/surveyController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Admin-only guard (admin JWT se aaya hua)
const requireAdminOnly = (req, res, next) => {
  if (!req.user || !req.user.adminId) {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};

// ✅ Create survey (Admin)
router.post("/create", requireAuth, requireAdminOnly, createSurvey);

// ✅ Add question (Admin) – surveyIdOrCode can be Mongo _id OR surveyCode (SRV-XXXX)
router.post(
  "/:surveyIdOrCode/questions",
  requireAuth,
  requireAdminOnly,
  addSurveyQuestion
);

// ✅ List surveys (Admin)
router.get("/list", requireAuth, requireAdminOnly, listSurveys);

// ✅ Get survey with questions (Admin)
router.get(
  "/:surveyIdOrCode",
  requireAuth,
  requireAdminOnly,
  getSurveyWithQuestions
);

export default router;
