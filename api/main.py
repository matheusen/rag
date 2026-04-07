"""
RAG System — FastAPI entry point.

Inicia o servidor:
    uvicorn api.main:app --reload

Docs interativas (Swagger UI):
    http://localhost:8000/docs

Rotas disponíveis:
    POST /langchain/ingest   — ingere documento via LangChain
    POST /langchain/query    — consulta RAG via LangChain
    POST /llamaindex/ingest  — ingere documento via LlamaIndex
    POST /llamaindex/query   — consulta RAG via LlamaIndex
    GET  /sqlalchemy/articles — inspeciona artigos via SQLAlchemy
    GET  /sqlalchemy/chunks   — inspeciona chunks via SQLAlchemy
    GET  /health             — status do servidor
"""

from dotenv import load_dotenv

load_dotenv()  # carrega .env antes de qualquer import dos routers

from fastapi import FastAPI
from api.routers import langchain as lc_router
from api.routers import llamaindex as li_router
from api.routers import sqlalchemy as sa_router

app = FastAPI(
    title="RAG System",
    description=(
        "API RAG com dois frameworks paralelos para comparação:\n\n"
        "- **LangChain** (`/langchain/*`): usa `PGVector` + `create_retrieval_chain`\n"
        "- **LlamaIndex** (`/llamaindex/*`): usa `PGVectorStore` + `RetrieverQueryEngine`\n"
        "- **SQLAlchemy** (`/sqlalchemy/*`): inspeciona artigos, chunks e embeddings salvos\n\n"
        "Todos usam **PostgreSQL/pgvector**; LangChain e LlamaIndex usam **Google Gemini** para embeddings e LLM."
    ),
    version="1.0.0",
)

app.include_router(lc_router.router)
app.include_router(li_router.router)
app.include_router(sa_router.router)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
