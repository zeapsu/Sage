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
  await ensureDesktopBackend();
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

// ── Config ──

export interface SageRuntimeConfig {
  provider: string;
  model: string;
}

export async function getRuntimeConfig(): Promise<SageRuntimeConfig> {
  return apiFetch<SageRuntimeConfig>("/api/config");
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

export interface DocumentSummary {
  id: string;
  title: string;
  source: string;
  doc_type: string;
  content_hash: string;
  created_at: string;
}

export interface DocumentDetail extends DocumentSummary {
  chunks: number;
  content_preview: string;
  tomes: { id: string; name: string }[];
}

export async function listDocuments(
  opts: { limit?: number; offset?: number } = {},
): Promise<DocumentSummary[]> {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts.offset !== undefined) params.set("offset", String(opts.offset));
  const qs = params.toString();
  const data = await apiFetch<{ documents: DocumentSummary[] }>(
    `/api/knowledge/documents${qs ? `?${qs}` : ""}`,
  );
  return data.documents;
}

export async function getDocument(docId: string): Promise<DocumentDetail> {
  return apiFetch<DocumentDetail>(`/api/knowledge/documents/${docId}`);
}

export async function deleteDocument(docId: string): Promise<void> {
  await apiFetch(`/api/knowledge/documents/${docId}`, { method: "DELETE" });
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

// ── Chat sessions / history ──

export interface ChatSessionSummary {
  id: string;
  tome_id: string | null;
  tome_name: string | null;
  provider: string;
  model: string;
  created_at: string;
  last_message_at: string;
  first_user_message: string | null;
  message_count: number;
}

export async function listChatSessions(limit = 100): Promise<ChatSessionSummary[]> {
  const data = await apiFetch<{ sessions: ChatSessionSummary[] }>(
    `/api/chat/sessions?limit=${limit}`,
  );
  return data.sessions;
}

// ── Generation: flashcards & quizzes ──

export interface GeneratedFlashcard {
  id: string;
  front: string;
  back: string;
}

export interface GeneratedSource {
  document_id: string;
  document_title: string;
  chunk_index: number;
  similarity: number | null;
}

export interface FlashcardGeneration {
  cards: GeneratedFlashcard[];
  topic: string;
  sources: GeneratedSource[];
}

export interface GeneratedQuizOption {
  id: string;
  text: string;
}

export interface GeneratedQuizQuestion {
  id: string;
  question: string;
  options: GeneratedQuizOption[];
  correctOptionId: string;
  explanation?: string;
}

export interface QuizGeneration {
  questions: GeneratedQuizQuestion[];
  topic: string;
  sources: GeneratedSource[];
}

export interface GenerateOpts {
  topic?: string;
  tomeId?: string;
  count?: number;
  provider?: string;
  model?: string;
}

function generateBody(opts: GenerateOpts) {
  return {
    topic: opts.topic ?? null,
    tome_id: opts.tomeId ?? null,
    count: opts.count ?? 6,
    provider: opts.provider ?? null,
    model: opts.model ?? null,
  };
}

export async function generateFlashcards(opts: GenerateOpts = {}): Promise<FlashcardGeneration> {
  return apiFetch<FlashcardGeneration>("/api/generate/flashcards", {
    method: "POST",
    body: generateBody(opts),
  });
}

export async function generateQuiz(opts: GenerateOpts = {}): Promise<QuizGeneration> {
  return apiFetch<QuizGeneration>("/api/generate/quiz", {
    method: "POST",
    body: generateBody(opts),
  });
}

// ── Generation: reports ──

export interface ReportTocItem {
  id: string;
  title: string;
}

export interface ReportGeneration {
  title: string;
  subtitle: string | null;
  sourceDocs: string | null;
  toc: ReportTocItem[];
  content: string;
  sources: GeneratedSource[];
  topic: string;
}

export async function generateReport(opts: GenerateOpts = {}): Promise<ReportGeneration> {
  return apiFetch<ReportGeneration>("/api/generate/report", {
    method: "POST",
    body: generateBody(opts),
  });
}

// ── Generation: audio narration ──

export interface AudioSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
}

export interface AudioGeneration {
  id: string;
  title: string;
  voice: string;
  provider: string;
  model: string;
  script: string;
  segments: AudioSegment[];
  duration: number;
  /** Backend-relative URL to an MP3 (OpenAI TTS). When null, the frontend
   *  falls back to browser SpeechSynthesis for playback. */
  audio_url: string | null;
  sources: GeneratedSource[];
  topic: string;
}

export interface GenerateAudioOpts {
  topic?: string;
  tomeId?: string;
  voice?: string;
  provider?: string;
  model?: string;
}

export async function generateAudio(opts: GenerateAudioOpts = {}): Promise<AudioGeneration> {
  return apiFetch<AudioGeneration>("/api/generate/audio", {
    method: "POST",
    body: {
      topic: opts.topic ?? null,
      tome_id: opts.tomeId ?? null,
      voice: opts.voice ?? null,
      provider: opts.provider ?? null,
      model: opts.model ?? null,
    },
  });
}

/** Resolve a relative audio path to a fully-qualified URL using the active API base. */
export function resolveAudioUrl(path: string): string {
  if (/^https?:/i.test(path)) return path;
  return `${getApiBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
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
