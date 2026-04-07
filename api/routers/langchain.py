"""
Router LangChain — endpoints de ingestão e consulta RAG.

Rotas:
  POST /langchain/ingest  — faz upload de um arquivo e ingere no pgvector
  POST /langchain/query   — faz uma pergunta ao RAG
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
    no pgvector usando a pipeline LangChain:
      UploadFile → TextLoader/PyPDFLoader → RecursiveCharacterTextSplitter → PGVector
    """
    # Salva o arquivo em disco temporariamente para os loaders do LangChain lerem
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
        framework="langchain",
        filename=file.filename,
    )


@router.post("/query", response_model=QueryResponse)
async def langchain_query(body: QueryRequest):
    """
    Recebe uma pergunta, busca os chunks mais relevantes no pgvector
    e gera uma resposta usando a chain LangChain:
      pergunta → VectorStoreRetriever → create_stuff_documents_chain → Gemini
    """
    try:
        answer = query(body.question, k=body.k)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return QueryResponse(
        answer=answer,
        framework="langchain",
        question=body.question,
    )
