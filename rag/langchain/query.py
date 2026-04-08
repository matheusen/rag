"""
LangChain — Consulta RAG usando chain.

CONCEITOS LANGCHAIN:
  - Retriever: interface genérica para buscar Documents relevantes.
    VectorStore.as_retriever() retorna um VectorStoreRetriever.
  - Chain: pipeline que encadeia etapas (retrieval → prompt → LLM).
  - create_retrieval_chain: chain que:
      1. Recebe o input do usuário
      2. Usa o retriever para buscar docs relevantes por similaridade
      3. Passa docs + pergunta para o LLM via prompt template
  - ChatPromptTemplate: template de mensagens com variáveis {input} e {context}.

Fluxo: pergunta → retriever (pgvector) → prompt + docs → LLM → resposta
"""

import os
import sys

from dotenv import load_dotenv
from opentelemetry import trace

# Chains prontas para RAG
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain

from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_postgres import PGVector

load_dotenv()

# Tracer deste módulo — spans aparecem como "rag.langchain" no Jaeger
tracer = trace.get_tracer("rag.langchain", "1.0.0")

# O prompt define o comportamento do LLM.
# {context} = documentos recuperados (injetados automaticamente pela chain)
# {input}   = pergunta do usuário
PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "Você é um assistente especializado. Use apenas o contexto abaixo para responder.\n\n"
     "Contexto:\n{context}"),
    ("human", "{input}"),
])


def get_vectorstore() -> PGVector:
    embeddings = OllamaEmbeddings(
        model=os.environ["OLLAMA_EMBEDDING_MODEL"],
        base_url=os.environ["OLLAMA_BASE_URL"],
    )
    connection = (
        f"postgresql+psycopg://{os.environ['POSTGRES_USER']}:{os.environ['POSTGRES_PASSWORD']}"
        f"@{os.environ['POSTGRES_HOST']}:{os.environ['POSTGRES_PORT']}/{os.environ['POSTGRES_DB']}"
    )
    return PGVector(
        embeddings=embeddings,
        collection_name="lc_documents",
        connection=connection,
        use_jsonb=True,
    )


def query(question: str, k: int = 4) -> str:
    with tracer.start_as_current_span("langchain.rag.query") as span:
        span.set_attribute("rag.question", question)
        span.set_attribute("rag.k", k)
        span.set_attribute("rag.framework", "langchain")

        vs = get_vectorstore()

        # Retriever: busca os k chunks mais similares por cosine similarity
        retriever = vs.as_retriever(search_kwargs={"k": k})

        llm = ChatOllama(
            model=os.environ["OLLAMA_LLM_MODEL"],
            base_url=os.environ["OLLAMA_BASE_URL"],
        )

        # create_stuff_documents_chain: "enfia" (stuff) todos os docs no prompt de uma vez.
        # Alternativas existentes: map_reduce (processa por partes), refine (itera doc a doc)
        document_chain = create_stuff_documents_chain(llm, PROMPT)

        # create_retrieval_chain combina: retriever → document_chain
        chain = create_retrieval_chain(retriever, document_chain)

        # .invoke() retorna dict com chaves: "input", "context" (docs usados) e "answer"
        with tracer.start_as_current_span("langchain.chain.invoke") as invoke_span:
            result = chain.invoke({"input": question})
            invoke_span.set_attribute("rag.chunks_retrieved", len(result.get("context", [])))

        span.set_attribute("rag.answer_length", len(result["answer"]))
        return result["answer"]


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python -m rag.langchain.query \"sua pergunta\"")
        sys.exit(1)
    answer = query(" ".join(sys.argv[1:]))
    print("\n--- Resposta (LangChain) ---")
    print(answer)
