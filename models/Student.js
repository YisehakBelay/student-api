const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  studentId: { type: String, unique: true, sparse: true, trim: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  age: { type: Number, min: 0 },
  gradeLevel: { type: Number, enum: [9, 10, 11, 12], required: true },
}, { timestamps: true });

studentSchema.pre("validate", function () {
  if (!this.studentId) {
    this.studentId = `STU${this._id.toString().slice(-10).toUpperCase()}`;
  }
});

module.exports = mongoose.model("Student", studentSchema);
