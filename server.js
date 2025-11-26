import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";

// Routes
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import punchInRoutes from "./routes/punchInRoutes.js";
import surveyRoutes from "./routes/surveyRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js"; // ✅ NEW
import helpRoutes from "./routes/helpRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";

const app = express();

// 🔐 Security headers
app.use(helmet());

// 🌐 CORS config
const FRONTEND_ORIGIN = "https://query-qc-panel.onrender.com";

const corsOptions = {
  origin: FRONTEND_ORIGIN, // ✅ only this frontend allowed
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], // ✅ all common methods
  allowedHeaders: ["Content-Type", "Authorization"], // ✅ adjust if you use more custom headers
  credentials: true, // ✅ allow cookies / Authorization header
};

app.use(cors(corsOptions));
// Preflight ke liye OPTIONS requests ko bhi allow karo
app.options("*", cors(corsOptions));

// 📜 Logs
app.use(morgan("dev"));

// 🧾 Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ⏱️ Rate limit for login endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100, // max 100 requests per window per IP
});

app.use("/api/admin/login", authLimiter);
app.use("/api/user/login", authLimiter);

// 🗄️ Connect DB
await connectDB();

// 🛣️ Mount routes
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/punchin", punchInRoutes);
app.use("/api/survey", surveyRoutes);
app.use("/api/help", helpRoutes);
app.use("/api/stats", statsRoutes);

// ✅ Dashboard routes: final path = /api/admin/dashboard/overview
app.use("/api/admin/dashboard", dashboardRoutes);

// ✅ Health / root checks
app.get("/", (_req, res) => res.send("✅ API is running..."));
app.get("/health", (_req, res) =>
  res.json({ status: "OK", time: new Date().toISOString() })
);

// 404 handler
app.use((req, res) =>
  res
    .status(404)
    .json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// 🚀 Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on :${PORT}`));
