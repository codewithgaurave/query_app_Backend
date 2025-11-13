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

    // category / type of survey
    category: {
      type: String,
      trim: true,
    },

    // kisi project ya client se linked
    projectName: {
      type: String,
      trim: true,
    },

    targetAudience: {
      type: String,
      trim: true,
    },

    // survey status
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

    // admin ne decide kiye hue question types (optional)
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

    createdByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// export default mongoose.model("Survey", surveySchema, "Surveys");
export default mongoose.model("Survey", surveySchema);
