// controllers/userController.js
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import User from "../models/User.js";
import Admin from "../models/Admin.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.USER_JWT_EXPIRES_IN || "8h";
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);

// helper: random userCode
const generateUserCode = () =>
  "USR-" + crypto.randomBytes(4).toString("hex").toUpperCase();

// helper: sign user JWT
const signUserJwt = (user) =>
  jwt.sign(
    {
      sub: String(user._id),
      mobile: user.mobile,
      role: user.role,
      userCode: user.userCode,
      type: "USER",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

// ✅ Admin creates a user (with optional profilePhoto)
export const createUserByAdmin = async (req, res) => {
  try {
    const adminId = req.user?.sub;
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const adminExists = await Admin.findById(adminId).lean();
    if (!adminExists) {
      return res.status(401).json({ message: "Admin no longer exists" });
    }

    const {
      mobile,
      password,
      role,
      fullName,
      email,
      employeeCode,
      department,
      city,
      state,
      pincode,
      dateOfJoining,
    } = req.body;

    if (!mobile || !password || !role || !fullName) {
      return res.status(400).json({
        message: "mobile, password, role, fullName are required.",
      });
    }

    if (!["SURVEY_USER", "QUALITY_ENGINEER"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const exists = await User.findOne({ mobile }).lean();
    if (exists) {
      return res
        .status(409)
        .json({ message: "User with this mobile already exists." });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const userCode = generateUserCode();

    // ✅ profile pic from Cloudinary (multer single)
    const profilePhotoUrl = req.file?.path;

    const user = await User.create({
      userCode,
      mobile,
      password: hash,
      role,
      fullName,
      email,
      employeeCode,
      department,
      city,
      state,
      pincode,
      dateOfJoining,
      createdByAdmin: adminId,
      profilePhotoUrl,
    });

    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        userCode: user.userCode,
        mobile: user.mobile,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        employeeCode: user.employeeCode,
        department: user.department,
        city: user.city,
        state: user.state,
        pincode: user.pincode,
        dateOfJoining: user.dateOfJoining,
        isActive: user.isActive,
        profilePhotoUrl: user.profilePhotoUrl,
      },
    });
  } catch (err) {
    console.error("createUserByAdmin error:", err);
    if (err.code === 11000) {
      return res.status(409).json({
        message: "Duplicate key error (mobile or userCode already exists).",
        keyValue: err.keyValue,
      });
    }
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ User login with mobile + password (returns token, SURVEY_USER + QE)
export const loginUser = async (req, res) => {
  try {
    const { mobile, password } = req.body;
    if (!mobile || !password) {
      return res
        .status(400)
        .json({ message: "mobile and password are required." });
    }

    const user = await User.findOne({ mobile })
      .select("+password")
      .lean(false);

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "User is inactive / blocked." });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = signUserJwt(user);

    return res.json({
      message: "Login successful",
      user: {
        id: user._id,
        userCode: user.userCode,
        mobile: user.mobile,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        employeeCode: user.employeeCode,
        department: user.department,
        city: user.city,
        state: user.state,
        pincode: user.pincode,
        dateOfJoining: user.dateOfJoining,
        isActive: user.isActive,
        profilePhotoUrl: user.profilePhotoUrl,
      },
      token,
    });
  } catch (err) {
    console.error("loginUser error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Only QUALITY_ENGINEER login (separate endpoint)
export const loginQualityEngineer = async (req, res) => {
  try {
    const { mobile, password } = req.body;
    if (!mobile || !password) {
      return res
        .status(400)
        .json({ message: "mobile and password are required." });
    }

    const user = await User.findOne({ mobile })
      .select("+password")
      .lean(false);

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "User is inactive / blocked." });
    }

    // ❗ Only QUALITY_ENGINEER allowed on this route
    if (user.role !== "QUALITY_ENGINEER") {
      return res
        .status(403)
        .json({ message: "Only Quality Engineer can login on this route." });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = signUserJwt(user);

    return res.json({
      message: "Quality Engineer login successful",
      user: {
        id: user._id,
        userCode: user.userCode,
        mobile: user.mobile,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        employeeCode: user.employeeCode,
        department: user.department,
        city: user.city,
        state: user.state,
        pincode: user.pincode,
        dateOfJoining: user.dateOfJoining,
        isActive: user.isActive,
        profilePhotoUrl: user.profilePhotoUrl,
      },
      token,
    });
  } catch (err) {
    console.error("loginQualityEngineer error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ List all users (admin)
export const listUsers = async (req, res) => {
  try {
    const { role, isActive } = req.query;
    const filter = {};

    if (role && ["SURVEY_USER", "QUALITY_ENGINEER"].includes(role)) {
      filter.role = role;
    }
    if (typeof isActive !== "undefined") {
      filter.isActive = isActive === "true";
    }

    const users = await User.find(filter, {
      userCode: 1,
      mobile: 1,
      role: 1,
      fullName: 1,
      email: 1,
      employeeCode: 1,
      department: 1,
      city: 1,
      state: 1,
      pincode: 1,
      dateOfJoining: 1,
      isActive: 1,
      profilePhotoUrl: 1,
      createdAt: 1,
      updatedAt: 1,
    }).lean();

    return res.json({ users });
  } catch (err) {
    console.error("listUsers error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get single user by Mongo ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id, {
      userCode: 1,
      mobile: 1,
      role: 1,
      fullName: 1,
      email: 1,
      employeeCode: 1,
      department: 1,
      city: 1,
      state: 1,
      pincode: 1,
      dateOfJoining: 1,
      isActive: 1,
      profilePhotoUrl: 1,
      createdByAdmin: 1,
      createdAt: 1,
      updatedAt: 1,
    }).lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ user });
  } catch (err) {
    console.error("getUserById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Update user details (admin, JSON only)
export const updateUserByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedFields = [
      "fullName",
      "email",
      "employeeCode",
      "department",
      "city",
      "state",
      "pincode",
      "dateOfJoining",
      "isActive",
      "role",
      "mobile",
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (typeof req.body[field] !== "undefined") {
        updateData[field] = req.body[field];
      }
    }

    const user = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      projection: {
        userCode: 1,
        mobile: 1,
        role: 1,
        fullName: 1,
        email: 1,
        employeeCode: 1,
        department: 1,
        city: 1,
        state: 1,
        pincode: 1,
        dateOfJoining: 1,
        isActive: 1,
        profilePhotoUrl: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    }).lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
      message: "User updated successfully",
      user,
    });
  } catch (err) {
    console.error("updateUserByAdmin error:", err);
    if (err.code === 11000) {
      return res.status(409).json({
        message: "Duplicate key error (maybe mobile already used).",
        keyValue: err.keyValue,
      });
    }
    return res.status(500).json({ message: "Server error" });
  }
};

// 🔐 NEW: Admin can reset a user's password
export const resetUserPasswordByAdmin = async (req, res) => {
  try {
    const adminId = req.user?.sub;
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const adminExists = await Admin.findById(adminId).lean();
    if (!adminExists) {
      return res.status(401).json({ message: "Admin no longer exists" });
    }

    const { id } = req.params;
    const { password } = req.body; // you can call this "newPassword" if you prefer

    if (!password) {
      return res
        .status(400)
        .json({ message: "New password is required in body as 'password'." });
    }

    // (optional) basic length check
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long." });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.findByIdAndUpdate(
      id,
      { password: hash },
      {
        new: true,
        projection: {
          userCode: 1,
          mobile: 1,
          fullName: 1,
          role: 1,
          isActive: 1,
          updatedAt: 1,
        },
      }
    ).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "User password reset successfully",
      user,
    });
  } catch (err) {
    console.error("resetUserPasswordByAdmin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Block user
export const blockUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true, projection: { userCode: 1, mobile: 1, isActive: 1 } }
    ).lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
      message: "User blocked successfully",
      user,
    });
  } catch (err) {
    console.error("blockUser error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Unblock user
export const unblockUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true, projection: { userCode: 1, mobile: 1, isActive: 1 } }
    ).lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
      message: "User unblocked successfully",
      user,
    });
  } catch (err) {
    console.error("unblockUser error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Delete user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("deleteUser error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
