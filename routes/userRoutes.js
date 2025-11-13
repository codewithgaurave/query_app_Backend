// routes/userRoutes.js
import express from "express";
import {
  createUserByAdmin,
  loginUser,
  listUsers,
  getUserById,
  updateUserByAdmin,
  blockUser,
  unblockUser,
  deleteUser,
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

router.patch("/:id/block", requireAuth, requireAdminOnly, blockUser);

router.patch("/:id/unblock", requireAuth, requireAdminOnly, unblockUser);

router.delete("/:id", requireAuth, requireAdminOnly, deleteUser);

export default router;
