const DEFAULT_BROWSER_API_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
);
const DEFAULT_DESKTOP_API_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_DESKTOP_API_URL ?? "http://127.0.0.1:8080",
);
const SIDECAR_PORT = new URL(DEFAULT_DESKTOP_API_BASE_URL).port || "8080";

let backendReadyPromise: Promise<void> | null = null;
let backendPid: number | null = null;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function isBackendReachable(url: string): Promise<boolean> {
  return fetch(`${url}/`, { method: "GET" })
    .then((response) => response.ok)
    .catch(() => false);
}

async function waitForBackend(url: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isBackendReachable(url)) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for Sage backend at ${url}.`);
}

export function isTauriDesktop(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
  );
}

export function getApiBaseUrl(): string {
  return isTauriDesktop()
    ? DEFAULT_DESKTOP_API_BASE_URL
    : DEFAULT_BROWSER_API_BASE_URL;
}

export async function ensureDesktopBackend(): Promise<void> {
  if (!isTauriDesktop()) {
    return;
  }

  if (await isBackendReachable(DEFAULT_DESKTOP_API_BASE_URL)) {
    return;
  }

  if (backendReadyPromise) {
    return backendReadyPromise;
  }

  backendReadyPromise = (async () => {
    const { Command } = await import("@tauri-apps/plugin-shell");
    const command = Command.sidecar("binaries/main", ["--port", SIDECAR_PORT]);

    command.stderr.on("data", (line) => {
      console.error(`[sage-backend] ${line}`);
    });

    const child = await command.spawn();
    backendPid = child.pid;

    await waitForBackend(DEFAULT_DESKTOP_API_BASE_URL);
    console.info(
      `Sage backend started on ${DEFAULT_DESKTOP_API_BASE_URL} (pid ${backendPid})`,
    );
  })().catch(async (error) => {
    backendReadyPromise = null;
    backendPid = null;

    if (await isBackendReachable(DEFAULT_DESKTOP_API_BASE_URL)) {
      return;
    }

    throw error;
  });

  return backendReadyPromise;
}
