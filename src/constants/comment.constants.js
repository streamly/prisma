export const ERROR_MESSAGES = {
  MISSING_COMMENT_FIELDS: "cid, vid, uid, and comment are required",
  MISSING_COMMENT_ID: "Comment ID is required",
  MISSING_USER_ID: "User ID is required",
  MISSING_UPDATE_FIELDS: "status, uid, and comment are required",
  COMMENT_NOT_FOUND: "Comment not found",
  IDS_REQUIRED: "ids array is required and must not be empty",
  NO_VALID_COMMENT_IDS: "No valid comment IDs provided",
  METHOD_NOT_ALLOWED: "Method not allowed",
  INTERNAL_SERVER_ERROR: "Internal server error",
  USER_NOT_FOUND:
    "User ID does not exist. Please create a user first or use a valid user ID.",
};

export const SUCCESS_MESSAGES = {
  COMMENT_CREATED: "Comment created successfully",
  COMMENT_UPDATED: "Comment updated successfully",
  COMMENT_DELETED: "Comment deleted successfully",
  COMMENTS_RETRIEVED: "Comments retrieved successfully",
};
