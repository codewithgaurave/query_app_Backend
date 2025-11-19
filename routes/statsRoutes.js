// routes/statsRoutes.js
import express from "express";
import {
  getUserSurveyStats,
  getPlatformStats,
  getSurveyStats,
} from "../controllers/statsController.js";

const router = express.Router();

// ✅ userCode based stats (no auth)
router.get("/user/:userCode", getUserSurveyStats);

// ✅ platform overall stats
router.get("/platform", getPlatformStats);

// ✅ single survey stats
router.get("/survey/:surveyIdOrCode", getSurveyStats);

export default router;
