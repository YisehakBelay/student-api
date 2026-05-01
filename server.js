require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const studentRoutes    = require("./routes/studentRoutes");
const courseRoutes     = require("./routes/courseRoutes");
const enrollmentRoutes = require("./routes/enrollmentRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const feeRoutes        = require("./routes/feeRoutes");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
}));
app.use(express.json());

app.use("/api/students",   studentRoutes);
app.use("/api/courses",    courseRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/fees",       feeRoutes);

app.get("/", (req, res) => res.send("StudentHub API is running..."));

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/studentDB";
const PORT = process.env.PORT || 5000;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
