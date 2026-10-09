// routes/punchInRoutes.js
import express from "express";
import {
  punchIn,
  getUserPunchHistory,
  getAllPunchHistory,
} from "../controllers/punchInController.js";
import { uploadPunchinPhoto } from "../middleware/upload.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = express.Router();

// PUBLIC: SURVEY_USER punch-in using userCode (no token)
router.post("/", (req, res, next) => {
  uploadPunchinPhoto(req, res, (err) => {
    if (err) {
      console.error("❌ Multer upload error:", err);
      return res.status(400).json({ 
        message: "File upload failed", 
        error: err.message 
      });
    }
    next();
  });
}, punchIn);

// PUBLIC: user history by userCode
router.get("/user/:userCode", getUserPunchHistory);

// ADMIN ONLY: all users punch-in history (requires punchins permission)
router.get("/all", requireAuth, requirePermission("punchins"), getAllPunchHistory);

export default router;
