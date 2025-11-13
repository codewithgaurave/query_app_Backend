// controllers/surveyResponseController.js
import mongoose from "mongoose";
import Survey from "../models/Survey.js";
import SurveyQuestion from "../models/SurveyQuestion.js";
import SurveyResponse from "../models/SurveyResponse.js";
import User from "../models/User.js";

const VALID_QUESTION_TYPES = [
  "OPEN_ENDED",
  "MCQ_SINGLE",
  "RATING",
  "LIKERT",
  "CHECKBOX",
  "DROPDOWN",
  "YES_NO",
];

// helper: survey _id ya surveyCode se survey laao
const findSurveyByIdOrCode = async (surveyIdOrCode) => {
  if (mongoose.Types.ObjectId.isValid(surveyIdOrCode)) {
    return Survey.findById(surveyIdOrCode).lean();
  }
  return Survey.findOne({ surveyCode: surveyIdOrCode }).lean();
};

// ✅ SURVEY_USER submit responses + audio
export const submitSurveyResponse = async (req, res) => {
  try {
    const { surveyIdOrCode } = req.params;
    const { userCode, answers } = req.body;

    if (!userCode) {
      return res.status(400).json({ message: "userCode is required." });
    }

    const user = await User.findOne({
      userCode,
      role: "SURVEY_USER",
      isActive: true,
    }).lean();

    if (!user) {
      return res
        .status(404)
        .json({ message: "Active SURVEY_USER not found for this userCode." });
    }

    const survey = await findSurveyByIdOrCode(surveyIdOrCode);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found." });
    }

    if (!req.file || !req.file.path) {
      return res
        .status(400)
        .json({ message: "Audio recording (audio) is required." });
    }

    let parsedAnswers;
    try {
      parsedAnswers = JSON.parse(answers || "[]");
    } catch (e) {
      return res
        .status(400)
        .json({ message: "answers must be a valid JSON array." });
    }

    if (!Array.isArray(parsedAnswers) || !parsedAnswers.length) {
      return res
        .status(400)
        .json({ message: "answers array is required and cannot be empty." });
    }

    const questions = await SurveyQuestion.find({
      survey: survey._id,
      isActive: true,
    }).lean();

    const questionMap = new Map(questions.map((q) => [String(q._id), q]));

    const normalizedAnswers = [];

    for (const a of parsedAnswers) {
      const qId = String(a.questionId || "");
      const q = questionMap.get(qId);
      if (!q) continue;

      const entry = {
        question: q._id,
        questionText: q.questionText,
        questionType: q.type,
      };

      switch (q.type) {
        case "OPEN_ENDED": {
          if (!a.answerText || typeof a.answerText !== "string") {
            return res.status(400).json({
              message: `answerText is required for OPEN_ENDED question: ${q.questionText}`,
            });
          }
          entry.answerText = a.answerText;
          break;
        }

        case "RATING": {
          const rating = Number(a.rating);
          if (Number.isNaN(rating)) {
            return res.status(400).json({
              message: `rating (number) is required for RATING question: ${q.questionText}`,
            });
          }
          if (
            typeof q.minRating === "number" &&
            typeof q.maxRating === "number" &&
            (rating < q.minRating || rating > q.maxRating)
          ) {
            return res.status(400).json({
              message: `rating must be between ${q.minRating} and ${q.maxRating} for question: ${q.questionText}`,
            });
          }
          entry.rating = rating;
          break;
        }

        case "MCQ_SINGLE":
        case "DROPDOWN":
        case "LIKERT":
        case "YES_NO": {
          let opt = a.selectedOption;
          if (!opt && Array.isArray(a.selectedOptions) && a.selectedOptions[0]) {
            opt = a.selectedOptions[0];
          }
          if (!opt || typeof opt !== "string") {
            return res.status(400).json({
              message: `selectedOption is required for question: ${q.questionText}`,
            });
          }
          if (!Array.isArray(q.options) || !q.options.includes(opt)) {
            return res.status(400).json({
              message: `selectedOption "${opt}" is not valid for question: ${q.questionText}`,
            });
          }
          entry.selectedOptions = [opt];
          break;
        }

        case "CHECKBOX": {
          const opts = Array.isArray(a.selectedOptions)
            ? a.selectedOptions
            : [];
          if (!opts.length) {
            return res.status(400).json({
              message: `selectedOptions (array) is required for CHECKBOX question: ${q.questionText}`,
            });
          }
          if (!Array.isArray(q.options)) {
            return res.status(400).json({
              message: `Question options missing for CHECKBOX question: ${q.questionText}`,
            });
          }
          const invalid = opts.filter((o) => !q.options.includes(o));
          if (invalid.length) {
            return res.status(400).json({
              message: `Invalid options ${invalid.join(
                ", "
              )} for question: ${q.questionText}`,
            });
          }
          entry.selectedOptions = opts;
          break;
        }

        default:
          continue;
      }

      normalizedAnswers.push(entry);
    }

    if (!normalizedAnswers.length) {
      return res
        .status(400)
        .json({ message: "No valid answers found for this survey." });
    }

    const responseDoc = await SurveyResponse.create({
      survey: survey._id,
      surveyCode: survey.surveyCode,
      user: user._id,
      userCode: user.userCode,
      userName: user.fullName,
      userMobile: user.mobile,
      userRole: user.role,
      audioUrl: req.file.path,
      isCompleted: true,
      answers: normalizedAnswers,
    });

    return res.status(201).json({
      message: "Survey response submitted successfully",
      responseId: responseDoc._id,
    });
  } catch (err) {
    console.error("submitSurveyResponse error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Admin: list responses for a specific survey
export const listSurveyResponses = async (req, res) => {
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

    const responses = await SurveyResponse.find(
      { survey: survey._id },
      {
        surveyCode: 1,
        userCode: 1,
        userName: 1,
        userMobile: 1,
        userRole: 1,
        audioUrl: 1,
        answers: 1,
        isCompleted: 1,
        createdAt: 1,
      }
    )
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      survey: {
        id: survey._id,
        surveyCode: survey.surveyCode,
        name: survey.name,
      },
      responses,
    });
  } catch (err) {
    console.error("listSurveyResponses error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ UPDATED: kis user ne kaun-kaun se surveys ka answer diya + detail answers
export const listUserSurveySummary = async (req, res) => {
  try {
    const { userCode } = req.params;

    if (!userCode) {
      return res.status(400).json({ message: "userCode is required." });
    }

    const user = await User.findOne({ userCode }).lean();

    const responses = await SurveyResponse.find(
      { userCode },
      {
        survey: 1,
        surveyCode: 1,
        audioUrl: 1,
        answers: 1,
        isCompleted: 1,
        createdAt: 1,
      }
    )
      .sort({ createdAt: -1 })
      .lean();

    if (!responses.length) {
      return res.json({
        user: user
          ? {
              userCode,
              userName: user.fullName,
              userMobile: user.mobile,
              role: user.role,
            }
          : { userCode },
        surveys: [],
      });
    }

    // unique surveys collect
    const surveyIdSet = new Set(responses.map((r) => String(r.survey)));
    const surveyIds = Array.from(surveyIdSet);

    const surveys = await Survey.find(
      { _id: { $in: surveyIds } },
      {
        name: 1,
        surveyCode: 1,
        description: 1,
        status: 1,
      }
    ).lean();

    const surveyMap = new Map(surveys.map((s) => [String(s._id), s]));

    // group by survey
    const grouped = new Map();

    for (const r of responses) {
      const key = String(r.survey);
      const s = surveyMap.get(key);
      if (!s) continue;

      if (!grouped.has(key)) {
        grouped.set(key, {
          surveyId: s._id,
          surveyCode: s.surveyCode,
          name: s.name,
          description: s.description,
          status: s.status,
          responses: [],    // yahan detailed responses jayenge
        });
      }

      const answers = (r.answers || []).map((a) => ({
        questionId: a.question,
        questionText: a.questionText,
        questionType: a.questionType,
        answerText: a.answerText,
        selectedOptions: a.selectedOptions,
        rating: a.rating,
      }));

      grouped.get(key).responses.push({
        responseId: r._id,
        audioUrl: r.audioUrl,
        isCompleted: r.isCompleted,
        createdAt: r.createdAt,
        answers,
      });
    }

    const surveysResult = Array.from(grouped.values()).sort((a, b) => {
      // sort by last response time (desc)
      const lastA = a.responses[0]?.createdAt || 0;
      const lastB = b.responses[0]?.createdAt || 0;
      return lastB - lastA;
    });

    return res.json({
      user: user
        ? {
            userCode,
            userName: user.fullName,
            userMobile: user.mobile,
            role: user.role,
          }
        : { userCode },
      surveys: surveysResult,
    });
  } catch (err) {
    console.error("listUserSurveySummary error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
