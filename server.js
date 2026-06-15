require("dotenv").config();

// ── Startup env validation ────────────────────────────────────────────────────
const REQUIRED_ENV = ["JWT_SECRET"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");
const morgan   = require("morgan");

const swaggerUi  = require("swagger-ui-express");
const swaggerSpec = require("./docs/swagger");
const rateLimit   = require("express-rate-limit");

const authRoutes       = require("./routes/authRoutes");
const studentRoutes    = require("./routes/studentRoutes");
const courseRoutes     = require("./routes/courseRoutes");
const enrollmentRoutes = require("./routes/enrollmentRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const feeRoutes        = require("./routes/feeRoutes");

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:5173,http://localhost:5000")
  .split(",")
  .map((o) => o.trim());

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
}));

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json());

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use("/api/auth", rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: "Too many auth attempts, please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use("/api/", rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  message: { message: "Too many requests, please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ message: "StudentHub API is running", version: "2.0.0", docs: "/api/docs" }));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/auth",       authRoutes);
app.use("/api/students",   studentRoutes);
app.use("/api/courses",    courseRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/fees",       feeRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ── Centralized error handler ─────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.statusCode || err.status || 500;
  console.error(`[${new Date().toISOString()}] ${err.stack || err.message}`);
  res.status(status).json({
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// ── Database + start ──────────────────────────────────────────────────────────
// Only connect and listen when run directly (not when required by tests)
if (require.main === module) {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/studentDB";
  const PORT      = process.env.PORT || 5000;

  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log("MongoDB connected");
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => {
      console.error("MongoDB connection failed:", err.message);
      process.exit(1);
    });
}

module.exports = app;
