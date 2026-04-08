from __future__ import annotations

import hashlib
import json
import os
import re
import uuid
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import psycopg
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_core.documents import Document
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

COLLECTION_NAME = "lc_documents"
SUMMARY_TABLE = "rag_document_registry"
EMBEDDING_DIMENSIONS = 768
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150
RRF_K = 60
SUMMARY_BACKFILL_CHUNKS = 8
SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".md", ".rst"}


@dataclass(slots=True)
class DocumentIngestResult:
    source: str
    filename: str
    status: str
    chunks_written: int
    page_count: int
    summary_updated: bool


@dataclass(slots=True)
class SummaryCandidate:
    source: str
    display_name: str
    summary: str
    page_count: int
    chunk_count: int
    dense_score: float | None = None
    lexical_score: float | None = None
    fused_score: float = 0.0


@dataclass(slots=True)
class ChunkCandidate:
    chunk_id: str
    source: str
    page: int | None
    text: str
    dense_score: float | None = None
    lexical_score: float | None = None
    fused_score: float = 0.0


def _dsn() -> str:
    return (
        f"host={os.environ['POSTGRES_HOST']} "
        f"port={os.environ['POSTGRES_PORT']} "
        f"dbname={os.environ['POSTGRES_DB']} "
        f"user={os.environ['POSTGRES_USER']} "
        f"password={os.environ['POSTGRES_PASSWORD']}"
    )


def _sanitize(text: str) -> str:
    return text.replace("\x00", "")


def _page_value(raw: Any) -> int | None:
    if raw in (None, ""):
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _fts_terms(question: str) -> str | None:
    cleaned = re.sub(r"[^\w\s-]", " ", question.lower())
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or None


def _message_text(message: Any) -> str:
    content = getattr(message, "content", message)
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                parts.append(str(item.get("text", "")).strip())
            else:
                parts.append(str(item).strip())
        return "\n".join(part for part in parts if part).strip()
    return str(content).strip()


def _collapse_whitespace(text: str, limit: int) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    return compact[:limit]


def _fallback_summary(source: str, text: str) -> str:
    excerpt = _collapse_whitespace(text, 1200)
    if not excerpt:
        return f"Documento {source} sem conteúdo textual extraído suficiente para resumo."
    return (
        f"Documento {Path(source).name}. "
        f"Resumo extrativo inicial: {excerpt}"
    )


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _embedder() -> OllamaEmbeddings:
    return OllamaEmbeddings(
        model=os.environ["OLLAMA_EMBEDDING_MODEL"],
        base_url=os.environ["OLLAMA_BASE_URL"],
    )


def _llm() -> ChatOllama:
    return ChatOllama(
        model=os.environ["OLLAMA_LLM_MODEL"],
        base_url=os.environ["OLLAMA_BASE_URL"],
        temperature=0,
    )


def ensure_supporting_schema() -> None:
    with psycopg.connect(_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {SUMMARY_TABLE} (
                    source_key TEXT PRIMARY KEY,
                    display_name TEXT NOT NULL,
                    content_hash TEXT NOT NULL,
                    page_count INTEGER NOT NULL DEFAULT 0,
                    chunk_count INTEGER NOT NULL DEFAULT 0,
                    summary TEXT NOT NULL,
                    summary_embedding VECTOR({EMBEDDING_DIMENSIONS}),
                    metadata JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                f"""
                CREATE INDEX IF NOT EXISTS rag_document_registry_summary_hnsw_idx
                ON {SUMMARY_TABLE}
                USING hnsw (summary_embedding vector_cosine_ops)
                """
            )
            cur.execute(
                f"""
                CREATE INDEX IF NOT EXISTS rag_document_registry_fts_idx
                ON {SUMMARY_TABLE}
                USING gin (
                    to_tsvector(
                        'simple',
                        coalesce(display_name, '') || ' ' || coalesce(summary, '')
                    )
                )
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS rag_langchain_source_idx
                ON langchain_pg_embedding ((cmetadata->>'source'))
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS rag_langchain_embedding_hnsw_idx
                ON langchain_pg_embedding
                USING hnsw (embedding vector_cosine_ops)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS rag_langchain_fts_idx
                ON langchain_pg_embedding
                USING gin (
                    to_tsvector(
                        'simple',
                        coalesce(cmetadata->>'source', '') || ' ' || coalesce(document, '')
                    )
                )
                """
            )
        conn.commit()


def _normalize_source(file_path: str, root: str | None = None, source_override: str | None = None) -> str:
    if source_override:
        return Path(source_override).as_posix()

    path = Path(file_path).resolve()
    if root:
        root_path = Path(root).resolve()
        try:
            return path.relative_to(root_path).as_posix()
        except ValueError:
            pass
    return path.name


def _resolve_files(path: str) -> list[Path]:
    root = Path(path)
    if root.is_file():
        return [root]

    files = [
        file_path
        for file_path in root.rglob("*")
        if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    return sorted(files)


def _load_documents(file_path: str, source_key: str) -> list[Document]:
    path = Path(file_path)
    if path.suffix.lower() == ".pdf":
        loader = PyPDFLoader(str(path))
    else:
        loader = TextLoader(str(path), encoding="utf-8")

    documents = loader.load()
    normalized: list[Document] = []
    for index, doc in enumerate(documents, start=1):
        metadata = dict(doc.metadata or {})
        metadata["source"] = source_key
        metadata.setdefault("page", index)
        normalized.append(Document(page_content=_sanitize(doc.page_content), metadata=metadata))
    return normalized


def _document_text(documents: Iterable[Document]) -> str:
    return "\n\n".join(doc.page_content for doc in documents if doc.page_content).strip()


def _summarize_document(source_key: str, text: str) -> str:
    if not text.strip():
        return _fallback_summary(source_key, text)

    excerpt = text[:9000]
    if len(text) > 12000:
        excerpt = f"{text[:6000]}\n[...]\n{text[-3000:]}"

    prompt = (
        "Voce esta preparando um indice de documentos para um sistema RAG corporativo. "
        "Resuma o documento abaixo em portugues, sem inventar fatos. "
        "Inclua tema central, conceitos importantes, nomes proprios, siglas, datas e quando este documento costuma ser relevante. "
        "Use no maximo 900 caracteres.\n\n"
        f"Arquivo: {Path(source_key).name}\n"
        f"Documento:\n{excerpt}"
    )

    try:
        return _message_text(_llm().invoke(prompt)) or _fallback_summary(source_key, text)
    except Exception:
        return _fallback_summary(source_key, text)


def _ensure_collection(cur: psycopg.Cursor) -> str:
    cur.execute(
        "SELECT uuid FROM langchain_pg_collection WHERE name = %s",
        (COLLECTION_NAME,),
    )
    row = cur.fetchone()
    if row:
        return str(row[0])

    collection_id = str(uuid.uuid4())
    cur.execute(
        "INSERT INTO langchain_pg_collection (uuid, name, cmetadata) VALUES (%s, %s, %s)",
        (collection_id, COLLECTION_NAME, json.dumps({})),
    )
    return collection_id


def _delete_source_chunks(cur: psycopg.Cursor, source_key: str) -> None:
    cur.execute(
        """
        DELETE FROM langchain_pg_embedding AS embedding
        USING langchain_pg_collection AS collection
        WHERE embedding.collection_id = collection.uuid
          AND collection.name = %s
          AND embedding.cmetadata->>'source' = %s
        """,
        (COLLECTION_NAME, source_key),
    )


def _existing_document(cur: psycopg.Cursor, source_key: str) -> dict[str, Any] | None:
    cur.execute(
        f"""
        SELECT source_key, content_hash, page_count, chunk_count
        FROM {SUMMARY_TABLE}
        WHERE source_key = %s
        """,
        (source_key,),
    )
    row = cur.fetchone()
    if row is None:
        return None
    return {
        "source_key": row[0],
        "content_hash": row[1],
        "page_count": row[2],
        "chunk_count": row[3],
    }


def _insert_chunks(
    cur: psycopg.Cursor,
    collection_id: str,
    chunks: list[Document],
    embeddings_list: list[list[float]],
) -> None:
    for chunk, embedding in zip(chunks, embeddings_list):
        metadata = {
            key: _sanitize(value) if isinstance(value, str) else value
            for key, value in (chunk.metadata or {}).items()
        }
        cur.execute(
            """
            INSERT INTO langchain_pg_embedding (id, collection_id, embedding, document, cmetadata)
            VALUES (%s, %s, %s::vector, %s, %s)
            """,
            (
                str(uuid.uuid4()),
                collection_id,
                str(embedding),
                _sanitize(chunk.page_content),
                json.dumps(metadata),
            ),
        )


def _upsert_document_registry(
    cur: psycopg.Cursor,
    *,
    source_key: str,
    display_name: str,
    content_hash: str,
    page_count: int,
    chunk_count: int,
    summary: str,
    summary_embedding: list[float],
    metadata: dict[str, Any],
) -> None:
    cur.execute(
        f"""
        INSERT INTO {SUMMARY_TABLE} (
            source_key,
            display_name,
            content_hash,
            page_count,
            chunk_count,
            summary,
            summary_embedding,
            metadata,
            updated_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s::vector, %s, NOW())
        ON CONFLICT (source_key)
        DO UPDATE SET
            display_name = EXCLUDED.display_name,
            content_hash = EXCLUDED.content_hash,
            page_count = EXCLUDED.page_count,
            chunk_count = EXCLUDED.chunk_count,
            summary = EXCLUDED.summary,
            summary_embedding = EXCLUDED.summary_embedding,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        """,
        (
            source_key,
            display_name,
            content_hash,
            page_count,
            chunk_count,
            summary,
            str(summary_embedding),
            json.dumps(metadata),
        ),
    )


def ingest_path(
    path: str,
    *,
    source_override: str | None = None,
    reset: bool = False,
) -> list[DocumentIngestResult]:
    ensure_supporting_schema()

    files = _resolve_files(path)
    root = path if Path(path).is_dir() else None
    embedder = _embedder()
    splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    results: list[DocumentIngestResult] = []

    with psycopg.connect(_dsn()) as conn:
        with conn.cursor() as cur:
            collection_id = _ensure_collection(cur)

            for file_path in files:
                source_key = _normalize_source(str(file_path), root=root, source_override=source_override)
                documents = _load_documents(str(file_path), source_key)
                full_text = _document_text(documents)
                content_hash = _hash_text(full_text)
                existing = _existing_document(cur, source_key)

                if existing and existing["content_hash"] == content_hash and not reset:
                    results.append(
                        DocumentIngestResult(
                            source=source_key,
                            filename=file_path.name,
                            status="skipped",
                            chunks_written=0,
                            page_count=len(documents),
                            summary_updated=False,
                        )
                    )
                    continue

                _delete_source_chunks(cur, source_key)
                chunks = splitter.split_documents(documents)
                for chunk in chunks:
                    chunk.metadata = dict(chunk.metadata or {})
                    chunk.metadata["source"] = source_key
                    chunk.metadata.setdefault("page", 1)

                batch_size = 50
                total_written = 0
                for index in range(0, len(chunks), batch_size):
                    batch = chunks[index:index + batch_size]
                    batch_texts = [_sanitize(chunk.page_content) for chunk in batch]
                    embeddings_list = embedder.embed_documents(batch_texts)
                    _insert_chunks(cur, collection_id, batch, embeddings_list)
                    total_written += len(batch)

                summary = _summarize_document(source_key, full_text)
                summary_embedding = embedder.embed_query(summary)
                _upsert_document_registry(
                    cur,
                    source_key=source_key,
                    display_name=file_path.name,
                    content_hash=content_hash,
                    page_count=len(documents),
                    chunk_count=total_written,
                    summary=summary,
                    summary_embedding=summary_embedding,
                    metadata={
                        "source": source_key,
                        "display_name": file_path.name,
                        "suffix": file_path.suffix.lower(),
                    },
                )

                results.append(
                    DocumentIngestResult(
                        source=source_key,
                        filename=file_path.name,
                        status="updated" if existing else "ingested",
                        chunks_written=total_written,
                        page_count=len(documents),
                        summary_updated=True,
                    )
                )

        conn.commit()

    return results


def backfill_document_registry() -> int:
    ensure_supporting_schema()

    with psycopg.connect(_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {SUMMARY_TABLE}")
            if int(cur.fetchone()[0]) > 0:
                return 0

            cur.execute(
                """
                SELECT
                    embedding.cmetadata->>'source' AS source,
                    CAST(NULLIF(embedding.cmetadata->>'page', '') AS INTEGER) AS page,
                    embedding.document
                FROM langchain_pg_embedding AS embedding
                JOIN langchain_pg_collection AS collection
                  ON collection.uuid = embedding.collection_id
                WHERE collection.name = %s
                ORDER BY embedding.cmetadata->>'source', page NULLS LAST, embedding.id
                """,
                (COLLECTION_NAME,),
            )
            rows = cur.fetchall()

        grouped: dict[str, list[tuple[int | None, str]]] = defaultdict(list)
        for source, page, document in rows:
            if not source:
                continue
            grouped[str(source)].append((_page_value(page), str(document or "")))

        if not grouped:
            return 0

        embedder = _embedder()

        with conn.cursor() as cur:
            for source_key, items in grouped.items():
                preview_text = "\n\n".join(text for _, text in items[:SUMMARY_BACKFILL_CHUNKS])
                summary = _fallback_summary(source_key, preview_text)
                summary_embedding = embedder.embed_query(summary)
                pages = [page for page, _ in items if page is not None]
                _upsert_document_registry(
                    cur,
                    source_key=source_key,
                    display_name=Path(source_key).name,
                    content_hash=_hash_text(preview_text),
                    page_count=max(pages) if pages else len(items),
                    chunk_count=len(items),
                    summary=summary,
                    summary_embedding=summary_embedding,
                    metadata={"source": source_key, "display_name": Path(source_key).name, "backfilled": True},
                )
            conn.commit()

    return len(grouped)


def _summary_dense_search(query_embedding: list[float], limit: int) -> list[SummaryCandidate]:
    with psycopg.connect(_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    source_key,
                    display_name,
                    summary,
                    page_count,
                    chunk_count,
                    1 - (summary_embedding <=> %s::vector) AS dense_score
                FROM {SUMMARY_TABLE}
                WHERE summary_embedding IS NOT NULL
                ORDER BY summary_embedding <=> %s::vector
                LIMIT %s
                """,
                (str(query_embedding), str(query_embedding), limit),
            )
            rows = cur.fetchall()

    return [
        SummaryCandidate(
            source=str(row[0]),
            display_name=str(row[1]),
            summary=str(row[2]),
            page_count=int(row[3] or 0),
            chunk_count=int(row[4] or 0),
            dense_score=float(row[5]) if row[5] is not None else None,
        )
        for row in rows
    ]


def _summary_lexical_search(question: str, limit: int) -> list[SummaryCandidate]:
    terms = _fts_terms(question)
    if not terms:
        return []

    with psycopg.connect(_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                WITH query AS (SELECT plainto_tsquery('simple', %s) AS q)
                SELECT
                    source_key,
                    display_name,
                    summary,
                    page_count,
                    chunk_count,
                    ts_rank_cd(
                        to_tsvector('simple', coalesce(display_name, '') || ' ' || coalesce(summary, '')),
                        query.q
                    ) AS lexical_score
                FROM {SUMMARY_TABLE}, query
                WHERE to_tsvector('simple', coalesce(display_name, '') || ' ' || coalesce(summary, '')) @@ query.q
                ORDER BY lexical_score DESC
                LIMIT %s
                """,
                (terms, limit),
            )
            rows = cur.fetchall()

    return [
        SummaryCandidate(
            source=str(row[0]),
            display_name=str(row[1]),
            summary=str(row[2]),
            page_count=int(row[3] or 0),
            chunk_count=int(row[4] or 0),
            lexical_score=float(row[5]) if row[5] is not None else None,
        )
        for row in rows
    ]


def _chunk_dense_search(
    query_embedding: list[float],
    limit: int,
    allowed_sources: list[str] | None = None,
) -> list[ChunkCandidate]:
    filters = ""
    params: list[Any] = [str(query_embedding), COLLECTION_NAME]
    if allowed_sources:
        filters = " AND embedding.cmetadata->>'source' = ANY(%s)"
        params.append(allowed_sources)
    params.extend([str(query_embedding), limit])

    query = f"""
        SELECT
            embedding.id,
            embedding.cmetadata->>'source' AS source,
            CAST(NULLIF(embedding.cmetadata->>'page', '') AS INTEGER) AS page,
            embedding.document,
            1 - (embedding.embedding <=> %s::vector) AS dense_score
        FROM langchain_pg_embedding AS embedding
        JOIN langchain_pg_collection AS collection
          ON collection.uuid = embedding.collection_id
        WHERE collection.name = %s {filters}
        ORDER BY embedding.embedding <=> %s::vector
        LIMIT %s
    """

    with psycopg.connect(_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()

    return [
        ChunkCandidate(
            chunk_id=str(row[0]),
            source=str(row[1]),
            page=_page_value(row[2]),
            text=str(row[3] or ""),
            dense_score=float(row[4]) if row[4] is not None else None,
        )
        for row in rows
        if row[1]
    ]


def _chunk_lexical_search(
    question: str,
    limit: int,
    allowed_sources: list[str] | None = None,
) -> list[ChunkCandidate]:
    terms = _fts_terms(question)
    if not terms:
        return []

    filters = ""
    params: list[Any] = [terms, COLLECTION_NAME]
    if allowed_sources:
        filters = " AND embedding.cmetadata->>'source' = ANY(%s)"
        params.append(allowed_sources)
    params.append(limit)

    query = f"""
        WITH query AS (SELECT plainto_tsquery('simple', %s) AS q)
        SELECT
            embedding.id,
            embedding.cmetadata->>'source' AS source,
            CAST(NULLIF(embedding.cmetadata->>'page', '') AS INTEGER) AS page,
            embedding.document,
            ts_rank_cd(
                to_tsvector('simple', coalesce(embedding.cmetadata->>'source', '') || ' ' || coalesce(embedding.document, '')),
                query.q
            ) AS lexical_score
        FROM langchain_pg_embedding AS embedding
        JOIN langchain_pg_collection AS collection
          ON collection.uuid = embedding.collection_id,
          query
        WHERE collection.name = %s
          AND to_tsvector('simple', coalesce(embedding.cmetadata->>'source', '') || ' ' || coalesce(embedding.document, '')) @@ query.q
          {filters}
        ORDER BY lexical_score DESC
        LIMIT %s
    """

    with psycopg.connect(_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()

    return [
        ChunkCandidate(
            chunk_id=str(row[0]),
            source=str(row[1]),
            page=_page_value(row[2]),
            text=str(row[3] or ""),
            lexical_score=float(row[4]) if row[4] is not None else None,
        )
        for row in rows
        if row[1]
    ]


def _fuse_rankings(dense: list[Any], lexical: list[Any], key_fn) -> list[Any]:
    fused: dict[str, Any] = {}
    scores: dict[str, float] = defaultdict(float)

    for rank, item in enumerate(dense, start=1):
        item_key = str(key_fn(item))
        fused[item_key] = item
        scores[item_key] += 1 / (RRF_K + rank)

    for rank, item in enumerate(lexical, start=1):
        item_key = str(key_fn(item))
        existing = fused.get(item_key)
        if existing is None:
            fused[item_key] = item
        else:
            for attribute in ("lexical_score", "dense_score"):
                existing_value = getattr(existing, attribute, None)
                incoming_value = getattr(item, attribute, None)
                if existing_value is None and incoming_value is not None:
                    setattr(existing, attribute, incoming_value)
        scores[item_key] += 1 / (RRF_K + rank)

    ranked = list(fused.values())
    for item in ranked:
        setattr(item, "fused_score", scores[str(key_fn(item))])

    ranked.sort(key=lambda item: getattr(item, "fused_score", 0.0), reverse=True)
    return ranked


def _total_documents() -> int:
    with psycopg.connect(_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {SUMMARY_TABLE}")
            return int(cur.fetchone()[0])


def _is_broad_query(question: str) -> bool:
    lowered = question.lower()
    hints = (
        "todos",
        "todas",
        "completo",
        "completa",
        "analise",
        "analisa",
        "compare",
        "comparar",
        "resuma",
        "resumir",
        "panorama",
        "estado da arte",
        "roadmap",
        "melhor cenario",
        "na sua base",
        "quais documentos",
        "sem perder",
    )
    return any(hint in lowered for hint in hints)


def _rerank_chunks(
    chunks: list[ChunkCandidate],
    *,
    source_priority: list[str],
    k: int,
) -> list[ChunkCandidate]:
    if not chunks:
        return []

    by_source: dict[str, list[ChunkCandidate]] = defaultdict(list)
    for chunk in chunks:
        by_source[chunk.source].append(chunk)

    for candidates in by_source.values():
        candidates.sort(key=lambda item: item.fused_score, reverse=True)

    selected_ids: set[str] = set()
    reranked: list[ChunkCandidate] = []

    for source in source_priority:
        if len(reranked) >= k:
            break
        best = by_source.get(source, [])
        if not best:
            continue
        candidate = best[0]
        selected_ids.add(candidate.chunk_id)
        reranked.append(candidate)

    for candidate in sorted(chunks, key=lambda item: item.fused_score, reverse=True):
        if len(reranked) >= k:
            break
        if candidate.chunk_id in selected_ids:
            continue
        if reranked and candidate.source == reranked[-1].source and candidate.page == reranked[-1].page:
            continue
        selected_ids.add(candidate.chunk_id)
        reranked.append(candidate)

    return reranked


def _format_summary_context(summaries: list[SummaryCandidate]) -> str:
    if not summaries:
        return ""

    blocks = []
    for summary in summaries:
        blocks.append(
            "\n".join(
                [
                    f"[Resumo de documento: {summary.display_name}]",
                    f"Arquivo: {summary.source}",
                    f"Paginas: {summary.page_count}",
                    f"Chunks: {summary.chunk_count}",
                    f"Resumo: {summary.summary}",
                ]
            )
        )
    return "\n\n".join(blocks)


def _format_chunk_context(chunks: list[ChunkCandidate]) -> str:
    blocks = []
    for index, chunk in enumerate(chunks, start=1):
        page_text = str(chunk.page) if chunk.page is not None else "n/d"
        blocks.append(
            "\n".join(
                [
                    f"[Trecho {index}]",
                    f"Arquivo: {chunk.source}",
                    f"Pagina: {page_text}",
                    f"Score hibrido: {chunk.fused_score:.4f}",
                    "Conteudo:",
                    chunk.text,
                ]
            )
        )
    return "\n\n".join(blocks)


def query_with_hybrid_strategy(
    question: str,
    *,
    k: int = 4,
    coverage_mode: bool | None = None,
    candidate_pool: int = 24,
    lexical_pool: int = 24,
    summary_k: int = 6,
) -> dict[str, Any]:
    ensure_supporting_schema()
    backfill_document_registry()

    total_documents = _total_documents()
    effective_coverage = coverage_mode if coverage_mode is not None else _is_broad_query(question)
    query_embedding = _embedder().embed_query(question)

    summary_candidates: list[SummaryCandidate] = []
    selected_sources: list[str] = []
    if total_documents > 0 and effective_coverage:
        dense_summaries = _summary_dense_search(query_embedding, limit=total_documents)
        lexical_summaries = _summary_lexical_search(question, limit=total_documents)
        summary_candidates = _fuse_rankings(dense_summaries, lexical_summaries, key_fn=lambda item: item.source)
        selected_sources = [candidate.source for candidate in summary_candidates[: min(summary_k, len(summary_candidates), max(k, 3))]]

    dense_chunks = _chunk_dense_search(
        query_embedding,
        limit=max(candidate_pool, k),
        allowed_sources=selected_sources or None,
    )
    lexical_chunks = _chunk_lexical_search(
        question,
        limit=max(lexical_pool, k),
        allowed_sources=selected_sources or None,
    )
    fused_chunks = _fuse_rankings(dense_chunks, lexical_chunks, key_fn=lambda item: item.chunk_id)
    context_chunks = _rerank_chunks(fused_chunks, source_priority=selected_sources, k=k)
    context_summaries = summary_candidates[: min(3, len(summary_candidates))] if effective_coverage else []

    if not context_chunks and not context_summaries:
        return {
            "answer": "Nao encontrei evidencias suficientes na base para responder com seguranca. Reingira os documentos ou refine a pergunta.",
            "question": question,
            "framework": "langchain",
            "sources": [],
            "retrieval": {
                "strategy": "advanced_hybrid_hierarchical_langchain",
                "coverage_mode": effective_coverage,
                "documents_total": total_documents,
                "documents_screened": total_documents if effective_coverage else 0,
                "documents_selected": 0,
                "candidate_chunks": 0,
                "chunks_used": 0,
                "dense_hits": len(dense_chunks),
                "lexical_hits": len(lexical_chunks),
                "selected_documents": [],
                "notes": ["Nenhum documento recuperado para a pergunta."],
            },
        }

    summary_context = _format_summary_context(context_summaries)
    chunk_context = _format_chunk_context(context_chunks)
    context_parts = [part for part in [summary_context, chunk_context] if part]
    context = "\n\n".join(context_parts)

    prompt = (
        "Voce e um assistente especializado em RAG. "
        "Responda somente com base no contexto fornecido. "
        "Se o contexto nao sustentar a resposta, diga explicitamente que nao sabe. "
        "Quando usar uma fonte, cite arquivo e pagina dentro do texto. "
        "Ao final, adicione uma secao chamada 'Fontes utilizadas' com a lista das fontes realmente usadas.\n\n"
        f"Contexto:\n{context}\n\nPergunta: {question}"
    )
    answer = _message_text(_llm().invoke(prompt))

    source_rows: list[dict[str, Any]] = []
    seen_sources: set[tuple[str, int | None, str]] = set()
    for summary in context_summaries:
        key = (summary.source, None, "summary")
        if key in seen_sources:
            continue
        seen_sources.add(key)
        source_rows.append(
            {
                "source": summary.source,
                "page": None,
                "kind": "summary",
                "score": round(summary.fused_score, 6),
            }
        )

    for chunk in context_chunks:
        key = (chunk.source, chunk.page, "chunk")
        if key in seen_sources:
            continue
        seen_sources.add(key)
        source_rows.append(
            {
                "source": chunk.source,
                "page": chunk.page,
                "kind": "chunk",
                "score": round(chunk.fused_score, 6),
            }
        )

    return {
        "answer": answer,
        "question": question,
        "framework": "langchain",
        "sources": source_rows,
        "retrieval": {
            "strategy": "advanced_hybrid_hierarchical_langchain",
            "coverage_mode": effective_coverage,
            "documents_total": total_documents,
            "documents_screened": total_documents if effective_coverage else 0,
            "documents_selected": len(selected_sources),
            "candidate_chunks": len(fused_chunks),
            "chunks_used": len(context_chunks),
            "dense_hits": len(dense_chunks),
            "lexical_hits": len(lexical_chunks),
            "selected_documents": selected_sources,
            "notes": [
                "Dense retrieval + busca lexical com fusao RRF.",
                "Coverage mode usa resumo por documento antes da busca detalhada." if effective_coverage else "Coverage mode automatico nao foi ativado para esta pergunta.",
            ],
        },
    }