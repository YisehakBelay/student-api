const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Attendance = require("../models/Attendance");
const { requireObjectId } = require("../utils/routeHelpers");
const { protect, authorize } = require("../middleware/auth");

const courseValidation = [
  body("name").trim().notEmpty().withMessage("Course name is required"),
  body("subject").trim().notEmpty().withMessage("Subject is required"),
  body("teacherName").trim().notEmpty().withMessage("Teacher name is required"),
  body("gradeLevel").isIn([9, 10, 11, 12]).withMessage("Grade level must be 9, 10, 11, or 12").toInt(),
  body("semester").isIn(["Fall", "Spring"]).withMessage("Semester must be Fall or Spring"),
  body("year").isInt({ min: 2000, max: 2100 }).withMessage("Valid year is required").toInt(),
  body("period").optional().isInt({ min: 1, max: 8 }).withMessage("Period must be 1–8").toInt(),
  body("credits").optional().isFloat({ min: 0.5, max: 4 }).withMessage("Credits must be between 0.5 and 4").toFloat(),
];

// GET all — all authenticated users
router.get("/", protect, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const total   = await Course.countDocuments();
    const courses = await Course.find().sort({ year: -1, semester: 1, gradeLevel: 1, period: 1 }).skip(skip).limit(limit);

    const result = await Promise.all(courses.map(async (c) => {
      const enrollmentCount = await Enrollment.countDocuments({ course: c._id });
      return { ...c.toObject(), enrollmentCount };
    }));

    res.json({ data: result, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single — all authenticated users
router.get("/:id", protect, async (req, res) => {
  try {
    if (!requireObjectId(res, req.params.id, "course id")) return;
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET enrollments for a course — admin and teacher
router.get("/:id/enrollments", protect, authorize("admin", "teacher"), async (req, res) => {
  try {
    if (!requireObjectId(res, req.params.id, "course id")) return;
    const enrollments = await Enrollment.find({ course: req.params.id })
      .populate("student", "name email studentId gradeLevel age")
      .sort({ createdAt: 1 });
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create — admin only
router.post("/", protect, authorize("admin"), courseValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  try {
    const course = new Course(req.body);
    const saved = await course.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update — admin only
router.put("/:id", protect, authorize("admin"), courseValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  try {
    if (!requireObjectId(res, req.params.id, "course id")) return;
    const updated = await Course.findByIdAndUpdate(
      req.params.id, req.body, { returnDocument: "after", runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: "Course not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE — admin only
// Soft-deletes the course by default. Pass ?permanent=true to hard-delete with all related records.
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  if (!requireObjectId(res, req.params.id, "course id")) return;

  if (req.query.permanent === "true") {
    const session = await Course.startSession();
    try {
      await session.withTransaction(async () => {
        const course = await Course.findOneAndDelete(
          { _id: req.params.id, isDeleted: { $in: [true, false] } },
          { session }
        );
        if (!course) throw Object.assign(new Error("Course not found"), { statusCode: 404 });
        await Enrollment.deleteMany({ course: req.params.id }, { session });
        await Attendance.deleteMany({ course: req.params.id }, { session });
      });
      return res.json({ message: "Course and all related records permanently deleted" });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    } finally {
      session.endSession();
    }
  }

  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    await course.softDelete();
    res.json({ message: "Course deactivated (soft deleted)" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
