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

// ✅ Helper: today ka start/end (calendar day based, server timezone)
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

// ✅ SINGLE endpoint: /admin/dashboard/overview
//  - summary (users, surveys, punchIns, responses)
//  - trends (daily punch-ins, daily responses for range)
//  - surveyPerformance (per survey responses + lastResponseAt)
//  - surveyUserActivity (per SURVEY_USER activity)
export const getAdminDashboardOverview = async (req, res) => {
  try {
    const auth = await ensureAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.message });
    }

    const { range = "30d" } = req.query;
    const rangeMap = { "7d": 7, "30d": 30, "90d": 90, "180d": 180 };
    const days = rangeMap[range] || 30;

    const { startOfDay, endOfDay } = getTodayRange();
    const fromDate = getFromDate(days);

    // ---- BASIC COUNTS ----
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
      surveyStatusAgg,
      punchSeriesAgg,
      responseSeriesAgg,
      surveyResponseAgg,
      responseAggByUser,
      punchAggByUser,
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

      // survey status breakdown
      Survey.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),

      // punch-in daily series
      PunchIn.aggregate([
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
      ]),

      // responses daily series
      SurveyResponse.aggregate([
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
      ]),

      // survey wise performance
      SurveyResponse.aggregate([
        {
          $group: {
            _id: "$survey",
            totalResponses: { $sum: 1 },
            lastResponseAt: { $max: "$createdAt" },
          },
        },
      ]),

      // responses grouped by user
      SurveyResponse.aggregate([
        {
          $group: {
            _id: "$userCode",
            totalResponses: { $sum: 1 },
            uniqueSurveys: { $addToSet: "$survey" },
            lastResponseAt: { $max: "$createdAt" },
          },
        },
      ]),

      // punch-ins grouped by user
      PunchIn.aggregate([
        {
          $group: {
            _id: "$userCode",
            totalPunchIns: { $sum: 1 },
            lastPunchAt: { $max: "$createdAt" },
          },
        },
      ]),
    ]);

    // ---- SURVEY STATUS BREAKDOWN ----
    const surveyStatusBreakdown = surveyStatusAgg.map((s) => ({
      status: s._id || "UNKNOWN",
      count: s.count,
    }));

    // ---- TRENDS ----
    const trends = {
      punchInsDaily: punchSeriesAgg.map((d) => ({
        date: d._id,
        count: d.count,
      })),
      responsesDaily: responseSeriesAgg.map((d) => ({
        date: d._id,
        count: d.count,
      })),
    };

    // ---- SURVEY PERFORMANCE DETAILS ----
    const surveyIds = surveyResponseAgg.map((a) => a._id);
    const surveyDocs = await Survey.find(
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
      surveyDocs.map((s) => [String(s._id), s])
    );

    const surveyPerformance = surveyResponseAgg
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

    // ---- USER ACTIVITY ----
    const userCodesSet = new Set();
    responseAggByUser.forEach((r) => userCodesSet.add(r._id));
    punchAggByUser.forEach((p) => userCodesSet.add(p._id));
    const userCodes = Array.from(userCodesSet);

    const userDocs = await User.find(
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

    const userMap = new Map(userDocs.map((u) => [u.userCode, u]));
    const punchMap = new Map(punchAggByUser.map((p) => [p._id, p]));

    const surveyUserActivity = responseAggByUser
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

    // ---- FINAL RESPONSE ----
    return res.json({
      range,
      days,
      summary: {
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
          statusBreakdown: surveyStatusBreakdown,
        },
        responses: {
          total: totalResponses,
          today: todayResponses,
        },
        punchIns: {
          total: totalPunchIns,
          today: todayPunchIns,
        },
      },
      trends,
      surveyPerformance,
      surveyUserActivity,
    });
  } catch (err) {
    console.error("getAdminDashboardOverview error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
