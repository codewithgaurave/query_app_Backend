// routes/dashboardRoutes.js
import express from "express";
import { getAdminDashboardOverview } from "../controllers/dashboardController.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = express.Router();

// GET /api/admin/dashboard/overview
router.get("/overview", requireAuth, requirePermission("dashboard"), getAdminDashboardOverview);

export default router;

