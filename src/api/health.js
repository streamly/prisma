import prisma from "@lib/prisma.js";
import { sendError, sendSuccess } from "@utils/response.js";
import { REQUEST_METHODS } from "@constants/http-methods.constants.js";
import { STATUS_CODES } from "@constants/status-codes.constants.js";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  METADATA,
} from "@constants/health.constants.js";

export default async function handler(req, res) {
  if (req.method !== REQUEST_METHODS.GET) {
    return sendError(
      res,
      ERROR_MESSAGES.METHOD_NOT_ALLOWED,
      STATUS_CODES.METHOD_NOT_ALLOWED
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;

    return sendSuccess(res, {
      message: SUCCESS_MESSAGES.HEALTH_CHECK_PASSED,
      timestamp: new Date().toISOString(),
      database: METADATA.DATABASE_CONNECTED,
    });
  } catch (error) {
    return sendError(
      res,
      ERROR_MESSAGES.HEALTH_CHECK_FAILED,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      {
        timestamp: new Date().toISOString(),
        database: METADATA.DATABASE_DISCONNECTED,
        error: error.message,
      }
    );
  }
}
