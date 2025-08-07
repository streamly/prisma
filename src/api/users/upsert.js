import prisma from "@lib/prisma.js";
import { generateToken, verifyToken } from "@lib/auth.js";
import { sendError, sendSuccess } from "@utils/response.js";
import { REQUEST_METHODS } from "@constants/http-methods.constants.js";
import { STATUS_CODES } from "@constants/status-codes.constants.js";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@constants/auth.constants.js";

export default async function handler(req, res) {
  if (req.method !== REQUEST_METHODS.POST) {
    return sendError(
      res,
      ERROR_MESSAGES.METHOD_NOT_ALLOWED,
      STATUS_CODES.METHOD_NOT_ALLOWED
    );
  }

  try {
    const userData = req.body;

    if (!userData.id) {
      return sendError(
        res,
        ERROR_MESSAGES.USER_ID_REQUIRED,
        STATUS_CODES.BAD_REQUEST
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userData.id },
    });

    if (existingUser) {
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1];

      if (token) {
        const decoded = verifyToken(token);
        if (!decoded) {
          return sendError(
            res,
            ERROR_MESSAGES.INVALID_TOKEN,
            STATUS_CODES.FORBIDDEN
          );
        }
        if (decoded.userId && decoded.userId !== userData.id) {
          return sendError(
            res,
            ERROR_MESSAGES.NOT_AUTHORIZED,
            STATUS_CODES.FORBIDDEN
          );
        }
      }
    }

    const user = await prisma.user.upsert({
      where: { id: userData.id },
      update: {
        sub: userData.sub || null,
        cus: userData.cus || null,
        firstName: userData.firstName || userData.first_name || null,
        lastName: userData.lastName || userData.last_name || null,
        role: userData.role || null,
        company: userData.company || null,
        phone: userData.phone || null,
        channel: userData.channel || null,
        billing: userData.billing || null,
        plan: userData.plan || null,
        trusted: userData.trusted || null,
        modified: Math.floor(Date.now() / 1000),
        created: userData.created || Math.floor(Date.now() / 1000),
      },
      create: {
        id: userData.id,
        sub: userData.sub || null,
        cus: userData.cus || null,
        firstName: userData.firstName || userData.first_name || null,
        lastName: userData.lastName || userData.last_name || null,
        role: userData.role || null,
        company: userData.company || null,
        phone: userData.phone || null,
        channel: userData.channel || null,
        billing: userData.billing || null,
        plan: userData.plan || null,
        trusted: userData.trusted || null,
        modified: Math.floor(Date.now() / 1000),
        created: userData.created || Math.floor(Date.now() / 1000),
      },
    });

    const token = generateToken({ userId: user.id, userRole: user.role });

    return sendSuccess(res, {
      user,
      token,
      message: existingUser
        ? SUCCESS_MESSAGES.USER_UPDATED
        : SUCCESS_MESSAGES.USER_CREATED,
    });
  } catch (error) {
    return sendError(
      res,
      ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      STATUS_CODES.INTERNAL_SERVER_ERROR
    );
  }
}
