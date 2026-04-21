# Sage: Local Knowledge Agent

> *Formerly "arXiv Sage" — evolving from a RAG summarizer into a local-first knowledge agent.*

A local-first desktop app where you bring your own documents, connect any AI agent, and generate structured learning outputs — quizzes, flashcards, audio reviews, and reports — powered by a skill/tool system.

## Features

- **Research Made Accessible**: Search arXiv's vast repository with simple keywords
- **AI-Powered Summaries**: Automatically transform dense research papers into concise, engaging summaries
- **Instagram-Style Feed**: Browse summaries in a familiar, visually appealing format
- **Desktop Application**: Convenient, secure, and lightweight Tauri-based app for Windows, Mac, and Linux

## Tech Stack

### Frontend

- **Next.js**: React framework for building the user interface
- **Tauri**: Wraps the web app into a lightweight desktop application
- **Tailwind CSS**: Utility-first CSS framework for styling
- **React Component Library**: UI components for consistent design

### Backend

- **FastAPI**: High-performance Python web framework
- **arXiv API**: Integration for fetching research papers
- **PDF Processing**: Extraction of text from research PDFs
- **DeepSeek API**: AI-powered text summarization

## Getting Started

### Prerequisites

- Node.js (v14+)
- Rust (latest stable version)
- Python (v3.8+)
- npm or yarn

### Backend Setup

1. Create a Python virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install backend dependencies:

```bash
pip install -r requirements.txt
```

3. Set up environment variables:

```bash
# Create a .env file in the backend directory
DEEPSEEK_API_KEY=your_deepseek_api_key
```

4. Start the FastAPI server:

```bash
uvicorn main:app --reload
```

### Frontend Setup

1. Install frontend dependencies (inside frontend directory):

```bash
npm install
# or
yarn install
```

2. Run the development server:

```bash
npm run dev
# or
yarn dev
```

3. For Tauri development:

```bash
npm run tauri dev
# or
yarn tauri dev
```

## Building for Production

### Package the Tauri App

```bash
npm run build
npm run tauri build
# or
yarn build
yarn tauri build
```

This will create distributable packages in the `dist` folder for your platform.

## Project Structure

```
arXiv-sage/
├── backend/               # FastAPI backend
│   ├── pdfs/              # arXiv PDFs storage
│   ├── services/          # Business logic
│   │   ├── arxiv.py       # arXiv API integration
│   │   ├── pdf.py         # PDF processing
│   │   └── summarizer.py  # DeepSeek API integration
│   ├── binary_main.py     # pyinstaller binary for Tauri
│   ├── main.py            # Main FastAPI application
│   └── requirements.txt   # Python dependencies
├── frontend/              # Next.js + Electron frontend
│   ├── public/            # Static assets
|   ├── src/
│   |   ├── app/           # Next.js app configuration
│   |   ├── components/    # Next.js components
│   |   ├── hooks/         # Next.js hooks
│   ├── src-tauri/         # Tauri configuration
│   |   ├── binaries/      # FastAPI sidecar binary
│   |   ├── capabilities/  # Permissions for sidecar
│   |   ├── gen/           # Schema for Tauri API
│   |   ├── icons/         # Default tauri icons
│   |   ├── pdfs/          # Pdf storage
│   |   ├── src/           # Tauri app entry point
│   |   ├── Cargo.toml     # Tauri dependencies
│   |   ├── build.rs       # Tauri build script
│   |   ├── tauri.conf.json# Tauri configuration
│   └── package.json       # Node.js dependencies
└── README.md              # Project documentation
```

## Future Extensions

- Local ML model integration for offline summarization
- Custom summarization styles (academic, ELI5, etc.)
- Citation extraction and management
- Collaborative features for research teams

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
