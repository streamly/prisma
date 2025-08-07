import { STATUS_CODES } from "@constants/status-codes.constants.js";

export function sendSuccess(res, data = {}, statusCode = STATUS_CODES.OK) {
  return res.status(statusCode).json({ success: true, data });
}

export function sendError(
  res,
  message,
  statusCode = STATUS_CODES.INTERNAL_SERVER_ERROR,
  extra = {}
) {
  return res.status(statusCode).json({
    success: false,
    error: message,
    ...extra,
  });
}
