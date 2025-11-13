// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    userCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["SURVEY_USER", "QUALITY_ENGINEER"],
      required: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    employeeCode: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    dateOfJoining: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // ✅ Only profile picture URL from Cloudinary
    profilePhotoUrl: {
      type: String,
    },

    createdByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

// export default mongoose.model("User", userSchema, "QueryAppUsers");
export default mongoose.model("User", userSchema);
