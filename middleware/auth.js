import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

export const requireAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Missing auth token" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { sub, adminId, role, tv, iat, exp, permissions }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const optionalAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (token) {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload;
    }
  } catch (err) {
    // optional auth: do not block if token is missing or invalid
  }
  next();
};

export const requireSuperAdminOnly = (req, res, next) => {
  if (!req.user || !req.user.adminId || req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ message: "Super Admin access required" });
  }
  next();
};

export const requireAdminOnly = (req, res, next) => {
  if (!req.user || !req.user.adminId) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

export const requirePermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.adminId) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // SUPER_ADMIN has unrestricted access to all modules and features
      if (req.user.role === "SUPER_ADMIN") {
        return next();
      }

      // Check SUB_ADMIN permissions from DB
      const admin = await Admin.findById(req.user.sub)
        .select("permissions role isActive")
        .lean();

      if (!admin || admin.isActive === false) {
        return res
          .status(403)
          .json({ message: "Account is inactive or disabled. Contact Super Admin." });
      }

      if (admin.role === "SUPER_ADMIN") {
        return next();
      }

      const permissions = admin.permissions || {};
      if (permissions[permissionKey] === true) {
        return next();
      }

      return res.status(403).json({
        message: `Permission denied: You do not have access to the '${permissionKey}' module. Please contact Super Admin.`,
        requiredPermission: permissionKey,
      });
    } catch (err) {
      console.error("requirePermission error:", err);
      return res.status(500).json({ message: "Server authorization error" });
    }
  };
};

