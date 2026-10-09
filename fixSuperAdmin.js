import "dotenv/config";
import mongoose from "mongoose";
import Admin from "./models/Admin.js";

const ALL_PERMISSIONS = {
  dashboard: true,
  surveys: true,
  surveyResponses: true,
  surveyCharts: true,
  users: true,
  punchins: true,
  pinnedQuestions: true,
};

const run = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/survey";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB...");

    const targetAdminId = process.argv[2] || "superadmin";

    const admin = await Admin.findOne({ adminId: targetAdminId });
    if (!admin) {
      console.error(`Admin with adminId "${targetAdminId}" not found!`);
      process.exit(1);
    }

    admin.role = "SUPER_ADMIN";
    admin.isActive = true;
    admin.permissions = ALL_PERMISSIONS;
    await admin.save();

    console.log(`✅ Successfully restored "${targetAdminId}" to SUPER_ADMIN with full permissions!`);
    console.log("Please Sign Out and Login again in your browser.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error updating admin:", err);
    process.exit(1);
  }
};

run();
