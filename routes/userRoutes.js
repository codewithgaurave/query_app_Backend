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
import { requireAuth, requirePermission, requireSuperAdminOnly } from "../middleware/auth.js";
import { uploadUserFields } from "../middleware/upload.js";

const router = express.Router();

// PUBLIC
router.post("/login", loginUser);

// ✅ PUBLIC - Only QUALITY_ENGINEER login route
router.post("/login/quality-engineer", loginQualityEngineer);

// USER MANAGEMENT ROUTES (Super Admin & Sub Admin with 'users' permission)
router.post(
  "/create",
  requireAuth,
  requirePermission("users"),
  uploadUserFields, // single('profilePhoto')
  createUserByAdmin
);

router.get("/list", requireAuth, requirePermission("users"), listUsers);

router.get("/:id", requireAuth, requirePermission("users"), getUserById);

router.patch("/:id", requireAuth, requirePermission("users"), updateUserByAdmin);

// 🔐 Reset user password
router.patch(
  "/:id/reset-password",
  requireAuth,
  requirePermission("users"),
  resetUserPasswordByAdmin
);

router.patch("/:id/block", requireAuth, requirePermission("users"), blockUser);

router.patch("/:id/unblock", requireAuth, requirePermission("users"), unblockUser);

router.delete("/:id", requireAuth, requirePermission("users"), deleteUser);

export default router;

