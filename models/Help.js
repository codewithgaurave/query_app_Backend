// models/Help.js
import mongoose from "mongoose";

const HelpSchema = new mongoose.Schema(
  {
    supportEmail: { type: String },
    supportPhone: { type: String },
    whatsappNumber: { type: String },

    officeAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      country: String,
    },

    officeHours: {
      mondayToFriday: String,
      saturday: String,
      sunday: String,
    },

    socialLinks: {
      website: String,
      facebook: String,
      instagram: String,
      linkedin: String,
    },

    faqs: [
      {
        question: String,
        answer: String,
      },
    ],

    updatedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    // ⭐ IST timestamps
    createdAtIST: { type: String },
    updatedAtIST: { type: String }
  },
  { timestamps: true }
);

// Auto-save IST time on create
HelpSchema.pre("save", function (next) {
  const istTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });

  if (!this.createdAtIST) {
    this.createdAtIST = istTime;
  }
  this.updatedAtIST = istTime;
  next();
});

// Auto-update IST timestamp on update
HelpSchema.pre("findOneAndUpdate", function (next) {
  const istTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });

  this.set({ updatedAtIST: istTime });
  next();
});

// Only 1 record allowed → Singleton pattern
HelpSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({});
  }
  return doc;
};

export default mongoose.model("Help", HelpSchema);
