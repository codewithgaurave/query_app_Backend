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

    // question type
    type: {
      type: String,
      enum: [
        "OPEN_ENDED",   // 1
        "MCQ_SINGLE",   // 2 (multiple choice single/multi handle via allowMultiple)
        "RATING",       // 3
        "LIKERT",       // 4
        "CHECKBOX",     // 5 (multi)
        "DROPDOWN",     // 6
        "YES_NO",       // 7
      ],
      required: true,
    },

    // options list – MCQ / CHECKBOX / DROPDOWN / LIKERT / YES_NO
    options: [
      {
        type: String,
        trim: true,
      },
    ],

    // for MCQ vs checkbox
    allowMultiple: {
      type: Boolean,
      default: false,
    },

    // ⭐ NEW: "Other" option support for option-based questions
    enableOtherOption: {
      type: Boolean,
      default: false,
    },
    otherOptionLabel: {
      type: String,
      trim: true,
      default: "Other",
    },

    // rating config
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

    // required flag
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
  },
  { timestamps: true }
);

// export default mongoose.model("SurveyQuestion", surveyQuestionSchema, "SurveyQuestions");
export default mongoose.model("SurveyQuestion", surveyQuestionSchema);
