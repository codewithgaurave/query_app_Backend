import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Admin from "../models/Admin.js";
import Survey from "../models/Survey.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);

const ALL_PERMISSIONS = {
  dashboard: true,
  surveys: true,
  surveyResponses: true,
  surveyCharts: true,
  users: true,
  punchins: true,
  pinnedQuestions: true,
};

const DEFAULT_SUBADMIN_PERMISSIONS = {
  dashboard: true,
  surveys: true,
  surveyResponses: true,
  surveyCharts: true,
  users: false,
  punchins: false,
  pinnedQuestions: false,
};

// helpers
const signJwt = (admin) =>
  jwt.sign(
    {
      sub: String(admin._id),
      adminId: admin.adminId,
      role: admin.role || "SUPER_ADMIN",
      tv: admin.tokenVersion || 0,
      permissions:
        admin.role === "SUPER_ADMIN"
          ? ALL_PERMISSIONS
          : admin.permissions || DEFAULT_SUBADMIN_PERMISSIONS,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    }
  );

// Create Admin (Default / Super Admin setup)
export const createAdmin = async (req, res) => {
  try {
    const { adminId, password, name, role = "SUPER_ADMIN", mobile, email } = req.body;
    if (!adminId || !password) {
      return res.status(400).json({ message: "adminId and password are required." });
    }

    const exists = await Admin.findOne({ adminId }).lean();
    if (exists) {
      return res.status(409).json({ message: "Admin with this adminId already exists." });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const admin = await Admin.create({
      adminId,
      password: hash,
      name,
      role,
      mobile: mobile || "",
      email: email || "",
      permissions: role === "SUPER_ADMIN" ? ALL_PERMISSIONS : DEFAULT_SUBADMIN_PERMISSIONS,
    });

    return res.status(201).json({
      message: "Admin created successfully",
      admin: {
        adminId: admin.adminId,
        name: admin.name,
        role: admin.role,
        id: admin._id,
        permissions: admin.permissions,
      },
    });
  } catch (err) {
    console.error("createAdmin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Login Admin (both Super Admin & Sub Admin)
export const loginAdmin = async (req, res) => {
  try {
    const { adminId, password } = req.body;
    if (!adminId || !password) {
      return res.status(400).json({ message: "adminId and password are required." });
    }

    const admin = await Admin.findOne({ adminId }).select("+password +tokenVersion");
    if (!admin) return res.status(401).json({ message: "Invalid credentials." });

    if (admin.isActive === false) {
      return res.status(403).json({ message: "Account has been deactivated. Please contact Super Admin." });
    }

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials." });

    const token = signJwt(admin);

    const userPermissions =
      admin.role === "SUPER_ADMIN"
        ? ALL_PERMISSIONS
        : { ...DEFAULT_SUBADMIN_PERMISSIONS, ...(admin.permissions ? admin.permissions.toObject?.() || admin.permissions : {}) };

    return res.json({
      message: "Login successful",
      admin: {
        adminId: admin.adminId,
        name: admin.name,
        role: admin.role || "SUPER_ADMIN",
        mobile: admin.mobile || "",
        email: admin.email || "",
        id: admin._id,
        permissions: userPermissions,
      },
      token,
    });
  } catch (err) {
    console.error("loginAdmin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// List Admins (protected)
export const listAdmins = async (_req, res) => {
  try {
    const admins = await Admin.find(
      {},
      { adminId: 1, name: 1, role: 1, mobile: 1, email: 1, isActive: 1, permissions: 1, createdAt: 1, updatedAt: 1 }
    ).lean();
    return res.json({ admins });
  } catch (err) {
    console.error("listAdmins error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ==========================================
// SUB ADMIN MANAGEMENT (Super Admin Only)
// ==========================================

// Create Sub Admin
export const createSubAdmin = async (req, res) => {
  try {
    const { adminId, password, name, mobile, email, permissions } = req.body;
    if (!adminId || !password || !name) {
      return res.status(400).json({ message: "adminId, password and name are required." });
    }

    const exists = await Admin.findOne({ adminId: adminId.trim() }).lean();
    if (exists) {
      return res.status(409).json({ message: "Sub Admin with this Login ID already exists." });
    }

    const finalPermissions = permissions
      ? { ...DEFAULT_SUBADMIN_PERMISSIONS, ...permissions }
      : DEFAULT_SUBADMIN_PERMISSIONS;

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const subAdmin = await Admin.create({
      adminId: adminId.trim(),
      password: hash,
      name: name.trim(),
      role: "SUB_ADMIN",
      mobile: mobile ? mobile.trim() : "",
      email: email ? email.trim().toLowerCase() : "",
      isActive: true,
      permissions: finalPermissions,
      createdBySuperAdmin: req.user.sub,
    });

    return res.status(201).json({
      message: "Sub Admin created successfully",
      subAdmin: {
        id: subAdmin._id,
        adminId: subAdmin.adminId,
        name: subAdmin.name,
        role: subAdmin.role,
        mobile: subAdmin.mobile,
        email: subAdmin.email,
        isActive: subAdmin.isActive,
        permissions: subAdmin.permissions,
        createdAtIST: subAdmin.createdAtIST,
      },
    });
  } catch (err) {
    console.error("createSubAdmin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// List Sub Admins with Survey Counts
export const listSubAdmins = async (req, res) => {
  try {
    const subAdmins = await Admin.find(
      { role: "SUB_ADMIN" },
      { adminId: 1, name: 1, role: 1, mobile: 1, email: 1, isActive: 1, permissions: 1, createdAtIST: 1, createdAt: 1, updatedAt: 1 }
    ).sort({ createdAt: -1 }).lean();

    // Aggregate surveys count per sub-admin
    const subAdminIds = subAdmins.map((s) => s._id);
    const surveyCounts = await Survey.aggregate([
      { $match: { createdByAdmin: { $in: subAdminIds } } },
      { $group: { _id: "$createdByAdmin", count: { $sum: 1 }, activeCount: { $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] } } } },
    ]);

    const countMap = {};
    surveyCounts.forEach((sc) => {
      countMap[String(sc._id)] = {
        totalSurveys: sc.count,
        activeSurveys: sc.activeCount,
      };
    });

    const result = subAdmins.map((sa) => ({
      ...sa,
      permissions: sa.permissions || DEFAULT_SUBADMIN_PERMISSIONS,
      totalSurveys: countMap[String(sa._id)]?.totalSurveys || 0,
      activeSurveys: countMap[String(sa._id)]?.activeSurveys || 0,
    }));

    return res.json({ subAdmins: result });
  } catch (err) {
    console.error("listSubAdmins error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Update Sub Admin
export const updateSubAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, mobile, email, isActive, password, permissions } = req.body;

    const subAdmin = await Admin.findOne({ _id: id, role: "SUB_ADMIN" });
    if (!subAdmin) {
      return res.status(404).json({ message: "Sub Admin not found" });
    }

    if (name) subAdmin.name = name.trim();
    if (mobile !== undefined) subAdmin.mobile = mobile.trim();
    if (email !== undefined) subAdmin.email = email.trim().toLowerCase();
    if (isActive !== undefined) subAdmin.isActive = Boolean(isActive);

    if (permissions !== undefined) {
      const existingPerms = subAdmin.permissions ? subAdmin.permissions.toObject?.() || subAdmin.permissions : DEFAULT_SUBADMIN_PERMISSIONS;
      subAdmin.permissions = {
        ...existingPerms,
        ...permissions,
      };
    }

    if (password && password.trim()) {
      subAdmin.password = await bcrypt.hash(password.trim(), SALT_ROUNDS);
      subAdmin.tokenVersion = (subAdmin.tokenVersion || 0) + 1;
    }

    await subAdmin.save();

    return res.json({
      message: "Sub Admin updated successfully",
      subAdmin: {
        id: subAdmin._id,
        adminId: subAdmin.adminId,
        name: subAdmin.name,
        role: subAdmin.role,
        mobile: subAdmin.mobile,
        email: subAdmin.email,
        isActive: subAdmin.isActive,
        permissions: subAdmin.permissions,
      },
    });
  } catch (err) {
    console.error("updateSubAdmin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Delete Sub Admin
export const deleteSubAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const subAdmin = await Admin.findOne({ _id: id, role: "SUB_ADMIN" });
    if (!subAdmin) {
      return res.status(404).json({ message: "Sub Admin not found" });
    }

    // Check if sub admin has surveys
    const surveysCount = await Survey.countDocuments({ createdByAdmin: id });
    if (surveysCount > 0) {
      // Instead of deleting data, deactivate
      subAdmin.isActive = false;
      await subAdmin.save();
      return res.json({
        message: `Sub Admin has ${surveysCount} surveys associated. Account has been deactivated instead of permanently deleted.`,
        deactivated: true,
      });
    }

    await Admin.deleteOne({ _id: id });
    return res.json({ message: "Sub Admin deleted successfully", deleted: true });
  } catch (err) {
    console.error("deleteSubAdmin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Optional: logout-all (invalidate old tokens by bumping tokenVersion)
export const logoutAll = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.sub).select("+tokenVersion");
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    admin.tokenVersion += 1;
    await admin.save();
    res.json({ message: "Logged out from all sessions" });
  } catch (err) {
    console.error("logoutAll error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Admin Profile (protected)
export const getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.sub).select("-password -tokenVersion -__v");
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    const adminObj = admin.toObject();
    adminObj.permissions =
      admin.role === "SUPER_ADMIN"
        ? ALL_PERMISSIONS
        : { ...DEFAULT_SUBADMIN_PERMISSIONS, ...(admin.permissions ? admin.permissions.toObject?.() || admin.permissions : {}) };
    return res.json({ admin: adminObj });
  } catch (err) {
    console.error("getAdminProfile error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Edit Admin Profile (protected)
export const editAdminProfile = async (req, res) => {
  try {
    const { name, mobile, email } = req.body;
    const admin = await Admin.findById(req.user.sub).select("-password -tokenVersion -__v");
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    if (name) admin.name = name;
    if (mobile !== undefined) admin.mobile = mobile;
    if (email !== undefined) admin.email = email;
    
    await admin.save();
    return res.json({ 
      message: "Profile updated successfully", 
      admin 
    });
  } catch (err) {
    console.error("editAdminProfile error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Change Password (protected)
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Old and new passwords are required." });
    }

    const admin = await Admin.findById(req.user.sub).select("+password +tokenVersion");
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const ok = await bcrypt.compare(oldPassword, admin.password);
    if (!ok) return res.status(401).json({ message: "Invalid old password." });

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    admin.password = hash;
    // Log out of other devices automatically
    admin.tokenVersion += 1;
    
    await admin.save();

    return res.json({ message: "Password changed successfully. You have been logged out of other devices." });
  } catch (err) {
    console.error("changePassword error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

