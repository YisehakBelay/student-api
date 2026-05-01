const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  course:  { type: mongoose.Schema.Types.ObjectId, ref: "Course",  required: true },
  date:    { type: Date, required: true },
  status:  { type: String, enum: ["present", "absent", "late", "excused"], required: true, default: "present" },
  note:    { type: String, default: "" },
}, { timestamps: true });

// One record per student per course per day
attendanceSchema.index({ student: 1, course: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
