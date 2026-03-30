"use strict";

/**
 * Remove `.next` before dev/build. OneDrive on Windows often leaves entries that
 * break Next's internal recursive-delete (EINVAL on readlink under .next/types).
 */
const fs = require("fs");
const path = require("path");

const dir = path.join(process.cwd(), ".next");
if (!fs.existsSync(dir)) {
  process.exit(0);
}

try {
  fs.rmSync(dir, {
    recursive: true,
    force: true,
    maxRetries: 15,
    retryDelay: 100,
  });
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (process.platform === "win32") {
    try {
      const { execSync } = require("child_process");
      execSync(`rmdir /s /q "${dir}"`, { stdio: "ignore" });
      process.exit(0);
    } catch {
      // fall through
    }
  }
  console.warn("[clean-next] Could not fully remove .next:", msg);
  console.warn("[clean-next] Close any running dev server, pause OneDrive for this project folder, then delete the .next folder manually.");
  process.exit(1);
}
