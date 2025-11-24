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

    options: [
      {
        type: String,
        trim: true,
      },
    ],

    allowMultiple: {
      type: Boolean,
      default: false,
    },

    enableOtherOption: {
      type: Boolean,
      default: false,
    },
    otherOptionLabel: {
      type: String,
      trim: true,
      default: "Other",
    },

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

    // ⭐ IST timestamps fields
    createdAtIST: { type: String },
    updatedAtIST: { type: String }
  },
  { timestamps: true }
);

// ⭐ Auto-save IST timestamp on create / update
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

// export default mongoose.model("SurveyQuestion", surveyQuestionSchema, "SurveyQuestions");
export default mongoose.model("SurveyQuestion", surveyQuestionSchema);
