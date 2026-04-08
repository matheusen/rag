"""
Router LangChain — endpoints de ingestão e consulta RAG.

Rotas:
  POST /langchain/ingest  — faz upload de um arquivo e ingere no pgvector
    POST /langchain/query   — faz uma pergunta ao pipeline híbrido coverage-aware
"""

import shutil
import tempfile

from fastapi import APIRouter, HTTPException, UploadFile, File

from api.schemas import IngestResponse, QueryRequest, QueryResponse
from rag.langchain.ingest import ingest
from rag.langchain.query import query

router = APIRouter(prefix="/langchain", tags=["LangChain"])


@router.post("/ingest", response_model=IngestResponse)
async def langchain_ingest(file: UploadFile = File(...)):
    """
    Recebe um arquivo (PDF ou texto), salva temporariamente e ingere
        no pgvector usando ingestão segura por documento.
    """
    # Salva o arquivo em disco temporariamente para os loaders do LangChain lerem
    suffix = "." + file.filename.split(".")[-1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        results = ingest(tmp_path, source_override=file.filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    first = results[0] if results else None

    message = "Documento processado com sucesso"
    if first and first.status == "skipped":
        message = "Documento já estava indexado; ingestão pulada"

    return IngestResponse(
        message=message,
        framework="langchain",
        filename=file.filename,
        source=first.source if first else file.filename,
        status=first.status if first else None,
        chunks_written=first.chunks_written if first else None,
        page_count=first.page_count if first else None,
        summary_updated=first.summary_updated if first else None,
    )


@router.post("/query", response_model=QueryResponse)
async def langchain_query(body: QueryRequest):
    """
    Recebe uma pergunta, faz triagem opcional por documento,
    combina retrieval denso + lexical com fusão RRF,
    reranqueia os chunks e gera uma resposta com fontes.
    """
    try:
        result = query(
            body.question,
            k=body.k,
            coverage_mode=body.coverage_mode,
            candidate_pool=body.candidate_pool,
            lexical_pool=body.lexical_pool,
            summary_k=body.summary_k,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return QueryResponse(**result)
