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
    questionType: { type: String },

    answerText: { type: String },
    selectedOptions: [{ type: String }],

    rating: { type: Number },
    otherText: { type: String },
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
    userRole: { type: String },

    audioUrl: {
      type: String,
      required: true,
    },

    latitude: { type: Number },
    longitude: { type: Number },

    isCompleted: { type: Boolean, default: true },

    approvalStatus: {
      type: String,
      enum: Object.values(APPROVAL_STATUS),
      default: APPROVAL_STATUS.PENDING,
      index: true,
    },

    isApproved: {
      type: Boolean,
      default: false,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    answers: [answerSchema],

    // ⭐ IST timestamps
    createdAtIST: { type: String },
    updatedAtIST: { type: String },
  },
  { timestamps: true }
);

// fast lookup
surveyResponseSchema.index({ survey: 1, userCode: 1 });

// keep isApproved in sync
surveyResponseSchema.pre("save", function (next) {
  this.isApproved = this.approvalStatus === APPROVAL_STATUS.CORRECTLY_DONE;

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

// update hook
surveyResponseSchema.pre("findOneAndUpdate", function (next) {
  const istTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });

  this.set({ updatedAtIST: istTime });
  next();
});

export default mongoose.model("SurveyResponse", surveyResponseSchema);
