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


// ── Sage API Client ──────────────────────────────────────────

type FetchOpts = {
  method?: string;
  body?: unknown;
};

async function apiFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${opts.method ?? "GET"} ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ── Tomes ──

export interface Tome {
  id: string;
  name: string;
  description: string;
  created_at: string;
  source_count: number;
  has_session: boolean;
}

export interface TomeDetail extends Tome {
  sources: { id: string; title: string; source: string; doc_type: string }[];
  session: { id: string; provider: string; model: string } | null;
}

export async function listTomes(): Promise<Tome[]> {
  const data = await apiFetch<{ tomes: Tome[] }>("/api/tomes");
  return data.tomes;
}

export async function createTome(name: string, description = ""): Promise<Tome> {
  return apiFetch<Tome>("/api/tomes", { method: "POST", body: { name, description } });
}

export async function getTome(tomeId: string): Promise<TomeDetail> {
  return apiFetch<TomeDetail>(`/api/tomes/${tomeId}`);
}

export async function deleteTome(tomeId: string): Promise<void> {
  await apiFetch(`/api/tomes/${tomeId}`, { method: "DELETE" });
}

export async function linkSource(tomeId: string, documentId: string): Promise<void> {
  await apiFetch(`/api/tomes/${tomeId}/sources`, {
    method: "POST", body: { document_id: documentId },
  });
}

export async function unlinkSource(tomeId: string, documentId: string): Promise<void> {
  await apiFetch(`/api/tomes/${tomeId}/sources/${documentId}`, { method: "DELETE" });
}

// ── Documents / Ingest ──

export interface IngestResult {
  document_id: string;
  title: string;
  chunks: number;
  deduplicated: boolean;
}

export async function ingestDocument(
  title: string,
  content: string,
  opts: { source?: string; sourceId?: string; docType?: string; tomeId?: string } = {},
): Promise<IngestResult> {
  return apiFetch<IngestResult>("/api/knowledge/ingest", {
    method: "POST",
    body: {
      title, content,
      source: opts.source ?? "upload",
      source_id: opts.sourceId ?? "",
      doc_type: opts.docType ?? "text",
      tome_id: opts.tomeId ?? null,
    },
  });
}

export async function searchKnowledge(
  query: string, opts: { maxResults?: number; tomeId?: string } = {},
): Promise<{ results: unknown[]; formatted: string }> {
  return apiFetch("/api/knowledge/search", {
    method: "POST",
    body: {
      query,
      max_results: opts.maxResults ?? 5,
      tome_id: opts.tomeId ?? null,
    },
  });
}

// ── Chat ──

export interface ChatResponse {
  response: string;
  session_id: string;
}

export async function sendChat(
  message: string, opts: { sessionId?: string; tomeId?: string; provider?: string; model?: string } = {},
): Promise<ChatResponse> {
  return apiFetch<ChatResponse>("/api/chat", {
    method: "POST",
    body: {
      message,
      session_id: opts.sessionId ?? null,
      tome_id: opts.tomeId ?? null,
      provider: opts.provider ?? null,
      model: opts.model ?? null,
    },
  });
}
