import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(projectRoot, "drizzle");
const destination = path.join(projectRoot, "dist", ".openai", "drizzle");

mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true, force: true });
