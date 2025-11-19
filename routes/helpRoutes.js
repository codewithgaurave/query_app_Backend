// routes/helpRoutes.js
import express from "express";
import {
  getHelpAndSupport,
  updateHelpAndSupport,
} from "../controllers/helpController.js";

import { requireAuth } from "../middleware/auth.js";

const requireAdminOnly = (req, res, next) => {
  if (!req.user?.adminId) {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};

const router = express.Router();

// PUBLIC
router.get("/", getHelpAndSupport);

// ADMIN ONLY
router.put("/", requireAuth, requireAdminOnly, updateHelpAndSupport);

export default router;
