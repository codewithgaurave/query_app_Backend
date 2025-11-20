// routes/userRoutes.js
import express from "express";
import {
  createUserByAdmin,
  loginUser,
  loginQualityEngineer,
  listUsers,
  getUserById,
  updateUserByAdmin,
  blockUser,
  unblockUser,
  deleteUser,
  resetUserPasswordByAdmin, // 🔐 NEW IMPORT
} from "../controllers/userController.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadUserFields } from "../config/cloudinary.js";

const router = express.Router();

const requireAdminOnly = (req, res, next) => {
  if (!req.user || !req.user.adminId) {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};

// PUBLIC
router.post("/login", loginUser);

// ✅ PUBLIC - Only QUALITY_ENGINEER login route
router.post("/login/quality-engineer", loginQualityEngineer);

// ADMIN ONLY (with profile photo upload)
router.post(
  "/create",
  requireAuth,
  requireAdminOnly,
  uploadUserFields, // single('profilePhoto')
  createUserByAdmin
);

router.get("/list", requireAuth, requireAdminOnly, listUsers);

router.get("/:id", requireAuth, requireAdminOnly, getUserById);

router.patch("/:id", requireAuth, requireAdminOnly, updateUserByAdmin);

// 🔐 NEW: Admin resets user password
// PATCH /api/users/:id/reset-password
// Body: { "password": "NewPassword123" }
router.patch(
  "/:id/reset-password",
  requireAuth,
  requireAdminOnly,
  resetUserPasswordByAdmin
);

router.patch("/:id/block", requireAuth, requireAdminOnly, blockUser);

router.patch("/:id/unblock", requireAuth, requireAdminOnly, unblockUser);

router.delete("/:id", requireAuth, requireAdminOnly, deleteUser);

export default router;
