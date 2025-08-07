import express from "express";
import upsertHandler from "@api/users/upsert.js";

const router = express.Router();

router.post("/upsert", upsertHandler);

export default router;
