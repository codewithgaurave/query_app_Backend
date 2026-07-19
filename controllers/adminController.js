import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Admin from "../models/Admin.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);

// helpers
const signJwt = (admin) =>
  jwt.sign({ sub: String(admin._id), adminId: admin.adminId, tv: admin.tokenVersion }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

// Create Admin
export const createAdmin = async (req, res) => {
  try {
    const { adminId, password, name } = req.body;
    if (!adminId || !password) {
      return res.status(400).json({ message: "adminId and password are required." });
    }

    const exists = await Admin.findOne({ adminId }).lean();
    if (exists) {
      return res.status(409).json({ message: "Admin with this adminId already exists." });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const admin = await Admin.create({ adminId, password: hash, name });

    return res.status(201).json({
      message: "Admin created successfully",
      admin: { adminId: admin.adminId, name: admin.name, id: admin._id },
    });
  } catch (err) {
    console.error("createAdmin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Login Admin
export const loginAdmin = async (req, res) => {
  try {
    const { adminId, password } = req.body;
    if (!adminId || !password) {
      return res.status(400).json({ message: "adminId and password are required." });
    }

    const admin = await Admin.findOne({ adminId }).select("+password +tokenVersion");
    if (!admin) return res.status(401).json({ message: "Invalid credentials." });

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials." });

    const token = signJwt(admin);

    return res.json({
      message: "Login successful",
      admin: {
        adminId: admin.adminId,
        name: admin.name,
        id: admin._id,
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
    const admins = await Admin.find({}, { adminId: 1, name: 1, createdAt: 1, updatedAt: 1 }).lean();
    return res.json({ admins });
  } catch (err) {
    console.error("listAdmins error:", err);
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
    return res.json({ admin });
  } catch (err) {
    console.error("getAdminProfile error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Edit Admin Profile (protected)
export const editAdminProfile = async (req, res) => {
  try {
    const { name } = req.body;
    const admin = await Admin.findById(req.user.sub).select("-password -tokenVersion -__v");
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    if (name) admin.name = name;
    
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
