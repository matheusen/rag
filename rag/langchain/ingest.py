"""LangChain — ingestão segura com atualização por documento e índice de resumos."""

import sys

from rag.langchain.advanced import ingest_path


def ingest(path: str, reset: bool = False, source_override: str | None = None):
    print(f"[LangChain] Carregando: {path}")
    results = ingest_path(path, reset=reset, source_override=source_override)

    for result in results:
        print(
            f"  {result.filename}: status={result.status}, "
            f"chunks={result.chunks_written}, paginas={result.page_count}, resumo={result.summary_updated}"
        )

    if not results:
        print("  Nenhum arquivo suportado encontrado para ingestão.")

    return results


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python -m rag.langchain.ingest <arquivo_ou_pasta> [--reset]")
        sys.exit(1)

    ingest(sys.argv[1], reset="--reset" in sys.argv[2:])
