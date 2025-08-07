import prisma from "@lib/prisma.js";
import { authenticateToken } from "@lib/auth.js";
import { sendSuccess, sendError } from "@utils/response.js";
import { REQUEST_METHODS } from "@constants/http-methods.constants.js";
import { STATUS_CODES } from "@constants/status-codes.constants.js";
import { ERROR_MESSAGES } from "@constants/comment.constants.js";

export default async function handler(req, res) {
  try {
    authenticateToken(req, res, async () => {
      if (req.method === REQUEST_METHODS.GET) {
        const { cid, vid, uid, status } = req.query;

        const where = {};
        if (cid) where.cid = cid;
        if (vid) where.vid = vid;
        if (uid) where.uid = uid;
        if (status !== undefined) where.status = parseInt(status);

        const comments = await prisma.comment.findMany({
          where,
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
          orderBy: {
            created: "asc",
          },
        });

        sendSuccess(res, { comments }, STATUS_CODES.OK);
      } else if (req.method === REQUEST_METHODS.POST) {
        const { cid, vid, uid, comment, status = 1 } = req.body;

        if (!cid || !vid || !uid || !comment) {
          return sendError(
            res,
            ERROR_MESSAGES.MISSING_COMMENT_FIELDS,
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

        const newComment = await prisma.comment.create({
          data: {
            cid,
            vid,
            uid,
            comment,
            created: Math.floor(Date.now() / 1000),
            status,
          },
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

        sendSuccess(res, { comment: newComment }, STATUS_CODES.CREATED);
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
