import prisma from "@lib/prisma.js";
import { generateToken } from "@lib/auth.js";
import { sendError, sendSuccess } from "@utils/response.js";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@constants/auth.constants.js";
import { STATUS_CODES } from "@constants/status-codes.constants.js";
import { REQUEST_METHODS } from "@constants/http-methods.constants.js";

export default async function handler(req, res) {
  if (req.method !== REQUEST_METHODS.POST) {
    return sendError(
      res,
      ERROR_MESSAGES.METHOD_NOT_ALLOWED,
      STATUS_CODES.METHOD_NOT_ALLOWED
    );
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return sendError(
        res,
        ERROR_MESSAGES.USER_ID_REQUIRED,
        STATUS_CODES.BAD_REQUEST
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return sendError(
        res,
        ERROR_MESSAGES.USER_NOT_FOUND,
        STATUS_CODES.NOT_FOUND
      );
    }

    const token = generateToken({ userId: user.id, userRole: user.role });

    return sendSuccess(res, {
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        company: user.company,
        role: user.role,
      },
      message: SUCCESS_MESSAGES.LOGIN_SUCCESS,
    });
  } catch (error) {
    return sendError(
      res,
      ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      STATUS_CODES.INTERNAL_SERVER_ERROR
    );
  }
}
