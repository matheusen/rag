"""LangChain — consulta RAG avançada com retrieval híbrido e coverage mode."""

import sys

from dotenv import load_dotenv
from opentelemetry import trace

from rag.langchain.advanced import query_with_hybrid_strategy

load_dotenv()

tracer = trace.get_tracer("rag.langchain", "1.0.0")


def query(
    question: str,
    k: int = 4,
    coverage_mode: bool | None = None,
    candidate_pool: int = 24,
    lexical_pool: int = 24,
    summary_k: int = 6,
) -> dict:
    with tracer.start_as_current_span("langchain.rag.query") as span:
        span.set_attribute("rag.question", question)
        span.set_attribute("rag.k", k)
        span.set_attribute("rag.framework", "langchain")
        if coverage_mode is not None:
            span.set_attribute("rag.coverage_mode_forced", coverage_mode)

        with tracer.start_as_current_span("langchain.hybrid.invoke") as invoke_span:
            result = query_with_hybrid_strategy(
                question,
                k=k,
                coverage_mode=coverage_mode,
                candidate_pool=candidate_pool,
                lexical_pool=lexical_pool,
                summary_k=summary_k,
            )
            retrieval = result.get("retrieval") or {}
            invoke_span.set_attribute("rag.chunks_retrieved", int(retrieval.get("chunks_used", 0) or 0))
            invoke_span.set_attribute("rag.candidate_chunks", int(retrieval.get("candidate_chunks", 0) or 0))
            invoke_span.set_attribute("rag.coverage_mode", bool(retrieval.get("coverage_mode", False)))
            invoke_span.set_attribute("rag.documents_selected", int(retrieval.get("documents_selected", 0) or 0))

        span.set_attribute("rag.answer_length", len(result["answer"]))
        return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python -m rag.langchain.query \"sua pergunta\"")
        sys.exit(1)

    result = query(" ".join(sys.argv[1:]))
    print("\n--- Resposta (LangChain) ---")
    print(result["answer"])
