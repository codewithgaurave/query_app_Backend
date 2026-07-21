// controllers/surveyController.js
import crypto from "crypto";
import mongoose from "mongoose";
import Survey from "../models/Survey.js";
import SurveyQuestion from "../models/SurveyQuestion.js";
import PunchIn from "../models/PunchIn.js";
import User from "../models/User.js";

// helper: random surveyCode
const generateSurveyCode = () =>
  "SRV-" + crypto.randomBytes(4).toString("hex").toUpperCase();

// helper: aaj ka startOfDay / endOfDay nikalne ke liye (calendar day based)
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
  "OPEN_ENDED", // 1
  "MCQ_SINGLE", // 2
  "RATING", // 3
  "LIKERT", // 4
  "CHECKBOX", // 5
  "DROPDOWN", // 6
  "YES_NO", // 7
];

// helper: Mongo _id ya surveyCode se survey laao
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
      // NEW: frontend se array of userIds
      assignedUserIds,
      assignedQCIds,
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
        return res
          .status(400)
          .json({ message: "Invalid allowedQuestionTypes" });
      }
    }

    // assigned users resolve karo
    let assignedUsers = [];
    if (Array.isArray(assignedUserIds) && assignedUserIds.length) {
      const validIds = assignedUserIds.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );

      if (!validIds.length) {
        return res
          .status(400)
          .json({ message: "No valid assignedUserIds provided." });
      }

      const users = await User.find({
        _id: { $in: validIds },
        isActive: true,
      })
        .select("_id role")
        .lean();

      if (!users.length) {
        return res.status(400).json({
          message: "No active users found for assignedUserIds.",
        });
      }

      assignedUsers = users.map((u) => u._id);
    }

    // assigned QCs resolve karo
    let assignedQCs = [];
    if (Array.isArray(assignedQCIds) && assignedQCIds.length) {
      const validQcIds = assignedQCIds.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );

      if (!validQcIds.length) {
        return res
          .status(400)
          .json({ message: "No valid assignedQCIds provided." });
      }

      const qcs = await User.find({
        _id: { $in: validQcIds },
        role: "QUALITY_ENGINEER",
        isActive: true,
      })
        .select("_id role")
        .lean();

      if (!qcs.length) {
        return res.status(400).json({
          message: "No active QUALITY_ENGINEER found for assignedQCIds.",
        });
      }

      assignedQCs = qcs.map((q) => q._id);
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
      assignedUsers,
      assignedQCs,
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
      // updated list of userIds (full replacement)
      assignedUserIds,
      assignedQCIds,
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
    if (typeof targetAudience === "string")
      update.targetAudience = targetAudience;
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

    // assignment update (full replacement)
    if (Array.isArray(assignedUserIds)) {
      if (!assignedUserIds.length) {
        update.assignedUsers = [];
      } else {
        const validIds = assignedUserIds.filter((id) =>
          mongoose.Types.ObjectId.isValid(id)
        );

        if (!validIds.length) {
          return res
            .status(400)
            .json({ message: "No valid assignedUserIds provided." });
        }

        const users = await User.find({
          _id: { $in: validIds },
          isActive: true,
        })
          .select("_id role")
          .lean();

        if (!users.length) {
          return res.status(400).json({
            message: "No active users found for assignedUserIds.",
          });
        }

        update.assignedUsers = users.map((u) => u._id);
      }
    }

    // QC assignment update (full replacement)
    if (Array.isArray(assignedQCIds)) {
      if (!assignedQCIds.length) {
        update.assignedQCs = [];
      } else {
        const validQcIds = assignedQCIds.filter((id) =>
          mongoose.Types.ObjectId.isValid(id)
        );

        if (!validQcIds.length) {
          return res
            .status(400)
            .json({ message: "No valid assignedQCIds provided." });
        }

        const qcs = await User.find({
          _id: { $in: validQcIds },
          role: "QUALITY_ENGINEER",
          isActive: true,
        })
          .select("_id role")
          .lean();

        if (!qcs.length) {
          return res.status(400).json({
            message: "No active QUALITY_ENGINEER found for assignedQCIds.",
          });
        }

        update.assignedQCs = qcs.map((q) => q._id);
      }
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

    await SurveyQuestion.deleteMany({ survey: survey._id });
    await Survey.findByIdAndDelete(survey._id);

    return res.json({
      message: "Survey and its questions deleted successfully",
    });
  } catch (err) {
    console.error("deleteSurvey error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Admin duplicates a survey (by _id or surveyCode) + its questions
export const duplicateSurvey = async (req, res) => {
  try {
    const adminId = req.user?.sub;
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { surveyIdOrCode } = req.params;
    const originalSurvey = await findSurveyByIdOrCode(surveyIdOrCode);
    if (!originalSurvey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    // 1. Create the new duplicated survey
    const newSurveyCode = generateSurveyCode();
    
    // Create new survey payload by omitting unneeded fields and modifying name/status
    const surveyPayload = {
      ...originalSurvey,
      _id: new mongoose.Types.ObjectId(),
      surveyCode: newSurveyCode,
      name: `${originalSurvey.name} - Copy`,
      status: "DRAFT",
      startDate: undefined,
      endDate: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      createdAtIST: undefined,
      updatedAtIST: undefined,
    };
    
    // Explicitly delete mongo internals
    delete surveyPayload.__v;

    const newSurvey = await Survey.create(surveyPayload);

    // 2. Fetch all original questions
    const originalQuestions = await SurveyQuestion.find({ survey: originalSurvey._id })
      .sort({ order: 1 })
      .lean();

    const rootQuestions = originalQuestions.filter((q) => !q.parentQuestion);
    const followUpQuestions = originalQuestions.filter((q) => q.parentQuestion);
    
    const questionIdMapping = {}; // { oldId: newId }

    // 3. Duplicate Root Questions
    for (const q of rootQuestions) {
      const oldId = q._id.toString();
      
      const qPayload = { ...q };
      delete qPayload._id;
      delete qPayload.__v;
      delete qPayload.createdAt;
      delete qPayload.updatedAt;
      delete qPayload.createdAtIST;
      delete qPayload.updatedAtIST;
      
      qPayload.survey = newSurvey._id;

      const newQ = await SurveyQuestion.create(qPayload);
      questionIdMapping[oldId] = newQ._id.toString();
    }

    // 4. Duplicate Follow-Up Questions
    for (const q of followUpQuestions) {
      const oldParentId = q.parentQuestion.toString();
      const newParentId = questionIdMapping[oldParentId];

      if (newParentId) {
        const qPayload = { ...q };
        delete qPayload._id;
        delete qPayload.__v;
        delete qPayload.createdAt;
        delete qPayload.updatedAt;
        delete qPayload.createdAtIST;
        delete qPayload.updatedAtIST;
        
        qPayload.survey = newSurvey._id;
        qPayload.parentQuestion = newParentId;

        await SurveyQuestion.create(qPayload);
      }
    }

    return res.status(201).json({
      message: "Survey duplicated successfully",
      survey: newSurvey,
    });
  } catch (err) {
    console.error("duplicateSurvey error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Admin adds a question to a survey (by _id or surveyCode)
// Root question -> koi bhi allowed type
// Follow-up question (parentQuestionId set) -> ALWAYS OPEN_ENDED + multiple allowed per option
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
      // "Other" support
      enableOtherOption,
      otherOptionLabel,
      // Follow-up mapping
      parentQuestionId,
      parentOptionValue,
    } = req.body;

    if (!questionText) {
      return res
        .status(400)
        .json({ message: "questionText is required." });
    }

    // Root questions ke liye type required; follow-up ke liye hum force OPEN_ENDED karenge
    if (!parentQuestionId && !type) {
      return res
        .status(400)
        .json({ message: "type is required for root questions." });
    }

    const survey = await findSurveyByIdOrCode(surveyIdOrCode);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found." });
    }

    const OPTION_BASED_TYPES = [
      "MCQ_SINGLE",
      "CHECKBOX",
      "DROPDOWN",
      "LIKERT",
      "YES_NO",
    ];

    let parentQuestionDoc = null;

    // ⭐ Follow-up validation (optional)
    if (parentQuestionId) {
      if (!mongoose.Types.ObjectId.isValid(parentQuestionId)) {
        return res
          .status(400)
          .json({ message: "parentQuestionId must be a valid ObjectId." });
      }

      parentQuestionDoc = await SurveyQuestion.findOne({
        _id: parentQuestionId,
        survey: survey._id,
      }).lean();

      if (!parentQuestionDoc) {
        return res.status(404).json({
          message: "Parent question not found for this survey.",
        });
      }

      if (!parentOptionValue || typeof parentOptionValue !== "string") {
        return res.status(400).json({
          message:
            "parentOptionValue (string) is required when parentQuestionId is provided.",
        });
      }
    }

    // 🔵 Allow any question type for root and follow-up questions
    let finalType = type || "OPEN_ENDED";

    if (!VALID_QUESTION_TYPES.includes(finalType)) {
      return res.status(400).json({ message: "Invalid question type." });
    }

    // Survey.allowedQuestionTypes enforce
    if (
      Array.isArray(survey.allowedQuestionTypes) &&
      survey.allowedQuestionTypes.length &&
      !survey.allowedQuestionTypes.includes(finalType)
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
      type: finalType,
      required: typeof required === "boolean" ? required : true,
      order: typeof order === "number" ? order : 0,
      helpText,
    };

    if (parentQuestionDoc) {
      doc.parentQuestion = parentQuestionDoc._id;
      doc.parentOptionValue = parentOptionValue;
    }

    // Type-specific handling for ALL option-based questions (root and follow-up)
    if (OPTION_BASED_TYPES.includes(finalType)) {
      if (!Array.isArray(options) || !options.length) {
        return res
          .status(400)
          .json({ message: "options are required for this question type." });
      }
      doc.options = options;

      if (typeof enableOtherOption === "boolean") {
        doc.enableOtherOption = enableOtherOption;
      }
      if (typeof otherOptionLabel === "string" && otherOptionLabel.trim()) {
        doc.otherOptionLabel = otherOptionLabel.trim();
      }
    }

    // checkbox & mcq multiple handling
    if (finalType === "CHECKBOX") {
      doc.allowMultiple = true;
    } else if (finalType === "MCQ_SINGLE") {
      doc.allowMultiple = !!allowMultiple; // default false
    }

    // rating config
    if (finalType === "RATING") {
      doc.minRating = typeof minRating === "number" ? minRating : 1;
      doc.maxRating = typeof maxRating === "number" ? maxRating : 5;
      doc.ratingStep = typeof ratingStep === "number" ? ratingStep : 1;
    }

    const question = await SurveyQuestion.create(doc);

    const cleanQuestion = {
      id: question._id,
      survey: question.survey,
      questionText: question.questionText,
      type: question.type,
      required: question.required,
      order: question.order,
      helpText: question.helpText,
      parentQuestion: question.parentQuestion || null,
      parentOptionValue: question.parentOptionValue || "",
      options: question.options || [],
      allowMultiple: question.allowMultiple || false,
      minRating: question.minRating,
      maxRating: question.maxRating,
      ratingStep: question.ratingStep,
      enableOtherOption: question.enableOtherOption || false,
      otherOptionLabel: question.otherOptionLabel || "Other",
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };

    return res.status(201).json({
      message: parentQuestionDoc
        ? "Follow-up question added successfully."
        : "Survey question added successfully.",
      question: cleanQuestion,
    });
  } catch (err) {
    console.error("Error adding survey question:", err);
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
      enableOtherOption,
      otherOptionLabel,
      parentQuestionId,
      parentOptionValue,
    } = req.body;

    const question = await SurveyQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found." });
    }

    const OPTION_BASED_TYPES = [
      "MCQ_SINGLE",
      "CHECKBOX",
      "DROPDOWN",
      "LIKERT",
      "YES_NO",
    ];

    // ⭐ Follow-up update logic
    if (parentQuestionId !== undefined) {
      if (!parentQuestionId) {
        question.parentQuestion = null;
        question.parentOptionValue = undefined;
      } else {
        if (!mongoose.Types.ObjectId.isValid(parentQuestionId)) {
          return res
            .status(400)
            .json({ message: "parentQuestionId must be a valid ObjectId." });
        }

        const parentQuestionDoc = await SurveyQuestion.findOne({
          _id: parentQuestionId,
          survey: question.survey,
        }).lean();

        if (!parentQuestionDoc) {
          return res.status(404).json({
            message: "Parent question not found for this survey.",
          });
        }

        let effectiveParentOptionValue = parentOptionValue;
        if (
          effectiveParentOptionValue === undefined &&
          question.parentQuestion &&
          String(question.parentQuestion) === String(parentQuestionDoc._id)
        ) {
          effectiveParentOptionValue = question.parentOptionValue;
        }

        if (
          !effectiveParentOptionValue ||
          typeof effectiveParentOptionValue !== "string"
        ) {
          return res.status(400).json({
            message:
              "parentOptionValue (string) is required when parentQuestionId is provided.",
          });
        }

        question.parentQuestion = parentQuestionDoc._id;
        question.parentOptionValue = effectiveParentOptionValue;
      }
    } else if (parentOptionValue !== undefined) {
      if (!question.parentQuestion) {
        return res.status(400).json({
          message:
            "parentOptionValue cannot be set because this question has no parentQuestion.",
        });
      }

      question.parentOptionValue = parentOptionValue;
    }

    // 🔵 Type handling
    let finalType = question.type;

    if (type) {
      if (!VALID_QUESTION_TYPES.includes(type)) {
        return res.status(400).json({ message: "Invalid question type." });
      }

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

      finalType = type;
    }

    question.type = finalType;

    if (typeof questionText === "string") question.questionText = questionText;
    if (typeof required === "boolean") question.required = required;
    if (typeof order === "number") question.order = order;
    if (typeof helpText === "string" || helpText === null) {
      question.helpText = helpText;
    }
    if (typeof isActive === "boolean") question.isActive = isActive;

    // Type-specific handling (works for both root and follow-up)
    if (OPTION_BASED_TYPES.includes(finalType)) {
      if (options !== undefined) {
        if (!Array.isArray(options) || !options.length) {
          return res.status(400).json({
            message: "options are required for this question type.",
          });
        }
        question.options = options;
      }

      if (typeof enableOtherOption === "boolean") {
        question.enableOtherOption = enableOtherOption;
      }
      if (typeof otherOptionLabel === "string") {
        const trimmed = otherOptionLabel.trim();
        question.otherOptionLabel = trimmed || "Other";
      }
    } else {
      // Non-option types (OPEN_ENDED / RATING etc)
      question.enableOtherOption = false;
      question.otherOptionLabel = undefined;
      if (!["OPEN_ENDED", "RATING"].includes(finalType)) {
        question.options = [];
      }
    }

    // allowMultiple handling
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

    // Rating config
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
      parentQuestion: question.parentQuestion,
      parentOptionValue: question.parentOptionValue,
    };

    if (OPTION_BASED_TYPES.includes(question.type)) {
      cleanQuestion.options = question.options;
      cleanQuestion.enableOtherOption = question.enableOtherOption;
      cleanQuestion.otherOptionLabel = question.otherOptionLabel;
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
        assignedUsers: 1,
      }
    )
      .populate("assignedUsers", "fullName mobile userCode role isActive")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ surveys });
  } catch (err) {
    console.error("listSurveys error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Public: list ACTIVE surveys for SURVEY_USER app
export const listPublicSurveys = async (req, res) => {
  try {
    const { userCode } = req.query;

    const baseFilter = {
      isActive: true,
      status: "ACTIVE",
    };

    let filter = { ...baseFilter };

    if (userCode) {
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

      // Allow surveys explicitly assigned to the user OR global surveys (assignedUsers array is empty or doesn't exist)
      filter.$or = [
        { assignedUsers: user._id },
        { assignedUsers: { $exists: true, $size: 0 } },
        { assignedUsers: { $exists: false } }
      ];
    }

    const surveys = await Survey.find(filter, {
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
    })
      .sort({ startDate: 1, createdAt: -1 })
      .lean();

    return res.json({ surveys });
  } catch (err) {
    console.error("listPublicSurveys error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get survey + its questions (by _id or surveyCode)
export const getSurveyWithQuestions = async (req, res) => {
  try {
    const { surveyIdOrCode } = req.params;
    const { userCode } = req.query; // SURVEY_USER app ke liye

    let user = null;

    if (userCode) {
      user = await User.findOne({
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

      const { startOfDay, endOfDay } = getTodayRange();

      const todayPunch = await PunchIn.findOne({
        userCode: user.userCode,
        createdAt: { $gte: startOfDay, $lt: endOfDay },
      }).lean();

      if (!todayPunch) {
        return res.status(403).json({
          message: "Please punch-in first for today before taking the survey.",
          code: "PUNCH_IN_REQUIRED",
        });
      }
    }

    const survey = await findSurveyByIdOrCode(surveyIdOrCode);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    if (userCode && user) {
      if (
        Array.isArray(survey.assignedUsers) &&
        survey.assignedUsers.length > 0
      ) {
        const isAssigned = survey.assignedUsers.some(
          (id) => String(id) === String(user._id)
        );

        if (!isAssigned) {
          return res.status(403).json({
            message: "This survey is not assigned to this user.",
            code: "SURVEY_NOT_ASSIGNED",
          });
        }
      }
    }

    const rawQuestions = await SurveyQuestion.find({
      survey: survey._id,
      isActive: true,
    })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    const OPTION_BASED_TYPES = [
      "MCQ_SINGLE",
      "CHECKBOX",
      "DROPDOWN",
      "LIKERT",
      "YES_NO",
    ];

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
        parentQuestion: q.parentQuestion || null,
        parentOptionValue: q.parentOptionValue || null,
      };

      if (OPTION_BASED_TYPES.includes(q.type)) {
        base.options = q.options;
        base.enableOtherOption = q.enableOtherOption;
        base.otherOptionLabel = q.otherOptionLabel;
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
