import express from "express";
import loginHandler from "@api/auth/login.js";

const router = express.Router();

router.post("/login", loginHandler);

export default router;
