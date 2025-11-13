// models/SurveyResponse.js
import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SurveyQuestion",
      required: true,
    },
    questionText: { type: String },
    questionType: { type: String }, // OPEN_ENDED / MCQ_SINGLE / ...

    // open-ended / generic text
    answerText: { type: String },

    // MCQ / CHECKBOX / DROPDOWN / LIKERT / YES_NO
    selectedOptions: [{ type: String }],

    // rating
    rating: { type: Number },
  },
  { _id: false }
);

const surveyResponseSchema = new mongoose.Schema(
  {
    survey: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Survey",
      required: true,
    },
    surveyCode: {
      type: String,
      required: true,
      index: true,
    },

    // which user responded
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    userCode: {
      type: String,
      required: true,
      index: true,
    },
    userName: { type: String },
    userMobile: { type: String },
    userRole: { type: String }, // SURVEY_USER

    // audio recording URL
    audioUrl: {
      type: String,
      required: true,
    },

    // ek response complete hai ya nahi (future ke liye useful)
    isCompleted: {
      type: Boolean,
      default: true,
    },

    answers: [answerSchema],
  },
  { timestamps: true }
);

// index: fast queries for "iss user ne iss survey ka response diya ya nahi"
surveyResponseSchema.index({ survey: 1, userCode: 1 });

export default mongoose.model("SurveyResponse", surveyResponseSchema);
