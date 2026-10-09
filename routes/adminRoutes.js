import express from "express";
import {
  createAdmin,
  loginAdmin,
  listAdmins,
  logoutAll,
  getAdminProfile,
  editAdminProfile,
  changePassword,
  createSubAdmin,
  listSubAdmins,
  updateSubAdmin,
  deleteSubAdmin,
} from "../controllers/adminController.js";
import { requireAuth, requireSuperAdminOnly } from "../middleware/auth.js";

const router = express.Router();

router.post("/create", createAdmin);
router.post("/login", loginAdmin);

// protected routes
router.get("/list", requireAuth, listAdmins);
router.post("/logout-all", requireAuth, logoutAll);
router.get("/profile", requireAuth, getAdminProfile);
router.put("/profile", requireAuth, editAdminProfile);
router.post("/change-password", requireAuth, changePassword);

// Super Admin Sub-Admin Management Routes
router.post("/subadmins", requireAuth, requireSuperAdminOnly, createSubAdmin);
router.get("/subadmins", requireAuth, requireSuperAdminOnly, listSubAdmins);
router.put("/subadmins/:id", requireAuth, requireSuperAdminOnly, updateSubAdmin);
router.delete("/subadmins/:id", requireAuth, requireSuperAdminOnly, deleteSubAdmin);

export default router;

