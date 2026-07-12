import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import Admin from "./models/Admin.js";

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");
    
    const adminId = "superadmin";
    const password = "superadmin123";
    const name = "Super Admin";

    const exists = await Admin.findOne({ adminId });
    if (exists) {
      console.log("SuperAdmin already exists!");
      process.exit(0);
    }

    const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    
    await Admin.create({ adminId, password: hash, name });
    console.log("SuperAdmin created successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error creating SuperAdmin:", err);
    process.exit(1);
  }
};

run();
