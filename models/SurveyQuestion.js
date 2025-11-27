// models/SurveyQuestion.js
import mongoose from "mongoose";

const surveyQuestionSchema = new mongoose.Schema(
  {
    survey: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Survey",
      required: true,
      index: true,
    },

    questionText: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
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
      required: true,
    },

    // For MCQ / CHECKBOX / DROPDOWN / LIKERT / YES_NO
    options: [
      {
        type: String,
        trim: true,
      },
    ],

    // For MCQ_SINGLE / CHECKBOX behavior
    allowMultiple: {
      type: Boolean,
      default: false,
    },

    // "Other" option support
    enableOtherOption: {
      type: Boolean,
      default: false,
    },
    otherOptionLabel: {
      type: String,
      trim: true,
      default: "Other",
    },

    // Rating config
    minRating: {
      type: Number,
      default: 1,
    },
    maxRating: {
      type: Number,
      default: 5,
    },
    ratingStep: {
      type: Number,
      default: 1,
    },

    required: {
      type: Boolean,
      default: true,
    },

    order: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    helpText: {
      type: String,
      trim: true,
    },

    // ⭐ Follow-up support
    // Root question => parentQuestion = null
    // Multiple children per (parentQuestion + parentOptionValue) allowed
    parentQuestion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SurveyQuestion",
      default: null,
      index: true,
    },

    // Which option (of parent) activates this question
    parentOptionValue: {
      type: String,
      trim: true,
    },

    // ⭐ IST timestamps fields
    createdAtIST: { type: String },
    updatedAtIST: { type: String },
  },
  { timestamps: true }
);

// Helpful indexes for ordering + follow-up lookups
surveyQuestionSchema.index({ survey: 1, order: 1 });
surveyQuestionSchema.index({ parentQuestion: 1, parentOptionValue: 1 });

// Auto-save IST timestamp on create / update
surveyQuestionSchema.pre("save", function (next) {
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

surveyQuestionSchema.pre("findOneAndUpdate", function (next) {
  const istTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });
  this.set({ updatedAtIST: istTime });
  next();
});

export default mongoose.model("SurveyQuestion", surveyQuestionSchema);
