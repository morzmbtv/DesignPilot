import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const command = "npm exec prisma -- generate";
const result = spawnSync(command, {
  cwd: process.cwd(),
  env: process.env,
  encoding: "utf8",
  shell: true,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) process.stderr.write(`${result.error.message}\n`);

if (result.status === 0) process.exit(0);

const combinedOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}\n${result.error?.message ?? ""}`;
const prismaClientExists = existsSync(path.join(process.cwd(), "node_modules", ".prisma", "client", "index.d.ts"));
const isWindowsUnlinkIssue = process.platform === "win32" && /EPERM: operation not permitted, unlink/.test(combinedOutput);

if (isWindowsUnlinkIssue && prismaClientExists) {
  console.warn(
    [
      "Prisma generate hit a Windows EPERM unlink issue in node_modules/.prisma/client.",
      "A Prisma Client already exists, so the build will continue.",
      "If schema.prisma changed and types look stale, run npm ci in a clean folder or delete node_modules and reinstall.",
    ].join("\n"),
  );
  process.exit(0);
}

process.exit(result.status ?? 1);
