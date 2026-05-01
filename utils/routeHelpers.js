const mongoose = require("mongoose");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function requireObjectId(res, id, label = "id") {
  if (isValidObjectId(id)) return true;
  res.status(400).json({ message: `Invalid ${label}` });
  return false;
}

function parseDateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function duplicateKeyMessage(err, fallback = "Duplicate value") {
  if (err?.code !== 11000) return null;
  const field = Object.keys(err.keyPattern ?? err.keyValue ?? {})[0];
  if (!field) return fallback;
  return `${field} already exists`;
}

module.exports = {
  duplicateKeyMessage,
  parseDateOnly,
  requireObjectId,
};
