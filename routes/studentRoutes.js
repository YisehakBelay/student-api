const express = require("express");
const router = express.Router();
const Student = require("../models/Student");
const Enrollment = require("../models/Enrollment");

function gradeToPoints(grade) {
  if (grade >= 90) return 4.0;
  if (grade >= 80) return 3.0;
  if (grade >= 70) return 2.0;
  if (grade >= 60) return 1.0;
  return 0.0;
}

// POST create
router.post("/", async (req, res) => {
  try {
    const student = new Student(req.body);
    const saved = await student.save();
    res.json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET all (with calculated GPA)
router.get("/", async (req, res) => {
  try {
    const students = await Student.find().sort({ gradeLevel: 1, name: 1 });
    const result = await Promise.all(students.map(async (s) => {
      const enrollments = await Enrollment.find({ student: s._id, gradeSubmitted: true })
        .populate("course", "credits");
      let gpa = null;
      if (enrollments.length > 0) {
        let totalPoints = 0, totalCredits = 0;
        for (const e of enrollments) {
          const credits = e.course?.credits ?? 1;
          totalPoints += gradeToPoints(e.grade) * credits;
          totalCredits += credits;
        }
        gpa = totalCredits > 0 ? parseFloat((totalPoints / totalCredits).toFixed(2)) : null;
      }
      return { ...s.toObject(), gpa };
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single
router.get("/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET student's enrolled courses with grades
router.get("/:id/courses", async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ student: req.params.id })
      .populate("course")
      .sort({ createdAt: -1 });
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update
router.put("/:id", async (req, res) => {
  try {
    const updated = await Student.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: "Student not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE (cascades enrollments)
router.delete("/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    await Enrollment.deleteMany({ student: req.params.id });
    res.json({ message: "Student deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
