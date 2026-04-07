"""
Consultas de inspeção no pgvector usando SQLAlchemy.

Este módulo não faz RAG. Ele existe para inspecionar o conteúdo já salvo
nas tabelas do LangChain, como artigos, chunks e embeddings.

Objetivo didático:
- mostrar como mapear tabelas existentes com SQLAlchemy ORM
- mostrar como construir expressões SQL a partir de colunas JSONB
- mostrar como executar SELECTs compostos com join, filtros, group by e order by
- mostrar como transformar o resultado bruto do banco em dicionários Python
"""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Integer, Text, create_engine, func, select
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

load_dotenv()

COLLECTION_NAME = "lc_documents"
EMBEDDING_DIMENSIONS = 768


class Base(DeclarativeBase):
    """Base declarativa do SQLAlchemy.

    Toda classe ORM herda desta base. Ela informa ao SQLAlchemy que estas
    classes representam tabelas mapeadas no banco.
    """


class CollectionStore(Base):
    """Tabela de coleções criada pelo langchain-postgres.

    Esta tabela funciona como um namespace lógico. Cada coleção agrupa vários
    embeddings. No nosso caso, a coleção principal do LangChain chama-se
    `lc_documents`.
    """

    __tablename__ = "langchain_pg_collection"

    # UUID primário da coleção. O langchain-postgres usa UUID como chave.
    uuid: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True)

    # Nome legível da coleção. É este campo que filtramos para pegar apenas
    # a coleção usada pelo fluxo LangChain atual.
    name: Mapped[str] = mapped_column(Text, nullable=False)

    # Metadados opcionais em JSON. No nosso uso atual, costuma ficar vazio.
    cmetadata: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)


class EmbeddingStore(Base):
    """Tabela de embeddings criada pelo langchain-postgres.

    Cada linha desta tabela representa um chunk. Não é um artigo inteiro.
    O campo mais importante para busca vetorial é `embedding`, enquanto o
    `document` guarda o texto do chunk e `cmetadata` guarda origem e página.
    """

    __tablename__ = "langchain_pg_embedding"

    # Chave primária textual usada pelo langchain-postgres.
    id: Mapped[str] = mapped_column(Text, primary_key=True)

    # Chave estrangeira lógica apontando para a coleção dona deste embedding.
    collection_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)

    # Coluna vetorial do pgvector. O tipo Vector(768) informa ao SQLAlchemy e
    # ao driver como serializar/deserializar os embeddings.
    embedding: Mapped[Any] = mapped_column(Vector(EMBEDDING_DIMENSIONS))

    # Texto bruto do chunk salvo no banco.
    document: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Metadados do chunk em JSONB. Aqui ficam campos como source e page.
    cmetadata: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)


def _connection_string() -> str:
    """Monta a URL de conexão SQLAlchemy a partir do .env.

    O formato `postgresql+psycopg://` diz ao SQLAlchemy para usar o dialeto
    PostgreSQL e o driver psycopg.
    """
    return (
        f"postgresql+psycopg://{os.environ['POSTGRES_USER']}:{os.environ['POSTGRES_PASSWORD']}"
        f"@{os.environ['POSTGRES_HOST']}:{os.environ['POSTGRES_PORT']}/{os.environ['POSTGRES_DB']}"
    )


# Engine = fábrica de conexões do SQLAlchemy. Ela não executa consulta sozinha;
# apenas sabe como abrir conexões para quando uma Session precisar falar com o banco.
engine = create_engine(_connection_string(), pool_pre_ping=True)


def _source_expr():
    """Cria uma expressão SQL para extrair `source` do JSONB `cmetadata`.

    Importante: isto não lê o valor em Python agora. Retorna um pedaço de SQL
    que será incorporado ao SELECT/WHERE/ORDER BY depois.
    Equivalente conceitual a:

        cmetadata->>'source'
    """
    return func.jsonb_extract_path_text(EmbeddingStore.cmetadata, "source")


def _page_int_expr():
    """Cria uma expressão SQL para extrair `page` do JSONB e convertê-la em inteiro.

    O metadata salva `page` como texto. Para ordenar numericamente e filtrar por
    página, convertemos dentro do SQL.

    Equivalente conceitual a:

        CAST(NULLIF(cmetadata->>'page', '') AS INTEGER)
    """
    return func.cast(
        func.nullif(func.jsonb_extract_path_text(EmbeddingStore.cmetadata, "page"), ""),
        Integer,
    )


def _normalize_embedding(values: Any, dims: int | None = None) -> list[float] | None:
    """Converte o vetor retornado pelo driver em uma lista Python de floats.

    O pgvector, via SQLAlchemy, devolve um objeto iterável. Para serializar isso
    em JSON na API, convertemos para `list[float]`.

    Se `dims` for informado, cortamos o vetor para mostrar apenas um preview.
    Isso evita devolver 768 dimensões quando o usuário só quer inspecionar.
    """
    if values is None:
        return None

    normalized = [float(value) for value in list(values)]
    if dims is not None:
        return normalized[:dims]
    return normalized


def list_articles(contains: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    """Lista artigos distintos presentes na coleção LangChain.

    Esta função faz um SELECT com agregação para responder:
    - quais arquivos existem
    - quantos chunks cada arquivo gerou
    - qual a primeira e a última página encontrada
    """
    source = _source_expr()
    page_int = _page_int_expr()

    # Montagem do SELECT principal.
    # Aqui ainda não executamos nada; apenas descrevemos a consulta.
    stmt = (
        select(
            # Nome do artigo extraído do JSONB
            source.label("article"),

            # COUNT(*) por artigo = total de chunks daquele arquivo
            func.count().label("total_chunks"),

            # Menor e maior página encontradas para aquele artigo
            func.min(page_int).label("min_page"),
            func.max(page_int).label("max_page"),
        )

        # JOIN entre embeddings e coleções para filtrar apenas a coleção correta.
        .join(CollectionStore, CollectionStore.uuid == EmbeddingStore.collection_id)

        # WHERE fixo: pega só a coleção lc_documents, ignorando outras tabelas/dados.
        .where(CollectionStore.name == COLLECTION_NAME)

        # GROUP BY necessário porque estamos usando funções de agregação por artigo.
        .group_by(source)

        # Ordenação alfabética pelo nome do arquivo.
        .order_by(source)

        # Proteção simples para não retornar artigos demais numa chamada.
        .limit(limit)
    )

    if contains:
        # Filtro opcional do tipo ILIKE '%texto%'
        stmt = stmt.where(source.ilike(f"%{contains}%"))

    with Session(engine) as session:
        # Aqui a consulta é enviada de fato ao PostgreSQL.
        rows = session.execute(stmt).all()

    # Transformação de Row objects do SQLAlchemy para dicionários simples.
    return [
        {
            "article": row.article,
            "total_chunks": row.total_chunks,
            "min_page": row.min_page,
            "max_page": row.max_page,
        }
        for row in rows
        if row.article
    ]


def list_chunks(
    article: str | None = None,
    page: int | None = None,
    limit: int = 20,
    preview_chars: int = 200,
    embedding_dims: int = 8,
) -> list[dict[str, Any]]:
    """Lista chunks com preview do texto e preview do embedding.

    Esta função é útil para inspeção visual. Em vez de trazer o vetor completo,
    podemos retornar apenas as primeiras dimensões do embedding.
    """
    source = _source_expr()
    page_int = _page_int_expr()

    # SELECT dos campos necessários para inspeção.
    stmt = (
        select(
            EmbeddingStore.id,
            source.label("article"),
            page_int.label("page"),
            EmbeddingStore.document,
            EmbeddingStore.embedding,
        )
        .join(CollectionStore, CollectionStore.uuid == EmbeddingStore.collection_id)
        .where(CollectionStore.name == COLLECTION_NAME)

        # Ordenamos por artigo, depois página, depois id, para a navegação ficar previsível.
        .order_by(source, page_int, EmbeddingStore.id)
        .limit(limit)
    )

    if article:
        # Filtro parcial pelo nome do arquivo/artigo
        stmt = stmt.where(source.ilike(f"%{article}%"))
    if page is not None:
        # Filtro opcional por página exata
        stmt = stmt.where(page_int == page)

    with Session(engine) as session:
        rows = session.execute(stmt).all()

    items: list[dict[str, Any]] = []
    for row in rows:
        text = row.document or ""
        items.append(
            {
                "id": row.id,
                "article": row.article,
                "page": row.page,

                # Preview textual para evitar retornar chunks enormes na listagem.
                "document_preview": text[:preview_chars],

                # Preview vetorial para inspecionar apenas o início do embedding.
                "embedding_preview": _normalize_embedding(row.embedding, embedding_dims)
                if embedding_dims > 0
                else None,

                # Informação importante para validar se o embedding tem a dimensão esperada.
                "embedding_dimensions": len(row.embedding) if row.embedding is not None else None,
            }
        )
    return items


def get_chunk_detail(chunk_id: str, embedding_dims: int | None = None) -> dict[str, Any] | None:
    """Busca um chunk específico pelo id.

    Esta função faz o equivalente a um SELECT ... WHERE id = :chunk_id.
    Ela é a forma mais direta de inspecionar um embedding específico.
    """
    source = _source_expr()
    page_int = _page_int_expr()

    # Consulta de detalhe: um único chunk, sem agregação.
    stmt = (
        select(
            EmbeddingStore.id,
            source.label("article"),
            page_int.label("page"),
            EmbeddingStore.document,
            EmbeddingStore.embedding,
        )
        .join(CollectionStore, CollectionStore.uuid == EmbeddingStore.collection_id)
        .where(CollectionStore.name == COLLECTION_NAME)
        .where(EmbeddingStore.id == chunk_id)
    )

    with Session(engine) as session:
        # one_or_none() expressa a expectativa correta: zero ou uma linha.
        row = session.execute(stmt).one_or_none()

    if row is None:
        return None

    # embedding_dims=None retorna o vetor inteiro.
    # embedding_dims=N retorna apenas as N primeiras dimensões.
    embedding = _normalize_embedding(row.embedding, embedding_dims)
    return {
        "id": row.id,
        "article": row.article,
        "page": row.page,

        # No detalhe, retornamos o texto completo do chunk.
        "document": row.document,

        # E aqui podemos retornar o vetor completo ou truncado, dependendo do parâmetro.
        "embedding": embedding,
        "embedding_dimensions": len(row.embedding) if row.embedding is not None else None,
    }