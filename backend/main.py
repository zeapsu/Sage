import argparse
import asyncio
import logging
import os
import socket
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
# Legacy arXiv services (loaded lazily to avoid import-time dependency on arxiv package)
_arxiv_service = None


def _get_arxiv_service():
    global _arxiv_service
    if _arxiv_service is None:
        from services.arxiv import ArxivService
        _arxiv_service = ArxivService()
    return _arxiv_service
from services.pdf import PDFService
from services.summarizer import DeepSeekService

from api import chat, knowledge, skills as skills_api, tomes as tomes_api
from config import SageConfig
from skills.read_document import ReadDocumentSkill
from skills.registry import SkillRegistry
from skills.search_docs import SearchDocsSkill
from store.db import KnowledgeStore

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("sage")

load_dotenv()

app = FastAPI(title="Sage API")

# --- Sage knowledge agent setup ---
_sage_config = SageConfig()
_sage_config.ensure_default_config()
_knowledge_store = KnowledgeStore(_sage_config.db_path)
_skill_registry = SkillRegistry()
_skill_registry.register(SearchDocsSkill())
_skill_registry.register(ReadDocumentSkill())

app.dependency_overrides[KnowledgeStore] = lambda: _knowledge_store
app.dependency_overrides[SkillRegistry] = lambda: _skill_registry
app.dependency_overrides[SageConfig] = lambda: _sage_config

app.include_router(knowledge.router)
app.include_router(chat.router)
app.include_router(tomes_api.router)
app.include_router(skills_api.router)
# --- end Sage setup ---

# Add CORS middleware with configurable origins
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Initialize services
arxiv_service = _get_arxiv_service()

# Thread pool for parallel processing
executor = ThreadPoolExecutor(max_workers=5)

# In-memory caches
pdf_text_cache = {}
paper_cache = {}
summary_cache = {}


# Dependency to get DeepSeek service (singleton pattern)
@lru_cache(maxsize=1)
def get_deepseek_service():
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="DeepSeek API key not configured")
    return DeepSeekService(api_key=api_key)


# Enable socket reuse to prevent "Address already in use" errors
@app.on_event("startup")
async def startup_event():
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    logger.info("Server started with socket reuse enabled")


# Request models
class SearchRequest(BaseModel):
    keyword: str
    max_results: int = 10


class SummarizeRequest(BaseModel):
    paper_id: str
    max_length: int = 500


class KeywordSummaryRequest(BaseModel):
    keyword: str
    max_results: int = 5
    max_length: int = 500


# Cached search function
@lru_cache(maxsize=100)
def cached_search_papers(keyword: str, max_results: int) -> List[Dict[str, Any]]:
    """Cache search results to avoid repeated API calls for the same keyword"""
    return arxiv_service.search_papers(keyword, max_results)


# Helper function to extract and cache PDF text
def get_pdf_text(paper_id: str) -> str:
    """Get PDF text with caching"""
    if paper_id in pdf_text_cache:
        logger.info(f"Cache hit for PDF text: {paper_id}")
        return pdf_text_cache[paper_id]

    pdf_path = arxiv_service.download_pdf(paper_id)
    extracted_text = PDFService.extract_text(pdf_path)
    pdf_text_cache[paper_id] = extracted_text
    return extracted_text


# Helper function to get and cache paper metadata
def get_paper_metadata(paper_id: str) -> Dict[str, Any]:
    """Get paper metadata with caching"""
    if paper_id in paper_cache:
        logger.info(f"Cache hit for paper metadata: {paper_id}")
        return paper_cache[paper_id]

    paper = arxiv_service.get_paper_by_id(paper_id)
    paper_cache[paper_id] = paper
    return paper


# Helper function to summarize text with caching
def summarize_text(
    text: str, max_length: int, deepseek_service: DeepSeekService
) -> Optional[str]:
    """Summarize text with caching based on text hash"""
    # Use a hash of the text and max_length as cache key
    cache_key = f"{hash(text)}_{max_length}"
    if cache_key in summary_cache:
        logger.info(f"Cache hit for summary: {cache_key[:10]}...")
        return summary_cache[cache_key]

    summary = deepseek_service.summarize_text(text=text, max_length=max_length)
    if summary:
        summary_cache[cache_key] = summary
    return summary


# Process a single paper (for parallel processing)
def process_paper(
    paper: Dict[str, Any], max_length: int, deepseek_service: DeepSeekService
) -> Optional[Dict[str, Any]]:
    paper_id = paper["entry_id"].split("/")[-1]  # Extract arXiv ID

    try:
        # Get PDF text (cached)
        extracted_text = get_pdf_text(paper_id)

        # Summarize text (cached)
        summary = summarize_text(extracted_text, max_length, deepseek_service)

        if not summary:
            logger.warning(f"Failed to generate summary for paper {paper_id}")
            return None

        return {
            "paper_id": paper_id,
            "title": paper["title"],
            "authors": paper["authors"],
            "summary": summary,
            "published": paper["published"],
            "pdf_url": paper["pdf_url"],
        }
    except Exception as e:
        logger.error(f"Error processing paper {paper_id}: {str(e)}")
        return None


# Endpoints
@app.post("/api/search")
def search_papers(request: SearchRequest):
    """Search for papers on arXiv based on a keyword."""
    if not request.keyword:
        raise HTTPException(status_code=400, detail="Keyword is required")

    try:
        results = cached_search_papers(request.keyword, request.max_results)
        return {"papers": results}
    except Exception as e:
        logger.error(f"Error searching arXiv: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error searching arXiv: {str(e)}")


@app.post("/api/paper/summarize")
def summarize_paper(
    request: SummarizeRequest,
    deepseek_service: DeepSeekService = Depends(get_deepseek_service),
):
    """Downloads a paper's PDF from arXiv, extracts its text, and generates a summary."""
    try:
        # Get PDF text (cached)
        extracted_text = get_pdf_text(request.paper_id)

        # Summarize text (cached)
        summary = summarize_text(extracted_text, request.max_length, deepseek_service)

        if not summary:
            raise HTTPException(status_code=500, detail="Failed to generate summary")

        # Get paper metadata (cached)
        paper_metadata = get_paper_metadata(request.paper_id)

        return {
            "paper_id": request.paper_id,
            "title": paper_metadata["title"],
            "authors": paper_metadata["authors"],
            "summary": summary,
            "published": paper_metadata["published"],
        }
    except Exception as e:
        logger.error(f"Error processing paper: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing paper: {str(e)}")


@app.post("/api/keyword/summarize")
async def summarize_by_keyword(
    request: KeywordSummaryRequest,
    background_tasks: BackgroundTasks,
    deepseek_service: DeepSeekService = Depends(get_deepseek_service),
):
    """Searches for papers based on keyword, downloads PDFs, and returns summarized posts."""
    if not request.keyword:
        raise HTTPException(status_code=400, detail="Keyword is required")

    try:
        # Search for papers (cached)
        papers = cached_search_papers(request.keyword, request.max_results)

        # Process papers in parallel using ThreadPoolExecutor
        loop = asyncio.get_event_loop()
        tasks = []
        for paper in papers:
            tasks.append(
                loop.run_in_executor(
                    executor, process_paper, paper, request.max_length, deepseek_service
                )
            )

        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks)

        # Filter out None results (failed papers)
        summarized_posts = [post for post in results if post is not None]

        return {"posts": summarized_posts}
    except Exception as e:
        logger.error(f"Error processing keyword search: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing keyword search: {str(e)}")


@app.get("/api/paper/{paper_id}")
def get_paper(paper_id: str):
    """Retrieve a specific paper by its arXiv ID."""
    try:
        paper = get_paper_metadata(paper_id)
        return paper
    except Exception as e:
        logger.error(f"Paper not found: {str(e)}")
        raise HTTPException(status_code=404, detail=f"Paper not found: {str(e)}")


@app.get("/api/paper/{paper_id}/extract")
def download_and_extract(paper_id: str):
    """Downloads a paper's PDF from arXiv and extracts its text."""
    try:
        # Get PDF text (cached)
        extracted_text = get_pdf_text(paper_id)
        pdf_path = arxiv_service.download_pdf(
            paper_id
        )  # This is cached by the ArxivService

        return {"paper_id": paper_id, "text": extracted_text, "pdf_path": pdf_path}
    except Exception as e:
        logger.error(f"Error processing paper: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing paper: {str(e)}")


@app.get("/")
def read_root():
    return {"message": "Welcome to the Sage API!"}


# Clear caches endpoint (for maintenance)
@app.post("/api/clear-cache")
def clear_cache():
    """Clear all caches"""
    pdf_text_cache.clear()
    paper_cache.clear()
    summary_cache.clear()
    cached_search_papers.cache_clear()
    return {"message": "All caches cleared"}


if __name__ == "__main__":
    import uvicorn

    # Parse command line arguments for port
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--port", type=int, default=8000, help="Port to run the server on"
    )
    args = parser.parse_args()

    uvicorn.run(app, host="0.0.0.0", port=args.port, reload=True)
