"use client";

import { useState, useRef, useEffect } from "react";
import { ragQuery, type QueryRetrievalMetadata, type QuerySource } from "@/lib/api";
import { Send, Bot, User, Trash2, Zap } from "lucide-react";

type Framework = "langchain" | "llamaindex";
type QueryMode = "auto" | "coverage";

interface Message {
  role: "user" | "assistant";
  content: string;
  framework?: Framework;
  time?: string;
  sources?: QuerySource[];
  retrieval?: QueryRetrievalMetadata | null;
}

const QUESTIONS = [
  "O que é RAG e como ele funciona?",
  "Qual a diferença entre LangChain e LlamaIndex?",
  "Como o pgvector armazena embeddings?",
  "O que é distance cosseno e por que é usada em busca semântica?",
  "Como funciona o chunking de documentos?",
  "O que é um VectorStore e qual sua função no RAG?",
  "Como o SQLAlchemy se conecta ao pgvector?",
  "O que é OpenTelemetry e como ele se aplica a sistemas RAG?",
  "Quais são os tipos de RAG? Explique cada um.",
  "Como melhorar a precisão de um sistema RAG?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! O cenário principal agora é o LangChain com retrieval híbrido e coverage mode. O LlamaIndex continua disponível como baseline vetorial de comparação.",
    },
  ]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [framework, setFramework] = useState<Framework>("langchain");
  const [mode, setMode]           = useState<QueryMode>("auto");
  const [k, setK]                 = useState(4);
  const bottomRef                 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(question?: string) {
    const q = (question ?? input).trim();
    if (!q || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: q, time: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await ragQuery(
        q,
        framework,
        k,
        mode === "coverage" ? { coverage_mode: true } : undefined,
      );
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: res.answer,
          framework,
          time: new Date().toLocaleTimeString(),
          sources: res.sources,
          retrieval: res.retrieval,
        },
      ]);
    } catch (e: unknown) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `Erro: ${String(e)}`, framework },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-48px)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Chat RAG</h1>
          <p className="text-gray-400 text-sm">LangChain = cenário escolhido com híbrido + coverage. LlamaIndex = baseline vetorial.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Framework toggle */}
          <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
            {(["langchain", "llamaindex"] as Framework[]).map(fw => (
              <button
                key={fw}
                onClick={() => setFramework(fw)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  framework === fw ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {fw === "langchain" ? "LangChain (principal)" : "LlamaIndex (baseline)"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>modo</span>
            <select
              value={mode}
              onChange={e => setMode(e.target.value as QueryMode)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
            >
              <option value="auto">auto</option>
              <option value="coverage">coverage</option>
            </select>
          </div>
          {/* K selector */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>k=</span>
            <select
              value={k}
              onChange={e => setK(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
            >
              {[2, 4, 6, 8, 10].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <button
            onClick={() => setMessages([{ role: "assistant", content: "Conversa limpa. Como posso ajudar?" }])}
            className="text-gray-400 hover:text-red-400 transition-colors"
            title="Limpar conversa"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Suggested questions */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-thin">
        {QUESTIONS.map(q => (
          <button
            key={q}
            onClick={() => send(q)}
            disabled={loading}
            className="shrink-0 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <Zap size={10} className="text-yellow-400" />
            {q.length > 50 ? q.slice(0, 50) + "…" : q}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              msg.role === "user" ? "bg-indigo-600" : "bg-gray-700"
            }`}>
              {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              {msg.framework && (
                <span className="text-[10px] text-gray-500 px-1">
                  via {msg.framework}
                  {msg.retrieval?.strategy ? ` • ${msg.retrieval.strategy}` : ""}
                </span>
              )}
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-gray-800 text-gray-200 rounded-tl-sm"
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="w-full rounded-xl border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs text-gray-400">
                  <p className="mb-2 font-semibold uppercase tracking-wide text-gray-500">Fontes</p>
                  <div className="flex flex-wrap gap-2">
                    {msg.sources.slice(0, 6).map((source, index) => (
                      <span key={`${source.source}-${source.page}-${index}`} className="rounded-full border border-gray-700 px-2 py-1 text-[10px]">
                        {source.source}
                        {source.page != null ? ` · p.${source.page}` : ""}
                        {source.asset_name ? ` · img:${source.asset_name}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {msg.retrieval && (
                <div className="w-full rounded-xl border border-gray-800 bg-gray-900/70 px-3 py-2 text-[11px] text-gray-400">
                  <p>
                    chunks usados: {msg.retrieval.chunks_used ?? 0} · candidatos: {msg.retrieval.candidate_chunks ?? 0} · coverage: {msg.retrieval.coverage_mode ? "on" : "off"}
                  </p>
                  {msg.retrieval.image_chunks_used ? (
                    <p>OCR de imagem usados: {msg.retrieval.image_chunks_used}</p>
                  ) : null}
                </div>
              )}
              {msg.time && <span className="text-[10px] text-gray-600 px-1">{msg.time}</span>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
              <Bot size={14} />
            </div>
            <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <span key={i} className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-2">
        <input
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          placeholder="Faça uma pergunta sobre os artigos ou sobre RAG…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          disabled={loading}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 rounded-xl transition-colors"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
