import express from "express";
import commentsHandler from "@api/comments/index.js";
import commentHandler from "@api/comments/[id].js";

const router = express.Router();

router.get("/", commentsHandler);
router.post("/", commentsHandler);
router.get("/:id", commentHandler);
router.put("/:id", commentHandler);
router.delete("/:id", commentHandler);

export default router;
