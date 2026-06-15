const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const Student = require("../models/Student");
const Enrollment = require("../models/Enrollment");
const Attendance = require("../models/Attendance");
const Fee = require("../models/Fee");
const { duplicateKeyMessage, requireObjectId } = require("../utils/routeHelpers");
const { protect, authorize } = require("../middleware/auth");

function gradeToPoints(grade) {
  if (grade >= 90) return 4.0;
  if (grade >= 80) return 3.0;
  if (grade >= 70) return 2.0;
  if (grade >= 60) return 1.0;
  return 0.0;
}

function normalizeStudentPayload(body) {
  const payload = { ...body };
  if (payload.gradeLevel === undefined && payload.grade !== undefined) {
    payload.gradeLevel = payload.grade;
  }
  if (payload.gradeLevel !== undefined) payload.gradeLevel = Number(payload.gradeLevel);
  if (payload.age === "" || payload.age === null) delete payload.age;
  if (payload.age !== undefined) payload.age = Number(payload.age);
  if (typeof payload.name === "string") payload.name = payload.name.trim();
  if (typeof payload.email === "string") payload.email = payload.email.trim().toLowerCase();
  return payload;
}

const studentValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("gradeLevel")
    .isIn([9, 10, 11, 12])
    .withMessage("Grade level must be 9, 10, 11, or 12")
    .toInt(),
  body("age").optional({ nullable: true, checkFalsy: true }).isInt({ min: 0 }).withMessage("Age must be a positive number").toInt(),
];

// POST — admin only
router.post(
  "/",
  protect,
  authorize("admin"),
  studentValidation,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    try {
      const student = new Student(normalizeStudentPayload(req.body));
      const saved = await student.save();
      res.status(201).json(saved);
    } catch (err) {
      const duplicate = duplicateKeyMessage(err);
      if (duplicate) return res.status(400).json({ message: duplicate });
      res.status(400).json({ message: err.message });
    }
  }
);

// GET all — admin and teacher
router.get("/", protect, authorize("admin", "teacher"), async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const total    = await Student.countDocuments();
    const students = await Student.find().sort({ gradeLevel: 1, name: 1 }).skip(skip).limit(limit);

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

    res.json({ data: result, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single — admin, teacher, or the linked student
router.get("/:id", protect, async (req, res) => {
  try {
    if (!requireObjectId(res, req.params.id, "student id")) return;

    // students can only view their own profile
    if (req.user.role === "student") {
      const linked = req.user.studentProfile?.toString();
      if (!linked || linked !== req.params.id) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET student's enrolled courses — admin, teacher, or the linked student
router.get("/:id/courses", protect, async (req, res) => {
  try {
    if (!requireObjectId(res, req.params.id, "student id")) return;

    if (req.user.role === "student") {
      const linked = req.user.studentProfile?.toString();
      if (!linked || linked !== req.params.id) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const enrollments = await Enrollment.find({ student: req.params.id })
      .populate("course")
      .sort({ createdAt: -1 });
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update — admin only
router.put(
  "/:id",
  protect,
  authorize("admin"),
  studentValidation,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    try {
      if (!requireObjectId(res, req.params.id, "student id")) return;
      const updated = await Student.findByIdAndUpdate(
        req.params.id, normalizeStudentPayload(req.body), { returnDocument: "after", runValidators: true }
      );
      if (!updated) return res.status(404).json({ message: "Student not found" });
      res.json(updated);
    } catch (err) {
      const duplicate = duplicateKeyMessage(err);
      if (duplicate) return res.status(400).json({ message: duplicate });
      res.status(400).json({ message: err.message });
    }
  }
);

// DELETE — admin only
// Soft-deletes the student record (sets isDeleted=true, preserves all related records).
// Pass ?permanent=true to hard-delete the student AND all related records (irreversible).
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  if (!requireObjectId(res, req.params.id, "student id")) return;

  if (req.query.permanent === "true") {
    const session = await Student.startSession();
    try {
      await session.withTransaction(async () => {
        const student = await Student.findOneAndDelete(
          { _id: req.params.id, isDeleted: { $in: [true, false] } },
          { session }
        );
        if (!student) throw Object.assign(new Error("Student not found"), { statusCode: 404 });
        await Enrollment.deleteMany({ student: req.params.id }, { session });
        await Attendance.deleteMany({ student: req.params.id }, { session });
        await Fee.deleteMany({ student: req.params.id }, { session });
      });
      return res.json({ message: "Student and all related records permanently deleted" });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    } finally {
      session.endSession();
    }
  }

  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    await student.softDelete();
    res.json({ message: "Student deactivated (soft deleted)" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
