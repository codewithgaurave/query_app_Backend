// controllers/surveyResponseController.js
import mongoose from "mongoose";
import Survey from "../models/Survey.js";
import SurveyQuestion from "../models/SurveyQuestion.js";
import SurveyResponse, {
  APPROVAL_STATUS,
} from "../models/SurveyResponse.js";
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

/**
 * ✅ Helper: answers ko validate + normalize kare
 *  - parsedAnswers: FE se aaya array
 *  - questionMap: Map(questionId -> questionDoc)
 *  -> agar kuch galat hua to error throw karega { status, message }
 */
const normalizeSurveyAnswers = (parsedAnswers, questionMap) => {
  if (!Array.isArray(parsedAnswers) || !parsedAnswers.length) {
    const err = new Error("answers array is required and cannot be empty.");
    err.status = 400;
    throw err;
  }

  const normalizedAnswers = [];

  for (const a of parsedAnswers) {
    const qId = String(a.questionId || "");
    const q = questionMap.get(qId);

    if (!q) {
      const err = new Error(`Invalid questionId "${qId}" for this survey.`);
      err.status = 400;
      throw err;
    }

    const entry = {
      question: q._id,
      questionText: q.questionText,
      questionType: q.type,
    };

    // "Other" option related flags from question
    const hasOther = !!q.enableOtherOption;
    const otherLabel = (q.otherOptionLabel || "Other").trim();

    switch (q.type) {
      case "OPEN_ENDED": {
        if (!a.answerText || typeof a.answerText !== "string") {
          const err = new Error(
            `answerText is required for OPEN_ENDED question: ${q.questionText}`
          );
          err.status = 400;
          throw err;
        }
        entry.answerText = a.answerText;
        break;
      }

      case "RATING": {
        const rating = Number(a.rating);
        if (Number.isNaN(rating)) {
          const err = new Error(
            `rating (number) is required for RATING question: ${q.questionText}`
          );
          err.status = 400;
          throw err;
        }
        if (
          typeof q.minRating === "number" &&
          typeof q.maxRating === "number" &&
          (rating < q.minRating || rating > q.maxRating)
        ) {
          const err = new Error(
            `rating must be between ${q.minRating} and ${q.maxRating} for question: ${q.questionText}`
          );
          err.status = 400;
          throw err;
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
          const err = new Error(
            `selectedOption is required for question: ${q.questionText}`
          );
          err.status = 400;
          throw err;
        }

        const optionsFromDb = Array.isArray(q.options) ? q.options : [];
        const isNormalOption = optionsFromDb.includes(opt);
        const isOtherSelected = hasOther && opt === otherLabel;

        if (!isNormalOption && !isOtherSelected) {
          const err = new Error(
            `selectedOption "${opt}" is not valid for question: ${q.questionText}`
          );
          err.status = 400;
          throw err;
        }

        if (isOtherSelected) {
          const otherText =
            typeof a.otherText === "string" ? a.otherText.trim() : "";
          if (!otherText) {
            const err = new Error(
              `otherText is required when selecting "${otherLabel}" for question: ${q.questionText}`
            );
            err.status = 400;
            throw err;
          }
          entry.otherText = otherText;
        }

        entry.selectedOptions = [opt];
        break;
      }

      case "CHECKBOX": {
        const opts = Array.isArray(a.selectedOptions)
          ? a.selectedOptions
          : [];
        if (!opts.length) {
          const err = new Error(
            `selectedOptions (array) is required for CHECKBOX question: ${q.questionText}`
          );
          err.status = 400;
          throw err;
        }
        if (!Array.isArray(q.options)) {
          const err = new Error(
            `Question options missing for CHECKBOX question: ${q.questionText}`
          );
          err.status = 400;
          throw err;
        }

        const optionsFromDb = q.options;
        const invalid = [];
        let usedOther = false;

        for (const val of opts) {
          const isNormalOption = optionsFromDb.includes(val);
          const isOtherSelected = hasOther && val === otherLabel;
          if (!isNormalOption && !isOtherSelected) {
            invalid.push(val);
          }
          if (isOtherSelected) {
            usedOther = true;
          }
        }

        if (invalid.length) {
          const err = new Error(
            `Invalid options ${invalid.join(
              ", "
            )} for question: ${q.questionText}`
          );
          err.status = 400;
          throw err;
        }

        if (usedOther) {
          const otherText =
            typeof a.otherText === "string" ? a.otherText.trim() : "";
          if (!otherText) {
            const err = new Error(
              `otherText is required when selecting "${otherLabel}" for question: ${q.questionText}`
            );
            err.status = 400;
            throw err;
          }
          entry.otherText = otherText;
        }

        entry.selectedOptions = opts;
        break;
      }

      default: {
        // unknown type => ignore
        continue;
      }
    }

    normalizedAnswers.push(entry);
  }

  if (!normalizedAnswers.length) {
    const err = new Error("No valid answers found for this survey.");
    err.status = 400;
    throw err;
  }

  return normalizedAnswers;
};

// ✅ SURVEY_USER submit responses + audio (SINGLE response)
export const submitSurveyResponse = async (req, res) => {
  try {
    const { surveyIdOrCode } = req.params;
    const { userCode, answers, latitude, longitude } = req.body;

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

    // ✅ Location parse (optional)
    let latitudeNum;
    let longitudeNum;

    if (latitude !== undefined) {
      latitudeNum = Number(latitude);
      if (Number.isNaN(latitudeNum)) {
        return res
          .status(400)
          .json({ message: "latitude must be a valid number." });
      }
    }

    if (longitude !== undefined) {
      longitudeNum = Number(longitude);
      if (Number.isNaN(longitudeNum)) {
        return res
          .status(400)
          .json({ message: "longitude must be a valid number." });
      }
    }

    let parsedAnswers;
    try {
      // answers yaha string aa rha hai (multipart/form-data), isliye JSON.parse
      parsedAnswers = JSON.parse(answers || "[]");
    } catch (e) {
      return res
        .status(400)
        .json({ message: "answers must be a valid JSON array." });
    }

    // ❗ isActive filter hata diya, taaki koi question skip na ho
    const questions = await SurveyQuestion.find({
      survey: survey._id,
      // isActive: true,
    }).lean();

    const questionMap = new Map(questions.map((q) => [String(q._id), q]));

    let normalizedAnswers;
    try {
      normalizedAnswers = normalizeSurveyAnswers(parsedAnswers, questionMap);
    } catch (e) {
      return res
        .status(e.status || 400)
        .json({ message: e.message || "Invalid answers." });
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
      // ✅ location (optional)
      latitude: latitudeNum,
      longitude: longitudeNum,
      isCompleted: true,
      answers: normalizedAnswers,
      // ✅ approval defaults
      approvalStatus: APPROVAL_STATUS.PENDING,
      isApproved: false,
      approvedBy: null,
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

// ✅ NEW: SURVEY_USER submit MULTIPLE responses + single audio (bulk)
export const submitBulkSurveyResponses = async (req, res) => {
  try {
    const { surveyIdOrCode } = req.params;
    const { userCode, responses } = req.body;

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

    // responses: JSON string of array
    let parsedResponses;
    try {
      parsedResponses = JSON.parse(responses || "[]");
    } catch (e) {
      return res
        .status(400)
        .json({ message: "responses must be a valid JSON array." });
    }

    if (!Array.isArray(parsedResponses) || !parsedResponses.length) {
      return res.status(400).json({
        message: "responses array is required and cannot be empty.",
      });
    }

    // Questions & map ek baar nikaal lo
    const questions = await SurveyQuestion.find({
      survey: survey._id,
    }).lean();

    const questionMap = new Map(questions.map((q) => [String(q._id), q]));

    const createdResponses = [];

    // Har item ek logical SurveyResponse hoga
    for (let i = 0; i < parsedResponses.length; i++) {
      const item = parsedResponses[i] || {};
      const answers = item.answers;

      // per-response location parse
      let latitudeNum;
      let longitudeNum;

      if (item.latitude !== undefined) {
        latitudeNum = Number(item.latitude);
        if (Number.isNaN(latitudeNum)) {
          return res.status(400).json({
            message: `Response index ${i}: latitude must be a valid number.`,
          });
        }
      }

      if (item.longitude !== undefined) {
        longitudeNum = Number(item.longitude);
        if (Number.isNaN(longitudeNum)) {
          return res.status(400).json({
            message: `Response index ${i}: longitude must be a valid number.`,
          });
        }
      }

      let normalizedAnswers;
      try {
        normalizedAnswers = normalizeSurveyAnswers(answers, questionMap);
      } catch (e) {
        return res
          .status(e.status || 400)
          .json({
            message: `Response index ${i}: ${
              e.message || "Invalid answers."
            }`,
          });
      }

      const responseDoc = await SurveyResponse.create({
        survey: survey._id,
        surveyCode: survey.surveyCode,
        user: user._id,
        userCode: user.userCode,
        userName: user.fullName,
        userMobile: user.mobile,
        userRole: user.role,
        audioUrl: req.file.path, // same audio for all in this bulk
        latitude: latitudeNum,
        longitude: longitudeNum,
        isCompleted: true,
        answers: normalizedAnswers,
        approvalStatus: APPROVAL_STATUS.PENDING,
        isApproved: false,
        approvedBy: null,
      });

      createdResponses.push({
        index: i,
        responseId: responseDoc._id,
      });
    }

    return res.status(201).json({
      message: "Bulk survey responses submitted successfully",
      createdResponses,
    });
  } catch (err) {
    console.error("submitBulkSurveyResponses error:", err);
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
        isApproved: 1,
        approvalStatus: 1,
        approvedBy: 1,
        createdAt: 1,
        // ✅ location fields
        latitude: 1,
        longitude: 1,
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

export const listUserSurveySummary = async (req, res) => {
  try {
    const { userCode } = req.params;

    if (!userCode) {
      return res.status(400).json({ message: "userCode is required." });
    }

    // ---- 1) Base user info ----
    const user = await User.findOne({ userCode }).lean();

    // ---- 2) User ke sare responses fetch + approval fields + location ----
    const responses = await SurveyResponse.find(
      { userCode },
      {
        survey: 1,
        surveyCode: 1,
        audioUrl: 1,
        answers: 1,
        isCompleted: 1,
        isApproved: 1,
        approvalStatus: 1,
        approvedBy: 1,
        // ✅ approval time (agar schema me ho)
        approvedAt: 1,
        // ✅ fallback ke liye updatedAt bhi
        updatedAt: 1,
        createdAt: 1,
        // ✅ location fields
        latitude: 1,
        longitude: 1,
      }
    )
      .sort({ createdAt: -1 })
      .lean();

    // Agar koi response hi nahi mila
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

    // ---- 3) Approver users ka map bana lo (approvedBy se) ----
    const approverIdSet = new Set(
      responses
        .map((r) => (r.approvedBy ? String(r.approvedBy) : null))
        .filter(Boolean)
    );
    const approverIds = Array.from(approverIdSet);

    let approverMap = new Map();
    if (approverIds.length > 0) {
      const approvers = await User.find(
        { _id: { $in: approverIds } },
        { fullName: 1, userCode: 1 }
      ).lean();

      approverMap = new Map(
        approvers.map((u) => [String(u._id), u])
      );
    }

    // ---- 4) Survey details fetch ----
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

    // ---- 5) Group by survey ----
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
          responses: [],
        });
      }

      // Q&A normalize
      const answers = (r.answers || []).map((a) => ({
        questionId: a.question,
        questionText: a.questionText,
        questionType: a.questionType,
        answerText: a.answerText,
        selectedOptions: a.selectedOptions,
        rating: a.rating,
        otherText: a.otherText,
      }));

      // ✅ approver detail resolve
      const approver =
        r.approvedBy ? approverMap.get(String(r.approvedBy)) : null;

      // ✅ approval time decide:
      //    - agar approvedAt hai to vo
      //    - warna agar isApproved true hai to updatedAt
      //    - warna null
      const approvalTime =
        r.approvedAt ||
        (r.isApproved ? r.updatedAt : null) ||
        null;

      grouped.get(key).responses.push({
        responseId: r._id,
        audioUrl: r.audioUrl,

        // ✅ location per response
        latitude: r.latitude,
        longitude: r.longitude,

        isCompleted: r.isCompleted,
        isApproved: r.isApproved,
        approvalStatus: r.approvalStatus,

        // ✅ raw id bhi bhej rahe hain (agar kahin chahiye ho)
        approvedBy: r.approvedBy || null,

        // ✅ human readable approver info
        approvedByName: approver ? approver.fullName : null,
        approvedByUserCode: approver ? approver.userCode : null,

        // ✅ kab verify kiya
        approvedAt: approvalTime,

        createdAt: r.createdAt,
        answers,
      });
    }

    // ---- 6) Surveys ko last response ke time se sort karo ----
    const surveysResult = Array.from(grouped.values()).sort((a, b) => {
      const lastA = a.responses[0]?.createdAt || 0;
      const lastB = b.responses[0]?.createdAt || 0;
      return lastB - lastA;
    });

    // ---- 7) Response return ----
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


// ✅ Admin summary — har survey pe kitne responses + kis user ne diye
export const adminSurveyResponseSummary = async (req, res) => {
  try {
    const adminId = req.user?.sub;
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const grouped = await SurveyResponse.aggregate([
      {
        $group: {
          _id: "$survey",
          surveyCode: { $first: "$surveyCode" },
          totalResponses: { $sum: 1 },
          users: {
            $addToSet: {
              userCode: "$userCode",
              userName: "$userName",
              userMobile: "$userMobile",
            },
          },
          lastResponseAt: { $max: "$createdAt" },
        },
      },
      { $sort: { lastResponseAt: -1 } },
    ]);

    if (!grouped.length) {
      return res.json({ surveys: [] });
    }

    const surveyIds = grouped.map((g) => g._id);
    const surveys = await Survey.find(
      { _id: { $in: surveyIds } },
      {
        name: 1,
        surveyCode: 1,
        status: 1,
        category: 1,
        projectName: 1,
      }
    ).lean();

    const surveyMap = new Map(surveys.map((s) => [String(s._id), s]));

    const result = grouped
      .map((g) => {
        const s = surveyMap.get(String(g._id));
        if (!s) return null;

        return {
          surveyId: s._id,
          surveyCode: s.surveyCode || g.surveyCode,
          name: s.name,
          status: s.status,
          category: s.category,
          projectName: s.projectName,
          totalResponses: g.totalResponses,
          users: g.users,
          lastResponseAt: g.lastResponseAt,
        };
      })
      .filter(Boolean);

    return res.json({ surveys: result });
  } catch (err) {
    console.error("adminSurveyResponseSummary error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ NEW: QUALITY_ENGINEER sets approvalStatus (5 options)
export const approveSurveyResponse = async (req, res) => {
  try {
    const userJwt = req.user;

    if (
      !userJwt ||
      userJwt.type !== "USER" ||
      userJwt.role !== "QUALITY_ENGINEER"
    ) {
      return res
        .status(403)
        .json({ message: "Only Quality Engineer can approve responses." });
    }

    const { responseId } = req.params;
    const { approvalStatus } = req.body;

    if (!mongoose.Types.ObjectId.isValid(responseId)) {
      return res.status(400).json({ message: "Invalid responseId." });
    }

    if (!approvalStatus) {
      return res
        .status(400)
        .json({ message: "approvalStatus is required." });
    }

    const allowedStatuses = Object.values(APPROVAL_STATUS).filter(
      (s) => s !== APPROVAL_STATUS.PENDING
    );

    if (!allowedStatuses.includes(approvalStatus)) {
      return res.status(400).json({
        message: `approvalStatus must be one of: ${allowedStatuses.join(
          ", "
        )}`,
      });
    }

    const isApproved = approvalStatus === APPROVAL_STATUS.CORRECTLY_DONE;

    const updated = await SurveyResponse.findByIdAndUpdate(
      responseId,
      {
        approvalStatus,
        isApproved,
        approvedBy: isApproved ? userJwt.sub : null,
        // 🔴 YEH LINE ADD KARO
        approvedAt: isApproved ? new Date() : null,
      },
      {
        new: true,
        projection: {
          survey: 1,
          surveyCode: 1,
          userCode: 1,
          userName: 1,
          userMobile: 1,
          isCompleted: 1,
          isApproved: 1,
          approvalStatus: 1,
          approvedBy: 1,
          // 🔴 YEH LINE BHI ADD KARO
          approvedAt: 1,
          createdAt: 1,
        },
      }
    ).lean();

    if (!updated) {
      return res.status(404).json({ message: "Survey response not found." });
    }

    return res.json({
      message: "Response approvalStatus updated successfully",
      response: updated,
    });
  } catch (err) {
    console.error("approveSurveyResponse error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


/**
 * ✅ NEW PUBLIC (NO AUTH):
 * - Sabhi surveys ke saare responses
 * - Kis user ne kiya, answers, audio, approval info sab
 */
export const publicSurveyResponsesWithApproval = async (req, res) => {
  try {
    const responses = await SurveyResponse.find(
      {},
      {
        survey: 1,
        surveyCode: 1,
        userCode: 1,
        userName: 1,
        userMobile: 1,
        userRole: 1,
        audioUrl: 1,
        answers: 1,
        isCompleted: 1,
        isApproved: 1,
        approvalStatus: 1,
        approvedBy: 1,
        createdAt: 1,
        // ✅ location fields
        latitude: 1,
        longitude: 1,
      }
    )
      .sort({ createdAt: -1 })
      .lean();

    if (!responses.length) {
      return res.json({ surveys: [] });
    }

    const surveyIds = [...new Set(responses.map((r) => String(r.survey)))];

    const surveys = await Survey.find(
      { _id: { $in: surveyIds } },
      {
        name: 1,
        surveyCode: 1,
        description: 1,
        status: 1,
        category: 1,
        projectName: 1,
      }
    ).lean();

    const surveyMap = new Map(surveys.map((s) => [String(s._id), s]));

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
          category: s.category,
          projectName: s.projectName,
          responses: [],
        });
      }

      const answers = (r.answers || []).map((a) => ({
        questionId: a.question,
        questionText: a.questionText,
        questionType: a.questionType,
        answerText: a.answerText,
        selectedOptions: a.selectedOptions,
        rating: a.rating,
        otherText: a.otherText,
      }));

      grouped.get(key).responses.push({
        responseId: r._id,
        userCode: r.userCode,
        userName: r.userName,
        userMobile: r.userMobile,
        userRole: r.userRole,
        audioUrl: r.audioUrl,
        // ✅ location per response
        latitude: r.latitude,
        longitude: r.longitude,
        isCompleted: r.isCompleted,
        isApproved: r.isApproved,
        approvalStatus: r.approvalStatus,
        approvedBy: r.approvedBy,
        createdAt: r.createdAt,
        answers,
      });
    }

    const result = Array.from(grouped.values()).sort((a, b) => {
      const lastA = a.responses[0]?.createdAt || 0;
      const lastB = b.responses[0]?.createdAt || 0;
      return lastB - lastA;
    });

    return res.json({ surveys: result });
  } catch (err) {
    console.error("publicSurveyResponsesWithApproval error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const publicSetSurveyResponseApproval = async (req, res) => {
  try {
    const { responseId } = req.params;
    const { approvalStatus } = req.body;

    if (!mongoose.Types.ObjectId.isValid(responseId)) {
      return res.status(400).json({ message: "Invalid responseId." });
    }

    if (!approvalStatus) {
      return res
        .status(400)
        .json({ message: "approvalStatus is required." });
    }

    const allowedStatuses = Object.values(APPROVAL_STATUS);

    if (!allowedStatuses.includes(approvalStatus)) {
      return res.status(400).json({
        message: `approvalStatus must be one of: ${allowedStatuses.join(
          ", "
        )}`,
      });
    }

    const isApproved = approvalStatus === APPROVAL_STATUS.CORRECTLY_DONE;

    // 🔴 YEH ADD KARO – ab NO AUTH nahi, proper user required
    if (!req.user || !req.user.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const approverId = req.user.sub;

    const update = {
      approvalStatus,
      isApproved,
    };

    if (isApproved) {
      // ✅ correct case
      update.approvedBy = approverId;
      update.approvedAt = new Date();
    } else if (approvalStatus === APPROVAL_STATUS.PENDING) {
      // ❌ reset case (agar tum pending pe clean karna chahte ho)
      update.approvedBy = null;
      update.approvedAt = null;
    }
    // baaki negative statuses pe agar tum last approver ka record rakhna chahte ho
    // to unpe approvedBy/approvedAt ko chhedna nahi bhi chahoge

    const updated = await SurveyResponse.findByIdAndUpdate(
      responseId,
      update,
      {
        new: true,
        projection: {
          survey: 1,
          surveyCode: 1,
          userCode: 1,
          userName: 1,
          userMobile: 1,
          isCompleted: 1,
          isApproved: 1,
          approvalStatus: 1,
          approvedBy: 1,
          approvedAt: 1,   // ⭐ ensure ye include hai
          createdAt: 1,
        },
      }
    ).lean();

    if (!updated) {
      return res.status(404).json({ message: "Survey response not found." });
    }

    return res.json({
      message: `Response status set to ${approvalStatus}`,
      response: updated,
    });
  } catch (err) {
    console.error("publicSetSurveyResponseApproval error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

