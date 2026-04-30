const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: String, required: true },
  teacherName: { type: String, required: true },
  // teacherId reserved for future teacher auth
  gradeLevel: { type: Number, enum: [9, 10, 11, 12], required: true },
  period: { type: Number, min: 1, max: 8 },
  credits: { type: Number, default: 1, min: 0.5, max: 4 },
  semester: { type: String, enum: ["Fall", "Spring"], required: true },
  year: { type: Number, required: true },
  description: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("Course", courseSchema);
