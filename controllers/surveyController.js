// controllers/surveyController.js
import crypto from "crypto";
import mongoose from "mongoose";
import Survey from "../models/Survey.js";
import SurveyQuestion from "../models/SurveyQuestion.js";
import PunchIn from "../models/PunchIn.js";     // ✅ NEW
import User from "../models/User.js";           // ✅ NEW

// helper: random surveyCode
const generateSurveyCode = () =>
  "SRV-" + crypto.randomBytes(4).toString("hex").toUpperCase();

// ✅ helper: aaj ka startOfDay / endOfDay nikalne ke liye (calendar day based)
const getTodayRange = () => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );
  return { startOfDay, endOfDay };
};

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

// ✅ Admin updates a survey (by _id or surveyCode)
export const updateSurvey = async (req, res) => {
  try {
    const adminId = req.user?.sub;
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { surveyIdOrCode } = req.params;
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
      isActive,
    } = req.body;

    const survey = await findSurveyByIdOrCode(surveyIdOrCode);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    const update = {};

    if (typeof name === "string") update.name = name;
    if (typeof description === "string") update.description = description;
    if (typeof category === "string") update.category = category;
    if (typeof projectName === "string") update.projectName = projectName;
    if (typeof targetAudience === "string") update.targetAudience = targetAudience;
    if (typeof status === "string") update.status = status;
    if (startDate !== undefined) update.startDate = startDate;
    if (endDate !== undefined) update.endDate = endDate;
    if (typeof isAnonymousAllowed === "boolean")
      update.isAnonymousAllowed = isAnonymousAllowed;
    if (typeof maxResponses === "number") update.maxResponses = maxResponses;
    if (typeof language === "string") update.language = language;
    if (Array.isArray(tags)) update.tags = tags;
    if (typeof isActive === "boolean") update.isActive = isActive;

    // allowedQuestionTypes validate
    if (Array.isArray(allowedQuestionTypes)) {
      const filtered = allowedQuestionTypes.filter((t) =>
        VALID_QUESTION_TYPES.includes(t)
      );
      if (!filtered.length && allowedQuestionTypes.length) {
        return res
          .status(400)
          .json({ message: "Invalid allowedQuestionTypes" });
      }
      update.allowedQuestionTypes = filtered;
    }

    const updatedSurvey = await Survey.findByIdAndUpdate(
      survey._id,
      { $set: update },
      { new: true }
    ).lean();

    return res.json({
      message: "Survey updated successfully",
      survey: updatedSurvey,
    });
  } catch (err) {
    console.error("updateSurvey error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Admin deletes a survey (by _id or surveyCode) + its questions
export const deleteSurvey = async (req, res) => {
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

    // pehle saare questions delete karo
    await SurveyQuestion.deleteMany({ survey: survey._id });

    // phir survey delete karo
    await Survey.findByIdAndDelete(survey._id);

    return res.json({
      message: "Survey and its questions deleted successfully",
    });
  } catch (err) {
    console.error("deleteSurvey error:", err);
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

// ✅ Admin updates a survey question
export const updateSurveyQuestion = async (req, res) => {
  try {
    const adminId = req.user?.sub;
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { questionId } = req.params;
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
      isActive,
    } = req.body;

    const question = await SurveyQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found." });
    }

    // agar type change kar rahe ho to validate karo
    if (type) {
      if (!VALID_QUESTION_TYPES.includes(type)) {
        return res.status(400).json({ message: "Invalid question type." });
      }

      // survey ke allowedQuestionTypes check karo (agar set hai)
      const survey = await Survey.findById(question.survey).lean();
      if (
        survey &&
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

      question.type = type;
    }

    if (typeof questionText === "string") question.questionText = questionText;
    if (typeof required === "boolean") question.required = required;
    if (typeof order === "number") question.order = order;
    if (typeof helpText === "string" || helpText === null) {
      question.helpText = helpText;
    }
    if (typeof isActive === "boolean") question.isActive = isActive;

    // type-specific handling
    const finalType = question.type; // updated type (if changed above)

    if (
      ["MCQ_SINGLE", "CHECKBOX", "DROPDOWN", "LIKERT", "YES_NO"].includes(
        finalType
      )
    ) {
      if (options !== undefined) {
        if (!Array.isArray(options) || !options.length) {
          return res.status(400).json({
            message: "options are required for this question type.",
          });
        }
        question.options = options;
      }
    } else {
      // non-option types ke liye options reset karna optional hai
      // question.options = [];
    }

    if (finalType === "CHECKBOX") {
      question.allowMultiple = true;
    } else if (finalType === "MCQ_SINGLE") {
      if (allowMultiple !== undefined) {
        question.allowMultiple = !!allowMultiple;
      } else {
        question.allowMultiple = false;
      }
    } else {
      question.allowMultiple = undefined;
    }

    if (finalType === "RATING") {
      if (minRating !== undefined) question.minRating = Number(minRating) || 1;
      if (maxRating !== undefined) question.maxRating = Number(maxRating) || 5;
      if (ratingStep !== undefined)
        question.ratingStep = Number(ratingStep) || 1;
    } else {
      question.minRating = undefined;
      question.maxRating = undefined;
      question.ratingStep = undefined;
    }

    await question.save();

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

    return res.json({
      message: "Question updated successfully",
      question: cleanQuestion,
    });
  } catch (err) {
    console.error("updateSurveyQuestion error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Admin deletes a survey question
export const deleteSurveyQuestion = async (req, res) => {
  try {
    const adminId = req.user?.sub;
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { questionId } = req.params;

    const question = await SurveyQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found." });
    }

    await SurveyQuestion.findByIdAndDelete(questionId);

    return res.json({
      message: "Question deleted successfully",
    });
  } catch (err) {
    console.error("deleteSurveyQuestion error:", err);
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

// ✅ Public: list ACTIVE surveys for SURVEY_USER app (no auth)
export const listPublicSurveys = async (req, res) => {
  try {
    const filter = {
      isActive: true,
      status: "ACTIVE"  // <-- always only ACTIVE
    };

    const surveys = await Survey.find(
      filter,
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
        isAnonymousAllowed: 1,
        maxResponses: 1,
        language: 1,
        tags: 1,
        isActive: 1,
        createdAt: 1,
      }
    )
      .sort({ startDate: 1, createdAt: -1 })
      .lean();

    return res.json({ surveys });
  } catch (err) {
    console.error("listPublicSurveys error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


// ✅ Get survey + its questions (by _id or surveyCode)
// 🔴 SURVEY_USER case me ?userCode=USR-XXXX pass kare aur yahan punch-in check hoga
export const getSurveyWithQuestions = async (req, res) => {
  try {
    const { surveyIdOrCode } = req.params;
    const { userCode } = req.query; // 🔴 NEW

    // 🔴 Agar userCode aaya hai to SURVEY_USER + punch-in validate karo
    if (userCode) {
      // 1) Check valid active SURVEY_USER
      const user = await User.findOne({
        userCode,
        role: "SURVEY_USER",
        isActive: true,
      }).lean();

      if (!user) {
        return res.status(404).json({
          message: "Active SURVEY_USER not found for this userCode.",
          code: "USER_NOT_FOUND",
        });
      }

      // 2) Aaj ka punch-in check
      const { startOfDay, endOfDay } = getTodayRange();

      const todayPunch = await PunchIn.findOne({
        userCode: user.userCode,
        createdAt: { $gte: startOfDay, $lt: endOfDay },
      }).lean();

      if (!todayPunch) {
        return res.status(403).json({
          message:
            "Please punch-in first for today before taking the survey.",
          code: "PUNCH_IN_REQUIRED",
        });
      }
    }

    // ✅ Aage same purana survey + questions logic
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

    // ✅ Cleaned question format
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
