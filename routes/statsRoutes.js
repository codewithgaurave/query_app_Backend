import express from "express";
import {
  getUserSurveyStats,
  getPlatformStats,
  getSurveyStats,
} from "../controllers/statsController.js";
import { requireAuth, requirePermission, optionalAuth } from "../middleware/auth.js";

const router = express.Router();

// ✅ userCode based stats (no auth - for survey mobile app)
router.get("/user/:userCode", optionalAuth, getUserSurveyStats);

// ✅ platform overall stats (Super Admin & Sub Admin with surveyCharts permission)
router.get("/platform", requireAuth, requirePermission("surveyCharts"), getPlatformStats);

// ✅ single survey stats (Super Admin & Sub Admin with surveyCharts permission)
router.get("/survey/:surveyIdOrCode", requireAuth, requirePermission("surveyCharts"), getSurveyStats);

export default router;
