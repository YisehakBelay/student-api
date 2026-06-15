const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const Enrollment = require("../models/Enrollment");
const { requireObjectId } = require("../utils/routeHelpers");
const { protect, authorize } = require("../middleware/auth");

// GET enrollments — filterable by ?course=id or ?student=id
// admin/teacher: any; student: only their own
router.get("/", protect, async (req, res) => {
  try {
    const filter = {};

    if (req.query.course) {
      if (!requireObjectId(res, req.query.course, "course id")) return;
      filter.course = req.query.course;
    }
    if (req.query.student) {
      if (!requireObjectId(res, req.query.student, "student id")) return;
      filter.student = req.query.student;
    }

    // Students may only see their own enrollments
    if (req.user.role === "student") {
      const linked = req.user.studentProfile?.toString();
      if (!linked) return res.status(403).json({ message: "No student profile linked to this account" });
      filter.student = linked;
    }

    const enrollments = await Enrollment.find(filter)
      .populate("student", "name email studentId gradeLevel age")
      .populate("course", "name subject teacherName gradeLevel semester year period credits");
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST enroll — admin only
router.post(
  "/",
  protect,
  authorize("admin"),
  [
    body("student").notEmpty().withMessage("Student id is required"),
    body("course").notEmpty().withMessage("Course id is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    try {
      if (!requireObjectId(res, req.body.student, "student id")) return;
      if (!requireObjectId(res, req.body.course, "course id")) return;
      const enrollment = new Enrollment({ student: req.body.student, course: req.body.course });
      const saved = await enrollment.save();
      const populated = await saved.populate([
        { path: "student", select: "name email studentId gradeLevel age" },
        { path: "course", select: "name subject teacherName gradeLevel semester year period credits" },
      ]);
      res.status(201).json(populated);
    } catch (err) {
      if (err.code === 11000) return res.status(400).json({ message: "Student is already enrolled in this course" });
      res.status(400).json({ message: err.message });
    }
  }
);

// PUT submit or update a grade — admin and teacher
router.put(
  "/:id/grade",
  protect,
  authorize("admin", "teacher"),
  [body("grade").isFloat({ min: 0, max: 100 }).withMessage("Grade must be a number between 0 and 100").toFloat()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    try {
      if (!requireObjectId(res, req.params.id, "enrollment id")) return;
      const updated = await Enrollment.findByIdAndUpdate(
        req.params.id,
        { grade: req.body.grade, gradeSubmitted: true, submittedAt: new Date() },
        { returnDocument: "after", runValidators: true }
      )
        .populate("student", "name email studentId gradeLevel age")
        .populate("course", "name subject teacherName gradeLevel semester year period credits");
      if (!updated) return res.status(404).json({ message: "Enrollment not found" });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

// DELETE remove a student from a course — admin only
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    if (!requireObjectId(res, req.params.id, "enrollment id")) return;
    const enrollment = await Enrollment.findByIdAndDelete(req.params.id);
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });
    res.json({ message: "Enrollment removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
