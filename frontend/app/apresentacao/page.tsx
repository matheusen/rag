"use client";

import { useState } from "react";
import {
  ChevronDown, ChevronUp, AlertTriangle, Lightbulb,
  Database, GitBranch, Zap, TrendingUp, CheckCircle,
  XCircle, ArrowRight, BarChart3, Layers, Clock,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   SLIDES — cada objeto é um "slide" da apresentação
   ───────────────────────────────────────────────────────────────────────────── */

const SLIDES = [
  /* ── 1 ── */
  {
    id: 1,
    color: "rose",
    icon: AlertTriangle,
    title: "O Problema",
    subtitle: "Por que LLM sozinho não basta",
    bullets: [
      { icon: "⏳", text: "Conhecimento estático — o modelo foi treinado até uma data de corte. Tudo depois disso ele não sabe." },
      { icon: "🌀", text: "Alucinação — sem fatos reais para ancorar a resposta, o modelo inventa com total confiança." },
      { icon: "🔒", text: "Dados privados — o LLM nunca viu sua documentação interna, contratos, tickets ou manuais." },
      { icon: "🔍", text: "Sem rastreabilidade — você não sabe de onde veio a informação. Em contextos jurídicos/médicos, isso é inaceitável." },
    ],
    highlight: {
      label: "Exemplo concreto",
      color: "rose",
      content: `Pergunta: "Qual a versão atual da nossa API de pagamentos?"

GPT-4 sem RAG → responde com base no treino, pode estar desatualizado, sem fonte.

GPT-4 com RAG → busca no Confluence/PDF interno → cita o trecho exato → resposta correta e auditável.`,
    },
  },
  /* ── 2 ── */
  {
    id: 2,
    color: "indigo",
    icon: Lightbulb,
    title: "O que é RAG",
    subtitle: "Retrieval-Augmented Generation",
    bullets: [
      { icon: "📖", text: "RAG = Retrieval-Augmented Generation — geração aumentada por recuperação de documentos." },
      { icon: "🎯", text: "Antes de gerar a resposta, o sistema busca os documentos relevantes e os injeta no prompt do LLM como contexto." },
      { icon: "🧠", text: "O LLM não precisa mais 'saber de cabeça' — ele lê os documentos em tempo real e responde com base neles." },
      { icon: "📅", text: "Proposto pelo Facebook AI Research (Lewis et al., 2020). Hoje é o padrão de mercado para QA sobre documentos." },
      { icon: "✅", text: "Resolve os 3 problemas ao mesmo tempo: atualiza conhecimento, ancora em fatos reais, suporta dados privados." },
    ],
    highlight: {
      label: "Analogia",
      color: "indigo",
      content: `Imagine um médico numa prova oral.

Sem RAG → responde só do que memorizou (pode estar errado ou desatualizado).

Com RAG → tem os prontuários e literatura médica na mesa — responde com base nos dados reais do paciente, citando a fonte.`,
    },
  },
  /* ── 3 ── */
  {
    id: 3,
    color: "teal",
    icon: Layers,
    title: "Como Funciona",
    subtitle: "O pipeline completo em 2 fases",
    bullets: [
      { icon: "🗂️", text: "FASE 1 — Indexação (offline, uma vez): documentos → loader → chunks → embedding → banco vetorial (pgvector)." },
      { icon: "🔢", text: "Chunk: pedaço de texto de ~512 tokens (≈380 palavras). Cada chunk vira um vetor numérico de 768 dimensões." },
      { icon: "📐", text: "Embedding: representação matemática do significado. Frases similares ficam próximas no espaço vetorial." },
      { icon: "⚡", text: "FASE 2 — Consulta (online, por query): embed da pergunta → busca cosine no pgvector (~5–50ms) → top-K chunks → LLM gera resposta." },
      { icon: "📌", text: "O LLM recebe apenas os trechos relevantes, não o documento inteiro. Cada resposta pode citar a fonte (arquivo, página)." },
    ],
    highlight: {
      label: "Pipeline visual",
      color: "teal",
      content: `INDEXAÇÃO (offline):
PDFs → Loader → Chunks → Embedding Model → Vetores → pgvector

CONSULTA (online, <1s total):
Pergunta → Embed → pgvector cosine search → Top-5 chunks
→ Prompt = "Com base nos documentos: {chunks} — {pergunta}"
→ LLM → Resposta com fonte citada`,
    },
  },
  /* ── 4 ── */
  {
    id: 4,
    color: "emerald",
    icon: GitBranch,
    title: "Tipos de RAG",
    subtitle: "Do básico ao estado da arte",
    bullets: [
      { icon: "1️⃣", text: "Naive RAG — fluxo linear: indexa → busca → gera. Simples, bom para protótipos, mas sem verificação de qualidade." },
      { icon: "2️⃣", text: "Advanced RAG — adiciona etapas: HyDE (gera doc hipotético para buscar), Query Expansion, Hybrid Search + RRF, Reranking." },
      { icon: "3️⃣", text: "Modular RAG — componentes independentes e trocáveis: retriever, memory, fusion, routing, generator." },
      { icon: "4️⃣", text: "Agentic RAG — o LLM age como agente com ferramentas de busca. Decide quando buscar, o que buscar, quantas rodadas." },
    ],
    highlight: {
      label: "Tabela — técnicas do Advanced RAG",
      color: "emerald",
      content: `QUANDO       │ TÉCNICA          │ O QUE FAZ
─────────────┼──────────────────┼──────────────────────────────────────────
Antes busca  │ HyDE             │ LLM gera doc hipotético → embed dele (mais preciso)
Antes busca  │ Query Expansion  │ Gera variações da pergunta, busca todas, combina
Na busca     │ Hybrid Search    │ Vetorial (semântica) + BM25 (palavras exatas) + RRF
Após busca   │ Reranking        │ Cross-encoder reordena top-50 → entrega top-5 ao LLM`,
    },
  },
  /* ── 5 ── */
  {
    id: 5,
    color: "fuchsia",
    icon: Zap,
    title: "Técnicas Mais Importantes (2024–2025)",
    subtitle: "O que os papers científicos demonstraram",
    bullets: [
      { icon: "🔀", text: "Busca Híbrida + RRF — combina vetorial (semântica) + BM25 (termos exatos). IBM: supera qualquer índice isolado e até fine-tuning de domínio específico." },
      { icon: "🎯", text: "FAIR-RAG — gap analysis iterativo: após cada busca, identifica o que falta e busca especificamente isso. +8 pts em HotpotQA." },
      { icon: "🌳", text: "RAG-Star — Monte Carlo Tree Search explora múltiplos caminhos de raciocínio, RAG verifica cada passo. +19% em raciocínio complexo." },
      { icon: "⚡", text: "REFRAG (Meta, 2025) — comprime chunks em embeddings antes do decoder. Atenção block-diagonal = 30× aceleração, zero perda de accuracy." },
      { icon: "🏋️", text: "RAG-Gym — treina agente com DPO, supervisão nos passos intermediários (não só na resposta). +24% em generalização out-of-distribution." },
      { icon: "🤝", text: "Collab-RAG — SLM local (3B params) decide quando/o que buscar; LLM grande (GPT-4) gera a resposta. Qualidade alta a custo baixo." },
    ],
    highlight: {
      label: "Números que importam",
      color: "fuchsia",
      content: `REFRAG   (Meta, 2025)  → 30× aceleração de inferência, 0% perda de accuracy
RAG-Gym  (UVA/NIH)    → +24% generalização com supervisão de processo
RAG-Star (Renmin)     → +19% em raciocínio complexo com MCTS
FAIR-RAG (Sharif)     → +8 pts HotpotQA, estado da arte multi-hop
IBM Blended RAG       → busca híbrida supera fine-tuning específico de domínio`,
    },
  },
  /* ── 6 ── */
  {
    id: 6,
    color: "green",
    icon: GitBranch,
    title: "GraphRAG — Quando as Relações Importam",
    subtitle: "Além da similaridade semântica",
    bullets: [
      { icon: "🔗", text: "Busca vetorial responde: 'qual o conteúdo deste chunk?'. GraphRAG responde: 'qual a RELAÇÃO entre A e B?'." },
      { icon: "🧩", text: "Knowledge Graph: triplas (sujeito → predicado → objeto). Excelente para raciocínio simbólico e cadeia causal." },
      { icon: "🕸️", text: "Hypergraph: uma aresta conecta N nós (não apenas 2). Representa relações N-árias que KG padrão não expressa." },
      { icon: "🌲", text: "Hierarchical (RAPTOR): árvore de resumos — pergunta abstrata consulta o topo, pergunta específica consulta a folha." },
      { icon: "🏢", text: "Microsoft GraphRAG (open-source): extrai entidades → detecta comunidades (Leiden) → gera resumos por comunidade → responde queries globais." },
    ],
    highlight: {
      label: "Quando usar cada um",
      color: "green",
      content: `VETORIAL (padrão)          │ GRAPHRAG
───────────────────────────┼──────────────────────────────────────────
Busca por similaridade     │ Busca por relações explícitas
FAQs, docs simples, rápido │ Domínios relacionais (médico, jurídico, financeiro)
Custo baixo de indexação   │ Indexação custosa (~$10–50/corpus)
Perguntas locais/pontuais  │ Perguntas multi-hop e análise de "quem conecta com quem"

→ Exemplo perfeito para GraphRAG:
"Quais as relações entre os times de backend e as falhas no módulo de pagamentos?"`,
    },
  },
  /* ── 7 ── */
  {
    id: 7,
    color: "amber",
    icon: BarChart3,
    title: "Long Context vs. RAG",
    subtitle: "A questão do Gemini 1M tokens — respondida com números",
    bullets: [
      { icon: "❓", text: "'Se o Gemini tem 1M tokens de contexto, por que construir RAG?' — a pergunta que todo mundo faz." },
      { icon: "💰", text: "CUSTO: 1.000 queries/dia com RAG (top-5 chunks) = ~$2/dia. Com long context (1M tokens) = ~$3.500/dia. Diferença: 1.750×." },
      { icon: "⏱️", text: "LATÊNCIA: atenção é O(n²). TTFT com 1M tokens = 30–60 segundos. RAG: < 1 segundo end-to-end." },
      { icon: "🎯", text: "LOST IN THE MIDDLE: modelos prestam mais atenção às bordas do contexto mesmo com janela grande." },
      { icon: "📏", text: "ESCALA: empresa média tem milhões de documentos. 1M tokens ≈ 2.500 páginas — não cabe nada real." },
      { icon: "🔐", text: "PRIVACIDADE: long context = enviar TODA a base para uma API a cada chamada. RAG = 3–10 chunks por query." },
    ],
    highlight: {
      label: "Tabela de custo",
      color: "amber",
      content: `ABORDAGEM                    │ CUSTO/DIA (1k queries) │ CUSTO/MÊS
─────────────────────────────┼────────────────────────┼──────────────
RAG — top-5 chunks (~5k tok) │ ~$2                    │ ~$60
Long context — 1M tokens     │ ~$3.500                │ ~$105.000
Diferença                    │ 1.750×                 │

→ Conclusão: long context para raciocínio INTERNO (ex: resumir tudo).
             RAG para acesso a conhecimento EXTERNO (ex: responder sobre docs).`,
    },
  },
  /* ── 8 ── */
  {
    id: 8,
    color: "sky",
    icon: CheckCircle,
    title: "Guia de Decisão",
    subtitle: "Quando usar RAG vs. fine-tuning vs. prompt engineering",
    bullets: [
      { icon: "✅", text: "Use RAG quando: dados privados, informação muda frequentemente, precisa citar fontes, base > 50 docs." },
      { icon: "❌", text: "NÃO use RAG quando: LLM já sabe a resposta com certeza, tarefa criativa sem base factual, < 20 docs curtos." },
      { icon: "🎛️", text: "Prompt Engineering: mais rápido e barato — use para validar o conceito primeiro." },
      { icon: "🔧", text: "Fine-tuning: quando precisar mudar o estilo/comportamento do modelo permanentemente. Alto custo, sem atualização dinâmica." },
      { icon: "🔀", text: "Combinação ideal para produção: RAG (dados certos) + Fine-tuning (comportamento) + Prompts (instruções)." },
    ],
    highlight: {
      label: "Comparativo",
      color: "sky",
      content: `CRITÉRIO              │ Prompt Eng. │ RAG  │ Fine-tuning
──────────────────────┼─────────────┼──────┼────────────
Conhecimento atual    │ ✗           │ ✓    │ ✗ (congelado)
Custo de setup        │ Baixo       │ Médio│ Alto
Citação de fontes     │ ✗           │ ✓    │ ✗
Privacidade de dados  │ Média       │ Alta │ Média
Velocidade de update  │ Imediata    │ Imediata│ Dias/semanas

Progressão prática: Prompt Engineering → + RAG → + Fine-tuning`,
    },
  },
  /* ── 9 ── */
  {
    id: 9,
    color: "blue",
    icon: Database,
    title: "Nossa Stack Técnica",
    subtitle: "O que estamos usando hoje",
    bullets: [
      { icon: "🐘", text: "pgvector — extensão nativa do PostgreSQL. Tipo vector(768), índice HNSW (busca em O(log n)). Sem banco separado." },
      { icon: "🦜", text: "LangChain — orquestração do pipeline: Loader → Splitter → Embedder → PGVector → Chain → LLM." },
      { icon: "🦙", text: "LlamaIndex — alternativa para indexação rica com DocumentStore e StorageContext estruturado." },
      { icon: "🤖", text: "Ollama (local) — nomic-embed-text (768 dims) + llama3.2. Zero custo de API, zero envio de dados externos." },
      { icon: "📡", text: "OpenTelemetry — traces (Jaeger + Tempo), métricas (Prometheus + Grafana), logs (Loki + Promtail). Cada query rastreada." },
    ],
    highlight: {
      label: "Fluxo completo neste projeto",
      color: "blue",
      content: `pergunta
  → OllamaEmbeddings.embed_query()
  → PGVector.similarity_search_with_score() (cosine, k=4, índice HNSW)
  → create_stuff_documents_chain (injeta chunks no prompt)
  → ChatOllama (llama3.2)
  → resposta com source_documents

Observabilidade:
  FastAPI → OTLP → OTel Collector → Jaeger + Tempo (traces)
                                  → Prometheus (métricas)
  logs/api.log → Promtail → Loki
  Grafana: correlação Traces ↔ Métricas ↔ Logs`,
    },
  },
  /* ── 10 ── */
  {
    id: 10,
    color: "violet",
    icon: Layers,
    title: "Padrão Map-Reduce",
    subtitle: "Analisar TODOS os documentos sem custo de long context",
    bullets: [
      { icon: "⚡", text: "RAG padrão: seleciona por similaridade → pode ignorar docs pouco similares mas relevantes." },
      { icon: "💸", text: "Long context para tudo: 1.750× mais caro. Inviável em produção." },
      { icon: "🗂️", text: "Fase de indexação: modelo barato gera 1 resumo por documento. Banco armazena: resumo (nível 1) + chunks detalhados (nível 2)." },
      { icon: "🔍", text: "Query específica → RAG padrão nos chunks. Análise completa → lê resumos de TODOS → detalha só os marcados como críticos." },
      { icon: "✅", text: "Verificação de cobertura (inspirado no FAIR-RAG): verifica quais fontes foram citadas, busca as não citadas antes de finalizar." },
    ],
    highlight: {
      label: "Comparativo de custo — 10 documentos",
      color: "violet",
      content: `ABORDAGEM               │ TOKENS/QUERY │ CUSTO APROX. │ COBERTURA
────────────────────────┼──────────────┼──────────────┼──────────
Long context (tudo)     │ ~500k        │ ~$1,75       │ 100%
RAG padrão (top-5)      │ ~5k          │ ~$0,002      │ 60–80%
Map-Reduce hierárquico  │ ~30k         │ ~$0,05       │ ~95%

→ 95% de cobertura por apenas 3% do custo do long context.`,
    },
  },
  /* ── 11 ── */
  {
    id: 11,
    color: "pink",
    icon: BarChart3,
    title: "Avaliação — Como Saber se o RAG Funciona",
    subtitle: "Métricas objetivas para cada etapa do pipeline",
    bullets: [
      { icon: "📊", text: "Recall@K — dos documentos relevantes existentes, quantos o retriever trouxe no top-K? (foco no retriever)" },
      { icon: "🎯", text: "Precision@K — dos K documentos trazidos, quantos são realmente relevantes? (evita ruído)" },
      { icon: "📐", text: "Faithfulness (RAGAS) — a resposta é fiel aos documentos recuperados? Detecta alucinações em relação ao contexto." },
      { icon: "💬", text: "Answer Relevancy (RAGAS) — a resposta endereça a pergunta ou desvia do tema?" },
      { icon: "🤖", text: "LLM-as-a-judge — usa GPT-4 para avaliar. 95% de concordância com avaliação humana. Escalável e barato." },
    ],
    highlight: {
      label: "Pirâmide de avaliação em produção",
      color: "pink",
      content: `         ┌───────────────────────────┐
         │     Avaliação humana      │  ← mais confiável, mais caro
         └─────────────┬─────────────┘
                       ↓
         ┌─────────────────────────────────┐
         │  LLM-as-a-judge (RAGAS, GPT-4)  │  ← escalável, custo médio
         └─────────────┬───────────────────┘
                       ↓
         ┌──────────────────────────────────────────┐
         │  Métricas automáticas (Recall, F1, ROUGE) │  ← barato, tempo real
         └──────────────────────────────────────────┘

→ Automáticas: monitoramento contínuo
→ LLM-judge:   avaliação semanal/mensal
→ Humana:      decisões de arquitetura`,
    },
  },
  /* ── 12 ── */
  {
    id: 12,
    color: "slate",
    icon: TrendingUp,
    title: "Roadmap e Próximos Passos",
    subtitle: "Do atual para o estado da arte",
    bullets: [
      { icon: "🟢", text: "CURTO PRAZO — busca híbrida como padrão (vetorial + BM25 + RRF), reranking com BGE Reranker, filtros por metadados." },
      { icon: "🟡", text: "MÉDIO PRAZO — Agentic RAG com multi-hop, GraphRAG para domínios relacionais, pipeline de avaliação RAGAS automatizado." },
      { icon: "🔵", text: "LONGO PRAZO — REFRAG para compressão de contexto (30×), OCR com Chandra 2 / MonkeyOCR para documentos escaneados." },
      { icon: "🧪", text: "DSPy (Stanford) — programação declarativa de pipelines LLM. Define a tarefa (Signature), o framework otimiza os prompts automaticamente." },
      { icon: "🌐", text: "RAG Multimodal — indexar imagens, screenshots e diagramas. AR-RAG (Meta/VT): primeiro RAG no nível de patch para geração de imagens." },
    ],
    highlight: {
      label: "Resumo — os 5 pontos que ficam",
      color: "slate",
      content: `1. RAG não é opcional para dados privados — o LLM não foi treinado no seu sistema.
2. Qualidade do retrieval determina a qualidade da resposta — garbage in, garbage out.
3. Busca híbrida (vetorial + BM25) deve ser o padrão, não a exceção.
4. Long context não substitui RAG — 1.750× mais caro com latência, privacidade e escala ruins.
5. Agentic RAG é o futuro — pipelines que aprendem a buscar superam estáticos em +24%.

Baseado em análise de 43 artigos científicos (2023–2025).`,
    },
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   ESTILOS
   ───────────────────────────────────────────────────────────────────────────── */

const colorMap: Record<string, { border: string; badge: string; icon: string; highlight: string; label: string }> = {
  rose:    { border: "border-rose-700/50",    badge: "bg-rose-900/60 text-rose-300",       icon: "text-rose-400",    highlight: "bg-rose-950/40 border-rose-700/40",    label: "text-rose-400" },
  indigo:  { border: "border-indigo-700/50",  badge: "bg-indigo-900/60 text-indigo-300",   icon: "text-indigo-400",  highlight: "bg-indigo-950/40 border-indigo-700/40",  label: "text-indigo-400" },
  teal:    { border: "border-teal-700/50",    badge: "bg-teal-900/60 text-teal-300",       icon: "text-teal-400",    highlight: "bg-teal-950/40 border-teal-700/40",      label: "text-teal-400" },
  emerald: { border: "border-emerald-700/50", badge: "bg-emerald-900/60 text-emerald-300", icon: "text-emerald-400", highlight: "bg-emerald-950/40 border-emerald-700/40", label: "text-emerald-400" },
  fuchsia: { border: "border-fuchsia-700/50", badge: "bg-fuchsia-900/60 text-fuchsia-300", icon: "text-fuchsia-400", highlight: "bg-fuchsia-950/40 border-fuchsia-700/40", label: "text-fuchsia-400" },
  green:   { border: "border-green-700/50",   badge: "bg-green-900/60 text-green-300",     icon: "text-green-400",   highlight: "bg-green-950/40 border-green-700/40",    label: "text-green-400" },
  amber:   { border: "border-amber-700/50",   badge: "bg-amber-900/60 text-amber-300",     icon: "text-amber-400",   highlight: "bg-amber-950/40 border-amber-700/40",    label: "text-amber-400" },
  sky:     { border: "border-sky-700/50",     badge: "bg-sky-900/60 text-sky-300",         icon: "text-sky-400",     highlight: "bg-sky-950/40 border-sky-700/40",        label: "text-sky-400" },
  blue:    { border: "border-blue-700/50",    badge: "bg-blue-900/60 text-blue-300",       icon: "text-blue-400",    highlight: "bg-blue-950/40 border-blue-700/40",      label: "text-blue-400" },
  violet:  { border: "border-violet-700/50",  badge: "bg-violet-900/60 text-violet-300",   icon: "text-violet-400",  highlight: "bg-violet-950/40 border-violet-700/40",  label: "text-violet-400" },
  pink:    { border: "border-pink-700/50",    badge: "bg-pink-900/60 text-pink-300",       icon: "text-pink-400",    highlight: "bg-pink-950/40 border-pink-700/40",      label: "text-pink-400" },
  slate:   { border: "border-slate-600/50",   badge: "bg-slate-700/60 text-slate-300",     icon: "text-slate-400",   highlight: "bg-slate-800/40 border-slate-600/40",    label: "text-slate-400" },
};

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENTE
   ───────────────────────────────────────────────────────────────────────────── */

export default function ApresentacaoPage() {
  const [open, setOpen] = useState<number | null>(1);
  const [showAll, setShowAll] = useState(false);

  const visibleSlides = showAll ? SLIDES : SLIDES.slice(0, 1);

  return (
    <div className="max-w-4xl mx-auto pb-16">

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 uppercase tracking-wide">
            Apresentação para a Equipe
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">
          RAG — Retrieval-Augmented Generation
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed max-w-2xl">
          Do problema ao estado da arte. Cada seção é um tópico de apresentação — expanda para ver
          os pontos e o exemplo concreto que você usa para explicar.
        </p>
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
          <span>{SLIDES.length} tópicos</span>
          <span>·</span>
          <span>43 artigos científicos (2023–2025)</span>
          <span>·</span>
          <span>REFRAG · RAG-Gym · FAIR-RAG · GraphRAG</span>
        </div>
      </div>

      {/* ── Navegação rápida ── */}
      <div className="flex flex-wrap gap-2 mb-8">
        {SLIDES.map(s => {
          const c = colorMap[s.color];
          const isActive = open === s.id;
          return (
            <button
              key={s.id}
              onClick={() => { setOpen(s.id); setShowAll(true); }}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                isActive
                  ? `${c.badge} ${c.border}`
                  : "bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
              }`}
            >
              {s.id}. {s.title}
            </button>
          );
        })}
      </div>

      {/* ── Slides ── */}
      <div className="space-y-3">
        {SLIDES.map((slide) => {
          const c = colorMap[slide.color];
          const isOpen = open === slide.id;
          const Icon = slide.icon;

          return (
            <div
              key={slide.id}
              id={`slide-${slide.id}`}
              className={`border rounded-2xl overflow-hidden bg-gray-900/50 transition-all ${c.border}`}
            >
              {/* Header do slide */}
              <button
                className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
                onClick={() => setOpen(isOpen ? null : slide.id)}
              >
                {/* Número */}
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${c.badge}`}>
                  {slide.id}
                </div>

                {/* Ícone */}
                <Icon size={18} className={`shrink-0 ${c.icon}`} />

                {/* Texto */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-base leading-tight">{slide.title}</div>
                  <div className="text-gray-400 text-xs mt-0.5">{slide.subtitle}</div>
                </div>

                {/* Chevron */}
                {isOpen
                  ? <ChevronUp size={16} className="text-gray-500 shrink-0" />
                  : <ChevronDown size={16} className="text-gray-500 shrink-0" />}
              </button>

              {/* Conteúdo expandido */}
              {isOpen && (
                <div className="px-6 pb-6 pt-2 space-y-5">

                  {/* Bullets */}
                  <ul className="space-y-3">
                    {slide.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="text-lg shrink-0 mt-0.5 leading-none">{b.icon}</span>
                        <span className="text-gray-200 text-sm leading-relaxed">{b.text}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Highlight box */}
                  <div className={`rounded-xl border p-4 ${c.highlight}`}>
                    <div className={`text-xs font-semibold uppercase tracking-wide mb-3 ${c.label}`}>
                      {slide.highlight.label}
                    </div>
                    <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono leading-relaxed">
                      {slide.highlight.content}
                    </pre>
                  </div>

                  {/* Navegação */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                    <button
                      onClick={() => {
                        if (slide.id > 1) setOpen(slide.id - 1);
                      }}
                      disabled={slide.id === 1}
                      className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                    >
                      ← anterior
                    </button>
                    <span className="text-xs text-gray-600">{slide.id} / {SLIDES.length}</span>
                    <button
                      onClick={() => {
                        if (slide.id < SLIDES.length) setOpen(slide.id + 1);
                      }}
                      disabled={slide.id === SLIDES.length}
                      className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                    >
                      próximo <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div className="mt-10 text-center text-xs text-gray-600">
        Baseado em análise de 43 artigos científicos (2023–2025) ·
        REFRAG (Meta) · RAG-Gym (UVA/NIH) · FAIR-RAG (Sharif) · RAG-Star (Renmin University) · IBM Blended RAG
      </div>
    </div>
  );
}
