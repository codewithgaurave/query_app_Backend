// controllers/punchInController.js
import User from "../models/User.js";
import PunchIn from "../models/PunchIn.js";

// ✅ SURVEY_USER punch-in using userCode (no token, per-day single record)
export const punchIn = async (req, res) => {
  try {
    console.log("📥 Punch-in request received");
    console.log("Body:", req.body);
    console.log("File:", req.file);
    
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

    const photoUrl = req.file?.location || req.file?.path;
    if (!req.file || !photoUrl) {
      return res
        .status(400)
        .json({ message: "Punch-in image (photo) required." });
    }

    // ✅ Date-based day boundary (IST calendar date)
    const istDateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const [year, month, day] = istDateStr.split("-").map(Number);
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

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
      existingPunch.photoUrl = photoUrl;
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
        photoUrl: photoUrl,
      });

      return res.status(201).json({
        message: "Punch-in recorded successfully",
        punch,
      });
    }
  } catch (err) {
    console.error("❌ punchIn error:", err);
    console.error("Error stack:", err.stack);
    return res.status(500).json({ 
      message: "Server error",
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
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
