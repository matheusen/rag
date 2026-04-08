"""
LlamaIndex — Consulta RAG usando query engine.

CONCEITOS LLAMAINDEX:
  - VectorStoreIndex.from_vector_store(): reconecta ao pgvector existente
    SEM recalcular embeddings — só aponta para o store.
  - VectorIndexRetriever: busca os k Nodes mais similares à pergunta.
    Equivalente ao VectorStoreRetriever do LangChain.
  - ResponseSynthesizer: pega os Nodes recuperados e gera a resposta via LLM.
    Equivalente ao create_stuff_documents_chain do LangChain.
    Modos disponíveis:
      "compact"        → concatena docs em 1 prompt (padrão, mais barato)
      "tree_summarize" → hierárquico, bom para muitos docs
      "refine"         → itera doc a doc refinando (mais preciso, mais caro)
  - RetrieverQueryEngine: combina retriever + synthesizer.
    Equivalente ao create_retrieval_chain do LangChain.
    .query("pergunta") = chain.invoke({"input": "pergunta"})

DIFERENÇA CHAVE vs LangChain:
  - LangChain: retorna dict {"input": ..., "context": ..., "answer": ...}
  - LlamaIndex: retorna objeto Response com .response (str) e .source_nodes (list)

Fluxo: pergunta → retriever (pgvector) → synthesizer + nodes → LLM → resposta
"""

import os
import sys

from dotenv import load_dotenv
from opentelemetry import trace
from llama_index.core import Settings, VectorStoreIndex
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.core.response_synthesizers import get_response_synthesizer
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.storage.storage_context import StorageContext
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.llms.ollama import Ollama
from llama_index.vector_stores.postgres import PGVectorStore

load_dotenv()

# Tracer deste módulo — spans aparecem como "rag.llamaindex" no Jaeger
tracer = trace.get_tracer("rag.llamaindex", "1.0.0")


def configure_settings():
    Settings.llm = Ollama(
        model=os.environ["OLLAMA_LLM_MODEL"],
        base_url=os.environ["OLLAMA_BASE_URL"],
    )
    Settings.embed_model = OllamaEmbedding(
        model_name=os.environ["OLLAMA_EMBEDDING_MODEL"],
        base_url=os.environ["OLLAMA_BASE_URL"],
    )


def get_index() -> VectorStoreIndex:
    """
    Reconecta ao pgvector sem re-indexar.
    Nenhum embedding é calculado aqui — apenas conecta ao store existente.
    """
    vector_store = PGVectorStore.from_params(
        host=os.environ["POSTGRES_HOST"],
        port=int(os.environ["POSTGRES_PORT"]),
        database=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        table_name="llamaindex_documents",
        embed_dim=768,
    )
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    return VectorStoreIndex.from_vector_store(
        vector_store, storage_context=storage_context
    )


def query(question: str, k: int = 4) -> str:
    with tracer.start_as_current_span("llamaindex.rag.query") as span:
        span.set_attribute("rag.question", question)
        span.set_attribute("rag.k", k)
        span.set_attribute("rag.framework", "llamaindex")

        configure_settings()
        index = get_index()

        # VectorIndexRetriever: busca por similaridade cosine no pgvector
        retriever = VectorIndexRetriever(index=index, similarity_top_k=k)

        # compact: junta todos os nodes em 1 prompt (igual ao "stuff" do LangChain)
        synthesizer = get_response_synthesizer(response_mode="compact")

        # RetrieverQueryEngine: pipeline completo retriever → synthesizer
        engine = RetrieverQueryEngine(
            retriever=retriever,
            response_synthesizer=synthesizer,
        )

        # .query() retorna Response — use .response para o texto e .source_nodes para os docs usados
        with tracer.start_as_current_span("llamaindex.engine.query") as engine_span:
            response = engine.query(question)
            engine_span.set_attribute("rag.source_nodes_count", len(response.source_nodes))

        span.set_attribute("rag.answer_length", len(str(response.response)))
        return str(response.response)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python -m rag.llamaindex.query \"sua pergunta\"")
        sys.exit(1)
    answer = query(" ".join(sys.argv[1:]))
    print("\n--- Resposta (LlamaIndex) ---")
    print(answer)
