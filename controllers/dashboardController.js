// controllers/dashboardController.js
import mongoose from "mongoose";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import Survey from "../models/Survey.js";
import SurveyResponse from "../models/SurveyResponse.js";
import PunchIn from "../models/PunchIn.js";

// ✅ Helper: ensure request is from a valid Admin
const ensureAdmin = async (req) => {
  const adminId = req.user?.sub;
  if (!adminId) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const admin = await Admin.findById(adminId).lean();
  if (!admin) {
    return { ok: false, status: 401, message: "Admin no longer exists" };
  }

  return { ok: true, admin };
};

// ✅ Helper: today ka start/end (calendar day based)
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

// ✅ Helper: pichhle `days` din ka fromDate
const getFromDate = (days = 30) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - Number(days || 30) + 1);
  return d;
};

// ✅ 1) Dashboard overview (cards / tiles)
//    - Total users, active users, SURVEY_USER count, QUALITY_ENGINEER count
//    - Total surveys, active surveys, draft/closed
//    - Total survey responses
//    - Total punch-ins
//    - Aaj ke punch-ins & aaj ke responses
export const getDashboardOverview = async (req, res) => {
  try {
    const auth = await ensureAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.message });
    }

    const { startOfDay, endOfDay } = getTodayRange();

    const [
      totalUsers,
      activeUsers,
      surveyUsers,
      qualityEngineers,
      totalSurveys,
      activeSurveys,
      draftSurveys,
      closedSurveys,
      totalResponses,
      totalPunchIns,
      todayPunchIns,
      todayResponses,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: "SURVEY_USER" }),
      User.countDocuments({ role: "QUALITY_ENGINEER" }),
      Survey.countDocuments({}),
      Survey.countDocuments({ isActive: true }),
      Survey.countDocuments({ status: "DRAFT" }),
      Survey.countDocuments({ status: "CLOSED" }),
      SurveyResponse.countDocuments({}),
      PunchIn.countDocuments({}),
      PunchIn.countDocuments({
        createdAt: { $gte: startOfDay, $lt: endOfDay },
      }),
      SurveyResponse.countDocuments({
        createdAt: { $gte: startOfDay, $lt: endOfDay },
      }),
    ]);

    return res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        surveyUsers,
        qualityEngineers,
      },
      surveys: {
        total: totalSurveys,
        active: activeSurveys,
        draft: draftSurveys,
        closed: closedSurveys,
      },
      responses: {
        total: totalResponses,
        today: todayResponses,
      },
      punchIns: {
        total: totalPunchIns,
        today: todayPunchIns,
      },
    });
  } catch (err) {
    console.error("getDashboardOverview error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ 2) Punch-in time series (graph ke liye)
//    /dashboard/punchins/timeseries?days=30
//    returns: [{ date: "2025-01-01", count: 10 }, ...]
export const getPunchInTimeSeries = async (req, res) => {
  try {
    const auth = await ensureAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.message });
    }

    const days = Number(req.query.days || 30);
    const fromDate = getFromDate(days);

    const data = await PunchIn.aggregate([
      {
        $match: {
          createdAt: { $gte: fromDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const series = data.map((d) => ({
      date: d._id,
      count: d.count,
    }));

    return res.json({ fromDate, days, series });
  } catch (err) {
    console.error("getPunchInTimeSeries error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ 3) Survey response time series (overall or specific survey)
//    /dashboard/responses/timeseries?days=30
//    /dashboard/responses/timeseries?days=30&surveyIdOrCode=SRV-XXXX
export const getSurveyResponseTimeSeries = async (req, res) => {
  try {
    const auth = await ensureAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.message });
    }

    const days = Number(req.query.days || 30);
    const fromDate = getFromDate(days);
    const { surveyIdOrCode } = req.query;

    const match = {
      createdAt: { $gte: fromDate },
    };

    // optional survey filter
    if (surveyIdOrCode) {
      if (mongoose.Types.ObjectId.isValid(surveyIdOrCode)) {
        match.survey = new mongoose.Types.ObjectId(surveyIdOrCode);
      } else {
        // lookup by surveyCode -> get _id list first
        const survey = await Survey.findOne(
          { surveyCode: surveyIdOrCode },
          { _id: 1 }
        ).lean();
        if (!survey) {
          return res.status(404).json({ message: "Survey not found." });
        }
        match.survey = survey._id;
      }
    }

    const data = await SurveyResponse.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const series = data.map((d) => ({
      date: d._id,
      count: d.count,
    }));

    return res.json({
      fromDate,
      days,
      filter: { surveyIdOrCode: surveyIdOrCode || null },
      series,
    });
  } catch (err) {
    console.error("getSurveyResponseTimeSeries error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ 4) Survey-wise performance summary
//    - Har survey ka totalResponses, lastResponseAt
//    - Frontend isko table + bar chart dono me dikha sakta hai
export const getSurveyPerformance = async (req, res) => {
  try {
    const auth = await ensureAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.message });
    }

    const agg = await SurveyResponse.aggregate([
      {
        $group: {
          _id: "$survey",
          totalResponses: { $sum: 1 },
          lastResponseAt: { $max: "$createdAt" },
        },
      },
    ]);

    const surveyIds = agg.map((a) => a._id);
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

    const surveyMap = new Map(
      surveys.map((s) => [String(s._id), s])
    );

    const result = agg
      .map((a) => {
        const s = surveyMap.get(String(a._id));
        if (!s) return null;
        return {
          surveyId: s._id,
          surveyCode: s.surveyCode,
          name: s.name,
          status: s.status,
          category: s.category,
          projectName: s.projectName,
          totalResponses: a.totalResponses,
          lastResponseAt: a.lastResponseAt,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.totalResponses - a.totalResponses);

    return res.json({ surveys: result });
  } catch (err) {
    console.error("getSurveyPerformance error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ 5) SURVEY_USER activity summary
//    - Har SURVEY_USER ke liye: kitne surveys ka response, total responses, total punch-ins, lastActiveAt
//    - Dashboard me "Top Active Surveyors" type ka graph/showcase
export const getSurveyUserActivity = async (req, res) => {
  try {
    const auth = await ensureAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.message });
    }

    // responses grouped by userCode
    const responseAgg = await SurveyResponse.aggregate([
      {
        $group: {
          _id: "$userCode",
          totalResponses: { $sum: 1 },
          uniqueSurveys: { $addToSet: "$survey" },
          lastResponseAt: { $max: "$createdAt" },
        },
      },
    ]);

    // punch-ins grouped by userCode
    const punchAgg = await PunchIn.aggregate([
      {
        $group: {
          _id: "$userCode",
          totalPunchIns: { $sum: 1 },
          lastPunchAt: { $max: "$createdAt" },
        },
      },
    ]);

    const userCodesSet = new Set();
    responseAgg.forEach((r) => userCodesSet.add(r._id));
    punchAgg.forEach((p) => userCodesSet.add(p._id));
    const userCodes = Array.from(userCodesSet);

    const users = await User.find(
      { userCode: { $in: userCodes } },
      {
        userCode: 1,
        fullName: 1,
        mobile: 1,
        role: 1,
        isActive: 1,
        profilePhotoUrl: 1,
      }
    ).lean();

    const userMap = new Map(users.map((u) => [u.userCode, u]));

    const punchMap = new Map(punchAgg.map((p) => [p._id, p]));

    const result = responseAgg
      .map((r) => {
        const u = userMap.get(r._id);
        if (!u) return null;

        const p = punchMap.get(r._id);
        const lastActivity = new Date(
          Math.max(
            r.lastResponseAt ? r.lastResponseAt.getTime() : 0,
            p?.lastPunchAt ? p.lastPunchAt.getTime() : 0
          )
        );

        return {
          userCode: u.userCode,
          userName: u.fullName,
          mobile: u.mobile,
          role: u.role,
          isActive: u.isActive,
          profilePhotoUrl: u.profilePhotoUrl,
          totalResponses: r.totalResponses,
          totalSurveysAttempted: (r.uniqueSurveys || []).length,
          totalPunchIns: p?.totalPunchIns || 0,
          lastResponseAt: r.lastResponseAt,
          lastPunchAt: p?.lastPunchAt || null,
          lastActivityAt: isNaN(lastActivity.getTime())
            ? null
            : lastActivity,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.totalResponses - a.totalResponses);

    return res.json({ users: result });
  } catch (err) {
    console.error("getSurveyUserActivity error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
