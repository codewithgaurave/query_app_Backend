import express from "express";
import { createAdmin, loginAdmin, listAdmins, logoutAll, getAdminProfile, editAdminProfile, changePassword } from "../controllers/adminController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/create", createAdmin);
router.post("/login", loginAdmin);

// protected routes
router.get("/list", requireAuth, listAdmins);
router.post("/logout-all", requireAuth, logoutAll);
router.get("/profile", requireAuth, getAdminProfile);
router.put("/profile", requireAuth, editAdminProfile);
router.post("/change-password", requireAuth, changePassword);

export default router;
