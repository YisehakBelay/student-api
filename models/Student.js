const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  studentId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  age: { type: Number },
  gradeLevel: { type: Number, enum: [9, 10, 11, 12], required: true },
}, { timestamps: true });

studentSchema.pre("save", async function (next) {
  if (!this.studentId) {
    const count = await mongoose.model("Student").countDocuments();
    this.studentId = `STU${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

module.exports = mongoose.model("Student", studentSchema);
