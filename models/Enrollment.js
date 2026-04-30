const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  // grade null = pending, 0-100 = submitted
  grade: { type: Number, min: 0, max: 100, default: null },
  gradeSubmitted: { type: Boolean, default: false },
  submittedAt: { type: Date, default: null },
}, { timestamps: true });

// Prevent duplicate enrollment in the same course
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = mongoose.model("Enrollment", enrollmentSchema);
