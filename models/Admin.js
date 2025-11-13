import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    adminId: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true, select: false },
    name: { type: String, default: "" },
    // optional: last issued token ID (for rotation / logout-all)
    tokenVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

export default mongoose.model("Admin", adminSchema);
