const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const Attendance = require("../models/Attendance");
const { parseDateOnly, requireObjectId } = require("../utils/routeHelpers");
const { protect, authorize } = require("../middleware/auth");

const ATTENDANCE_STATUSES = new Set(["present", "absent", "late", "excused"]);

function normalizeAttendanceRecord(record, course, date) {
  return {
    student: record.student,
    course,
    date,
    status: record.status ?? "present",
    note: record.note ?? "",
  };
}

function validateStatus(res, status) {
  if (ATTENDANCE_STATUSES.has(status)) return true;
  res.status(400).json({ message: "Status must be present, absent, late, or excused" });
  return false;
}

const statusValidation = body("status")
  .optional()
  .isIn(["present", "absent", "late", "excused"])
  .withMessage("Status must be present, absent, late, or excused");

// GET attendance — filterable; students see only their own
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
    if (req.query.date) {
      const d = parseDateOnly(req.query.date);
      if (!d) return res.status(400).json({ message: "Invalid date" });
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      filter.date = { $gte: d, $lt: next };
    }

    if (req.user.role === "student") {
      const linked = req.user.studentProfile?.toString();
      if (!linked) return res.status(403).json({ message: "No student profile linked to this account" });
      filter.student = linked;
    }

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const skip  = (page - 1) * limit;
    const total = await Attendance.countDocuments(filter);

    const records = await Attendance.find(filter)
      .populate("student", "name email studentId gradeLevel")
      .populate("course", "name subject semester year period")
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ data: records, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create/upsert one record — admin and teacher
router.post(
  "/",
  protect,
  authorize("admin", "teacher"),
  [
    body("student").notEmpty().withMessage("Student id is required"),
    body("course").notEmpty().withMessage("Course id is required"),
    body("date").notEmpty().withMessage("Date is required"),
    statusValidation,
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    try {
      const { student, course, status } = req.body;
      if (!requireObjectId(res, student, "student id")) return;
      if (!requireObjectId(res, course, "course id")) return;
      const date = parseDateOnly(req.body.date);
      if (!date) return res.status(400).json({ message: "A valid date is required" });
      if (!validateStatus(res, status ?? "present")) return;

      const record = await Attendance.findOneAndUpdate(
        { student, course, date },
        { $set: normalizeAttendanceRecord(req.body, course, date) },
        { returnDocument: "after", runValidators: true, upsert: true, setDefaultsOnInsert: true }
      )
        .populate("student", "name email studentId gradeLevel")
        .populate("course", "name subject semester year period");
      res.status(201).json(record);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

// POST /bulk — admin and teacher
router.post("/bulk", protect, authorize("admin", "teacher"), async (req, res) => {
  try {
    const { course, date, records } = req.body;
    if (!course || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: "course, date, and records[] are required" });
    }
    if (!requireObjectId(res, course, "course id")) return;
    const dateObj = parseDateOnly(date);
    if (!dateObj) return res.status(400).json({ message: "Invalid date" });

    for (const record of records) {
      if (!requireObjectId(res, record.student, "student id")) return;
      if (!validateStatus(res, record.status ?? "present")) return;
    }

    const ops = records.map((r) => ({
      updateOne: {
        filter: { student: r.student, course, date: dateObj },
        update: { $set: normalizeAttendanceRecord(r, course, dateObj) },
        upsert: true,
      },
    }));
    await Attendance.bulkWrite(ops);

    const next = new Date(dateObj);
    next.setDate(next.getDate() + 1);
    const saved = await Attendance.find({ course, date: { $gte: dateObj, $lt: next } })
      .populate("student", "name email studentId gradeLevel");
    res.json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /course/:courseId/date/:date — admin and teacher
router.get("/course/:courseId/date/:date", protect, authorize("admin", "teacher"), async (req, res) => {
  try {
    if (!requireObjectId(res, req.params.courseId, "course id")) return;
    const date = parseDateOnly(req.params.date);
    if (!date) return res.status(400).json({ message: "Invalid date" });
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const records = await Attendance.find({
      course: req.params.courseId,
      date: { $gte: date, $lt: next },
    })
      .populate("student", "name email studentId gradeLevel")
      .populate("course", "name subject semester year period")
      .sort({ "student.name": 1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /summary/:studentId — admin, teacher, or the linked student
router.get("/summary/:studentId", protect, async (req, res) => {
  try {
    if (!requireObjectId(res, req.params.studentId, "student id")) return;

    if (req.user.role === "student") {
      const linked = req.user.studentProfile?.toString();
      if (!linked || linked !== req.params.studentId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const filter = { student: req.params.studentId };
    if (req.query.course) {
      if (!requireObjectId(res, req.query.course, "course id")) return;
      filter.course = req.query.course;
    }
    const records = await Attendance.find(filter);
    const total   = records.length;
    const count   = (s) => records.filter((r) => r.status === s).length;
    const present = count("present");
    const late    = count("late");
    const absent  = count("absent");
    const excused = count("excused");
    const pct     = total > 0 ? (((present + late) / total) * 100).toFixed(1) : null;
    res.json({ total, present, late, absent, excused, attendancePercent: pct });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /:id — admin and teacher
router.put(
  "/:id",
  protect,
  authorize("admin", "teacher"),
  [statusValidation],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    try {
      if (!requireObjectId(res, req.params.id, "attendance id")) return;
      const payload = { ...req.body };
      if (payload.date) {
        payload.date = parseDateOnly(payload.date);
        if (!payload.date) return res.status(400).json({ message: "Invalid date" });
      }
      const updated = await Attendance.findByIdAndUpdate(req.params.id, payload, {
        returnDocument: "after",
        runValidators: true,
      })
        .populate("student", "name email studentId gradeLevel")
        .populate("course", "name subject semester year period");
      if (!updated) return res.status(404).json({ message: "Record not found" });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

// DELETE /:id — admin and teacher
router.delete("/:id", protect, authorize("admin", "teacher"), async (req, res) => {
  try {
    if (!requireObjectId(res, req.params.id, "attendance id")) return;
    const deleted = await Attendance.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Record not found" });
    res.json({ message: "Record deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
