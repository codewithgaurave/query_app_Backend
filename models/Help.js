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

    // Kis admin ne last update kiya
    updatedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

// Only 1 record allowed → use fixed ID logic
HelpSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({});
  }
  return doc;
};

export default mongoose.model("Help", HelpSchema);
