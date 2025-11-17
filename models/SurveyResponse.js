// models/SurveyResponse.js
import mongoose from "mongoose";

export const APPROVAL_STATUS = {
  PENDING: "PENDING",
  CORRECTLY_DONE: "CORRECTLY_DONE",
  NOT_ASKING_ALL_QUESTIONS: "NOT_ASKING_ALL_QUESTIONS",
  NOT_DOING_IT_PROPERLY: "NOT_DOING_IT_PROPERLY",
  TAKING_FROM_FRIENDS_OR_TEAMMATE: "TAKING_FROM_FRIENDS_OR_TEAMMATE",
  FAKE_OR_EMPTY_AUDIO: "FAKE_OR_EMPTY_AUDIO",
};

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

    // ✅ NEW: enum based approval status
    approvalStatus: {
      type: String,
      enum: Object.values(APPROVAL_STATUS),
      default: APPROVAL_STATUS.PENDING,
      index: true,
    },

    // ✅ backward compat: true sirf tab jab CORRECTLY_DONE ho
    isApproved: {
      type: Boolean,
      default: false,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // QUALITY_ENGINEER expected
    },

    answers: [answerSchema],
  },
  { timestamps: true }
);

// index: fast queries for "iss user ne iss survey ka response diya ya nahi"
surveyResponseSchema.index({ survey: 1, userCode: 1 });

// OPTIONAL: keep isApproved in sync with approvalStatus when using .save()
surveyResponseSchema.pre("save", function (next) {
  if (!this.approvalStatus || this.approvalStatus === APPROVAL_STATUS.PENDING) {
    this.isApproved = false;
  } else {
    this.isApproved = this.approvalStatus === APPROVAL_STATUS.CORRECTLY_DONE;
  }
  next();
});

export default mongoose.model("SurveyResponse", surveyResponseSchema);
