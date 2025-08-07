#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

console.log("Setting up Comment Management API...");

// Check if .env file exists
if (!fs.existsSync(".env")) {
  console.log("- Creating .env file...");
  const envContent = `DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=change-this-in-production"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
EXPIRESIN="24h"
PORT=3000
NODE_ENV="development"`;

  fs.writeFileSync(".env", envContent);
  console.log("✓ .env file created with your database credentials.");
} else {
  console.log("✓ .env file already exists.");
}

// Install dependencies
console.log("- Installing dependencies...");
try {
  execSync("npm install", { stdio: "inherit" });
  console.log("✓ Dependencies installed successfully.");
} catch (error) {
  console.log("✗ Failed to install dependencies:", error.message);
  process.exit(1);
}

// Generate Prisma client
console.log("- Generating Prisma client...");
try {
  execSync("npx prisma generate", { stdio: "inherit" });
  console.log("✓ Prisma client generated successfully.");
} catch (error) {
  console.log("✗ Failed to generate Prisma client:", error.message);
  process.exit(1);
}

// Push schema to database
console.log("- Pushing schema to database...");
try {
  execSync("npx prisma db push", { stdio: "inherit" });
  console.log("✓ Database schema pushed successfully.");
} catch (error) {
  console.log("✗ Failed to push schema to database:", error.message);
  console.log("✗ Make sure your DATABASE_URL is correct in .env file.");
  process.exit(1);
}

// Build the project
console.log("- Building project with esbuild...");
try {
  execSync("npm run dev:build", { stdio: "inherit" });
  console.log("✓ Project built successfully.");
} catch (error) {
  console.log("✗ Failed to build project:", error.message);
  process.exit(1);
}

console.log("✓ Setup completed successfully!");
console.log("- Next steps:");
console.log("1. Update your .env file with actual credentials");
console.log('2. Run "npm run dev:local" to start development server');
console.log('3. Run "npm run dev:build" to rebuild after changes');
console.log("4. Test the API endpoints using curl or Postman");
console.log('5. Deploy to Vercel using "vercel" command');

console.log("- API Endpoints:");
console.log("- GET    /api/health                    - Health check");
console.log("- POST   /api/users/upsert              - Create/update user");
console.log(
  "- POST   /api/auth/login                - Login and get JWT token"
);
console.log("- GET    /api/comments?vid=123         - Get comments for video");
console.log("- POST   /api/comments                  - Create new comment");
console.log("- GET    /api/comments/:id              - Get specific comment");
console.log("- PUT    /api/comments/:id              - Update comment");
console.log("- DELETE /api/comments/:id              - Delete comment");

console.log("- Authentication:");
console.log(
  "- All comment endpoints require JWT token in Authorization header"
);
console.log("- Format: Authorization: Bearer YOUR_JWT_TOKEN");

console.log("- Check README.md for detailed documentation and examples.");
