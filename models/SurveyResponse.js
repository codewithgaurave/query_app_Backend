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

    // ⭐ kis time pe verify / approve hua
    approvedAt: {
      type: Date,
    },

    answers: [answerSchema],

    // ⭐ IST timestamps (string form)
    createdAtIST: { type: String },
    updatedAtIST: { type: String },
  },
  { timestamps: true }
);

// fast lookup
surveyResponseSchema.index({ survey: 1, userCode: 1 });

// keep isApproved + approvedAt in sync on .save()
surveyResponseSchema.pre("save", function (next) {
  const willBeApproved =
    this.approvalStatus === APPROVAL_STATUS.CORRECTLY_DONE;

  // isApproved always derived from approvalStatus
  this.isApproved = willBeApproved;

  // agar approvalStatus change hua ho to approvedAt bhi handle karo
  if (this.isModified("approvalStatus")) {
    if (willBeApproved) {
      // create ke time pe agar directly CORRECTLY_DONE aa raha hai to timestamp set kar do
      if (!this.approvedAt) {
        this.approvedAt = new Date();
      }
    } else {
      // agar status hata rahe ho (e.g. wapas PENDING) to time clear
      this.approvedAt = undefined;
    }
  }

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

// update hook – yahan abhi sirf IST updatedAt string set kar rahe hain
surveyResponseSchema.pre("findOneAndUpdate", function (next) {
  const istTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });

  this.set({ updatedAtIST: istTime });
  next();
});

export default mongoose.model("SurveyResponse", surveyResponseSchema);
