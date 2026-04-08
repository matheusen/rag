from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    question: str = Field(..., description="Pergunta a ser respondida pelo RAG")
    k: int = Field(4, ge=1, le=20, description="Número de chunks a recuperar do pgvector")
    coverage_mode: bool | None = Field(
        None,
        description="Força triagem por resumo por documento antes da busca detalhada",
    )
    candidate_pool: int = Field(24, ge=4, le=100, description="Quantidade de candidatos densos avaliados antes do rerank")
    lexical_pool: int = Field(24, ge=4, le=100, description="Quantidade de candidatos lexicais avaliados antes da fusão")
    summary_k: int = Field(6, ge=1, le=20, description="Quantidade máxima de documentos priorizados no coverage mode")


class QuerySource(BaseModel):
    source: str
    page: int | None = None
    kind: str = Field(..., description="Origem do contexto: chunk, summary ou image_ocr")
    asset_name: str | None = Field(None, description="Nome da imagem quando a fonte veio de OCR")
    score: float | None = None


class QueryRetrievalMetadata(BaseModel):
    strategy: str
    coverage_mode: bool
    documents_total: int | None = None
    documents_screened: int | None = None
    documents_selected: int | None = None
    candidate_chunks: int | None = None
    chunks_used: int | None = None
    dense_hits: int | None = None
    lexical_hits: int | None = None
    asset_dense_hits: int | None = None
    asset_lexical_hits: int | None = None
    image_chunks_used: int | None = None
    selected_documents: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class QueryResponse(BaseModel):
    answer: str
    framework: str
    question: str
    sources: list[QuerySource] = Field(default_factory=list)
    retrieval: QueryRetrievalMetadata | None = None


class IngestResponse(BaseModel):
    message: str
    framework: str
    filename: str
    source: str | None = None
    status: str | None = None
    chunks_written: int | None = None
    page_count: int | None = None
    summary_updated: bool | None = None
    image_assets: int | None = None
    ocr_chunks_written: int | None = None


class SQLAlchemyArticleSummary(BaseModel):
    article: str
    total_chunks: int
    min_page: int | None = None
    max_page: int | None = None


class SQLAlchemyChunkPreview(BaseModel):
    id: str
    article: str | None = None
    page: int | None = None
    document_preview: str | None = None
    embedding_preview: list[float] | None = None
    embedding_dimensions: int | None = None


class SQLAlchemyChunkDetail(BaseModel):
    id: str
    article: str | None = None
    page: int | None = None
    document: str | None = None
    embedding: list[float] | None = None
    embedding_dimensions: int | None = None


class SQLAlchemyImageAssetSummary(BaseModel):
    asset_id: str
    source: str
    asset_name: str
    asset_kind: str
    page: int | None = None
    ocr_engine: str | None = None
    ocr_chunks: int
    ocr_preview: str | None = None
