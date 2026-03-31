const express = require("express");
const mongoose = require("mongoose");
const studentRoutes = require("./routes/studentRoutes");

const app = express();

app.use(express.json());

// Debug middleware
app.use("/api/students", (req, res, next) => {
  console.log("✅ Route HIT:", req.method, req.url);
  next();
}, studentRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// MongoDB connection
mongoose.connect("mongodb://127.0.0.1:27017/studentDB")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});