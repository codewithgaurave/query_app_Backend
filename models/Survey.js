// models/Survey.js
import mongoose from "mongoose";

const surveySchema = new mongoose.Schema(
  {
    surveyCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    category: {
      type: String,
      trim: true,
    },

    projectName: {
      type: String,
      trim: true,
    },

    targetAudience: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "CLOSED"],
      default: "DRAFT",
    },

    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },

    isAnonymousAllowed: {
      type: Boolean,
      default: false,
    },

    maxResponses: {
      type: Number,
    },

    language: {
      type: String,
      default: "hi",
    },

    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    allowedQuestionTypes: [
      {
        type: String,
        enum: [
          "OPEN_ENDED",
          "MCQ_SINGLE",
          "RATING",
          "LIKERT",
          "CHECKBOX",
          "DROPDOWN",
          "YES_NO",
        ],
      },
    ],

    assignedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    createdByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // ⭐ for IST timestamps
    createdAtIST: { type: String },
    updatedAtIST: { type: String }
  },
  { timestamps: true }
);

// Auto-save IST time on create
surveySchema.pre("save", function (next) {
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
surveySchema.pre("findOneAndUpdate", function (next) {
  const istTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });

  this.set({ updatedAtIST: istTime });
  next();
});

// export default mongoose.model("Survey", surveySchema, "Surveys");
export default mongoose.model("Survey", surveySchema);
