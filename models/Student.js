const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  studentId:  { type: String, unique: true, sparse: true, trim: true },
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  age:        { type: Number, min: 0 },
  gradeLevel: { type: Number, enum: [9, 10, 11, 12], required: true },
  isDeleted:  { type: Boolean, default: false, index: true },
  deletedAt:  { type: Date, default: null },
}, { timestamps: true });

studentSchema.pre("validate", function () {
  if (!this.studentId) {
    this.studentId = `STU${this._id.toString().slice(-10).toUpperCase()}`;
  }
});

// Scope all queries to non-deleted records by default
studentSchema.pre(/^find/, function () {
  if (this.getFilter().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
});

// Soft-delete helper: student.softDelete() instead of student.deleteOne()
studentSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

module.exports = mongoose.model("Student", studentSchema);
