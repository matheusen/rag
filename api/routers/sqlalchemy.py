"""
Router SQLAlchemy — endpoints de inspeção do conteúdo salvo no pgvector.

Rotas:
  GET /sqlalchemy/articles      — lista artigos e quantidade de chunks
  GET /sqlalchemy/chunks        — lista chunks com preview de texto e embedding
  GET /sqlalchemy/chunks/{id}   — detalhe de um chunk com vetor completo
"""

from fastapi import APIRouter, HTTPException, Query

from api.schemas import (
    SQLAlchemyArticleSummary,
    SQLAlchemyChunkDetail,
    SQLAlchemyChunkPreview,
)
from rag.sqlalchemy_queries import get_chunk_detail, list_articles, list_chunks

router = APIRouter(prefix="/sqlalchemy", tags=["SQLAlchemy"])


@router.get("/articles", response_model=list[SQLAlchemyArticleSummary])
def sqlalchemy_articles(
    contains: str | None = Query(None, description="Parte do nome do arquivo/artigo"),
    limit: int = Query(100, ge=1, le=500, description="Máximo de artigos retornados"),
):
    return list_articles(contains=contains, limit=limit)


@router.get("/chunks", response_model=list[SQLAlchemyChunkPreview])
def sqlalchemy_chunks(
    article: str | None = Query(None, description="Parte do nome do arquivo/artigo"),
    page: int | None = Query(None, ge=0, description="Filtra por página do PDF"),
    limit: int = Query(20, ge=1, le=200, description="Máximo de chunks retornados"),
    preview_chars: int = Query(200, ge=50, le=2000, description="Quantidade de caracteres no preview do texto"),
    embedding_dims: int = Query(8, ge=0, le=768, description="Quantidade de dimensões do embedding no preview"),
):
    return list_chunks(
        article=article,
        page=page,
        limit=limit,
        preview_chars=preview_chars,
        embedding_dims=embedding_dims,
    )


@router.get("/chunks/{chunk_id}", response_model=SQLAlchemyChunkDetail)
def sqlalchemy_chunk_detail(
    chunk_id: str,
    embedding_dims: int = Query(768, ge=1, le=768, description="Quantidade de dimensões do embedding retornadas"),
):
    item = get_chunk_detail(chunk_id=chunk_id, embedding_dims=embedding_dims)
    if item is None:
        raise HTTPException(status_code=404, detail="Chunk não encontrado")
    return item