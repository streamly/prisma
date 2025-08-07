import express from "express";
import healthHandler from "@api/health.js";

const router = express.Router();

router.get("/", healthHandler);

export default router;
