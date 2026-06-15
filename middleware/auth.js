const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Verify JWT and attach user to req
async function protect(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized — no token" });
  }
  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) return res.status(401).json({ message: "Not authorized — user not found" });
    next();
  } catch {
    return res.status(401).json({ message: "Not authorized — invalid token" });
  }
}

// Restrict to specific roles — use after protect
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role '${req.user.role}' is not permitted to perform this action`,
      });
    }
    next();
  };
}

module.exports = { protect, authorize };
