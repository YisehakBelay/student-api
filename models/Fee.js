const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0.01 },
  date:   { type: Date, default: Date.now },
  note:   { type: String, default: "" },
}, { timestamps: true });

const feeSchema = new mongoose.Schema({
  student:     { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  description: { type: String, required: true, trim: true },
  category:    { type: String, enum: ["tuition", "registration", "lab", "library", "sports", "other"], default: "tuition" },
  totalAmount: { type: Number, required: true, min: 0 },
  paidAmount:  {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator(value) {
        return value <= this.totalAmount;
      },
      message: "Paid amount cannot be greater than total amount",
    },
  },
  dueDate:     { type: Date },
  semester:    { type: String, enum: ["Fall", "Spring"] },
  year:        { type: Number },
  payments:    [paymentSchema],
}, { timestamps: true });

// Computed status
feeSchema.virtual("status").get(function () {
  if (this.paidAmount >= this.totalAmount) return "paid";
  if (this.paidAmount > 0) return "partial";
  return "unpaid";
});

feeSchema.set("toJSON",   { virtuals: true });
feeSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Fee", feeSchema);
