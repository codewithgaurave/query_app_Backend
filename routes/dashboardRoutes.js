// routes/dashboardRoutes.js
import express from "express";
import { getAdminDashboardOverview } from "../controllers/dashboardController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// GET /api/admin/dashboard/overview
router.get("/overview", requireAuth, getAdminDashboardOverview);

export default router;
