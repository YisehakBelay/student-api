const express = require("express");
const router = express.Router();
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Attendance = require("../models/Attendance");
const { requireObjectId } = require("../utils/routeHelpers");

// GET all courses with enrollment count
router.get("/", async (req, res) => {
  try {
    const courses = await Course.find().sort({ year: -1, semester: 1, gradeLevel: 1, period: 1 });
    const result = await Promise.all(courses.map(async (c) => {
      const enrollmentCount = await Enrollment.countDocuments({ course: c._id });
      return { ...c.toObject(), enrollmentCount };
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single course
router.get("/:id", async (req, res) => {
  try {
    if (!requireObjectId(res, req.params.id, "course id")) return;
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET enrollments for a course (with student info and grades)
router.get("/:id/enrollments", async (req, res) => {
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

// POST create course
router.post("/", async (req, res) => {
  try {
    const course = new Course(req.body);
    const saved = await course.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update course
router.put("/:id", async (req, res) => {
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

// DELETE course (cascades related records)
router.delete("/:id", async (req, res) => {
  try {
    if (!requireObjectId(res, req.params.id, "course id")) return;
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    await Enrollment.deleteMany({ course: req.params.id });
    await Attendance.deleteMany({ course: req.params.id });
    res.json({ message: "Course deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
