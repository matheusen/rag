"use client";

import { useState, useCallback } from "react";
import { fetchArticles, fetchChunks, fetchChunkDetail, Article, ChunkPreview, ChunkDetail } from "@/lib/api";
import { Search, ChevronRight, Layers, X } from "lucide-react";

export default function ExplorerPage() {
  const [search, setSearch]       = useState("");
  const [articles, setArticles]   = useState<Article[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const [selectedArticle, setSelectedArticle]   = useState<string | null>(null);
  const [chunks, setChunks]                     = useState<ChunkPreview[]>([]);
  const [chunksLoading, setChunksLoading]       = useState(false);

  const [selectedChunk, setSelectedChunk]       = useState<ChunkDetail | null>(null);
  const [chunkLoading, setChunkLoading]         = useState(false);
  const [previewDims, setPreviewDims]           = useState(6);

  const searchArticles = useCallback(async () => {
    setLoading(true);
    setError("");
    setSelectedArticle(null);
    setChunks([]);
    setSelectedChunk(null);
    try {
      const data = await fetchArticles(search || undefined);
      setArticles(data);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [search]);

  const selectArticle = useCallback(async (article: string) => {
    setSelectedArticle(article);
    setSelectedChunk(null);
    setChunksLoading(true);
    try {
      const data = await fetchChunks({ article, limit: 50, preview_chars: 200, embedding_dims: previewDims });
      setChunks(data);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setChunksLoading(false);
    }
  }, [previewDims]);

  const selectChunk = useCallback(async (id: string) => {
    setChunkLoading(true);
    try {
      const data = await fetchChunkDetail(id, 30);
      setSelectedChunk(data);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setChunkLoading(false);
    }
  }, []);

  const shortName = (path: string) => path.split(/[\\/]/).pop() ?? path;

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">SQLAlchemy Explorer</h1>
      <p className="text-gray-400 text-sm mb-6">
        Inspecione artigos, chunks e embeddings salvos no pgvector via SQLAlchemy ORM.
      </p>

      {/* Search bar */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            placeholder="Filtrar por nome do artigo (deixe vazio para listar todos)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && searchArticles()}
          />
        </div>
        <button
          onClick={searchArticles}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Articles panel */}
        <div className="col-span-4 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-200">Artigos ({articles.length})</span>
            <Layers size={14} className="text-gray-400" />
          </div>
          <div className="overflow-y-auto max-h-[600px]">
            {articles.length === 0 && !loading && (
              <p className="text-gray-500 text-sm p-4">Clique em Buscar para listar artigos.</p>
            )}
            {articles.map(a => (
              <button
                key={a.article}
                onClick={() => selectArticle(a.article)}
                className={`w-full text-left px-4 py-3 border-b border-gray-800 hover:bg-gray-800 transition-colors group ${
                  selectedArticle === a.article ? "bg-gray-800 border-l-2 border-l-indigo-500" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-gray-200 leading-snug break-all">{shortName(a.article)}</span>
                  <ChevronRight size={14} className="text-gray-500 mt-0.5 shrink-0" />
                </div>
                <div className="mt-1 flex gap-3 text-xs text-gray-500">
                  <span>{a.total_chunks} chunks</span>
                  {a.min_page != null && <span>pág {a.min_page}–{a.max_page}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chunks panel */}
        <div className="col-span-4 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-200">
              Chunks {selectedArticle ? `(${chunks.length})` : ""}
            </span>
            <span className="text-xs text-gray-500">{selectedArticle ? shortName(selectedArticle) : "selecione um artigo"}</span>
          </div>
          <div className="overflow-y-auto max-h-[600px]">
            {chunksLoading && <p className="text-gray-500 text-sm p-4 animate-pulse">Carregando chunks…</p>}
            {!chunksLoading && chunks.length === 0 && (
              <p className="text-gray-500 text-sm p-4">Nenhum chunk. Selecione um artigo.</p>
            )}
            {chunks.map(c => (
              <button
                key={c.id}
                onClick={() => selectChunk(c.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-800 hover:bg-gray-800 transition-colors ${
                  selectedChunk?.id === c.id ? "bg-gray-800 border-l-2 border-l-emerald-500" : ""
                }`}
              >
                <div className="text-xs text-gray-400 mb-1">Pág {c.page ?? "?"} · {c.id.slice(0, 8)}…</div>
                <p className="text-xs text-gray-300 leading-relaxed line-clamp-3">{c.document_preview}</p>
                {c.embedding_preview && (
                  <p className="mt-1 text-[10px] text-indigo-400 font-mono truncate">
                    [{c.embedding_preview.map(v => v.toFixed(3)).join(", ")} …]
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chunk detail panel */}
        <div className="col-span-4 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-200">Detalhe do Chunk</span>
            {selectedChunk && (
              <button onClick={() => setSelectedChunk(null)} className="text-gray-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="p-4 overflow-y-auto max-h-[600px]">
            {chunkLoading && <p className="text-gray-400 text-sm animate-pulse">Carregando…</p>}
            {!chunkLoading && !selectedChunk && (
              <p className="text-gray-500 text-sm">Clique em um chunk para ver o texto completo e o embedding.</p>
            )}
            {selectedChunk && !chunkLoading && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">ID</label>
                  <p className="text-xs text-indigo-300 font-mono mt-0.5 break-all">{selectedChunk.id}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Artigo</label>
                  <p className="text-xs text-gray-300 mt-0.5 break-all">{shortName(selectedChunk.article ?? "")}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Página</label>
                  <p className="text-xs text-gray-300 mt-0.5">{selectedChunk.page ?? "?"}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Texto do Chunk</label>
                  <p className="text-xs text-gray-200 mt-1 leading-relaxed bg-gray-800 rounded p-3 whitespace-pre-wrap">
                    {selectedChunk.document}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">
                    Embedding (primeiras {selectedChunk.embedding?.length ?? 0} dims de {selectedChunk.embedding_dimensions})
                  </label>
                  <p className="text-[10px] text-indigo-300 font-mono mt-1 bg-gray-800 rounded p-2 break-all leading-relaxed">
                    [{selectedChunk.embedding?.map(v => v.toFixed(4)).join(", ")}]
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
