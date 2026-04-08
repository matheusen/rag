import type { Metadata } from "next";
import Link from "next/link";
import { Source_Serif_4, Space_Grotesk } from "next/font/google";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle,
  Clock,
  Database,
  GitBranch,
  Layers,
  Lightbulb,
  MessageSquare,
  Search,
  TrendingUp,
  Zap,
} from "lucide-react";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700"],
});

const bodyFont = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Apresentação RAG",
  description: "Deck visual para apresentar RAG, GraphRAG, retrieval híbrido e roadmap ao time.",
};

type Tone = "coral" | "teal" | "blue" | "gold";
type PanelKey =
  | "problem"
  | "concept"
  | "pipeline"
  | "types"
  | "techniques"
  | "graph"
  | "cost"
  | "decision"
  | "stack"
  | "mapreduce"
  | "evaluation"
  | "roadmap";

type Section = {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  summary: string;
  bullets: string[];
  calloutTitle: string;
  calloutLines: string[];
  icon: LucideIcon;
  tone: Tone;
  panel: PanelKey;
};

const toneStyles: Record<Tone, { badge: string; dot: string; border: string; soft: string; panel: string; accent: string }> = {
  coral: {
    badge: "bg-[#ffe3da] text-[#9a3818]",
    dot: "bg-[#ef6b3f]",
    border: "border-[#e7d2c3]",
    soft: "bg-[#fff8f3]",
    panel: "bg-[#fff4ec]",
    accent: "text-[#a33b1a]",
  },
  teal: {
    badge: "bg-[#dff5ef] text-[#0f655b]",
    dot: "bg-[#2b9d8f]",
    border: "border-[#cfe5dd]",
    soft: "bg-[#f3fbf9]",
    panel: "bg-[#ecfaf7]",
    accent: "text-[#136b61]",
  },
  blue: {
    badge: "bg-[#e2efff] text-[#244c86]",
    dot: "bg-[#3f7ac4]",
    border: "border-[#d5dfef]",
    soft: "bg-[#f5f9ff]",
    panel: "bg-[#eef5ff]",
    accent: "text-[#28518c]",
  },
  gold: {
    badge: "bg-[#faefcf] text-[#8e5b0a]",
    dot: "bg-[#d39a2f]",
    border: "border-[#eadfbd]",
    soft: "bg-[#fffaf0]",
    panel: "bg-[#fff4d8]",
    accent: "text-[#8f6512]",
  },
};

const heroStats = [
  { value: "12", label: "blocos", detail: "do problema ao roadmap" },
  { value: "1.750x", label: "mais barato", detail: "que long context de 1M tokens" },
  { value: "5-50ms", label: "retrieval", detail: "com HNSW no pgvector" },
];

const flowHighlights = [
  "1. Comece pela dor: dado privado, desatualização e falta de rastreabilidade.",
  "2. Mostre o pipeline: retrieval primeiro, geração depois.",
  "3. Feche com decisão prática: quando usar RAG, quando não usar.",
  "4. Termine no roadmap: retrieval híbrido, rerank e agentic RAG.",
];

const sections: Section[] = [
  {
    id: "problema",
    number: "01",
    title: "O problema",
    subtitle: "Por que LLM sozinho não basta",
    summary:
      "Sem retrieval, o modelo responde com o que memorizou no treino. Isso quebra exatamente nos cenários mais críticos do trabalho: dado novo, dado privado e resposta auditável.",
    bullets: [
      "Conhecimento do modelo é estático e sempre vem com data de corte.",
      "Quando falta lastro factual, a resposta pode soar confiante e ainda assim estar errada.",
      "Documentação interna, tickets, contratos e runbooks nunca estiveram no corpus de treino público.",
      "Sem fonte citada, não existe trilha de auditoria para validar a resposta.",
    ],
    calloutTitle: "Exemplo que abre a conversa",
    calloutLines: [
      "Pergunta: qual é a versão atual da nossa API de pagamentos?",
      "Sem RAG, a resposta pode sair plausível, mas sem garantia de atualidade nem prova de origem.",
      "Com RAG, o sistema consulta a documentação interna primeiro, recupera o trecho certo e ancora a resposta na fonte.",
    ],
    icon: AlertTriangle,
    tone: "coral",
    panel: "problem",
  },
  {
    id: "conceito",
    number: "02",
    title: "O que é RAG",
    subtitle: "Retrieval-Augmented Generation",
    summary:
      "A lógica é simples e poderosa: antes de responder, o sistema busca os documentos relevantes e injeta esse material no prompt do LLM como contexto de trabalho.",
    bullets: [
      "RAG não depende de o modelo saber tudo de cabeça; ele lê o contexto certo em tempo real.",
      "A técnica reduz alucinação porque a resposta nasce de trechos recuperados, não apenas de memória paramétrica.",
      "Dados privados passam a fazer parte da resposta sem exigir retreinamento do modelo.",
      "Foi proposto em 2020 e hoje é o padrão para QA sobre bases documentais.",
    ],
    calloutTitle: "Analogia rápida",
    calloutLines: [
      "Sem RAG, o especialista responde de memória e pode errar por desatualização.",
      "Com RAG, ele entra na reunião com os prontuários e a literatura em cima da mesa.",
      "O ganho não é só precisão; é também confiança operacional para responder com base em prova.",
    ],
    icon: Lightbulb,
    tone: "teal",
    panel: "concept",
  },
  {
    id: "pipeline",
    number: "03",
    title: "Como funciona",
    subtitle: "Indexação offline e consulta online",
    summary:
      "RAG opera em duas fases. A primeira organiza o conhecimento em chunks vetorizados. A segunda usa a pergunta do usuário para recuperar os melhores trechos e só então gerar a resposta.",
    bullets: [
      "Na indexação: documentos passam por loader, chunking, embedding e armazenamento no pgvector.",
      "Chunk típico: cerca de 512 tokens, equilibrando precisão de retrieval e contexto suficiente para o LLM.",
      "Na consulta: a pergunta vira embedding, a busca por similaridade retorna o top-k e o LLM responde sobre esse contexto.",
      "A resposta pode trazer arquivo, página e score, o que melhora confiança e depuração.",
    ],
    calloutTitle: "Mensagem operacional",
    calloutLines: [
      "O banco vetorial não guarda apenas texto; ele guarda uma representação semântica do texto.",
      "O LLM não recebe o documento inteiro. Ele recebe só os trechos com maior chance de responder a pergunta.",
      "Isso explica por que RAG é mais barato e mais rápido do que despejar tudo na janela de contexto.",
    ],
    icon: Layers,
    tone: "blue",
    panel: "pipeline",
  },
  {
    id: "tipos",
    number: "04",
    title: "Tipos de RAG",
    subtitle: "Do básico ao estado da arte",
    summary:
      "RAG não é um único desenho arquitetural. O mercado já separa pipelines básicos, retrievers enriquecidos e agentes que decidem quando e como buscar.",
    bullets: [
      "Naive RAG resolve protótipo rápido: indexa, busca e gera.",
      "Advanced RAG melhora o retrieval com HyDE, query expansion, hybrid search e reranking.",
      "Modular RAG separa os blocos para trocar retriever, memória, roteamento e geração com mais liberdade.",
      "Agentic RAG trata busca como ferramenta, não como etapa fixa, o que ajuda em perguntas multi-hop.",
    ],
    calloutTitle: "Regra prática",
    calloutLines: [
      "Para base simples, Naive RAG entrega valor rápido.",
      "Quando o custo do erro sobe, o retrieval deixa de ser detalhe e vira a principal alavanca de qualidade.",
      "É por isso que o salto de protótipo para produção quase sempre passa por hybrid search e reranking.",
    ],
    icon: GitBranch,
    tone: "teal",
    panel: "types",
  },
  {
    id: "tecnicas",
    number: "05",
    title: "Técnicas mais importantes",
    subtitle: "O que os papers de 2024–2025 estão mostrando",
    summary:
      "O avanço recente do RAG não está só em modelos maiores. Está na forma como a busca é melhorada, verificada e comprimida antes de chegar ao decoder.",
    bullets: [
      "Busca híbrida com RRF combina semântica e correspondência lexical, elevando recall e precisão.",
      "Reranking com cross-encoder recupera rápido e decide devagar, o que costuma melhorar muito o top final entregue ao LLM.",
      "FAIR-RAG faz gap analysis iterativo para descobrir explicitamente o que ainda falta responder.",
      "REFRAG, RAG-Gym e RAG-Star apontam para sistemas mais rápidos, mais deliberativos e melhores em multi-hop.",
    ],
    calloutTitle: "Números que sustentam a tese",
    calloutLines: [
      "REFRAG: 30x de aceleração sem perda de accuracy reportada.",
      "RAG-Gym: cerca de 24% de ganho em generalização fora de distribuição.",
      "FAIR-RAG: melhora relevante em benchmarks de perguntas multi-hop justamente porque sabe identificar lacunas.",
    ],
    icon: Zap,
    tone: "coral",
    panel: "techniques",
  },
  {
    id: "graphrag",
    number: "06",
    title: "GraphRAG",
    subtitle: "Quando a relação entre entidades importa mais que o chunk isolado",
    summary:
      "Busca vetorial responde muito bem a perguntas locais. GraphRAG entra quando a resposta depende de relações explícitas entre pessoas, times, serviços, incidentes ou conceitos.",
    bullets: [
      "Knowledge graph modela sujeito, predicado e objeto para suportar raciocínio simbólico e causal.",
      "Property graph enriquece nós e arestas com atributos e metadados úteis para consulta.",
      "RAPTOR usa hierarquia de resumos para atender perguntas abstratas e perguntas específicas com o mesmo corpus.",
      "Microsoft GraphRAG popularizou a combinação de extração de entidades, detecção de comunidades e resumos por cluster.",
    ],
    calloutTitle: "Exemplo de pergunta certa",
    calloutLines: [
      "Quais relações existem entre os times de backend e as falhas do módulo de pagamentos nos últimos 90 dias?",
      "A busca vetorial encontra trechos relevantes; o grafo encontra conexões, causalidade e cadeia de impacto.",
      "Se o seu problema é relacional, o vetor sozinho não conta a história inteira.",
    ],
    icon: GitBranch,
    tone: "blue",
    panel: "graph",
  },
  {
    id: "long-context",
    number: "07",
    title: "Long context vs. RAG",
    subtitle: "A comparação que sempre aparece na reunião",
    summary:
      "Janela enorme de contexto não elimina a necessidade de retrieval. Ela muda o ponto de equilíbrio, mas custo, latência, privacidade e escala continuam favorecendo RAG na maioria dos cenários corporativos.",
    bullets: [
      "RAG reduz drasticamente o volume de tokens enviados a cada pergunta.",
      "Atenção continua tendo custo quadrático, então 1M de tokens cobra em dinheiro e em tempo para primeiro token.",
      "Long context piora o problema de lost in the middle quando tudo compete pela atenção do modelo.",
      "Para bases vivas e grandes, retrieval seletivo ainda é o caminho economicamente defensável.",
    ],
    calloutTitle: "Conclusão que fecha a objeção",
    calloutLines: [
      "Long context é ótimo para raciocínio global e protótipos pequenos.",
      "RAG é a resposta para conhecimento externo, rotativo, privado e com exigência de fonte.",
      "Na prática, os dois convivem; mas long context não substitui retrieval bem feito.",
    ],
    icon: BarChart3,
    tone: "gold",
    panel: "cost",
  },
  {
    id: "decisao",
    number: "08",
    title: "Guia de decisão",
    subtitle: "Quando usar RAG, prompt engineering ou fine-tuning",
    summary:
      "A decisão não precisa ser ideológica. Ela pode seguir um fluxo simples: natureza do dado, frequência de atualização, necessidade de explicabilidade e tamanho do acervo.",
    bullets: [
      "Use RAG quando o dado é privado, muda com frequência ou precisa ser citado na resposta.",
      "Use prompt engineering quando o problema ainda está sendo validado e o modelo já sabe o suficiente.",
      "Use fine-tuning para alterar comportamento, estilo ou estrutura de saída de forma persistente.",
      "A combinação comum em produção é prompt bom + retrieval bom + fine-tuning só quando necessário.",
    ],
    calloutTitle: "Regra de bolso",
    calloutLines: [
      "Comece com prompt engineering para provar valor rapidamente.",
      "Adicione RAG assim que a resposta depender de contexto externo ou confidencial.",
      "Só então avalie fine-tuning, quando o gargalo for comportamento do modelo e não acesso à informação.",
    ],
    icon: CheckCircle,
    tone: "teal",
    panel: "decision",
  },
  {
    id: "stack",
    number: "09",
    title: "Nossa stack técnica",
    subtitle: "O que este projeto já demonstra",
    summary:
      "A base atual já tem os componentes certos para uma conversa séria sobre RAG: banco vetorial, frameworks de pipeline, embeddings locais, LLM local e observabilidade fim a fim.",
    bullets: [
      "pgvector permite manter SQL, metadados e vetores no mesmo PostgreSQL.",
      "LangChain e LlamaIndex cobrem duas formas de orquestrar retrieval e geração.",
      "Ollama com nomic-embed-text e llama3.2 reduz custo operacional e evita enviar dado sensível para terceiros.",
      "OpenTelemetry, Prometheus, Loki, Tempo e Grafana dão rastreabilidade para latência, erro e qualidade operacional.",
    ],
    calloutTitle: "Como traduzir isso para o time",
    calloutLines: [
      "Não estamos mostrando só teoria; o projeto já encadeia ingestão, retrieval, geração e observabilidade.",
      "Isso permite discutir qualidade com base em implementação real, não em diagrama abstrato.",
      "A stack atual já suporta o próximo passo natural: retrieval híbrido e reranking.",
    ],
    icon: Database,
    tone: "blue",
    panel: "stack",
  },
  {
    id: "map-reduce",
    number: "10",
    title: "Padrão map-reduce",
    subtitle: "Como cobrir muitos documentos sem pagar o preço do long context",
    summary:
      "Quando a pergunta exige cobertura ampla, o retrieval puro por similaridade pode deixar passar documentos relevantes. A saída prática é adicionar um primeiro nível de leitura barata via resumos.",
    bullets: [
      "Na indexação, cada documento ganha um resumo curto além dos chunks detalhados.",
      "Na consulta ampla, o sistema lê os resumos de todos, seleciona os candidatos e aprofunda só nos escolhidos.",
      "Essa arquitetura eleva cobertura sem jogar o custo na escala do long context bruto.",
      "O padrão combina muito bem com checagem de cobertura inspirada em FAIR-RAG.",
    ],
    calloutTitle: "Headline desta parte",
    calloutLines: [
      "A ideia é simples: leitura panorâmica barata primeiro, leitura profunda depois.",
      "Você troca uma busca cega por uma busca hierárquica.",
      "Isso aproxima cobertura de 100% sem transformar cada query em uma conta absurda de tokens.",
    ],
    icon: Layers,
    tone: "gold",
    panel: "mapreduce",
  },
  {
    id: "avaliacao",
    number: "11",
    title: "Avaliação",
    subtitle: "Como medir se o sistema realmente está funcionando",
    summary:
      "Sem avaliação, RAG vira demo. O retriever precisa ser medido separadamente da resposta final, e a geração precisa ser avaliada pela fidelidade ao contexto recuperado.",
    bullets: [
      "Recall@K e Precision@K avaliam a qualidade da busca antes de culpar o LLM pela resposta ruim.",
      "Faithfulness mede se a resposta está suportada pelos documentos de contexto.",
      "Answer relevancy e context relevancy ajudam a entender desvio de tema e ruído no retrieval.",
      "Produção madura combina métrica automática, judge model e avaliação humana periódica.",
    ],
    calloutTitle: "Frase importante para a reunião",
    calloutLines: [
      "Se o retrieval está errado, o restante do pipeline só propaga o erro com mais fluência.",
      "Por isso, garbage in, garbage out é literalmente uma regra de arquitetura em RAG.",
      "Medir o retriever não é opcional; é a base para qualquer discussão séria de qualidade.",
    ],
    icon: TrendingUp,
    tone: "coral",
    panel: "evaluation",
  },
  {
    id: "roadmap",
    number: "12",
    title: "Roadmap",
    subtitle: "Curto, médio e longo prazo",
    summary:
      "O próximo ganho relevante não vem de reescrever tudo. Vem de melhorar retrieval, enriquecer ranking e automatizar avaliação antes de entrar em camadas mais sofisticadas.",
    bullets: [
      "Curto prazo: hybrid search como padrão, reranking e filtros por metadados.",
      "Médio prazo: agentic RAG, multi-hop e GraphRAG onde o domínio realmente for relacional.",
      "Longo prazo: multimodalidade, OCR estruturado e compressão de contexto ao estilo REFRAG.",
      "A ordem importa: primeiro acertar qualidade e observabilidade, depois sofisticar a arquitetura.",
    ],
    calloutTitle: "Mensagem de fechamento",
    calloutLines: [
      "RAG já resolve um problema concreto hoje.",
      "Agentic RAG e GraphRAG são extensões naturais quando o caso de uso exige mais profundidade.",
      "O roadmap é uma progressão de maturidade, não uma troca brusca de stack.",
    ],
    icon: Clock,
    tone: "teal",
    panel: "roadmap",
  },
];

const takeaways = [
  "RAG não é opcional quando a resposta depende de dado privado ou atualizado.",
  "Qualidade do retrieval determina a qualidade da resposta final.",
  "Hybrid search deve ser o padrão inicial em produção, não a exceção.",
  "Long context ajuda, mas não resolve custo, escala e explicabilidade sozinho.",
  "A evolução natural é retrieval melhor, avaliação melhor e só depois arquitetura mais autônoma.",
];

const closingScript = [
  "Se a pergunta depende de informação viva, privada e auditável, precisamos de retrieval antes de geração.",
  "Nosso projeto já mostra a espinha dorsal certa; o próximo passo é subir o nível do retrieval, não trocar tudo de novo.",
  "Em resumo: RAG resolve o presente, hybrid search melhora o resultado agora e agentic RAG abre o futuro quando a complexidade pedir.",
];

function SectionPanel({ panel, tone }: { panel: PanelKey; tone: Tone }) {
  const palette = toneStyles[tone];

  if (panel === "problem") {
    return (
      <div className="space-y-4">
        <div className={`rounded-[28px] border p-5 ${palette.border} ${palette.panel}`}>
          <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${palette.accent}`}>Onde o LLM puro falha</p>
          <div className="mt-4 grid gap-3">
            {[
              "Conhecimento congelado",
              "Documentos internos fora do treino",
              "Resposta sem prova de origem",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          {[
            { value: "Atualidade", label: "sem retrieval não existe garantia" },
            { value: "Privacidade", label: "o modelo não nasceu sabendo seu domínio" },
            { value: "Auditoria", label: "sem fonte, não existe confiança operacional" },
          ].map((item) => (
            <div key={item.value} className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
              <p className="text-sm font-semibold text-slate-900">{item.value}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (panel === "concept") {
    return (
      <div className="space-y-4">
        {[
          { title: "Retrieve", body: "Busca só o material relevante para a pergunta atual." },
          { title: "Augment", body: "Insere esses trechos no prompt como contexto factual." },
          { title: "Generate", body: "O LLM responde sobre evidência recuperada, não apenas sobre memória." },
        ].map((item, index) => (
          <div key={item.title} className={`rounded-[28px] border p-5 ${index === 1 ? `${palette.border} ${palette.panel}` : "border-slate-200 bg-white/80"}`}>
            <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${palette.accent}`}>{item.title}</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{item.body}</p>
          </div>
        ))}
      </div>
    );
  }

  if (panel === "pipeline") {
    const phases = [
      {
        title: "Indexação offline",
        steps: ["PDFs e docs", "Loader", "Chunks", "Embeddings", "pgvector"],
      },
      {
        title: "Consulta online",
        steps: ["Pergunta", "Embedding", "Busca top-k", "Prompt com contexto", "Resposta com fonte"],
      },
    ];

    return (
      <div className="space-y-4">
        {phases.map((phase) => (
          <div key={phase.title} className={`rounded-[28px] border p-5 ${palette.border} ${palette.soft}`}>
            <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${palette.accent}`}>{phase.title}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {phase.steps.map((step, index) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="rounded-full border border-white/70 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700">
                    {step}
                  </span>
                  {index < phase.steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-400" />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (panel === "types") {
    return (
      <div className="grid gap-3">
        {[
          { title: "Naive", body: "Busca e gera. Ótimo para prova de conceito." },
          { title: "Advanced", body: "Query expansion, hybrid search e reranking para subir qualidade." },
          { title: "Modular", body: "Blocos independentes para trocar search, routing e memory." },
          { title: "Agentic", body: "O modelo decide quando buscar e como encadear as buscas." },
        ].map((item, index) => (
          <div key={item.title} className={`rounded-[24px] border p-4 ${index === 1 ? `${palette.border} ${palette.panel}` : "border-slate-200 bg-white/80"}`}>
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
          </div>
        ))}
      </div>
    );
  }

  if (panel === "techniques") {
    return (
      <div className="space-y-3">
        {[
          { title: "Hybrid Search + RRF", value: "baseline recomendado" },
          { title: "Cross-encoder rerank", value: "mais precisão no top final" },
          { title: "FAIR-RAG", value: "fecha lacunas iterativamente" },
          { title: "REFRAG", value: "30x mais rápido no paper" },
          { title: "RAG-Gym", value: "+24% em generalização" },
        ].map((item, index) => (
          <div key={item.title} className={`rounded-[24px] border p-4 ${index === 0 ? `${palette.border} ${palette.panel}` : "border-slate-200 bg-white/80"}`}>
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className={`mt-1 text-xs font-semibold uppercase tracking-[0.2em] ${palette.accent}`}>{item.value}</p>
          </div>
        ))}
      </div>
    );
  }

  if (panel === "graph") {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
            <p className="text-sm font-semibold text-slate-900">Vetorial</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Excelente para FAQs, documentação simples e perguntas locais.</p>
          </div>
          <div className={`rounded-[24px] border p-4 ${palette.border} ${palette.panel}`}>
            <p className="text-sm font-semibold text-slate-900">GraphRAG</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Melhor quando a resposta depende de cadeia causal, comunidade ou relacionamento explícito.</p>
          </div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
          <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${palette.accent}`}>Quando o grafo faz sentido</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <li>Jurídico, médico e financeiro com forte dependência de entidades.</li>
            <li>Incidentes com times, serviços, causa raiz e impacto cruzado.</li>
            <li>Perguntas multi-hop em que o documento relevante depende da relação entre fontes.</li>
          </ul>
        </div>
      </div>
    );
  }

  if (panel === "cost") {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className={`rounded-[24px] border p-4 ${palette.border} ${palette.panel}`}>
            <p className="text-sm font-semibold text-slate-900">RAG</p>
            <p className={`mt-2 text-3xl font-semibold ${palette.accent}`} style={{ fontFamily: "var(--font-display)" }}>
              ~$60/mês
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Top-5 chunks, cerca de 5k tokens por query.</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
            <p className="text-sm font-semibold text-slate-900">Long context</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
              ~$105k/mês
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">1M de tokens em 1.000 queries por dia.</p>
          </div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
          <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${palette.accent}`}>O que faz a conta fechar</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <li>Custo de inferência.</li>
            <li>Latência para primeiro token.</li>
            <li>Privacidade ao evitar enviar a base inteira a cada chamada.</li>
          </ul>
        </div>
      </div>
    );
  }

  if (panel === "decision") {
    return (
      <div className="space-y-3">
        {[
          "O dado é privado ou interno? Se sim, RAG entra imediatamente.",
          "A informação muda toda semana? Se sim, retrieval vale mais que retreino.",
          "Precisa citar fonte? RAG entrega auditabilidade nativa.",
          "São poucos documentos curtos? Talvez long context simples já resolva.",
        ].map((item, index) => (
          <div key={item} className={`rounded-[24px] border p-4 ${index === 0 ? `${palette.border} ${palette.panel}` : "border-slate-200 bg-white/80"}`}>
            <p className="text-sm leading-6 text-slate-700">{item}</p>
          </div>
        ))}
      </div>
    );
  }

  if (panel === "stack") {
    return (
      <div className="space-y-3">
        {[
          "FastAPI + OTLP",
          "LangChain e LlamaIndex",
          "pgvector no PostgreSQL",
          "Ollama com embeddings e LLM local",
          "Grafana, Tempo, Loki e Prometheus",
        ].map((item, index) => (
          <div key={item} className={`rounded-[24px] border p-4 ${index === 2 ? `${palette.border} ${palette.panel}` : "border-slate-200 bg-white/80"}`}>
            <p className="text-sm font-semibold text-slate-900">{item}</p>
          </div>
        ))}
      </div>
    );
  }

  if (panel === "mapreduce") {
    return (
      <div className="space-y-4">
        <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
          <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${palette.accent}`}>Leitura em dois níveis</p>
          <div className="mt-4 grid gap-3">
            {[
              "1. Resumo por documento para triagem barata.",
              "2. Seleção dos documentos críticos.",
              "3. Leitura profunda só dos escolhidos.",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className={`rounded-[28px] border p-5 ${palette.border} ${palette.panel}`}>
          <p className="text-sm font-semibold text-slate-900">Cobertura esperada</p>
          <p className={`mt-2 text-3xl font-semibold ${palette.accent}`} style={{ fontFamily: "var(--font-display)" }}>
            ~95%
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Por uma fração do custo do long context completo.</p>
        </div>
      </div>
    );
  }

  if (panel === "evaluation") {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {[
            "Recall@K",
            "Precision@K",
            "Faithfulness",
            "Answer relevancy",
          ].map((item, index) => (
            <div key={item} className={`rounded-[24px] border p-4 ${index === 2 ? `${palette.border} ${palette.panel}` : "border-slate-200 bg-white/80"}`}>
              <p className="text-sm font-semibold text-slate-900">{item}</p>
            </div>
          ))}
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
          <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${palette.accent}`}>Camadas de avaliação</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <p>Humana: menos frequente, mais confiável.</p>
            <p>LLM-as-a-judge: escala com custo moderado.</p>
            <p>Métricas automáticas: monitoramento contínuo.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {[
        { title: "Curto prazo", body: "Hybrid search, reranking e filtros por metadados." },
        { title: "Médio prazo", body: "Agentic RAG, multi-hop e GraphRAG onde fizer sentido." },
        { title: "Longo prazo", body: "Multimodalidade, OCR estruturado e compressão de contexto." },
      ].map((item, index) => (
        <div key={item.title} className={`rounded-[28px] border p-5 ${index === 0 ? `${palette.border} ${palette.panel}` : "border-slate-200 bg-white/80"}`}>
          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

function PresentationSection({ section }: { section: Section }) {
  const palette = toneStyles[section.tone];
  const Icon = section.icon;

  return (
    <article
      id={section.id}
      className="scroll-mt-24 rounded-[32px] border border-[#d9d0c2] bg-[var(--deck-paper)]/98 shadow-[0_24px_80px_-40px_rgba(19,34,56,0.42)]"
    >
      <div className="grid gap-8 p-6 sm:p-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${palette.badge}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${palette.dot}`} />
              {section.number}
            </span>
            <span className="text-sm font-semibold text-slate-500">{section.subtitle}</span>
          </div>

          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${palette.border} ${palette.panel}`}>
              <Icon className={`h-5 w-5 ${palette.accent}`} />
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
                {section.title}
              </h2>
              <p className="mt-2 max-w-3xl text-lg leading-8 text-slate-700">{section.summary}</p>
            </div>
          </div>

          <ul className="grid gap-3">
            {section.bullets.map((bullet, index) => (
              <li key={`${section.id}-${index}`} className="flex items-start gap-3 rounded-[24px] border border-slate-200/80 bg-white/75 px-4 py-3">
                <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${palette.dot}`} />
                <span className="text-base leading-7 text-slate-700">{bullet}</span>
              </li>
            ))}
          </ul>

          <div className={`rounded-[28px] border p-5 ${palette.border} ${palette.soft}`}>
            <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${palette.accent}`}>{section.calloutTitle}</p>
            <div className="mt-4 space-y-3 text-base leading-7 text-slate-700">
              {section.calloutLines.map((line, index) => (
                <p key={`${section.id}-callout-${index}`}>{line}</p>
              ))}
            </div>
          </div>
        </div>

        <SectionPanel panel={section.panel} tone={section.tone} />
      </div>
    </article>
  );
}

export default function ApresentacaoPage() {
  return (
    <div
      className={`${displayFont.variable} ${bodyFont.variable} min-h-screen bg-[#132238] text-[#f6f1e8]`}
      style={{
        fontFamily: "var(--font-body)",
        scrollBehavior: "smooth",
      }}
    >
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,107,63,0.25),transparent_30%),radial-gradient(circle_at_top_right,rgba(43,157,143,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_42%)]" />

        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#132238]/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#f4c86c]">RAG deck</p>
              <p className="text-sm text-white/70">Apresentação para o time</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold sm:text-sm">
              <Link href="/guide" className="rounded-full border border-white/15 px-4 py-2 text-white/80 transition hover:border-white/30 hover:text-white">
                Guia
              </Link>
              <Link href="/chat" className="rounded-full border border-white/15 px-4 py-2 text-white/80 transition hover:border-white/30 hover:text-white">
                Chat
              </Link>
              <Link href="/explorer" className="rounded-full bg-white px-4 py-2 text-slate-900 transition hover:bg-[#fff1dc]">
                Voltar ao app
              </Link>
            </div>
          </div>
        </header>

        <main className="relative mx-auto max-w-[1500px] px-4 pb-20 pt-6 sm:px-6 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-6 self-start lg:sticky lg:top-24">
              <div className="rounded-[30px] border border-white/10 bg-white/6 p-6 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f4c86c]">Formato</p>
                <h2 className="mt-3 text-2xl font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                  Roteiro pronto para apresentar
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/72">
                  Página vertical, com saltos rápidos por capítulo e blocos pensados para fala curta em reunião.
                </p>
                <div className="mt-5 grid gap-3 text-sm text-white/78">
                  <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">Tempo sugerido: 12 a 15 minutos</div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">Base: 43 artigos científicos entre 2023 e 2025</div>
                </div>
              </div>

              <nav className="rounded-[30px] border border-white/10 bg-white/6 p-3 backdrop-blur">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm text-white/72 transition hover:bg-white/8 hover:text-white"
                  >
                    <span>{section.number}. {section.title}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                ))}
              </nav>

              <div className="rounded-[30px] border border-white/10 bg-white/6 p-6 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f4c86c]">Mensagem central</p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-white/72">
                  <li>RAG resolve um problema de acesso a conhecimento, não um problema de estilo de resposta.</li>
                  <li>Retrieval bom vale mais do que aumentar contexto sem critério.</li>
                  <li>O próximo ganho mais pragmático está em hybrid search e reranking.</li>
                </ul>
              </div>
            </aside>

            <div className="space-y-8">
              <section className="overflow-hidden rounded-[38px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.03))] p-8 shadow-[0_32px_120px_-55px_rgba(0,0,0,0.7)] sm:p-10 lg:p-12">
                <div className="grid gap-10 xl:grid-cols-[minmax(0,1.05fr)_360px] xl:items-start">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#f4c86c]">Retrieval-Augmented Generation</p>
                    <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl" style={{ fontFamily: "var(--font-display)" }}>
                      Uma apresentação clara de RAG para o time entender o que realmente importa.
                    </h1>
                    <p className="mt-6 max-w-3xl text-lg leading-8 text-white/78 sm:text-xl">
                      A história desta página vai da dor real do LLM sem contexto até o roadmap prático: retrieval híbrido, reranking, GraphRAG e agentic RAG.
                    </p>

                    <div className="mt-8 flex flex-wrap gap-3">
                      <Link href="/guide" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-[#fff1dc]">
                        Abrir guia detalhado
                      </Link>
                      <Link href="/chat" className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/8">
                        Testar o chat
                      </Link>
                      <Link href="/explorer" className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/8">
                        Ver chunks e embeddings
                      </Link>
                    </div>

                    <div className="mt-10 grid gap-4 md:grid-cols-3">
                      {heroStats.map((stat) => (
                        <div key={stat.label} className="rounded-[26px] border border-white/10 bg-black/12 p-5 backdrop-blur-sm">
                          <p className="text-3xl font-semibold text-white sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
                            {stat.value}
                          </p>
                          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.24em] text-[#f4c86c]">{stat.label}</p>
                          <p className="mt-3 text-sm leading-6 text-white/72">{stat.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[32px] border border-white/10 bg-[#0d1828]/65 p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-3 text-[#f4c86c]">
                      <Bot className="h-5 w-5" />
                      <p className="text-[11px] font-semibold uppercase tracking-[0.3em]">Estrutura da fala</p>
                    </div>
                    <div className="mt-5 space-y-3">
                      {flowHighlights.map((item, index) => (
                        <div key={item} className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/42">Bloco {index + 1}</p>
                          <p className="mt-2 text-sm leading-6 text-white/78">{item}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                      {[
                        { icon: BookOpen, label: "Guia", text: "material de apoio técnico" },
                        { icon: MessageSquare, label: "Chat", text: "perguntas ao vivo com a base" },
                        { icon: Search, label: "Explorer", text: "inspeção de chunks e embeddings" },
                      ].map(({ icon: Icon, label, text }) => (
                        <div key={label} className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                          <Icon className="h-4 w-4 text-[#f4c86c]" />
                          <p className="mt-3 text-sm font-semibold text-white">{label}</p>
                          <p className="mt-1 text-sm leading-6 text-white/68">{text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {sections.map((section) => (
                <PresentationSection key={section.id} section={section} />
              ))}

              <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="rounded-[32px] border border-[#d9d0c2] bg-[var(--deck-paper)] p-6 shadow-[0_24px_80px_-40px_rgba(19,34,56,0.42)] sm:p-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#a33b1a]">Os 5 pontos que ficam</p>
                  <div className="mt-5 grid gap-3">
                    {takeaways.map((item, index) => (
                      <div key={item} className="flex items-start gap-4 rounded-[24px] border border-slate-200 bg-white/75 px-4 py-4">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#132238] text-sm font-semibold text-white">
                          {index + 1}
                        </span>
                        <p className="text-base leading-7 text-slate-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[32px] border border-white/10 bg-white/6 p-6 backdrop-blur sm:p-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f4c86c]">Fechamento sugerido</p>
                  <div className="mt-5 space-y-4">
                    {closingScript.map((line, index) => (
                      <div key={line} className="rounded-[24px] border border-white/10 bg-black/10 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/42">Frase {index + 1}</p>
                        <p className="mt-2 text-sm leading-6 text-white/78">{line}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-6 text-xs leading-6 text-white/52">
                    Baseado em análise de 43 artigos científicos, incluindo REFRAG, RAG-Gym, FAIR-RAG, GraphRAG e blended retrieval.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
