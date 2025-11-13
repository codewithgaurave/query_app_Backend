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

const app = express();

// Security & logs
app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(morgan("dev"));

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limit for login endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use("/api/admin/login", authLimiter);
app.use("/api/user/login", authLimiter);

// Connect DB
await connectDB();

// Mount routes
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/punchin", punchInRoutes);
app.use("/api/survey", surveyRoutes);

app.get("/", (_req, res) => res.send("✅ API is running..."));
app.get("/health", (_req, res) =>
  res.json({ status: "OK", time: new Date().toISOString() })
);

app.use((req, res) =>
  res
    .status(404)
    .json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
);

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on :${PORT}`));
