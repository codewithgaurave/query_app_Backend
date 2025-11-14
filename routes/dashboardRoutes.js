// routes/dashboardRoutes.js
import express from "express";
import { getAdminDashboardOverview } from "../controllers/dashboardController.js";
import { verifyAdminJwt } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/admin/dashboard/overview
router.get("/overview", verifyAdminJwt, getAdminDashboardOverview);

export default router;
