import express from "express";
import healthRoutes from "./health.routes.js";
import userRoutes from "./users.routes.js";
import authRoutes from "./auth.routes.js";
import commentRoutes from "./comments.routes.js";

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/users", userRoutes);
router.use("/auth", authRoutes);
router.use("/comments", commentRoutes);

export default router;
