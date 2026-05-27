import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/lib/sage-api.ts", import.meta.url), "utf8");
const apiFetchMatch = source.match(/async function apiFetch[\s\S]*?\n}\n/);
assert.ok(apiFetchMatch, "apiFetch function should exist");

const apiFetchSource = apiFetchMatch[0];
const ensureIndex = apiFetchSource.indexOf("await ensureDesktopBackend()");
const baseIndex = apiFetchSource.indexOf("const base = getApiBaseUrl()");

assert.ok(ensureIndex >= 0, "apiFetch should ensure the Tauri sidecar before requests");
assert.ok(baseIndex >= 0, "apiFetch should resolve the API base URL");
assert.ok(
  ensureIndex < baseIndex,
  "apiFetch should wait for the desktop sidecar before building and issuing the request",
);

console.log("sage api sidecar readiness tests passed");
