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
  resetUserPasswordByAdmin,
} from "../controllers/userController.js";
import { requireAuth, requireSuperAdminOnly } from "../middleware/auth.js";
import { uploadUserFields } from "../middleware/upload.js";

const router = express.Router();

// PUBLIC
router.post("/login", loginUser);

// ✅ PUBLIC - Only QUALITY_ENGINEER login route
router.post("/login/quality-engineer", loginQualityEngineer);

// SUPER ADMIN ONLY (with profile photo upload)
router.post(
  "/create",
  requireAuth,
  requireSuperAdminOnly,
  uploadUserFields, // single('profilePhoto')
  createUserByAdmin
);

router.get("/list", requireAuth, requireSuperAdminOnly, listUsers);

router.get("/:id", requireAuth, requireSuperAdminOnly, getUserById);

router.patch("/:id", requireAuth, requireSuperAdminOnly, updateUserByAdmin);

// 🔐 Admin resets user password
router.patch(
  "/:id/reset-password",
  requireAuth,
  requireSuperAdminOnly,
  resetUserPasswordByAdmin
);

router.patch("/:id/block", requireAuth, requireSuperAdminOnly, blockUser);

router.patch("/:id/unblock", requireAuth, requireSuperAdminOnly, unblockUser);

router.delete("/:id", requireAuth, requireSuperAdminOnly, deleteUser);

export default router;

