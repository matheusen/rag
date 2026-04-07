"""
LangChain — Ingestão de documentos no pgvector.

CONCEITOS LANGCHAIN:
  - Document Loaders: carregam arquivos e retornam List[Document]
    cada Document tem .page_content (str) e .metadata (dict)
  - Text Splitters: dividem Documents em chunks menores
  - Embeddings: convertem texto em vetores numéricos
  - VectorStore (PGVector): armazena vetores + texto no PostgreSQL

Fluxo: arquivo → loader → splitter → embeddings → pgvector

NOTA: O ingest usa psycopg diretamente (sem PGVector.add_documents) para
evitar o erro `9h9h` de transação inválida do SQLAlchemy/langchain-postgres.
O PGVector ainda é usado para delete_collection() e para queries (query.py).
"""

import json
import os
import sys
import time
import uuid
from pathlib import Path

import psycopg
from dotenv import load_dotenv

# Document Loaders: cada classe sabe ler um tipo de arquivo
from langchain_community.document_loaders import (
    DirectoryLoader,
    PyPDFLoader,
    TextLoader,
)

# Embeddings: wrapper do Vertex AI para gerar vetores
from langchain_google_vertexai import VertexAIEmbeddings

# PGVector: VectorStore que usa PostgreSQL + extensão pgvector
from langchain_postgres import PGVector

# Text Splitter: divide documentos grandes em chunks com sobreposição
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

COLLECTION_NAME = "lc_documents"


def _dsn() -> str:
    """Retorna a DSN de conexão psycopg (formato libpq)."""
    return (
        f"host={os.environ['POSTGRES_HOST']} "
        f"port={os.environ['POSTGRES_PORT']} "
        f"dbname={os.environ['POSTGRES_DB']} "
        f"user={os.environ['POSTGRES_USER']} "
        f"password={os.environ['POSTGRES_PASSWORD']}"
    )


def get_vectorstore() -> PGVector:
    """
    Cria e retorna o VectorStore conectado ao PostgreSQL.

    PGVector mantém duas tabelas:
      - langchain_pg_collection: lista de coleções (namespaces)
      - langchain_pg_embedding:  vetores + metadados + texto original

    Usado apenas para delete_collection() e para queries (query.py).
    """
    from sqlalchemy import create_engine
    from sqlalchemy.pool import NullPool

    embeddings = VertexAIEmbeddings(
        model_name=os.environ["GEMINI_EMBEDDING_MODEL"]
    )
    connection_string = (
        f"postgresql+psycopg://{os.environ['POSTGRES_USER']}:{os.environ['POSTGRES_PASSWORD']}"
        f"@{os.environ['POSTGRES_HOST']}:{os.environ['POSTGRES_PORT']}/{os.environ['POSTGRES_DB']}"
    )
    engine = create_engine(connection_string, poolclass=NullPool)
    return PGVector(
        embeddings=embeddings,
        collection_name=COLLECTION_NAME,
        connection=engine,
        use_jsonb=True,
    )


def _ensure_collection(cur: psycopg.Cursor) -> str:
    """
    Garante que a coleção `lc_documents` existe na tabela langchain_pg_collection.
    Retorna o UUID da coleção.
    """
    cur.execute(
        "SELECT uuid FROM langchain_pg_collection WHERE name = %s",
        (COLLECTION_NAME,),
    )
    row = cur.fetchone()
    if row:
        return str(row[0])
    coll_id = str(uuid.uuid4())
    cur.execute(
        "INSERT INTO langchain_pg_collection (uuid, name, cmetadata) VALUES (%s, %s, %s)",
        (coll_id, COLLECTION_NAME, json.dumps({})),
    )
    return coll_id


def _sanitize(text: str) -> str:
    """Remove NUL bytes (0x00) que PostgreSQL não aceita em campos text."""
    return text.replace("\x00", "")


def _insert_batch_direct(texts: list[str], embeddings_list: list[list[float]], metadatas: list[dict]):
    """
    Insere um batch de chunks diretamente via psycopg, sem SQLAlchemy.
    Cada chamada abre e fecha sua própria conexão — sem pool, sem estado compartilhado.
    """
    with psycopg.connect(_dsn()) as conn:
        with conn.cursor() as cur:
            coll_id = _ensure_collection(cur)
            for text, embedding, meta in zip(texts, embeddings_list, metadatas):
                row_id = str(uuid.uuid4())
                clean_text = _sanitize(text)
                clean_meta = {k: _sanitize(v) if isinstance(v, str) else v for k, v in meta.items()}
                cur.execute(
                    """
                    INSERT INTO langchain_pg_embedding
                        (id, collection_id, embedding, document, cmetadata)
                    VALUES (%s, %s, %s::vector, %s, %s)
                    """,
                    (
                        row_id,
                        coll_id,
                        str(embedding),  # psycopg aceita str '[0.1, 0.2, ...]' para vector
                        clean_text,
                        json.dumps(clean_meta),
                    ),
                )
        conn.commit()


def load_documents(path: str):
    """Carrega documentos de arquivo ou diretório."""
    p = Path(path)
    if p.is_dir():
        # DirectoryLoader percorre subdiretórios recursivamente
        loader = DirectoryLoader(path, glob="**/*.pdf", loader_cls=PyPDFLoader)
    elif p.suffix.lower() == ".pdf":
        loader = PyPDFLoader(path)
    else:
        loader = TextLoader(path, encoding="utf-8")
    return loader.load()


def ingest(path: str, start_chunk: int = 0):
    print(f"[LangChain] Carregando: {path}")
    docs = load_documents(path)
    print(f"  {len(docs)} página(s) carregada(s)")

    # chunk_size=1000 chars, chunk_overlap=150 chars de sobreposição
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    chunks = splitter.split_documents(docs)
    print(f"  {len(chunks)} chunk(s) gerado(s)")

    if start_chunk == 0:
        # Limpar coleção existente usando PGVector (só aqui, uma vez)
        vs = get_vectorstore()
        vs.delete_collection()
    else:
        print(f"  Retomando do chunk {start_chunk} (pulando delete_collection)")

    # Inicializar modelo de embeddings (reutilizado em todos os batches)
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        embedder = VertexAIEmbeddings(model_name=os.environ["GEMINI_EMBEDDING_MODEL"])

    # Vertex AI: máx 250 instâncias E 20000 tokens por batch
    # chunk_size=1000 chars ≈ 250 tokens cada → usa 50 chunks/batch
    batch_size = 50
    total_batches = -(-len(chunks) // batch_size)
    for i in range(start_chunk, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        batch_num = i // batch_size + 1

        texts = [c.page_content for c in batch]
        texts = [_sanitize(t) for t in texts]  # remove NUL bytes (0x00) dos PDFs
        metadatas = [c.metadata for c in batch]

        # Gerar embeddings via Vertex AI
        embeddings_list = embedder.embed_documents(texts)

        # Inserir diretamente via psycopg (conexão nova por batch, sem pool)
        _insert_batch_direct(texts, embeddings_list, metadatas)

        print(f"  Batch {batch_num}/{total_batches} salvo ({len(batch)} chunks)")
        if i + batch_size < len(chunks):
            time.sleep(30)  # pausa 30s para respeitar quota do Vertex AI
    print("  Embeddings salvos no pgvector com sucesso.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python -m rag.langchain.ingest <arquivo_ou_pasta> [start_chunk]")
        sys.exit(1)
    start = int(sys.argv[2]) if len(sys.argv) >= 3 else 0
    ingest(sys.argv[1], start_chunk=start)
