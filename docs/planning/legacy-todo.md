## Project Setup

> **Status note (May 2026):** Archived early TODO from the arXivSage / Electron-era project. Sage is now Tauri + Next.js + FastAPI with Tome Home as the default UI. Keep this file for history only.

- [x] **Initialize FastAPI backend**
  - Set up Python environment (`venv`) and install FastAPI, Uvicorn[^1]
  - Create basic "Hello World" API endpoint[^1]
- [x] **Setup Next.js + Electron frontend**
  - Initialize Next.js project and Electron integration
  - Configure Tailwind CSS and chosen component library

## Backend (FastAPI)

- [x] **Implement arXiv API integration**
  - Query arXiv for top/latest papers based on keyword input
- [x] **PDF download \& text extraction**
  - Download PDFs from arXiv URLs
  - Extract text from PDFs (e.g., using `pdfplumber` or `PyMuPDF`)
- [x] **Integrate DeepSeek API for summarization**
  - Send extracted text to DeepSeek API
  - Format summaries into short, engaging Instagram-style posts
- [x] **Create REST endpoints**
  - Endpoint accepting keyword, returning summarized posts as JSON
  - Ensure clear data validation with Pydantic models[^2]

## Frontend (Next.js + React)

- [x] **Create keyword input/search component**
  - Handle user input and send requests to FastAPI backend using fetch/Axios[^1]
- [ ] **Implement React "Post" component**
  - Display summarized content clearly and attractively
- [ ] **Build Instagram-like feed page**
  - Dynamically populate feed with summaries from backend API

## Integration \& Communication

- [ ] **Integrate Next.js frontend with FastAPI backend**
  - Set up proxy or rewrites in Next.js (`next.config.js`) for seamless communication[^3][^5]
  - Handle loading states and errors gracefully in UI

## ML Extensions (Future-Proofing)

- [ ] **Set up ML model integration structure in FastAPI**
  - Use lifespan events to manage ML model lifecycle efficiently[^6]
  - Prepare structure for future ML model deployment/inference endpoints[^2][^4]

## Electron Packaging \& Deployment

- [ ] **Electron packaging setup**
  - Configure Electron-builder or Electron-packager for distribution

## Testing \& Documentation

- [ ] **Write tests for FastAPI endpoints**
  - Unit tests for API logic (arXiv fetching, PDF extraction, summarization)
- [x] **Write clear documentation**
  - README with setup instructions, environment variables, and usage examples

<div style="text-align: center">⁂</div>

[^1]: <https://www.restack.io/p/fastapi-answer-nextjs-integration>
[^2]: <https://github.com/xbeat/Machine-Learning/blob/main/Integrating> ML Models in FastAPI with Python.md
[^3]: <https://vercel.com/templates/next.js/nextjs-fastapi-starter>
[^4]: <https://www.evidentlyai.com/blog/fastapi-tutorial>
[^5]: <https://github.com/psycho-baller/nextjs-and-fastapi-backend>
[^6]: <https://blog.jetbrains.com/pycharm/2024/09/how-to-use-fastapi-for-machine-learning/>
