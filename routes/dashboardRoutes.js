// routes/dashboardRoutes.js
import express from "express";
import {
  getDashboardOverview,
  getPunchInTimeSeries,
  getSurveyResponseTimeSeries,
  getSurveyPerformance,
  getSurveyUserActivity,
} from "../controllers/dashboardController.js";
import { verifyAdminJwt } from "../middleware/authMiddleware.js"; // aapka admin auth

const router = express.Router();

router.get("/overview", verifyAdminJwt, getDashboardOverview);
router.get("/punchins/timeseries", verifyAdminJwt, getPunchInTimeSeries);
router.get("/responses/timeseries", verifyAdminJwt, getSurveyResponseTimeSeries);
router.get("/surveys/performance", verifyAdminJwt, getSurveyPerformance);
router.get("/users/activity", verifyAdminJwt, getSurveyUserActivity);

export default router;
