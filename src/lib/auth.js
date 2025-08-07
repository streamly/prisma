import jwt from "jsonwebtoken";
import { sendError } from "@utils/response.js";
import { HELPER_MESSAGES } from "@constants/helper.constants.js";
import { STATUS_CODES } from "@constants/status-codes.constants.js";

const JWT_SECRET = process.env.JWT_SECRET || "who_knows";
const EXPIRESIN = process.env.EXPIRESIN || "24h";

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRESIN });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return sendError(
      res,
      HELPER_MESSAGES.TOKEN_REQUIRED,
      STATUS_CODES.UNAUTHORIZED
    );
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return sendError(
      res,
      HELPER_MESSAGES.INVALID_TOKEN,
      STATUS_CODES.FORBIDDEN
    );
  }

  req.user = decoded;
  next();
}
