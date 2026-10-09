import express from "express";
import {
  getUserSurveyStats,
  getPlatformStats,
  getSurveyStats,
} from "../controllers/statsController.js";
import { requireAuth, requireSuperAdminOnly, optionalAuth } from "../middleware/auth.js";

const router = express.Router();

// ✅ userCode based stats (no auth - for survey mobile app)
router.get("/user/:userCode", optionalAuth, getUserSurveyStats);

// ✅ platform overall stats (Super Admin Only)
router.get("/platform", requireAuth, requireSuperAdminOnly, getPlatformStats);

// ✅ single survey stats (Super Admin Only)
router.get("/survey/:surveyIdOrCode", requireAuth, requireSuperAdminOnly, getSurveyStats);

export default router;
