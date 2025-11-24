import mongoose from "mongoose";

const { Schema } = mongoose;

const SurveyDashboardPinSchema = new Schema(
  {
    survey: {
      type: Schema.Types.ObjectId,
      ref: "Survey",
      required: true,
    },
    surveyCode: {
      type: String,
    },
    surveyName: {
      type: String,
    },
    question: {
      type: Schema.Types.ObjectId,
      ref: "SurveyQuestion",
      required: true,
    },
    questionText: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// ek survey ka ek question sirf ek baar pin ho
SurveyDashboardPinSchema.index(
  { survey: 1, question: 1 },
  { unique: true }
);

const SurveyDashboardPin = mongoose.model(
  "SurveyDashboardPin",
  SurveyDashboardPinSchema
);

export default SurveyDashboardPin;
