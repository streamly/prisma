import { build } from "esbuild";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const buildOptions = {
  entryPoints: ["src/index.js"],
  bundle: true,
  outfile: "dist/index.js",
  platform: "node",
  target: "node18",
  format: "esm",
  external: [
    "@prisma/client",
    "express",
    "cors",
    "dotenv",
    "jsonwebtoken",
    "bcryptjs",
  ],
  alias: {
    "@": join(__dirname, "src"),
    "@api": join(__dirname, "src/api"),
    "@routes": join(__dirname, "src/routes"),
    "@lib": join(__dirname, "src/lib"),
    "@utils": join(__dirname, "src/utils"),
    "@constants": join(__dirname, "src/constants"),
  },
  sourcemap: true,
  minify: false,
};

async function buildApp() {
  try {
    await build(buildOptions);
    console.log("✓ Build completed successfully!");
  } catch (error) {
    console.error("✗ Build failed:", error);
    process.exit(1);
  }
}

buildApp();
