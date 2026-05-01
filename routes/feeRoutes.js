const express = require("express");
const router = express.Router();
const Fee = require("../models/Fee");
const { parseDateOnly, requireObjectId } = require("../utils/routeHelpers");

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
  if (payload.paidAmount !== undefined) payload.paidAmount = Number(payload.paidAmount);
  if (payload.year !== undefined && payload.year !== "") payload.year = Number(payload.year);
  if (payload.year === "") delete payload.year;
  if (payload.dueDate) payload.dueDate = parseDateOnly(payload.dueDate);
  if (typeof payload.description === "string") payload.description = payload.description.trim();
  return payload;
}

// GET fees — filterable by ?student=&semester=&year=
router.get("/", async (req, res) => {
  try {
    const filter = buildFeeFilter(req.query, res);
    if (!filter) return;
    const fees = await Fee.find(filter)
      .populate("student", "name email studentId gradeLevel")
      .sort({ createdAt: -1 });
    res.json(fees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /summary — aggregate totals
router.get("/summary", async (req, res) => {
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

// GET /:id — get one fee record
router.get("/:id", async (req, res) => {
  try {
    if (!requireObjectId(res, req.params.id, "fee id")) return;
    const fee = await Fee.findById(req.params.id).populate("student", "name email studentId gradeLevel");
    if (!fee) return res.status(404).json({ message: "Fee not found" });
    res.json(fee);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST — create fee
router.post("/", async (req, res) => {
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

// PUT /:id/payment — record a payment
router.put("/:id/payment", async (req, res) => {
  try {
    if (!requireObjectId(res, req.params.id, "fee id")) return;
    const { amount, note } = req.body;
    const pay = Number(amount);
    if (!Number.isFinite(pay) || pay <= 0) {
      return res.status(400).json({ message: "A valid payment amount is required" });
    }
    const fee = await Fee.findById(req.params.id);
    if (!fee) return res.status(404).json({ message: "Fee not found" });
    const outstanding = fee.totalAmount - fee.paidAmount;
    if (outstanding <= 0) return res.status(400).json({ message: "Fee is already paid" });
    if (pay > outstanding) return res.status(400).json({ message: `Payment exceeds outstanding balance of ${outstanding}` });
    fee.payments.push({ amount: pay, note: note ?? "", date: new Date() });
    fee.paidAmount = fee.paidAmount + pay;
    await fee.save();
    const pop = await fee.populate("student", "name email studentId gradeLevel");
    res.json(pop);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /:id/payment/:paymentId — remove a payment and recalculate balance
router.delete("/:id/payment/:paymentId", async (req, res) => {
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

// PUT /:id — update fee details
router.put("/:id", async (req, res) => {
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

// DELETE /:id
router.delete("/:id", async (req, res) => {
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
