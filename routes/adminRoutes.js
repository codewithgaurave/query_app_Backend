import express from "express";
import { createAdmin, loginAdmin, listAdmins, logoutAll } from "../controllers/adminController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/create", createAdmin);
router.post("/login", loginAdmin);

// protected routes
router.get("/list", requireAuth, listAdmins);
router.post("/logout-all", requireAuth, logoutAll);

export default router;
