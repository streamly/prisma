import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "@routes/index.js";
import { sendSuccess, sendError } from "@utils/response.js";
import { STATUS_CODES } from "@constants/status-codes.constants.js";
import { SERVER_MESSAGES, API_INFO } from "@constants/helper.constants.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

app.use("/api", routes);

app.get("/", (req, res) => {
  sendSuccess(res, {
    message: API_INFO.NAME,
    version: API_INFO.VERSION,
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    endpoints: {
      health: {
        GET: "/api/health",
        description: API_INFO.HEALTH_DESCRIPTION,
      },
      users: {
        POST: "/api/users/upsert",
        description: API_INFO.USERS_DESCRIPTION,
      },
      auth: {
        POST: "/api/auth/login",
        description: API_INFO.AUTH_DESCRIPTION,
      },
      comments: {
        "GET /api/comments": "List and filter comments",
        "POST /api/comments": "Create new comment",
        "GET /api/comments/:id": "Get specific comment",
        "PUT /api/comments/:id": "Update comment",
        "DELETE /api/comments/:id": "Delete comment",
        "DELETE /api/comments/delete-multiple": "Delete multiple comments",
        description: API_INFO.COMMENTS_DESCRIPTION,
      },
    },
    authentication: {
      required: API_INFO.AUTH_REQUIRED,
      format: API_INFO.AUTH_FORMAT,
    },
  });
});

app.use((error, req, res, next) => {
  console.error("Unhandled error:", {
    message: error.message,
    stack: NODE_ENV === "development" ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  });

  sendError(
    res,
    SERVER_MESSAGES.INTERNAL_SERVER_ERROR,
    STATUS_CODES.INTERNAL_SERVER_ERROR,
    {
      message:
        NODE_ENV === "development"
          ? error.message
          : SERVER_MESSAGES.SOMETHING_WENT_WRONG,
      timestamp: new Date().toISOString(),
    }
  );
});

app.use((req, res) => {
  sendError(res, SERVER_MESSAGES.ENDPOINT_NOT_FOUND, STATUS_CODES.NOT_FOUND, {
    path: req.path,
    method: req.method,
    availableEndpoints: "/",
  });
});

const server = app.listen(PORT, () => {
  console.log(`✓ Development server running on http://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/api/health`);
  console.log(`✓ API documentation: http://localhost:${PORT}/`);
  console.log(`✓ Environment: ${NODE_ENV}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  server.close(() => {
    console.log("Server closed due to uncaught exception");
    process.exit(1);
  });
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  server.close(() => {
    console.log("Server closed due to unhandled rejection");
    process.exit(1);
  });
});
