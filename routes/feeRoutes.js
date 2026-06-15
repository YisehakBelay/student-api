const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const Fee = require("../models/Fee");
const { parseDateOnly, requireObjectId } = require("../utils/routeHelpers");
const { protect, authorize } = require("../middleware/auth");

function buildFeeFilter(query, res) {
  const filter = {};
  if (query.student) {
    if (!requireObjectId(res, query.student, "student id")) return null;
    filter.student = query.student;
  }
  if (query.semester) filter.semester = query.semester;
  if (query.category) filter.category = query.category;
  if (query.year) filter.year = parseInt(query.year, 10);
  return filter;
}

function normalizeFeePayload(body) {
  const payload = { ...body };
  if (payload.totalAmount !== undefined) payload.totalAmount = Number(payload.totalAmount);
  if (payload.paidAmount  !== undefined) payload.paidAmount  = Number(payload.paidAmount);
  if (payload.year !== undefined && payload.year !== "") payload.year = Number(payload.year);
  if (payload.year === "") delete payload.year;
  if (payload.dueDate) payload.dueDate = parseDateOnly(payload.dueDate);
  if (typeof payload.description === "string") payload.description = payload.description.trim();
  return payload;
}

const feeValidation = [
  body("student").notEmpty().withMessage("Student id is required"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("totalAmount").isFloat({ min: 0 }).withMessage("Total amount must be a non-negative number").toFloat(),
  body("category")
    .optional()
    .isIn(["tuition", "registration", "lab", "library", "sports", "other"])
    .withMessage("Invalid category"),
  body("semester").optional().isIn(["Fall", "Spring"]).withMessage("Semester must be Fall or Spring"),
  body("year").optional().isInt({ min: 2000, max: 2100 }).withMessage("Valid year is required").toInt(),
];

// GET fees — admin sees all; student sees only their own
router.get("/", protect, async (req, res) => {
  try {
    const filter = buildFeeFilter(req.query, res);
    if (!filter) return;

    if (req.user.role === "student") {
      const linked = req.user.studentProfile?.toString();
      if (!linked) return res.status(403).json({ message: "No student profile linked to this account" });
      filter.student = linked;
    }

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;
    const total = await Fee.countDocuments(filter);

    const fees = await Fee.find(filter)
      .populate("student", "name email studentId gradeLevel")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ data: fees, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /summary — admin only
router.get("/summary", protect, authorize("admin"), async (req, res) => {
  try {
    const filter = buildFeeFilter(req.query, res);
    if (!filter) return;
    const fees        = await Fee.find(filter);
    const totalBilled = fees.reduce((s, f) => s + f.totalAmount, 0);
    const totalPaid   = fees.reduce((s, f) => s + f.paidAmount,  0);
    res.json({
      totalBilled,
      totalPaid,
      outstanding:  totalBilled - totalPaid,
      paidCount:    fees.filter((f) => f.paidAmount >= f.totalAmount).length,
      partialCount: fees.filter((f) => f.paidAmount > 0 && f.paidAmount < f.totalAmount).length,
      unpaidCount:  fees.filter((f) => f.paidAmount === 0).length,
      totalRecords: fees.length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /:id — admin or the linked student
router.get("/:id", protect, async (req, res) => {
  try {
    if (!requireObjectId(res, req.params.id, "fee id")) return;
    const fee = await Fee.findById(req.params.id).populate("student", "name email studentId gradeLevel");
    if (!fee) return res.status(404).json({ message: "Fee not found" });

    if (req.user.role === "student") {
      const linked = req.user.studentProfile?.toString();
      if (!linked || linked !== fee.student._id.toString()) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    res.json(fee);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create fee — admin only
router.post("/", protect, authorize("admin"), feeValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  try {
    if (!requireObjectId(res, req.body.student, "student id")) return;
    const fee  = new Fee(normalizeFeePayload(req.body));
    const saved = await fee.save();
    const pop  = await saved.populate("student", "name email studentId gradeLevel");
    res.status(201).json(pop);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /:id/payment — admin only
router.put(
  "/:id/payment",
  protect,
  authorize("admin"),
  [body("amount").isFloat({ min: 0.01 }).withMessage("Payment amount must be greater than 0").toFloat()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    try {
      if (!requireObjectId(res, req.params.id, "fee id")) return;
      const fee = await Fee.findById(req.params.id);
      if (!fee) return res.status(404).json({ message: "Fee not found" });
      const outstanding = fee.totalAmount - fee.paidAmount;
      if (outstanding <= 0) return res.status(400).json({ message: "Fee is already paid" });
      if (req.body.amount > outstanding) {
        return res.status(400).json({ message: `Payment exceeds outstanding balance of ${outstanding}` });
      }
      fee.payments.push({ amount: req.body.amount, note: req.body.note ?? "", date: new Date() });
      fee.paidAmount = fee.paidAmount + req.body.amount;
      await fee.save();
      const pop = await fee.populate("student", "name email studentId gradeLevel");
      res.json(pop);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

// DELETE /:id/payment/:paymentId — admin only
router.delete("/:id/payment/:paymentId", protect, authorize("admin"), async (req, res) => {
  try {
    if (!requireObjectId(res, req.params.id, "fee id")) return;
    if (!requireObjectId(res, req.params.paymentId, "payment id")) return;
    const fee = await Fee.findById(req.params.id);
    if (!fee) return res.status(404).json({ message: "Fee not found" });
    const payment = fee.payments.id(req.params.paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    payment.deleteOne();
    fee.paidAmount = fee.payments.reduce((sum, p) => sum + p.amount, 0);
    await fee.save();
    const pop = await fee.populate("student", "name email studentId gradeLevel");
    res.json(pop);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /:id update fee details — admin only
router.put("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    if (!requireObjectId(res, req.params.id, "fee id")) return;
    const updated = await Fee.findByIdAndUpdate(
      req.params.id,
      normalizeFeePayload(req.body),
      { returnDocument: "after", runValidators: true }
    ).populate("student", "name email studentId gradeLevel");
    if (!updated) return res.status(404).json({ message: "Fee not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /:id — admin only
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    if (!requireObjectId(res, req.params.id, "fee id")) return;
    const fee = await Fee.findByIdAndDelete(req.params.id);
    if (!fee) return res.status(404).json({ message: "Fee not found" });
    res.json({ message: "Fee deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
