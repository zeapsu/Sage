# Knowledge base UI

Two related additions: a way to add documents *into* the knowledge base, and
a way to view what's already in it.

## 1. Upload modal

A circular icon button now sits to the right of the command-bar pill.
Clicking it opens `UploadModal`, which lets the user:

- Paste raw text into a textarea.
- Drag-and-drop or "Choose file" a plain-text file. Supported extensions:
  `.txt`, `.md`, `.markdown`, `.rst`, `.csv`, `.json`, `.log`, plus any
  file with a `text/*` MIME type.
- Edit the auto-derived title.
- Submit, which calls `ingestDocument()` → `POST /api/knowledge/ingest`.

The backend deduplicates by SHA-256 of the content, so re-uploading the
same file is safe and surfaces "already in knowledge base" instead of
double-indexing.

### Caveats

- **Binary formats (PDF, DOCX, images) are not supported through this UI**.
  The ingest endpoint takes `content: string`. The backend already has
  `services/pdf.py::PDFService.extract_text` used by the arXiv flow — if you
  want PDF upload from the UI, the cleanest path is a new `multipart/form-data`
  endpoint that calls `PDFService.extract_text` and then forwards into the
  existing ingest pipeline.
- The modal accepts an optional `tomeId` so the new document can be linked
  to the active tome. The `CommandBar` plumbs the prop through but there is
  no "active tome" state at the page level yet, so uploads currently go to
  the global knowledge base.

## 2. Knowledge-base viewer

Typing any of `knowledge`, `kb`, `docs`, `documents`, `knowledge base`,
`view/show/list documents` into the command bar switches the view to
`KnowledgeBaseWidget`. Two-pane layout:

- **Left**: scrollable list of every ingested document (title, doc_type,
  source, ingest time). Calls `listDocuments({ limit: 200 })`.
- **Right**: detail panel for the selected document. Calls
  `getDocument(id)` and shows source, type, chunk count, content hash,
  linked tomes, and a 200-char content preview.
- **Header actions**: Refresh button. Per-document Delete button in the
  detail panel (`deleteDocument(id)`).

The content preview comes from the backend's
`GET /api/knowledge/documents/{id}` response, which returns
`chunks[0].content[:200]` (`backend/api/knowledge.py`). If you want full
chunk text in the UI, extend that endpoint to return all chunk content.

## Files touched

### Backend

No changes — these UI flows reuse existing endpoints:
- `POST /api/knowledge/ingest`
- `GET  /api/knowledge/documents`
- `GET  /api/knowledge/documents/{id}`
- `DELETE /api/knowledge/documents/{id}`

### Frontend

- `frontend/src/components/UploadModal.tsx` (new) — paste / drop / choose-file
  modal that POSTs to `/api/knowledge/ingest`.
- `frontend/src/components/CommandBar.tsx` — adds the round upload button to
  the right of the pill and renders `UploadModal`.
- `frontend/src/components/KnowledgeBaseWidget.tsx` (new) — list + detail view.
- `frontend/src/lib/sage-api.ts` — added `listDocuments`, `getDocument`,
  `deleteDocument`, and matching types.
- `frontend/src/app/page.tsx` — registered the `"knowledge"` view-state and
  command-verb routing.
