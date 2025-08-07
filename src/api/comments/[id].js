import prisma from "@lib/prisma.js";
import { authenticateToken } from "@lib/auth.js";
import { sendError, sendSuccess } from "@utils/response.js";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "@constants/comment.constants.js";
import { STATUS_CODES } from "@constants/status-codes.constants.js";
import { REQUEST_METHODS } from "@constants/http-methods.constants.js";

export default async function handler(req, res) {
  try {
    authenticateToken(req, res, async () => {
      const { id } = req.params;

      if (!id) {
        return sendError(
          res,
          ERROR_MESSAGES.MISSING_COMMENT_ID,
          STATUS_CODES.BAD_REQUEST
        );
      }

      if (req.method === REQUEST_METHODS.GET) {
        const comment = await prisma.comment.findUnique({
          where: { id: parseInt(id) },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                company: true,
              },
            },
          },
        });

        if (!comment) {
          sendError(
            res,
            ERROR_MESSAGES.COMMENT_NOT_FOUND,
            STATUS_CODES.NOT_FOUND
          );
        }

        sendSuccess(res, { comment }, STATUS_CODES.OK);
      } else if (req.method === REQUEST_METHODS.PUT) {
        const { comment, status, uid } = req.body;

        if (!comment || !status || !uid) {
          return sendError(
            res,
            ERROR_MESSAGES.MISSING_UPDATE_FIELDS,
            STATUS_CODES.BAD_REQUEST
          );
        }

        if (uid) {
          const existingUser = await prisma.user.findUnique({
            where: { id: uid },
          });

          if (!existingUser) {
            return sendError(
              res,
              ERROR_MESSAGES.USER_NOT_FOUND,
              STATUS_CODES.BAD_REQUEST
            );
          }
        }

        const existingComment = await prisma.comment.findUnique({
          where: { id: parseInt(id) },
        });

        if (!existingComment) {
          return sendError(
            res,
            ERROR_MESSAGES.COMMENT_NOT_FOUND,
            STATUS_CODES.NOT_FOUND
          );
        }

        const updateData = {};
        if (comment !== undefined) updateData.comment = comment;
        if (status !== undefined) updateData.status = status;
        if (uid !== undefined) updateData.uid = uid;

        const updatedComment = await prisma.comment.update({
          where: { id: parseInt(id) },
          data: updateData,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                company: true,
              },
            },
          },
        });

        sendSuccess(res, { comment: updatedComment }, STATUS_CODES.OK);
      } else if (req.method === REQUEST_METHODS.DELETE) {
        const { uid } = req.body;

        if (!uid) {
          return sendError(
            res,
            ERROR_MESSAGES.MISSING_USER_ID,
            STATUS_CODES.BAD_REQUEST
          );
        }

        const existingUser = await prisma.user.findUnique({
          where: { id: uid },
        });

        if (!existingUser) {
          return sendError(
            res,
            ERROR_MESSAGES.USER_NOT_FOUND,
            STATUS_CODES.BAD_REQUEST
          );
        }

        const existingComment = await prisma.comment.findUnique({
          where: { id: parseInt(id) },
        });

        if (!existingComment) {
          return sendError(
            res,
            ERROR_MESSAGES.COMMENT_NOT_FOUND,
            STATUS_CODES.NOT_FOUND
          );
        }

        await prisma.comment.delete({
          where: { id: parseInt(id) },
        });

        sendSuccess(
          res,
          { message: SUCCESS_MESSAGES.COMMENT_DELETED },
          STATUS_CODES.OK
        );
      } else {
        return sendError(
          res,
          ERROR_MESSAGES.METHOD_NOT_ALLOWED,
          STATUS_CODES.METHOD_NOT_ALLOWED
        );
      }
    });
  } catch (error) {
    return sendError(
      res,
      ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      STATUS_CODES.INTERNAL_SERVER_ERROR
    );
  }
}
