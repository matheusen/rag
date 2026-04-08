const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Article {
  article: string;
  total_chunks: number;
  min_page: number | null;
  max_page: number | null;
}

export interface ChunkPreview {
  id: string;
  article: string | null;
  page: number | null;
  document_preview: string | null;
  embedding_preview: number[] | null;
  embedding_dimensions: number | null;
}

export interface ChunkDetail extends ChunkPreview {
  document: string | null;
  embedding: number[] | null;
}

export interface QueryResponse {
  answer: string;
  framework: string;
  question: string;
}

export async function fetchArticles(contains?: string, limit = 100): Promise<Article[]> {
  const qs = new URLSearchParams();
  if (contains) qs.set("contains", contains);
  qs.set("limit", String(limit));
  const res = await fetch(`${BASE}/sqlalchemy/articles?${qs}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchChunks(params: {
  article?: string;
  page?: number;
  limit?: number;
  preview_chars?: number;
  embedding_dims?: number;
}): Promise<ChunkPreview[]> {
  const qs = new URLSearchParams();
  if (params.article) qs.set("article", params.article);
  if (params.page != null) qs.set("page", String(params.page));
  qs.set("limit", String(params.limit ?? 20));
  qs.set("preview_chars", String(params.preview_chars ?? 200));
  qs.set("embedding_dims", String(params.embedding_dims ?? 6));
  const res = await fetch(`${BASE}/sqlalchemy/chunks?${qs}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchChunkDetail(id: string, dims = 30): Promise<ChunkDetail> {
  const res = await fetch(`${BASE}/sqlalchemy/chunks/${id}?embedding_dims=${dims}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function ragQuery(
  question: string,
  framework: "langchain" | "llamaindex",
  k = 4
): Promise<QueryResponse> {
  const res = await fetch(`${BASE}/${framework}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, k }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
