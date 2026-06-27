import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, ".env");
const envText = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
const envDatabaseUrl = envText
  .split(/\r?\n/)
  .find((line) => line.trim().startsWith("DATABASE_URL="))
  ?.split("=")
  .slice(1)
  .join("=")
  .trim()
  .replace(/^["']|["']$/g, "");

const databaseUrl = process.env.DATABASE_URL?.trim() || envDatabaseUrl;

if (!databaseUrl?.startsWith("file:")) {
  throw new Error("DATABASE_URL must use file: for the SQLite MVP.");
}

const sqlitePath = databaseUrl.slice("file:".length).split("?")[0];
const databasePath = isAbsolute(sqlitePath)
  ? sqlitePath
  : resolve(root, "prisma", sqlitePath);

mkdirSync(dirname(databasePath), { recursive: true });
if (!existsSync(databasePath)) writeFileSync(databasePath, "");

console.log(`SQLite database ready: ${databasePath}`);
