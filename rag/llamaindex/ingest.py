"""
LlamaIndex — Ingestão de documentos no pgvector.

CONCEITOS LLAMAINDEX:
  - SimpleDirectoryReader: carrega arquivos e retorna List[Document].
    Cada Document tem .text (str) e .metadata (dict).
  - Node: unidade básica de dados após o chunking.
    Equivalente ao Document pós-split do LangChain.
  - SentenceSplitter: divide Documents em Nodes respeitando fronteiras
    de sentenças — qualidade de chunk melhor que por contagem de chars.
  - Settings: objeto GLOBAL que configura LLM, embeddings e chunking
    para todo o projeto. Não precisa passar para cada função.
  - VectorStoreIndex: índice que une Nodes + VectorStore.
    Ao criar, calcula embeddings e armazena no pgvector.
  - StorageContext: agrupa os stores (vector, doc, index, graph).

Fluxo: arquivo → reader → nodes → VectorStoreIndex → pgvector
"""

import os
import sys

from dotenv import load_dotenv

# Settings: configuração global — diferença chave vs LangChain
from llama_index.core import Settings, SimpleDirectoryReader, VectorStoreIndex
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.storage.storage_context import StorageContext

# Integrações com Vertex AI
from llama_index.embeddings.vertex import VertexTextEmbedding
from llama_index.llms.vertex import Vertex

# Vector store para PostgreSQL + pgvector
from llama_index.vector_stores.postgres import PGVectorStore

load_dotenv()


def configure_settings():
    """
    LlamaIndex usa Settings global em vez de passar llm/embeddings
    para cada classe individualmente (ao contrário do LangChain).
    """
    Settings.llm = Vertex(
        model=os.environ["GEMINI_LLM_MODEL"],
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.environ["GOOGLE_CLOUD_LOCATION"],
    )
    Settings.embed_model = VertexTextEmbedding(
        model_name=os.environ["GEMINI_EMBEDDING_MODEL"],
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.environ["GOOGLE_CLOUD_LOCATION"],
    )
    Settings.chunk_size = 1000
    Settings.chunk_overlap = 150


def get_vector_store() -> PGVectorStore:
    """
    PGVectorStore do LlamaIndex conecta diretamente ao pgvector.
    Cria a tabela 'llamaindex_documents' automaticamente.
    Namespace separado do LangChain (tabela diferente).
    """
    return PGVectorStore.from_params(
        host=os.environ["POSTGRES_HOST"],
        port=int(os.environ["POSTGRES_PORT"]),
        database=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        table_name="llamaindex_documents",
        embed_dim=768,  # dimensão do text-embedding-004
    )


def ingest(path: str):
    configure_settings()

    print(f"[LlamaIndex] Carregando: {path}")

    # SimpleDirectoryReader detecta o tipo do arquivo automaticamente (PDF, txt, etc.)
    reader = (
        SimpleDirectoryReader(input_files=[path])
        if os.path.isfile(path)
        else SimpleDirectoryReader(path, recursive=True)
    )
    documents = reader.load_data()
    print(f"  {len(documents)} documento(s) carregado(s)")

    # SentenceSplitter: divide por fronteiras de sentenças.
    # Vantagem sobre RecursiveCharacterTextSplitter: não corta frases no meio.
    splitter = SentenceSplitter(chunk_size=1000, chunk_overlap=150)
    nodes = splitter.get_nodes_from_documents(documents)
    print(f"  {len(nodes)} node(s) gerado(s)")

    vector_store = get_vector_store()

    # StorageContext: camada de abstração que agrupa todos os stores
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    # VectorStoreIndex(nodes, ...): calcula embeddings de cada node e persiste
    VectorStoreIndex(nodes, storage_context=storage_context)
    print("  Salvo no pgvector com sucesso.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python -m rag.llamaindex.ingest <arquivo_ou_pasta>")
        sys.exit(1)
    ingest(sys.argv[1])
