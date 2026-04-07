"""
RAG System — ingest documents into pgvector.
Usage:
    python -m rag.ingest <file_or_directory>
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader, TextLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_vertexai import VertexAIEmbeddings
from langchain_postgres import PGVector

load_dotenv()


def get_vectorstore():
    embeddings = VertexAIEmbeddings(
        model_name=os.environ["GEMINI_EMBEDDING_MODEL"]
    )
    connection = (
        f"postgresql+psycopg://{os.environ['POSTGRES_USER']}:{os.environ['POSTGRES_PASSWORD']}"
        f"@{os.environ['POSTGRES_HOST']}:{os.environ['POSTGRES_PORT']}/{os.environ['POSTGRES_DB']}"
    )
    return PGVector(
        embeddings=embeddings,
        collection_name="documents",
        connection=connection,
        use_jsonb=True,
    )


def load_documents(path: str):
    p = Path(path)
    if p.is_dir():
        loader = DirectoryLoader(path, glob="**/*.pdf", loader_cls=PyPDFLoader)
    elif p.suffix.lower() == ".pdf":
        loader = PyPDFLoader(path)
    else:
        loader = TextLoader(path, encoding="utf-8")
    return loader.load()


def ingest(path: str):
    print(f"Carregando documentos de: {path}")
    docs = load_documents(path)
    print(f"  {len(docs)} página(s) carregada(s)")

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    chunks = splitter.split_documents(docs)
    print(f"  {len(chunks)} chunk(s) gerado(s)")

    vs = get_vectorstore()
    batch_size = 50
    for i in range(0, len(chunks), batch_size):
        vs.add_documents(chunks[i:i + batch_size])
    print("  Embeddings salvos no pgvector com sucesso.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python -m rag.ingest <arquivo_ou_pasta>")
        sys.exit(1)
    ingest(sys.argv[1])
