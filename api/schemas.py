from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    question: str = Field(..., description="Pergunta a ser respondida pelo RAG")
    k: int = Field(4, ge=1, le=20, description="Número de chunks a recuperar do pgvector")


class QueryResponse(BaseModel):
    answer: str
    framework: str
    question: str


class IngestResponse(BaseModel):
    message: str
    framework: str
    filename: str


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
