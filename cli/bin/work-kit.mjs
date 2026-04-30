#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = resolve(__dirname, "..", "src", "index.ts");

// Find tsx binary from the package's own dependencies
const require = createRequire(import.meta.url);
const tsxBin = resolve(dirname(require.resolve("tsx/package.json")), "dist", "cli.mjs");

try {
  execFileSync(process.execPath, [tsxBin, entry, ...process.argv.slice(2)], {
    stdio: "inherit",
  });
} catch (e) {
  process.exit(e.status ?? 1);
}
