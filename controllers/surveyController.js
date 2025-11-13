// controllers/surveyController.js
import crypto from "crypto";
import mongoose from "mongoose";
import Survey from "../models/Survey.js";
import SurveyQuestion from "../models/SurveyQuestion.js";

// helper: random surveyCode
const generateSurveyCode = () =>
  "SRV-" + crypto.randomBytes(4).toString("hex").toUpperCase();

// allowed question types
const VALID_QUESTION_TYPES = [
  "OPEN_ENDED",   // 1
  "MCQ_SINGLE",   // 2
  "RATING",       // 3
  "LIKERT",       // 4
  "CHECKBOX",     // 5
  "DROPDOWN",     // 6
  "YES_NO",       // 7
];

// ✅ helper: Mongo _id ya surveyCode se survey laao
const findSurveyByIdOrCode = async (surveyIdOrCode) => {
  if (mongoose.Types.ObjectId.isValid(surveyIdOrCode)) {
    return Survey.findById(surveyIdOrCode).lean();
  }
  // warna surveyCode treat karo
  return Survey.findOne({ surveyCode: surveyIdOrCode }).lean();
};

// ✅ Admin creates a survey
export const createSurvey = async (req, res) => {
  try {
    const adminId = req.user?.sub;
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      name,
      description,
      category,
      projectName,
      targetAudience,
      status,
      startDate,
      endDate,
      isAnonymousAllowed,
      maxResponses,
      language,
      tags,
      allowedQuestionTypes,
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    let allowedTypes = [];
    if (Array.isArray(allowedQuestionTypes) && allowedQuestionTypes.length) {
      allowedTypes = allowedQuestionTypes.filter((t) =>
        VALID_QUESTION_TYPES.includes(t)
      );
      if (!allowedTypes.length) {
        return res.status(400).json({ message: "Invalid allowedQuestionTypes" });
      }
    }

    const surveyCode = generateSurveyCode();

    const survey = await Survey.create({
      surveyCode,
      name,
      description,
      category,
      projectName,
      targetAudience,
      status,
      startDate,
      endDate,
      isAnonymousAllowed,
      maxResponses,
      language,
      tags,
      allowedQuestionTypes: allowedTypes,
      createdByAdmin: adminId,
    });

    return res.status(201).json({
      message: "Survey created successfully",
      survey,
    });
  } catch (err) {
    console.error("createSurvey error:", err);
    if (err.code === 11000) {
      return res.status(409).json({
        message: "Duplicate key error (surveyCode already exists).",
        keyValue: err.keyValue,
      });
    }
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Admin adds a question to a survey (by _id or surveyCode)
export const addSurveyQuestion = async (req, res) => {
  try {
    const adminId = req.user?.sub;
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { surveyIdOrCode } = req.params;
    const {
      questionText,
      type,
      options,
      allowMultiple,
      minRating,
      maxRating,
      ratingStep,
      required,
      order,
      helpText,
    } = req.body;

    if (!questionText || !type) {
      return res
        .status(400)
        .json({ message: "questionText and type are required." });
    }

    if (!VALID_QUESTION_TYPES.includes(type)) {
      return res.status(400).json({ message: "Invalid question type." });
    }

    const survey = await findSurveyByIdOrCode(surveyIdOrCode);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found." });
    }

    // if survey has allowedQuestionTypes, ensure type is allowed
    if (
      Array.isArray(survey.allowedQuestionTypes) &&
      survey.allowedQuestionTypes.length &&
      !survey.allowedQuestionTypes.includes(type)
    ) {
      return res.status(400).json({
        message: `This question type is not allowed for this survey. Allowed: ${survey.allowedQuestionTypes.join(
          ", "
        )}`,
      });
    }

    const doc = {
      survey: survey._id,
      questionText,
      type,
      required: typeof required === "boolean" ? required : true,
      order: typeof order === "number" ? order : 0,
      helpText,
    };

    // type-specific handling for options
    if (
      ["MCQ_SINGLE", "CHECKBOX", "DROPDOWN", "LIKERT", "YES_NO"].includes(type)
    ) {
      if (!Array.isArray(options) || !options.length) {
        return res
          .status(400)
          .json({ message: "options are required for this question type." });
      }
      doc.options = options;
    }

    // checkbox & mcq multiple handling
    if (type === "CHECKBOX") {
      doc.allowMultiple = true;
    } else if (type === "MCQ_SINGLE") {
      doc.allowMultiple = !!allowMultiple; // default false
    }

    // rating config
    if (type === "RATING") {
      doc.minRating = typeof minRating === "number" ? minRating : 1;
      doc.maxRating = typeof maxRating === "number" ? maxRating : 5;
      doc.ratingStep = typeof ratingStep === "number" ? ratingStep : 1;
    }

    const question = await SurveyQuestion.create(doc);

    // ✅ yahan response clean kar rahe hain – sirf relevant fields bhejenge
    const cleanQuestion = {
      id: question._id,
      survey: question.survey,
      questionText: question.questionText,
      type: question.type,
      required: question.required,
      order: question.order,
      isActive: question.isActive,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };

    if (
      ["MCQ_SINGLE", "CHECKBOX", "DROPDOWN", "LIKERT", "YES_NO"].includes(
        question.type
      )
    ) {
      cleanQuestion.options = question.options;
    }

    if (["MCQ_SINGLE", "CHECKBOX"].includes(question.type)) {
      cleanQuestion.allowMultiple = question.allowMultiple;
    }

    if (question.type === "RATING") {
      cleanQuestion.minRating = question.minRating;
      cleanQuestion.maxRating = question.maxRating;
      cleanQuestion.ratingStep = question.ratingStep;
    }

    if (question.helpText) {
      cleanQuestion.helpText = question.helpText;
    }

    return res.status(201).json({
      message: "Question added to survey successfully",
      question: cleanQuestion,
    });
  } catch (err) {
    console.error("addSurveyQuestion error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ List all surveys (admin)
export const listSurveys = async (req, res) => {
  try {
    const adminId = req.user?.sub;
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const surveys = await Survey.find(
      {},
      {
        surveyCode: 1,
        name: 1,
        description: 1,
        status: 1,
        category: 1,
        projectName: 1,
        targetAudience: 1,
        startDate: 1,
        endDate: 1,
        isActive: 1,
        createdAt: 1,
      }
    )
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ surveys });
  } catch (err) {
    console.error("listSurveys error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get survey + its questions (by _id or surveyCode)
export const getSurveyWithQuestions = async (req, res) => {
  try {
    const adminId = req.user?.sub;
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { surveyIdOrCode } = req.params;

    const survey = await findSurveyByIdOrCode(surveyIdOrCode);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    const rawQuestions = await SurveyQuestion.find({
      survey: survey._id,
      isActive: true,
    })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    // ✅ yahan bhi questions ko clean kar ke bhejenge
    const questions = rawQuestions.map((q) => {
      const base = {
        id: q._id,
        survey: q.survey,
        questionText: q.questionText,
        type: q.type,
        required: q.required,
        order: q.order,
        isActive: q.isActive,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
      };

      if (
        ["MCQ_SINGLE", "CHECKBOX", "DROPDOWN", "LIKERT", "YES_NO"].includes(
          q.type
        )
      ) {
        base.options = q.options;
      }

      if (["MCQ_SINGLE", "CHECKBOX"].includes(q.type)) {
        base.allowMultiple = q.allowMultiple;
      }

      if (q.type === "RATING") {
        base.minRating = q.minRating;
        base.maxRating = q.maxRating;
        base.ratingStep = q.ratingStep;
      }

      if (q.helpText) {
        base.helpText = q.helpText;
      }

      return base;
    });

    return res.json({ survey, questions });
  } catch (err) {
    console.error("getSurveyWithQuestions error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
