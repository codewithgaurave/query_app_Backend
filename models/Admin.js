import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    adminId: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true, select: false },
    name: { type: String, default: "" },
    role: {
      type: String,
      enum: ["SUPER_ADMIN", "SUB_ADMIN"],
      default: "SUPER_ADMIN",
      index: true,
    },
    mobile: { type: String, default: "" },
    email: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    permissions: {
      dashboard: { type: Boolean, default: true },
      surveys: { type: Boolean, default: true },
      surveyResponses: { type: Boolean, default: true },
      surveyCharts: { type: Boolean, default: true },
      users: { type: Boolean, default: true },
      punchins: { type: Boolean, default: false },
      pinnedQuestions: { type: Boolean, default: false },
    },
    createdBySuperAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    tokenVersion: { type: Number, default: 0, select: false },
    // IST timestamps
    createdAtIST: { type: String },
    updatedAtIST: { type: String },
  },
  { timestamps: true }
);

// dwhfvdvfe

// Auto-save IST time on create
adminSchema.pre("save", function (next) {
  const istTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });

  this.createdAtIST = istTime;
  this.updatedAtIST = istTime;
  next();
});

// Auto-update IST time when updated
adminSchema.pre("findOneAndUpdate", function (next) {
  const istTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });

  this.set({ updatedAtIST: istTime });
  next();
});

export default mongoose.model("Admin", adminSchema);
