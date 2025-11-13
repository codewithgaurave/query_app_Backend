// controllers/punchInController.js
import User from "../models/User.js";
import PunchIn from "../models/PunchIn.js";

// ✅ SURVEY_USER punch-in using userCode (no token, per-day single record)
export const punchIn = async (req, res) => {
  try {
    const { userCode, latitude, longitude } = req.body;

    if (!userCode || !latitude || !longitude) {
      return res.status(400).json({
        message: "userCode, latitude and longitude are required.",
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res
        .status(400)
        .json({ message: "latitude and longitude must be valid numbers." });
    }

    const user = await User.findOne({
      userCode,
      role: "SURVEY_USER",
      isActive: true,
    }).lean();

    if (!user) {
      return res
        .status(404)
        .json({ message: "Active SURVEY_USER not found for this userCode." });
    }

    if (!req.file || !req.file.path) {
      return res
        .status(400)
        .json({ message: "Punch-in image (photo) required." });
    }

    // ✅ Date-based day boundary (calendar date, not 24 hours)
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );

    // Check if there is already a punch-in today for this user
    const existingPunch = await PunchIn.findOne({
      userCode: user.userCode,
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    });

    let punch;

    if (existingPunch) {
      // ✅ Update same-day record
      existingPunch.latitude = lat;
      existingPunch.longitude = lng;
      existingPunch.photoUrl = req.file.path;
      punch = await existingPunch.save();

      return res.status(200).json({
        message: "Punch-in updated for today",
        punch,
      });
    } else {
      // ✅ First punch-in of the day → create new record
      punch = await PunchIn.create({
        user: user._id,
        userCode: user.userCode,
        latitude: lat,
        longitude: lng,
        photoUrl: req.file.path,
      });

      return res.status(201).json({
        message: "Punch-in recorded successfully",
        punch,
      });
    }
  } catch (err) {
    console.error("punchIn error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get punch-in history for one user (by userCode)
export const getUserPunchHistory = async (req, res) => {
  try {
    const { userCode } = req.params;

    const punches = await PunchIn.find({ userCode })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ userCode, punches });
  } catch (err) {
    console.error("getUserPunchHistory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get all punch-in history (admin only)
export const getAllPunchHistory = async (_req, res) => {
  try {
    const punches = await PunchIn.find({})
      .populate("user", "userCode fullName mobile role")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ punches });
  } catch (err) {
    console.error("getAllPunchHistory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
