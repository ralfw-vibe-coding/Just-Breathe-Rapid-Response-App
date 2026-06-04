import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "requirements");
const targetDir = path.join(root, "public", "base");

if (!existsSync(sourceDir)) {
  throw new Error(`Missing requirements directory at ${sourceDir}`);
}

mkdirSync(targetDir, { recursive: true });
cpSync(path.join(sourceDir, "techniques.json"), path.join(targetDir, "techniques.json"));
cpSync(path.join(sourceDir, "manual.txt"), path.join(targetDir, "manual.txt"));
