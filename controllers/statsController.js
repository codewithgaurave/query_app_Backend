// controllers/statsController.js
import mongoose from "mongoose";
import Survey from "../models/Survey.js";
import SurveyResponse from "../models/SurveyResponse.js";
import User from "../models/User.js";

// ------------ DATE HELPERS --------------

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

const getMonthRange = (date = new Date()) => {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { startOfMonth, endOfMonth };
};

const getYearRange = (date = new Date()) => {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const endOfYear = new Date(date.getFullYear() + 1, 0, 1);
  return { startOfYear, endOfYear };
};

const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ✅ helper: Mongo _id ya surveyCode se survey laao
const findSurveyByIdOrCode = async (surveyIdOrCode) => {
  if (mongoose.Types.ObjectId.isValid(surveyIdOrCode)) {
    return Survey.findById(surveyIdOrCode).lean();
  }
  return Survey.findOne({ surveyCode: surveyIdOrCode }).lean();
};

// ----------------------------------------
// 1) USER WISE SURVEY STATS (by userCode)
//    GET /api/stats/user/:userCode
// ----------------------------------------
export const getUserSurveyStats = async (req, res) => {
  try {
    const { userCode } = req.params;

    if (!userCode) {
      return res.status(400).json({ message: "userCode is required" });
    }

    // SURVEY_USER / QE sab ke stats de sakte ho, but yaha atleast user exist check
    const user = await User.findOne({ userCode }).lean();
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found for this userCode" });
    }

    const now = new Date();
    const { startOfDay, endOfDay } = getTodayRange();
    const { startOfMonth, endOfMonth } = getMonthRange(now);
    const { startOfYear, endOfYear } = getYearRange(now);

    const [
      // responses related
      totalResponses,
      todayResponses,
      thisMonthResponses,
      thisYearResponses,
      overallAgg,
      monthWiseAgg,
      yearWiseAgg,
      // 🔴 NEW: system-wide survey counts
      totalSurveysInSystem,
      activeSurveysInSystem,
    ] = await Promise.all([
      // total
      SurveyResponse.countDocuments({ userCode }),

      // today
      SurveyResponse.countDocuments({
        userCode,
        createdAt: { $gte: startOfDay, $lt: endOfDay },
      }),

      // this month
      SurveyResponse.countDocuments({
        userCode,
        createdAt: { $gte: startOfMonth, $lt: endOfMonth },
      }),

      // this year
      SurveyResponse.countDocuments({
        userCode,
        createdAt: { $gte: startOfYear, $lt: endOfYear },
      }),

      // overall aggregation for distinct surveys + lastResponseAt
      SurveyResponse.aggregate([
        { $match: { userCode } },
        {
          $group: {
            _id: null,
            totalResponses: { $sum: 1 },
            distinctSurveys: { $addToSet: "$survey" },
            lastResponseAt: { $max: "$createdAt" },
          },
        },
      ]),

      // month-wise
      SurveyResponse.aggregate([
        { $match: { userCode } },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            totalResponses: { $sum: 1 },
            distinctSurveys: { $addToSet: "$survey" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      // year-wise
      SurveyResponse.aggregate([
        { $match: { userCode } },
        {
          $group: {
            _id: { year: { $year: "$createdAt" } },
            totalResponses: { $sum: 1 },
            distinctSurveys: { $addToSet: "$survey" },
          },
        },
        { $sort: { "_id.year": 1 } },
      ]),

      // 🔴 NEW: system me total kitne survey
      Survey.countDocuments({}),

      // 🔴 NEW: system me kitne survey active (isActive + status ACTIVE)
      Survey.countDocuments({ isActive: true, status: "ACTIVE" }),
    ]);

    const overall = overallAgg[0] || {
      totalResponses: 0,
      distinctSurveys: [],
      lastResponseAt: null,
    };

    const breakdownByMonth = monthWiseAgg.map((m) => ({
      year: m._id.year,
      month: m._id.month,
      label: `${monthNames[m._id.month - 1]} ${m._id.year}`,
      totalResponses: m.totalResponses,
      totalSurveysAttempted: (m.distinctSurveys || []).length,
    }));

    const breakdownByYear = yearWiseAgg.map((y) => ({
      year: y._id.year,
      totalResponses: y.totalResponses,
      totalSurveysAttempted: (y.distinctSurveys || []).length,
    }));

    return res.json({
      user: {
        id: user._id,
        userCode: user.userCode,
        fullName: user.fullName,
        mobile: user.mobile,
        role: user.role,
        isActive: user.isActive,
      },
      counts: {
        today: todayResponses,
        thisMonth: thisMonthResponses,
        thisYear: thisYearResponses,
        total: totalResponses,
      },
      meta: {
        totalSurveysAttempted: (overall.distinctSurveys || []).length,
        lastResponseAt: overall.lastResponseAt || null,
      },
      // 🔴 NEW: system-wide survey info for context
      systemSurveys: {
        total: totalSurveysInSystem,           // ab tak system me total kitne survey
        active: activeSurveysInSystem,         // abhi kitne survey active / live
      },
      breakdown: {
        byMonth: breakdownByMonth,
        byYear: breakdownByYear,
      },
    });
  } catch (err) {
    console.error("getUserSurveyStats error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------------
// 2) PLATFORM WIDE STATS
//    GET /api/stats/platform
// ----------------------------------------
export const getPlatformStats = async (_req, res) => {
  try {
    const { startOfDay, endOfDay } = getTodayRange();

    const [
      totalSurveys,
      activeSurveys,
      liveSurveys, // isActive + status ACTIVE
      closedSurveys,
      totalResponses,
      todayResponses,
      totalUsers,
      activeUsers,
      surveyUsers,
      qualityEngineers,
    ] = await Promise.all([
      Survey.countDocuments({}),
      Survey.countDocuments({ isActive: true }),
      Survey.countDocuments({ isActive: true, status: "ACTIVE" }),
      Survey.countDocuments({ status: "CLOSED" }),
      SurveyResponse.countDocuments({}),
      SurveyResponse.countDocuments({
        createdAt: { $gte: startOfDay, $lt: endOfDay },
      }),
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: "SURVEY_USER" }),
      User.countDocuments({ role: "QUALITY_ENGINEER" }),
    ]);

    return res.json({
      // 🔴 NEW: clear summary for your requirement
      systemSurveys: {
        total: totalSurveys,   // ab tak system me total kitne survey
        active: liveSurveys,   // abhi kitne survey action/active (status ACTIVE + isActive)
      },
      surveys: {
        total: totalSurveys,
        active: activeSurveys, // koi bhi isActive === true
        live: liveSurveys,     // isActive + status: "ACTIVE"
        closed: closedSurveys,
      },
      responses: {
        total: totalResponses,
        today: todayResponses,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        surveyUsers,
        qualityEngineers,
      },
    });
  } catch (err) {
    console.error("getPlatformStats error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------------
// 3) SURVEY WISE STATS (by id or surveyCode)
//    GET /api/stats/survey/:surveyIdOrCode
// ----------------------------------------
export const getSurveyStats = async (req, res) => {
  try {
    const { surveyIdOrCode } = req.params;

    const survey = await findSurveyByIdOrCode(surveyIdOrCode);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    const { startOfDay, endOfDay } = getTodayRange();
    const now = new Date();
    const { startOfMonth, endOfMonth } = getMonthRange(now);
    const { startOfYear, endOfYear } = getYearRange(now);

    const [
      totalResponses,
      todayResponses,
      thisMonthResponses,
      thisYearResponses,
      overallAgg,
      userWiseAgg,
    ] = await Promise.all([
      SurveyResponse.countDocuments({ survey: survey._id }),
      SurveyResponse.countDocuments({
        survey: survey._id,
        createdAt: { $gte: startOfDay, $lt: endOfDay },
      }),
      SurveyResponse.countDocuments({
        survey: survey._id,
        createdAt: { $gte: startOfMonth, $lt: endOfMonth },
      }),
      SurveyResponse.countDocuments({
        survey: survey._id,
        createdAt: { $gte: startOfYear, $lt: endOfYear },
      }),
      SurveyResponse.aggregate([
        { $match: { survey: survey._id } },
        {
          $group: {
            _id: null,
            totalResponses: { $sum: 1 },
            distinctUsers: { $addToSet: "$userCode" },
            lastResponseAt: { $max: "$createdAt" },
          },
        },
      ]),
      // top users for this survey
      SurveyResponse.aggregate([
        { $match: { survey: survey._id } },
        {
          $group: {
            _id: "$userCode",
            totalResponses: { $sum: 1 },
            lastResponseAt: { $max: "$createdAt" },
          },
        },
        { $sort: { totalResponses: -1 } },
        { $limit: 20 },
      ]),
    ]);

    const overall = overallAgg[0] || {
      totalResponses: 0,
      distinctUsers: [],
      lastResponseAt: null,
    };

    return res.json({
      survey: {
        id: survey._id,
        surveyCode: survey.surveyCode,
        name: survey.name,
        status: survey.status,
        category: survey.category,
        projectName: survey.projectName,
        isActive: survey.isActive,
      },
      counts: {
        today: todayResponses,
        thisMonth: thisMonthResponses,
        thisYear: thisYearResponses,
        total: totalResponses,
      },
      meta: {
        totalParticipants: (overall.distinctUsers || []).length,
        lastResponseAt: overall.lastResponseAt || null,
      },
      topUsers: userWiseAgg.map((u) => ({
        userCode: u._id,
        totalResponses: u.totalResponses,
        lastResponseAt: u.lastResponseAt,
      })),
    });
  } catch (err) {
    console.error("getSurveyStats error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
