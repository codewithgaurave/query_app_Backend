// routes/punchInRoutes.js
import express from "express";
import {
  punchIn,
  getUserPunchHistory,
  getAllPunchHistory,
} from "../controllers/punchInController.js";
import { uploadPunchinPhoto } from "../config/cloudinary.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// same pattern as userRoutes
const requireAdminOnly = (req, res, next) => {
  if (!req.user || !req.user.adminId) {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};

// PUBLIC: SURVEY_USER punch-in using userCode (no token)
router.post("/", uploadPunchinPhoto, punchIn);

// PUBLIC: user history by userCode
router.get("/user/:userCode", getUserPunchHistory);

// ADMIN ONLY: all users punch-in history
router.get("/all", requireAuth, requireAdminOnly, getAllPunchHistory);

export default router;
