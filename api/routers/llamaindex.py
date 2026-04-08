"""
Router LlamaIndex — endpoints de ingestão e consulta RAG.

Rotas:
  POST /llamaindex/ingest  — faz upload de um arquivo e ingere no pgvector
  POST /llamaindex/query   — faz uma pergunta ao RAG
"""

import shutil
import tempfile

from fastapi import APIRouter, HTTPException, UploadFile, File

from api.schemas import IngestResponse, QueryRequest, QueryResponse
from rag.llamaindex.ingest import ingest
from rag.llamaindex.query import query

router = APIRouter(prefix="/llamaindex", tags=["LlamaIndex"])


@router.post("/ingest", response_model=IngestResponse)
async def llamaindex_ingest(file: UploadFile = File(...)):
    """
    Recebe um arquivo (PDF ou texto), salva temporariamente e ingere
    no pgvector usando a pipeline LlamaIndex:
      UploadFile → SimpleDirectoryReader → SentenceSplitter → PGVectorStore
    """
    suffix = "." + file.filename.split(".")[-1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        ingest(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return IngestResponse(
        message="Documento ingerido com sucesso",
        framework="llamaindex",
        filename=file.filename,
    )


@router.post("/query", response_model=QueryResponse)
async def llamaindex_query(body: QueryRequest):
    """
    Recebe uma pergunta, busca os nodes mais relevantes no pgvector
    e gera uma resposta usando o query engine LlamaIndex:
      pergunta → VectorIndexRetriever → ResponseSynthesizer(compact) → Ollama
    """
    try:
        result = query(body.question, k=body.k)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return QueryResponse(**result)
