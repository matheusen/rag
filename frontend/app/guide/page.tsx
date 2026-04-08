"use client";

import { useState } from "react";
import { ragQuery } from "@/lib/api";
import { ChevronDown, ChevronUp, Lightbulb, RefreshCw } from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   SEÇÕES DE CONTEÚDO — 18 seções com explicações técnicas detalhadas
   ───────────────────────────────────────────────────────────────────────────── */

const SECTIONS = [
  /* ── 1. O que é RAG ───────────────────────────────────────────────────────── */
  {
    id: "what-is-rag",
    title: "O que é RAG?",
    tag: "Fundamento",
    color: "indigo",
    content: `RAG — Retrieval-Augmented Generation — é uma arquitetura que combina busca semântica com geração de linguagem natural, resolvendo duas limitações críticas dos LLMs:

  1. Conhecimento estático  — o modelo só sabe o que estava no corpus de treino.
  2. Alucinações           — sem ancoragem em fatos reais, o modelo inventa.

━━━ COMPONENTES PRINCIPAIS ━━━

  RETRIEVER (busca)
    → Converte a pergunta em embedding (vetor numérico)
    → Busca os k chunks mais próximos no banco vetorial
    → Retorna documentos reais como contexto

  GENERATOR (geração)
    → Recebe pergunta + documentos recuperados
    → Gera resposta fundamentada nos fatos reais
    → Nunca inventa: se não está no contexto, recusa

━━━ PIPELINE COMPLETO ━━━

  Indexação (offline):
    PDFs → Loader → Chunks → Embedding Model → Vetores → pgvector

  Consulta (online):
    Pergunta → Embed → pgvector (cosine search) → Top-k chunks
    → Prompt Template com contexto → LLM → Resposta

━━━ EXEMPLO CONCRETO ━━━

  Pergunta: "O que é HyDE?"

  Sem RAG → LLM pode alucinar ou dar resposta genérica
  Com RAG → busca chunks sobre HyDE nos artigos indexados
           → cita o trecho exato do documento
           → responde com precisão e referência

━━━ QUANDO USAR RAG vs FINE-TUNING ━━━

  RAG:
    ✓ Base de conhecimento que muda frequentemente
    ✓ Precisa de citação e rastreabilidade das fontes
    ✓ Custo baixo (sem re-treinar o modelo)
    ✓ Domínios proprietários (código interno, documentação, PDFs)

  Fine-tuning:
    ✓ Alterar o estilo ou tom do modelo para sempre
    ✓ Especializar em tarefas específicas (classificação, extração)
    ✗ Caro, lento, não atualiza dinamicamente

━━━ MÉTRICAS DE AVALIAÇÃO ━━━

  • Faithfulness: a resposta é fiel aos documentos recuperados?
  • Answer Relevancy: a resposta é relevante para a pergunta?
  • Context Precision: os chunks recuperados são precisos?
  • Context Recall: os chunks certos foram recuperados?
  Frameworks: RAGAS, TruLens, DeepEval`,
  },
  /* ── 2. Tipos de RAG ──────────────────────────────────────────────────────── */
  {
    id: "types",
    title: "Tipos de RAG",
    tag: "Arquitetura",
    color: "emerald",
    content: `━━━ 1. NAIVE RAG (Basic RAG) ━━━
Fluxo linear simples: index → retrieve → generate.

  Problemas:
  • Retriever recupera chunks irrelevantes (baixa precision)
  • Chunks relevantes podem ser perdidos (baixo recall)
  • Sem verificação de qualidade dos documentos
  • Contexto longo pode confundir o LLM ("lost in the middle")

━━━ 2. ADVANCED RAG ━━━
Adiciona etapas de pré e pós-processamento:

  PRE-RETRIEVAL (melhora a query antes de buscar):
  • Query Expansion: gera múltiplas variações da pergunta e busca todas
  • HyDE (Hypothetical Document Embeddings):
      1. Manda pergunta para o LLM gerar um documento hipotético
      2. Usa o EMBEDDING do documento hipotético para buscar (não a pergunta)
      3. Resultado: busca mais precisa por semântica de resposta, não de pergunta
  • Step-Back Prompting: abstrai a pergunta antes de buscar
  • Query Routing: decide qual índice/base buscar baseado no conteúdo

  RETRIEVAL (melhora a busca):
  • Hybrid Search: combina BM25 (lexical/sparse) + vetorial (dense)
      - BM25: melhor para termos exatos, siglas, nomes próprios
      - Vetorial: melhor para sinônimos e contexto semântico
      - Resultado combinado com RRF (Reciprocal Rank Fusion)
  • MMR (Maximal Marginal Relevance): diversifica os resultados
      - Evita chunks repetitivos/redundantes no contexto
      - Balanceia relevância X diversidade

  POST-RETRIEVAL (melhora o contexto antes de gerar):
  • Re-ranking: usa um modelo cross-encoder para reordenar chunks
      - Cross-encoder: compara query+doc juntos (mais preciso que bi-encoder)
      - Modelos: Cohere Rerank, BGE Reranker, ms-marco-MiniLM
  • Context Compression: extrai apenas as partes relevantes de cada chunk
  • LLM Filter: pede ao LLM para filtrar chunks irrelevantes

━━━ 3. MODULAR RAG ━━━
Componentes independentes e trocáveis:

  Módulos:
  • Search (retriever)       — pode ser vetorial, graph, web, SQL
  • Memory                   — armazena histórico de conversas
  • Fusion                   — combina múltiplas buscas
  • Routing                  — decide qual módulo usar por query
  • Predict                  — geração da resposta final

  Vantagem: flexibilidade total para montar pipelines custom.

━━━ 4. AGENTIC RAG ━━━
O LLM age como agente com ferramentas de busca:

  Características:
  • Multi-hop: faz múltiplas buscas encadeadas para responder
  • ReAct loop: Reason → Action → Observe → Reason → ...
  • Decide QUANDO buscar (não busca em toda query)
  • Usa ferramentas: search_documents(), web_search(), calculator()

  Exemplo de fluxo:
    "Compare os artigos sobre RAG e os de LangChain"
    1. Busca artigos sobre RAG
    2. Lê os resultados
    3. Busca artigos sobre LangChain
    4. Compara os dois conjuntos

━━━ 5. GRAPH RAG ━━━
Combina vetores com grafos de conhecimento (Knowledge Graph):

  • Entidades e relações extraídas dos documentos
  • Busca por relacionamentos além de similaridade
  • Microsoft GraphRAG: open-source, comunidades de entidades
  • Excelente para: genealogia de conceitos, cadeia de causalidade

━━━ 6. SELF-RAG ━━━
O modelo reflete sobre quando e se deve fazer retrieval:

  Tokens especiais gerados:
  • [Retrieve]    — decide buscar ou não
  • [IsRel]       — os docs recuperados são relevantes?
  • [IsSup]       — a resposta é suportada pelos docs?
  • [IsUse]       — a resposta é útil para o usuário?

  Vantagem: mais eficiente, não busca desnecessariamente.

━━━ 7. CORRECTIVE RAG (CRAG) ━━━
Avalia a qualidade dos documentos recuperados:

  Fluxo:
  • Score alto (relevante) → usa direto na resposta
  • Score médio            → refina chunks com LLM
  • Score baixo (irrelevante) → faz web search como fallback

━━━ 8. RAPTOR ━━━
Recursive Abstractive Processing Tree Organized Retrieval:

  • Cria árvore hierárquica de resumos dos documentos
  • Query pode buscar tanto em nível folha (detalhe) quanto raiz (resumo)
  • Excelente para documentos longos e perguntas de alto nível`,
  },
  /* ── 3. Chunking ──────────────────────────────────────────────────────────── */
  {
    id: "chunking",
    title: "Estratégias de Chunking",
    tag: "Indexação",
    color: "teal",
    content: `Chunking é o processo de dividir documentos em pedaços menores para indexação.
A estratégia de chunking é uma das variáveis que mais impacta a qualidade do RAG.

━━━ ESTRATÉGIAS PRINCIPAIS ━━━

  1. FIXED SIZE (por caracteres/tokens)
     chunk_size=1000, chunk_overlap=200
     • Simples, previsível, sem ambiguidade
     • Pode cortar frases no meio
     • Bom ponto de partida

  2. RECURSIVE CHARACTER SPLITTER (LangChain padrão)
     Tenta dividir por: \n\n → \n → " " → ""
     • Preserva parágrafos quando possível
     • Fallback progressivo para caracteres
     • Mais inteligente que fixed-size puro

  3. SENTENCE SPLITTER (LlamaIndex padrão)
     Divide por fronteiras de sentenças (punkt tokenizer)
     • Nunca quebra uma sentença no meio
     • Melhor qualidade semântica por chunk
     • Chunks de tamanho variável (esperado)

  4. SEMANTIC CHUNKING
     Calcula embeddings de cada sentença e agrupa por similaridade
     • Chunks baseados em coerência semântica real
     • Mais caro computacionalmente
     • Melhor recall em textos técnicos longos

  5. PARENT-CHILD (ou Small-to-Big)
     • Chunks pequenos indexados (alta precisão no retrieval)
     • Chunks grandes retornados ao LLM (mais contexto)
     • Ex: busca chunk de 256 tokens → retorna janela de 1024 tokens ao redor

  6. DOCUMENT-AWARE
     • Respeita a estrutura do documento (títulos, seções, tabelas)
     • Usa markdown headers ou tags HTML como separadores naturais

━━━ PARÂMETROS CRÍTICOS ━━━

  chunk_size   : tamanho máximo do chunk (em tokens ou chars)
  chunk_overlap: sobreposição entre chunks consecutivos
                 → evita perder contexto nos limites
                 → tipicamente 10-20% do chunk_size

━━━ IMPACTO NOS RESULTADOS ━━━

  Chunk pequeno (128-256 tokens):
  ✓ Alta precisão — retriever pega exatamente o trecho correto
  ✗ Pouco contexto — LLM pode não ter info suficiente para responder

  Chunk grande (1024-2048 tokens):
  ✓ Muito contexto para o LLM
  ✗ "Ruído" — partes irrelevantes no mesmo chunk
  ✗ "Lost in the middle" — LLM ignora meio do contexto longo

  Recomendação prática: 512-1024 tokens com 10-20% overlap`,
  },

  /* ── 4. Embeddings ────────────────────────────────────────────────────────── */
  {
    id: "embeddings",
    title: "Embeddings e Busca Vetorial",
    tag: "Conceitos Core",
    color: "yellow",
    content: `Embedding é a representação de texto como um vetor de números reais em espaço de alta dimensão.
Textos semanticamente similares ficam próximos nesse espaço — independente das palavras usadas.

━━━ COMO FUNCIONA ━━━

  "O gato subiu no telhado"    → [0.12, -0.34, 0.89, ...]  (768 dims)
  "O felino escalou o teto"    → [0.11, -0.36, 0.91, ...]  (muito próximo!)
  "Receita de bolo de cenoura" → [0.78,  0.22, -0.15, ...]  (distante)

━━━ MODELOS DE EMBEDDING ━━━

  nomic-embed-text (local, Ollama)
  • 768 dimensões — gratuito, roda na sua máquina

  text-embedding-3-small (OpenAI)
  • 1536 dimensões — excelente qualidade, pago

  text-embedding-004 (Google Vertex AI)
  • 768 dimensões — requer billing no GCP

  BGE-M3 (HuggingFace, gratuito)
  • Multilingual, alta qualidade, pode rodar local

━━━ MÉTRICAS DE SIMILARIDADE ━━━

  Cosine Similarity (mais usada em NLP):
    sim(A, B) = (A · B) / (|A| × |B|)
    → Mede o ÂNGULO entre vetores (ignora magnitude)
    → Range: [-1, 1] onde 1 = idêntico, -1 = oposto
    → pgvector: embedding <=> outro_embedding

  Distância Euclidiana (L2):
    dist(A, B) = √(Σ(aᵢ - bᵢ)²)
    → Mede distância absoluta no espaço
    → Sensível à magnitude dos vetores
    → pgvector: embedding <-> outro_embedding

  Produto Interno (Dot Product):
    dot(A, B) = Σ(aᵢ × bᵢ)
    → Equivale ao cosine quando vetores são normalizados
    → pgvector: embedding <#> outro_embedding (negativo)

━━━ OPERADORES PGVECTOR ━━━

  <=>  distância cosine    (menor = mais similar)
  <->  distância euclidiana (menor = mais similar)
  <#>  produto interno negativo

  -- Buscar os 4 chunks mais similares:
  SELECT document FROM langchain_pg_embedding
  ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
  LIMIT 4;

━━━ ÍNDICES VETORIAIS ━━━

  IVFFlat:
  • Divide vetores em clusters
  • Busca aproximada (ANN) apenas nos clusters mais próximos
  • Menos memória, mais rápido de criar
  • Precisa de dados antes de criar

  HNSW (recomendado):
  • Grafo hierárquico de vizinhos mais próximos
  • Busca em O(log n) — muito mais rápida
  • Mais memória, mais lento de criar
  • Pode criar antes de inserir dados

  CREATE INDEX ON langchain_pg_embedding
  USING hnsw (embedding vector_cosine_ops);

━━━ SPARSE vs DENSE ━━━

  Dense (embeddings vetoriais):
  • Captura significado semântico
  • Funciona com sinônimos e paráfrases
  • Falha em termos exatos raros (siglas, nomes próprios)

  Sparse (BM25, TF-IDF):
  • Baseado em frequência de termos
  • Excelente para termos exatos
  • Sem compreensão semântica

  Hybrid Search = Dense + Sparse (melhor dos dois mundos)`,
  },
  /* ── 5. LangChain ─────────────────────────────────────────────────────────── */
  {
    id: "langchain",
    title: "LangChain",
    tag: "Framework",
    color: "blue",
    content: `LangChain é um framework Python/JS para construir aplicações com LLMs através de composição de componentes modulares.

━━━ ARQUITETURA GERAL ━━━

  Camadas:
  langchain-core       → interfaces base (sem dependências pesadas)
  langchain            → chains, agents, memory de alto nível
  langchain-community  → integrações da comunidade (600+ conectores)
  langchain-[provider] → pacotes específicos (langchain-ollama, langchain-openai, etc.)

━━━ DOCUMENT LOADERS ━━━

  Carregam arquivos e retornam List[Document]:

  PyPDFLoader("arquivo.pdf")          → divide por página
  DirectoryLoader("pasta/", glob="**/*.pdf", loader_cls=PyPDFLoader)
  TextLoader("doc.txt")
  WebBaseLoader("https://...")

  Document tem:
  • page_content: str   — texto do chunk
  • metadata: dict      — fonte, página, etc.

━━━ TEXT SPLITTERS ━━━

  RecursiveCharacterTextSplitter(
      chunk_size=1000,
      chunk_overlap=200,
      separators=["\n\n", "\n", " ", ""]
  )
  → Tenta cada separador em ordem; fallback para o próximo

  CharacterTextSplitter(separator="\n\n", chunk_size=1000)
  → Simples, divide por 1 separador fixo

━━━ EMBEDDINGS ━━━

  Interface base: Embeddings
  .embed_documents(texts) → List[List[float]]
  .embed_query(text)      → List[float]

  OllamaEmbeddings(model="nomic-embed-text", base_url="http://localhost:11434")
  OpenAIEmbeddings(model="text-embedding-3-small")

━━━ VECTORSTORES ━━━

  PGVector(
      embeddings=embeddings,
      collection_name="lc_documents",
      connection="postgresql+psycopg://...",
      use_jsonb=True,
  )

  Métodos importantes:
  .add_documents(docs)                 → ingere e salva embeddings
  .similarity_search(query, k=4)      → retorna List[Document]
  .as_retriever(search_kwargs={"k":4}) → retorna VectorStoreRetriever

━━━ CHAINS ━━━

  create_stuff_documents_chain(llm, prompt):
    → "Stuff" = junta TODOS os docs em 1 prompt
    → Mais simples, funciona bem com poucos chunks

  create_retrieval_chain(retriever, document_chain):
    → Input: {"input": "pergunta"}
    → Output: {"input", "context", "answer"}
    → Internamente: retriever busca → document_chain gera

  Modos alternativos:
  • map_reduce: processa cada doc separadamente, combina no final
  • refine: itera doc a doc, refinando a resposta progressivamente
  • map_rerank: pontua cada doc, usa o melhor

━━━ PROMPTS ━━━

  ChatPromptTemplate.from_messages([
      ("system", "Use o contexto:\n\n{context}"),
      ("human", "{input}"),
  ])
  MessagesPlaceholder("chat_history")  → para memória de conversa

━━━ LCEL (LangChain Expression Language) ━━━

  Sintaxe de pipe para compor chains:
  chain = prompt | llm | StrOutputParser()
  chain.invoke({"input": "pergunta"})
  chain.stream({"input": "pergunta"})  → streaming token a token

━━━ MEMORY ━━━

  ConversationBufferMemory()   → mantém histórico completo
  ConversationSummaryMemory()  → resume histórico para economizar tokens

━━━ PADRÃO NESTE PROJETO ━━━

  pergunta
  → OllamaEmbeddings.embed_query()
  → PGVector.similarity_search_with_score() (cosine, k=4)
  → create_stuff_documents_chain (injeta chunks no prompt)
  → ChatOllama (llama3.2)
  → resposta

━━━ LANGCHAIN vs DSPY — PARADIGMAS DISTINTOS ━━━

  LangChain: orquestração EXPLÍCITA — você define cada passo do pipeline.
  DSPy (Stanford, Khattab et al., 2023): otimização DECLARATIVA — você declara
  a tarefa, o framework encontra os melhores prompts automaticamente.

  DSPy — o que é na prática:
  → Signature: define input/output da tarefa ("question → answer")
  → Module: componente (ChainOfThought, Retrieve, etc.)
  → Optimizer/Teleprompter: BootstrapFewShot, MIPRO, BayesianSignatureOptimizer
    → testa variações de prompts automaticamente e escolhe o melhor
  → Compila o pipeline: sem prompt engineering manual

  Exemplo DSPy para RAG:
  class RAGModule(dspy.Module):
      def __init__(self):
          self.retrieve = dspy.Retrieve(k=5)
          self.generate = dspy.ChainOfThought("context, question → answer")

      def forward(self, question):
          context = self.retrieve(question).passages
          return self.generate(context=context, question=question)

  teleprompter = BootstrapFewShot(metric=answer_exact_match)
  compiled_rag = teleprompter.compile(RAGModule(), trainset=train_examples)
  # compiled_rag agora tem os melhores few-shot prompts encontrados automaticamente

  Quando usar cada um:
  LangChain: controle explícito do pipeline, integrações ricas, produção já conhecida
  DSPy:      otimizar prompts automaticamente, research, evitar engenharia de prompt manual
  Combinação possível: LangChain gerencia fluxo, DSPy otimiza os módulos LLM internos`,
  },
  /* ── 6. LlamaIndex ────────────────────────────────────────────────────────── */
  {
    id: "llamaindex",
    title: "LlamaIndex",
    tag: "Framework",
    color: "orange",
    content: `LlamaIndex (ex-GPT Index) é um framework focado em ingestão, indexação estruturada e consulta avançada de dados para LLMs.

━━━ DIFERENÇA CONCEITUAL vs LANGCHAIN ━━━

  LangChain: orquestração geral, chains, agents, muitas integrações
  LlamaIndex: especializado em dados — índices ricos, pipelines de ingestão

━━━ PIPELINE DE INGESTÃO ━━━

  SimpleDirectoryReader("pasta/"):
  → Detecta tipo de arquivo automaticamente (PDF, TXT, MD, DOCX...)
  → Retorna List[Document]

  SentenceSplitter(chunk_size=1024, chunk_overlap=100):
  → Divide por fronteiras de sentenças (usa punkt tokenizer)
  → Retorna List[Node]

  Node vs Document:
  • Document: arquivo inteiro com metadata
  • Node: chunk processado com embedding, relações parent/child, metadata herdado

━━━ SETTINGS (GLOBAL) ━━━

  from llama_index.core import Settings
  Settings.llm         = Ollama(model="llama3.2")
  Settings.embed_model = OllamaEmbedding(model_name="nomic-embed-text")
  Settings.chunk_size  = 1024
  Settings.chunk_overlap = 100

  → Configurado UMA VEZ, usado por todos os componentes automaticamente
  → Equivalente a um container de injeção de dependência global

━━━ ÍNDICES ━━━

  VectorStoreIndex:
  → .from_documents(docs)        — cria novo índice
  → .from_vector_store(vs, ctx)  — conecta a existente (SEM recalcular)

  SummaryIndex:
  → Itera todos os docs para responder
  → Bom para sumarização global

  KnowledgeGraphIndex:
  → Extrai entidades e relações, cria grafo
  → Busca por relações entre conceitos

━━━ STORAGE CONTEXT ━━━

  StorageContext.from_defaults(vector_store=pg_vector_store)
  → Agrupa: VectorStore + DocumentStore + IndexStore
  → Permite persistência distribuída (S3, Redis, etc.)

━━━ RETRIEVER ━━━

  VectorIndexRetriever(index=index, similarity_top_k=4)
  → Retorna List[NodeWithScore]
  → NodeWithScore tem: .node (Node) e .score (float 0-1)

━━━ RESPONSE SYNTHESIZER ━━━

  get_response_synthesizer(response_mode="compact")

  Modos:
  • compact:        concatena todos os nodes em 1 prompt (padrão, barato)
  • tree_summarize: divide em subárvores, sumariza hierarquicamente
  • refine:         processa node a node, refinando resposta (mais caro, preciso)
  • accumulate:     responde cada node separadamente, agrupa
  • no_text:        retorna só os source nodes sem gerar resposta

━━━ QUERY ENGINE ━━━

  RetrieverQueryEngine(retriever=retriever, response_synthesizer=synthesizer)

  engine.query("pergunta") → Response
  response.response        → str (texto da resposta)
  response.source_nodes    → List[NodeWithScore] (quais docs foram usados)
  response.source_nodes[0].score  → score de similaridade (0-1)

━━━ DIFERENÇAS DE RESULTADO vs LANGCHAIN ━━━

  LangChain:
    result = chain.invoke({"input": "pergunta"})
    result["answer"]   → texto
    result["context"]  → List[Document] com chunks usados

  LlamaIndex:
    response = engine.query("pergunta")
    response.response          → texto
    response.source_nodes      → List[NodeWithScore]`,
  },
  /* ── 7. pgvector + SQLAlchemy ─────────────────────────────────────────────── */
  {
    id: "pgvector",
    title: "pgvector e SQLAlchemy",
    tag: "Banco de Dados",
    color: "rose",
    content: `pgvector é uma extensão do PostgreSQL que adiciona o tipo nativo vector e operações de ANN (Approximate Nearest Neighbor) eficientes.

━━━ INSTALAÇÃO E SETUP ━━━

  -- No PostgreSQL:
  CREATE EXTENSION IF NOT EXISTS vector;

  -- Verificar:
  SELECT extname FROM pg_extension WHERE extname = 'vector';

━━━ TIPO VECTOR ━━━

  -- DDL:
  CREATE TABLE embeddings (
    id UUID PRIMARY KEY,
    content TEXT,
    embedding vector(768)   -- 768 dimensões (nomic-embed-text)
  );

━━━ TABELAS DO LANGCHAIN ━━━

  langchain_pg_collection:
    id          UUID  (chave primária)
    name        TEXT  (ex: "lc_documents")
    cmetadata   JSONB

  langchain_pg_embedding:
    id            UUID
    collection_id UUID  → FK para langchain_pg_collection
    embedding     vector(768)
    document      TEXT  (texto do chunk)
    cmetadata     JSONB (ex: {"source": "artigo.pdf", "page": 3})

━━━ SQLALCHEMY 2.x COM PGVECTOR ━━━

  from pgvector.sqlalchemy import Vector
  from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
  from sqlalchemy.dialects.postgresql import JSONB
  import uuid

  class EmbeddingStore(Base):
      __tablename__ = "langchain_pg_embedding"
      id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
      document: Mapped[str]
      embedding: Mapped[Any] = mapped_column(Vector(768))
      cmetadata: Mapped[dict] = mapped_column(JSONB)

━━━ SESSIONS E ENGINES ━━━

  Engine:
  engine = create_engine(
      "postgresql+psycopg://user:pass@host:port/db",
      pool_pre_ping=True,      # testa conexão antes de usar
      pool_size=5,             # conexões no pool
      max_overflow=10,         # extras além do pool
  )

  pool_pre_ping=True:
  → Executa SELECT 1 antes de entregar conexão do pool
  → Evita "connection closed" em conexões idle por muito tempo

  NullPool (para scripts/workers):
  from sqlalchemy.pool import NullPool
  engine = create_engine(url, poolclass=NullPool)
  → Abre nova conexão para cada request, fecha ao terminar

  Session:
  with Session(engine) as session:
      result = session.execute(select(EmbeddingStore).limit(10))
      chunks = result.scalars().all()

━━━ ÍNDICES VETORIAIS ━━━

  IVFFlat:
  CREATE INDEX ON langchain_pg_embedding
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  → lists: número de clusters (√n é um bom ponto de partida)

  HNSW (recomendado):
  CREATE INDEX ON langchain_pg_embedding
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
  → m: número de conexões por nó no grafo (default 16)
  → ef_construction: qualidade da busca ao inserir (default 64)
  → Busca muito mais rápida que IVFFlat

━━━ QUERIES JSONB ━━━

  -- Filtrar por fonte:
  from sqlalchemy import func
  stmt = select(EmbeddingStore).where(
      func.jsonb_extract_path_text(
          EmbeddingStore.cmetadata, "source"
      ).ilike("%artigo%")
  )

  -- Contar chunks por arquivo:
  stmt = (
      select(
          func.jsonb_extract_path_text(
              EmbeddingStore.cmetadata, "source"
          ).label("fonte"),
          func.count().label("total"),
      )
      .group_by("fonte")
      .order_by(func.count().desc())
  )`,
  },
  /* ── 8. OpenTelemetry ─────────────────────────────────────────────────────── */
  {
    id: "opentelemetry",
    title: "OpenTelemetry",
    tag: "Observabilidade",
    color: "purple",
    content: `OpenTelemetry (OTel) é o padrão aberto e vendor-neutral de observabilidade para sistemas distribuídos, mantido pela CNCF.

━━━ OS 3 PILARES (SINAIS) ━━━

  1. TRACES — "o que aconteceu e quando"
     → Mapa de uma requisição end-to-end através de todos os serviços
     → Span: unidade atômica de trabalho (tem nome, início, fim, atributos, status)
     → Trace: árvore de spans conectados por trace_id / parent_span_id
     → W3C TraceContext: propaga trace_id via HTTP headers (traceparent)

  2. METRICS — "o quanto está acontecendo"
     → Counter:   só aumenta (ex: requests_total, errors_total)
     → Gauge:     sobe e desce (ex: memória usada, fila pendente)
     → Histogram: distribui observações em buckets (ex: http_duration_seconds)
       - Permite calcular percentis: p50, p95, p99
     → UpDownCounter: aumenta e decresce (ex: conexões ativas)

  3. LOGS — "o que o sistema disse"
     → Eventos estruturados com timestamp, nível, atributos
     → OTel Logs: conecta log ao trace_id corrente automaticamente
     → Permite correlação: span → logs daquele span

━━━ COMPONENTES DO SDK ━━━

  TracerProvider:
  → Fábrica de Tracers, um por processo.
  → Configurado com Resource + SpanProcessors + Exporters

  Resource:
  → Identifica o serviço: nome, versão, ambiente
  → Resource.create({SERVICE_NAME: "rag-system"})

  Tracer:
  → trace.get_tracer("rag.langchain")
  → Cria spans: tracer.start_as_current_span("langchain.rag.query")

  Span:
  → span.set_attribute("rag.question", question)
  → span.set_attribute("rag.chunks_retrieved", 4)
  → span.set_status(Status(StatusCode.OK))

  SpanProcessors:
  → BatchSpanProcessor: acumula em memória, exporta em lotes (produção)
  → SimpleSpanProcessor: exporta cada span imediatamente (debug)

  Exporters:
  → OTLPSpanExporter(endpoint="http://localhost:4318/v1/traces")
  → ConsoleSpanExporter() → imprime no stdout (debug)

━━━ AUTO-INSTRUMENTAÇÃO ━━━

  FastAPIInstrumentor.instrument_app(app):
  → Cria span para cada request HTTP
  → Atributos: http.method, http.route, http.status_code

  SQLAlchemyInstrumentor().instrument():
  → Cria span para cada query SQL
  → Atributos: db.statement, db.system, db.name

━━━ SPANS MANUAIS ━━━

  tracer = trace.get_tracer("rag.langchain")

  with tracer.start_as_current_span("langchain.rag.query") as span:
      span.set_attribute("rag.question", question)
      span.set_attribute("rag.k", k)

      with tracer.start_as_current_span("langchain.chain.invoke") as child:
          result = chain.invoke({"input": question})
          child.set_attribute("rag.chunks_retrieved", len(result["context"]))

━━━ OTEL COLLECTOR ━━━

  Hub central que recebe dados e os distribui:
  receivers → processors → exporters

  A app só conhece 1 endpoint.
  Backends podem mudar sem alterar código da app.

━━━ FLUXO DESTE PROJETO ━━━

  FastAPI (8000)
    ├── OTLP HTTP → OTel Collector (4318) → Jaeger (16686) — traces
    │                                     → Tempo  (3200)  — traces
    ├── /metrics  ← Prometheus (9090)               — metrics
    └── logs/api.log ← Promtail → Loki (3100)       — logs

  Grafana (3030): UI unificada com correlação Traces ↔ Metrics ↔ Logs`,
  },

  /* ── 9. Stack de Observabilidade ──────────────────────────────────────────── */
  {
    id: "observability-stack",
    title: "Grafana · Prometheus · Loki · Jaeger",
    tag: "Stack",
    color: "violet",
    content: `A stack completa de observabilidade deste projeto usa 4 ferramentas complementares.

━━━ JAEGER ━━━

  Backend de traces open-source (criado pelo Uber).
  UI rica para análise: flamegraph de spans, comparação entre traces.

  Acesso: http://localhost:16686
  Para ver traces: Service → rag-system → Find Traces

━━━ GRAFANA TEMPO ━━━

  Backend de traces da Grafana Labs — integrado ao Grafana.
  Diferencial: correlação nativa com Loki e Prometheus.

  Visualizado no Grafana:
  Explore → Datasource: Tempo → Search → Service: rag-system

  TraceQL (linguagem de query do Tempo):
  { .service.name = "rag-system" }
  { .http.route = "/langchain/query" && duration > 5s }
  { .rag.framework = "langchain" }

━━━ PROMETHEUS ━━━

  Modelo PULL: scrape o endpoint /metrics a cada 15s.
  Acesso: http://localhost:9090

  Métricas do FastAPI (/metrics):
  • http_requests_total{method, handler, status}
  • http_request_duration_seconds{handler}

  PromQL (exemplos):
  rate(http_requests_total[5m])
  → taxa de requests por segundo nos últimos 5 min

  histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
  → p95 de latência

  sum by (handler) (http_requests_total)
  → total por endpoint

━━━ GRAFANA LOKI ━━━

  "Prometheus para logs" — indexa apenas LABELS, não o conteúdo.
  Muito mais barato que Elasticsearch em armazenamento e CPU.

  LogQL (exemplos):
  {job="rag-api"}
  → todos os logs do job

  {job="rag-api"} | json | level="ERROR"
  → filtrar por nível ERROR

  {job="rag-api"} | json | duration > 2s
  → requests lentas

  rate({job="rag-api"}[5m])
  → taxa de logs por janela

━━━ CORRELAÇÕES NO GRAFANA ━━━

  • Prometheus Exemplars → Tempo: clica pico de latência → vai para o trace
  • Tempo span → Loki: clica num span → vê logs daquele período
  • Loki log com trace_id → Tempo: clica no traceID → abre o trace

━━━ PROMTAIL ━━━

  Agente que monitora arquivos de log e envia ao Loki.
  Similar ao FileBeat (ELK) ou Fluentd.

  Pipeline:
  1. Detecta nova linha em logs/api.log
  2. Parseia como JSON
  3. Extrai labels: level, logger
  4. Define timestamp do evento
  5. Envia ao Loki com push API`,
  },

  /* ── 10. Boas Práticas ────────────────────────────────────────────────────── */
  {
    id: "best-practices",
    title: "Boas Práticas e Armadilhas",
    tag: "Produção",
    color: "amber",
    content: `━━━ INGESTÃO ━━━

  ✓ Use NullPool para scripts de ingestão (evita conexões pendentes)
  ✓ Faça batch inserts (50+ chunks por vez) em vez de 1 a 1
  ✓ Salve progresso para poder retomar se falhar
  ✓ Trate duplicatas: langchain-postgres usa uuid5(content) como ID
  ✗ Nunca recalcule embeddings que já existem (caro e lento)

━━━ CHUNKING ━━━

  ✓ Teste chunk_size 512, 1024 e 2048 para sua base de dados
  ✓ Use chunk_overlap de 10-20% do chunk_size
  ✓ Preserve metadados (arquivo fonte, número de página)
  ✗ Não ignore a estrutura do documento (títulos são limites naturais)

━━━ RETRIEVAL ━━━

  ✓ Comece com k=4, ajuste baseado em resultado
  ✓ Para perguntas complexas, use k maior (6-10)
  ✓ Logue os chunks recuperados para debugar qualidade
  ✗ Não confunda k (chunks recuperados) com janela de contexto do LLM
  ✗ Chunks irrelevantes no contexto degradam a resposta

━━━ PROMPTS ━━━

  ✓ System prompt claro: "Use APENAS o contexto abaixo"
  ✓ Instrua o modelo a dizer "não sei" quando contexto insuficiente
  ✓ Inclua instrução de citação de fonte quando necessário
  ✗ Prompt muito longo desperdiça tokens e obscurece a instrução

━━━ SQLALCHEMY ━━━

  ✓ Sempre use pool_pre_ping=True em apps de longa duração
  ✓ Use context manager (with Session(...)) — nunca esqueça de fechar
  ✓ Evite N+1 queries — use joinedload() ou selectinload()
  ✗ session.query() é legado — use select() com session.execute()

━━━ PGVECTOR ━━━

  ✓ Crie índice HNSW ANTES de precisar de performance
  ✓ VACUUM ANALYZE após ingestão grande
  ✓ Use vector_cosine_ops quando embeddings são normalizados
  ✗ Sem índice = sequential scan = lento para >100k vetores
  ✗ Não misture modelos de embedding (768 dims ≠ 1536 dims)

━━━ OPENTELEMETRY ━━━

  ✓ Use BatchSpanProcessor em produção (nunca Simple em prod)
  ✓ Limite atributos de span a dados seguros (sem senhas, tokens)
  ✓ Propague context entre serviços via W3C TraceContext
  ✗ Não logue PII (dados pessoais) em spans ou métricas
  ✗ Não crie spans dentro de loops apertados (overhead)

━━━ GARGALOS TÍPICOS EM RAG ━━━

  1. Embedding da query   → ~50-200ms (local) / ~100ms (API)
  2. Busca no pgvector    → ~5-50ms com índice HNSW
  3. LLM generation       → ~1-30s (depende do modelo e tamanho da resposta)
  4. I/O de banco         → ~10-100ms total

  Para reduzir latência:
  • Cache de embeddings de queries frequentes (Redis)
  • Modelo menor de embedding se latência for crítica
  • Quantização do LLM (Q4_K_M reduz memória e aumenta velocidade)`,
  },

  /* ── 11. Como um LLM Funciona ────────────────────────────────────────────── */
  {
    id: "llm-fundamentals",
    title: "Como um LLM Funciona",
    tag: "Fundamento",
    color: "cyan",
    content: `Entender o que acontece dentro do LLM é fundamental para construir RAG de qualidade.

━━━ DOIS TIPOS DE MEMÓRIA ━━━

  MEMÓRIA PARAMÉTRICA — "o que está nos pesos"
  → Tudo que o modelo aprendeu durante o treinamento
  → Codificado nos bilhões de parâmetros do modelo
  → Permanente, mas NÃO atualizável sem retreinamento caro
  → Analogia: o que você sabe de cabeça

  MEMÓRIA CONTEXTUAL — "o que está no prompt atual"
  → O texto que você enviou nesta chamada específica
  → Temporária: esquecida após a chamada terminar
  → Limitada pela context window (32k, 128k, 1M tokens)
  → Analogia: os resumos que você consulta numa prova

  RAG preenche a MEMÓRIA CONTEXTUAL com fatos reais — sem alterar
  a memória paramétrica. Eficiente e imediato — zero retreinamento.

━━━ GERAÇÃO AUTORREGRESSIVA ━━━

  LLMs geram um token de cada vez, condicionado nos tokens anteriores:

  Prompt: "A capital do Brasil é"
    ↓
  Passo 1: calcula distribuição sobre 50k+ tokens → "Brasília" (maior prob.)
  Passo 2: calcula distribuição → "."
  Passo 3: calcula distribuição → [EOS]

  Em RAG, o modelo vê: sistema + documentos + pergunta ao gerar cada token.
  Cada token pode "prestar atenção" a qualquer token anterior via Attention.

━━━ MECANISMO DE ATENÇÃO ━━━

  O Attention permite ponderar a influência de cada token anterior na geração.

  Em RAG especificamente:
  → Tokens da resposta prestam alta atenção a tokens dos documentos relevantes
  → Documentos com fatos corretos amplificam os padrões certos
  → Documentos contraditórios ao conhecimento paramétrico criam conflito
  → Por isso: qualidade dos documentos recuperados ≫ quantidade

━━━ LOST IN THE MIDDLE ━━━

  LLMs prestam MAIS atenção ao início e ao fim do contexto.
  Informação enterrada no meio de contextos longos tende a ser esquecida.

  Implicações práticas para RAG:
  ✓ Coloque os chunks mais relevantes no INÍCIO do contexto
  ✓ Não concatene apenas em ordem de similaridade — ordene estrategicamente
  ✗ Contexto longo NÃO é sempre melhor — foco é mais eficaz que volume
  ✗ Dezenas de chunks pouco relevantes pioram a resposta

━━━ TEMPERATURA ━━━

  Temperatura 0 (greedy):
  → Sempre escolhe o token mais provável
  → Respostas determinísticas e repetíveis
  → RECOMENDADO para RAG factual em produção

  Temperatura > 0:
  → Introduz aleatoriedade via softmax escalado
  → Útil para geração criativa
  → AUMENTA risco de alucinação em contextos factuais
  → Regra de bolso: temperatura ≤ 0.1 para RAG em produção

━━━ KV CACHE ━━━

  LLMs cacheia Keys/Values da atenção para evitar recomputation.

  Em RAG com contextos longos:
  → Contextos maiores = KV cache maior = mais memória GPU
  → Atenção é O(n²) — latência cresce quadraticamente com o contexto
  → TTFT (Time to First Token) com 1M tokens: 30–60 segundos
  → REFRAG (Meta, 2025): comprime chunks antes do decoder → 30× mais rápido
  → Pré-compute KV de documentos estáticos e reutilize entre chamadas`,
  },

  /* ── 12. Tokenização ─────────────────────────────────────────────────────── */
  {
    id: "tokenization",
    title: "Tokenização",
    tag: "Fundamento",
    color: "lime",
    content: `Tokenização converte texto em sequências de inteiros. Impacta chunking, custo e limites do RAG.

━━━ O QUE É UM TOKEN ━━━

  Um token não é necessariamente uma palavra — é um fragmento do vocabulário:

  Texto:  "Retrieval-Augmented Generation"
  Tokens: ["Retrieval", "-", "Aug", "mented", " Generation"]
  IDs:    [   17891,    12,  2325,   1703,       27592    ]

  Exemplos práticos:
  • "carro" (comum)           → 1 token
  • "automóvel" (menos comum) → 2–3 tokens
  • "pgvector" (técnico)      → 3–4 tokens
  • "atenção" (português)     → 2 tokens (acento adiciona complexidade)
  • código-fonte              → geralmente mais tokens que texto natural

━━━ TOKENIZADORES PRINCIPAIS ━━━

  tiktoken (GPT-4, GPT-3.5):
  → Vocabulário ~100k tokens (cl100k_base, o200k_base)
  → Eficiente para inglês, razoável para português

  SentencePiece (Llama 2/3, Gemini):
  → Vocabulário 32k–128k tokens, baseado em BPE
  → Melhor suporte a português e idiomas não-latinos

  WordPiece (BERT, E5, BGE — modelos de embedding):
  → Vocabulário ~30k–32k tokens
  → Divide palavras raras em subpalavras comuns

━━━ POR QUE IMPORTA PARA RAG ━━━

  1. CHUNKING É DEFINIDO EM TOKENS, NÃO EM PALAVRAS:
     chunk_size=512 tokens ≈ 350–400 palavras em inglês
     chunk_size=512 tokens ≈ 250–320 palavras em português (mais tokens/palavra)
     → Definir chunk_size em palavras é estimativa — tokens é a realidade

  2. CUSTO DE API É EM TOKENS:
     APIs cobram por: tokens_entrada (prompt) + tokens_saída (resposta)
     k chunks × chunk_size tokens = custo adicional por query
     Exemplo: k=4, chunk_size=512 → +2.048 tokens de entrada por query

  3. CONTEXT WINDOW TEM LIMITE EM TOKENS:
     Llama 3.2:       128k tokens
     GPT-4:           128k tokens
     Gemini 1.5 Pro:    1M tokens
     Chunks que cabem = (window - prompt - resposta) / chunk_size

━━━ REGRAS PRÁTICAS ━━━

  1 token ≈ 4 caracteres (inglês) / 3 caracteres (português com acentos)
  1 token ≈ 0.75 palavras (inglês) / 0.6 palavras (português)
  1 página A4 densa         ≈ 700–900 tokens
  1 artigo científico curto ≈ 3.000–8.000 tokens
  1 livro técnico (~300 pág) ≈ 200.000–300.000 tokens

  Para contar tokens exatamente (Python):
  import tiktoken
  enc = tiktoken.get_encoding("cl100k_base")  # GPT-4 / GPT-3.5
  n_tokens = len(enc.encode("seu texto aqui"))

  LangChain oferece token-aware splitting:
  CharacterTextSplitter.from_tiktoken_encoder(
      encoding_name="cl100k_base",
      chunk_size=512,
      chunk_overlap=50,
  )`,
  },

  /* ── 13. Técnicas Avançadas de Retrieval ─────────────────────────────────── */
  {
    id: "retrieval-advanced",
    title: "Técnicas Avançadas de Retrieval",
    tag: "Pesquisa",
    color: "fuchsia",
    content: `Técnicas de retrieval além do padrão vetorial, baseadas em pesquisa 2023–2025.

━━━ BUSCA ESPARSA — BM25 ━━━

  Algoritmo clássico baseado em frequência de termos (evolução do TF-IDF):

  BM25(q,d) = Σ IDF(t) × (tf × (k₁+1)) / (tf + k₁×(1 - b + b×|d|/avgdl))

  onde: k₁=1.5, b=0.75 (padrões), tf = frequência do termo no documento

  ✓ Excelente para termos exatos: siglas, nomes próprios, IDs, código
  ✗ Sem compreensão semântica: "carro" NÃO encontra "automóvel"

━━━ BUSCA HÍBRIDA + RRF ━━━

  Combina busca densa (vetorial) + esparsa (BM25):

  Reciprocal Rank Fusion:
  RRF(d) = Σ 1 / (k + rankᵢ(d))   para cada sistema i, k=60 (padrão)

  IBM Blended RAG (2024):
  → Busca híbrida supera qualquer índice individual
  → Em alguns casos supera fine-tuning específico de domínio
  → Recomendado como DEFAULT para sistemas em produção

━━━ BUSCA MULTI-HOP ━━━

  Para perguntas que exigem combinar múltiplos documentos:

  "Quem fundou a empresa que criou o modelo que venceu o GPT-4 no benchmark X?"
  Passo 1: busca "benchmark X"   → "modelo Y venceu GPT-4"
  Passo 2: busca "modelo Y"      → "criado pela empresa Z"
  Passo 3: busca "empresa Z"     → "fundada por pessoa W"
  Resposta: "W"

  Cada busca usa o resultado anterior como contexto da próxima query.
  Não é resolvível em uma única rodada de retrieval.

━━━ RERANKING CROSS-ENCODER ━━━

  Bi-encoder (retrieval):  encode(query) × encode(doc)  → rápido, paralelo
  Cross-encoder (reranking): encode(query + doc juntos) → lento, preciso

  Fluxo típico:
  query → busca vetorial → Top-50 candidatos → cross-encoder → Top-5 melhores

  Por que funciona: o cross-encoder vê query E documento juntos → mais preciso
  Modelos: Cohere Rerank, BGE Reranker, ms-marco-MiniLM-L-6-v2

━━━ FAIR-RAG — GAP ANALYSIS ITERATIVO ━━━

  Após cada rodada de busca, verifica se a pergunta foi completamente respondida.
  Se não: identifica exatamente o que FALTA → busca especificamente isso.

  "O sistema sabe exatamente o que não sabe."
  Resultado: +8 pontos em HotpotQA (benchmark multi-hop)
  Estado da arte em perguntas que requerem múltiplas fontes combinadas.

━━━ VENDI-RAG — DIVERSIDADE DE RETRIEVAL ━━━

  Maximiza diversidade semântica dos chunks recuperados.
  Evita recuperar k cópias da mesma informação — desperdício de contexto.

  Vendi Score: mede diversidade via determinante da matriz de similaridade.
  Alternativa mais simples: MMR (Maximal Marginal Relevance).
  Resultado: +4% em QA multi-hop (2024).

━━━ RAG-STAR — MCTS + VERIFICAÇÃO ━━━

  Monte Carlo Tree Search explora múltiplos caminhos de raciocínio.
  RAG verifica cada passo da árvore antes de commitar a direção.

  ✓ Separa exploração (MCTS) de verificação (RAG)
  ✓ Elimina conflito entre conhecimento paramétrico e externo
  Resultado: +19% em raciocínio complexo.

━━━ REFRAG — COMPRESSÃO NO DECODER (META, 2025) ━━━

  Comprime chunks em embeddings antes de entrar no decoder do LLM.
  Atenção entre chunks é block-diagonal — a maioria do cross-attention é redundante.

  Resultado: 30× aceleração de inferência com ZERO perda de accuracy.
  Torna RAG com contextos muito longos economicamente viável.

━━━ RAG-GYM — DPO COM SUPERVISÃO DE PROCESSO ━━━

  Treina agente RAG com reinforcement learning via DPO.
  Supervisão nos PASSOS INTERMEDIÁRIOS, não apenas na resposta final.

  "Ensina COMO raciocinar, não apenas O QUE responder."
  Resultado: +24% em generalização out-of-distribution.
  Supera supervisão de resultado puro — o processo importa tanto quanto o fim.

━━━ COLLAB-RAG — SLM + LLM COLABORATIVO ━━━

  Desafio: LLMs grandes (GPT-4) são caros para cada passo de retrieval.
  Solução: combina um SLM local pequeno com um LLM grande black-box.

  Arquitetura:
  SLM (3B params, local):
  → Decide QUANDO e O QUE buscar (retrieval policy)
  → Faz sub-queries especializadas para decomposição da pergunta
  → Baixo custo por chamada

  LLM (black-box, ex: GPT-4):
  → Recebe apenas o contexto já filtrado pelo SLM
  → Gera a resposta final com qualidade máxima
  → Chamado apenas 1× por query (não a cada passo)

  Treinamento:
  → Preference optimization sem anotações humanas
  → O LLM grande gera dados de preferência (respostas boas vs. ruins)
  → O SLM aprende com esses dados — loop auto-supervisionado

  Resultado: performance próxima a usar LLM em todos os passos
  ao custo de usar apenas o SLM local para o retrieval.
  Ideal para: produção com budget limitado + LLM de alta qualidade como gerador.`,
  },

  /* ── 14. GraphRAG e Busca em Grafos ─────────────────────────────────────── */
  {
    id: "graphrag",
    title: "GraphRAG — Busca em Grafos",
    tag: "Pesquisa",
    color: "green",
    content: `Quando a informação está nas RELAÇÕES entre conceitos, busca vetorial pura falha.
GraphRAG combina grafos de conhecimento com RAG para raciocínio relacional.

━━━ POR QUE GRAFOS? ━━━

  Busca vetorial: "qual o conteúdo deste chunk?"
  Busca em grafo:  "qual a RELAÇÃO entre entidade A e entidade B?"

  Exemplo:
  "Qual o impacto do medicamento X na proteína Y em pacientes com condição Z?"
  → 3 entidades, 2 relações — sem grafo, retrieval vetorial recupera chunks díspares.
  → Com grafo: percorre X → Y → Z em uma única consulta estruturada.

━━━ OS 4 TIPOS DE GRAFOS EM RAG ━━━

  1. KNOWLEDGE GRAPH (KG)
     Estrutura: triplas  (sujeito) —[predicado]→ (objeto)
     Exemplo:   "REFRAG" —[developed_by]→ "Meta AI"
     Força:     semântica formal, raciocínio simbólico
     Fraqueza:  construção custosa, domínio fechado

  2. PROPERTY GRAPH
     Nós e arestas com propriedades arbitrárias (key-value)
     Exemplo: {author: "Lewis", year: 2020, citations: 4200}
     Força:   flexível, fácil de enriquecer com metadados
     Fraqueza: sem semântica formal, mais ad-hoc

  3. HYPERGRAPH
     Uma aresta pode conectar N nós (não apenas 2)
     Exemplo: hiper-aresta {Meta, 2025, REFRAG, compressão} — uma relação entre 4 entidades
     Força:   relações N-ários que KG padrão não expressa
     Fraqueza: complexidade de consulta, menos tooling disponível

  4. HIERARCHICAL GRAPH (árvore de resumos)
     Folhas = chunks originais → nós intermediários = resumos → raiz = resumo global
     Implementação: RAPTOR (2024) — Random Projections for Tree Recursion
     Força:   pergunta abstrata consulta topo; pergunta específica consulta folha
     Fraqueza: custo de construção (N embeddings extras por doc)

━━━ ALGORITMOS DE TRAVERSAL ━━━

  BFS (Busca em Largura):
    Explora vizinhos por camadas.
    Bom para: "o que está próximo de X?" — contexto local.

  DFS (Busca em Profundidade):
    Segue um caminho até o fim antes de voltar.
    Bom para: "existe um caminho de A até Z?" — alcançabilidade.

  Personalized PageRank (PPR):
    Simula random walk a partir de entidades-semente da query.
    Retorna score de relevância para TODOS os nós do grafo.
    Mais sofisticado que BFS/DFS — considera estrutura global.

  Beam Search k=3:
    Mantém os k melhores caminhos a cada passo.
    Bom para: raciocínio multi-hop estruturado (multi-hop RAG).

  A* (heurística):
    Direciona a busca com uma função heurística de custo.
    Bom para: grafos grandes onde BFS/DFS seriam lentos demais.

  WaterCircle (CARROT, 2024):
    Expande a partir de entidades-semente em ondas circulares.
    Controla cobertura vs profundidade adaptativamente.

━━━ MICROSOFT GRAPHRAG (open-source) ━━━

  Passo 1: Extrai entidades e relações de todos os documentos → constrói KG
  Passo 2: Detecta comunidades no grafo (Leiden algorithm)
  Passo 3: Gera resumo para cada comunidade
  Passo 4: Query global → encontra comunidades relevantes → resumos como contexto

  Caso de uso ideal:
  Perguntas globais sobre um corpus ("quais são os principais temas?")
  Perguntas relacionais ("como A se relaciona com B através de C?")

  Custo:
  → Indexação: ~$10–50 por corpus pequeno (muitas chamadas LLM)
  → Query: barato (resumos de comunidade já estão prontos)

━━━ COMPARATIVO: VETORIAL vs GRAFO ━━━

  BUSCA VETORIAL             │ BUSCA EM GRAFO (GraphRAG)
  ───────────────────────────┼──────────────────────────────────────────
  Busca por similaridade     │ Busca por relações explícitas
  Retorna chunks de texto    │ Retorna caminhos no grafo
  Não vê conexões implícitas │ Captura relações N-hop
  Rápido de indexar          │ Indexação custosa (extração de entidades)
  Ótimo para perguntas locais│ Ótimo para perguntas relacionais/globais

━━━ ARQUITETURA COMBINADA (estado da arte) ━━━

  query → NER extrai entidades → DUAL RETRIEVAL
    ├── vetorial:  busca chunks semelhantes (contexto local)
    └── grafo:     percorre KG a partir das entidades (contexto relacional)
           ↓
  FUSION LAYER: combina chunks + caminhos do grafo
           ↓
  LLM: resposta com contexto local E relacional

  Quando usar:
  ✓ Corpus com entidades fortemente inter-relacionadas (biomédico, legal, financeiro)
  ✓ Perguntas multi-hop que exigem encadeamento de relações
  ✓ Análise de "comunidades" dentro de um corpus grande
  ✗ Corpus de FAQs simples → vetorial padrão é suficiente e mais barato`,
  },

  /* ── 15. Quando (Não) Usar RAG ───────────────────────────────────────────── */
  {
    id: "when-to-use",
    title: "Quando (Não) Usar RAG",
    tag: "Decisão",
    color: "sky",
    content: `Guia de decisão para escolher entre RAG, Fine-tuning e Prompt Engineering.

━━━ QUANDO USAR RAG ━━━

  1. BASE DE CONHECIMENTO PROPRIETÁRIA
     Manuais internos, contratos, políticas da empresa.
     O LLM não foi treinado nesses dados.
     RAG os torna disponíveis instantaneamente — sem expor ao treinamento.

  2. INFORMAÇÃO QUE MUDA FREQUENTEMENTE
     Preços, notícias, documentação técnica versionada.
     RAG re-indexa novos docs sem retreinar o modelo.
     Hot-swap: adicionou 1 PDF → disponível na próxima query.

  3. CITAÇÃO DE FONTES OBRIGATÓRIA
     Contextos regulatórios, jurídicos, médicos.
     Cada afirmação rastreável ao chunk e documento de origem.
     Exemplo: Telco-RAG — 90.8% de accuracy em padrões 3GPP.

  4. BASE QUE NÃO CABE NO CONTEXTO
     10.000+ documentos, PDFs de centenas de páginas.
     Mesmo 1M tokens não carrega tudo — veja seção Futuro.
     RAG seleciona apenas os trechos relevantes por query.

  5. PRIVACIDADE DE DADOS
     Long context = enviar TODA a base para uma API a cada chamada.
     RAG envia apenas 3–10 chunks por query — exposição mínima.
     Dados sensíveis permanecem na sua infraestrutura.

━━━ QUANDO NÃO USAR RAG ━━━

  1. CONHECIMENTO PARAMÉTRICO SUFICIENTE
     "Qual é a capital da França?" — o LLM já sabe com certeza.
     RAG adiciona latência e custo sem benefício algum.

  2. TAREFAS CRIATIVAS SEM BASE FACTUAL
     Geração de histórias, brainstorming, tradução criativa.
     RAG pode restringir criatividade indesejavelmente.

  3. POUCOS DOCUMENTOS (< 20 curtos)
     Cabem inteiros no contexto — concatene e envie diretamente.
     Regra: se cabe no contexto, não precisa de RAG.

  4. BASE ESTÁTICA COM PERGUNTAS PADRONIZADAS
     Fine-tuning em dataset curado pode superar RAG.
     Ex: classificador de sentimentos em domínio específico.

  5. RESPOSTAS 100% DETERMINÍSTICAS
     RAG com retrieval dinâmico pode variar entre chamadas.
     Fine-tuning pode ser mais adequado para saídas fixas.

━━━ RAG vs FINE-TUNING vs PROMPT ENGINEERING ━━━

                     RAG             Fine-tuning      Prompt Eng
  Conhecimento     Externo (docs)   Paramétrico      Contextual
  Atualização      Imediata         Retreinamento    Imediata
  Custo inferência Médio            Baixo (pós)      Baixo
  Custo setup      Médio            Alto             Baixo
  Explicabilidade  Alta (cita)      Baixa            Média
  Escalabilidade   Alta             Média            Baixa
  Privacidade      Alta             Média            Depende

━━━ A COMBINAÇÃO IDEAL ━━━

  Para sistemas de produção de alta qualidade:
  RAG (busca certa) + Fine-tuning (comportamento) + Prompts (instruções)

  MUST-RAG (KAIST):
  → RAG sozinho:       82% accuracy em QA de domínio específico
  → RAG + Fine-tuning: 92% accuracy

  Progressão prática:
  1. Prompt Engineering → rápido, barato, valida o conceito
  2. + RAG              → quando precisar de dados atualizados/privados
  3. + Fine-tuning       → quando estilo ou comportamento precisar mudar`,
  },

  /* ── 16. Métricas de Avaliação ───────────────────────────────────────────── */
  {
    id: "evaluation",
    title: "Métricas de Avaliação",
    tag: "Qualidade",
    color: "pink",
    content: `Como medir a qualidade de um pipeline RAG em cada etapa do processo.

━━━ MÉTRICAS DE RETRIEVAL ━━━

  Recall@K:
  Recall@5 = relevantes_no_top5 / total_documentos_relevantes
  → "O retriever recuperou os documentos que devia recuperar?"
  → Range: [0, 1]. 1.0 = todos os relevantes estão no Top-K.

  Precision@K:
  Precision@5 = relevantes_no_top5 / 5
  → "O que foi recuperado é realmente relevante?"
  → Mede foco/precisão — complementar ao Recall.

  MRR (Mean Reciprocal Rank):
  MRR = média de (1 / posição_do_primeiro_relevante)
  → Quão alto está o PRIMEIRO documento relevante?
  → MRR=1.0 = sempre na posição 1. MRR=0.5 = média posição 2.

  NDCG (Normalized Discounted Cumulative Gain):
  → Considera posição E grau de relevância (não só 0/1)
  → Documento muito relevante na posição 1 > levemente relevante na posição 1
  → Métrica mais completa que Recall/Precision sozinhas.

━━━ MÉTRICAS DE GERAÇÃO ━━━

  Exact Match (EM):
  → A resposta gerada é exatamente igual à referência?
  → Rígida demais para respostas abertas. Útil para fact-checking simples.

  F1 Token-level:
  → Sobreposição de tokens entre resposta gerada e referência
  → Mais flexível que EM. Parcialmente correto = score parcial.

  ROUGE-L:
  → Maior subsequência comum (LCS) entre gerado e referência
  → Usado principalmente em sumarização de texto.

━━━ MÉTRICAS SEM REFERÊNCIA — RAGAS ━━━

  Framework que usa LLM como juiz — substitui anotações humanas.
  95% de concordância com avaliações humanas (paper original, 2023).

  Faithfulness (Fidelidade):
  Faithfulness = afirmações_suportadas / total_afirmações_na_resposta
  → "A resposta é fiel ao contexto recuperado?"
  → Detecta alucinações em relação ao contexto (não ao mundo real)
  → Score 1.0 = todo fato na resposta está no contexto

  Answer Relevancy:
  → LLM gera N queries hipotéticas a partir da resposta gerada
  → Calcula similaridade média com a query original
  → "A resposta endereça a pergunta? Ou desvia do tema?"

  Context Relevancy:
  Context Relevancy = sentenças_relevantes / total_sentenças_no_contexto
  → "O contexto recuperado é focado? Há ruído excessivo?"
  → Score baixo = retriever traz muita informação irrelevante

  Context Recall:
  → Com golden answer: o contexto contém os fatos da resposta ideal?
  → Requer referência humana para calcular — mais trabalhoso.

━━━ PIRÂMIDE DE AVALIAÇÃO ━━━

           ┌───────────────────┐
           │  Avaliação humana  │  ← mais confiável, mais caro
           └─────────┬─────────┘
                     │
          ┌──────────┴──────────────┐
          │   LLM-as-a-judge        │  ← escalável, custo médio
          │   (RAGAS, GPT-4-eval)   │
          └──────────┬──────────────┘
                     │
        ┌────────────┴────────────────────┐
        │  Métricas automáticas            │  ← barato, menos confiável
        │  (EM, F1, ROUGE, Recall@K)      │
        └──────────────────────────────────┘

  Para produção:
  ✓ Métricas automáticas → monitoramento contínuo (tempo real ou diário)
  ✓ LLM-as-a-judge       → avaliações periódicas (semanal/mensal)
  ✓ Avaliação humana     → decisões de arquitetura e roadmap`,
  },

  /* ── 17. Padrão Map-Reduce ───────────────────────────────────────────────── */
  {
    id: "map-reduce",
    title: "Padrão Map-Reduce em RAG",
    tag: "Padrão",
    color: "green",
    content: `Padrão para analisar TODOS os documentos de um conjunto sem custo de long context.

━━━ O PROBLEMA DO TRADE-OFF ━━━

  Analisar TUDO  → precisa ler todos os documentos (muito caro)
  Baixo custo    → precisa ler o mínimo possível

  RAG padrão: seleciona por similaridade → ignora docs pouco similares.
  Long context: cabe tudo, mas custa ~1.750× mais (veja seção Futuro).

  Solução: separar QUANDO você lê cada parte do documento.

━━━ FASE 1 — INGESTÃO (offline, uma vez por conjunto) ━━━

  Para CADA documento, um modelo barato gera um resumo durante a indexação:

  Anexo A (PDF 50 pág.) → "Relatório de bug no módulo X, causa: timeout em Y"
  Anexo B (stack trace) → "NullPointerException linha 47 em UserService.java"
  Anexo C (screenshot)  → OCR → "Tela de erro 500, Connection refused"

  O que vai para o banco por documento:
  • Nível 1 (resumo):  1 chunk por doc    → busca rápida e geral
  • Nível 2 (detalhe): N chunks por doc   → busca detalhada quando necessário

  Custo de ingestão: ~$0.001–0.005 por documento (GPT-4o-mini / Gemini Flash)

━━━ FASE 2 — CONSULTA (duas estratégias combinadas) ━━━

  Estratégia A — RAG RÁPIDO (queries específicas):
  "Qual a causa raiz do bug?"
    → busca vetorial nos chunks detalhados
    → retorna Top-5 mais relevantes → LLM responde
    Custo: ~$0.002. Risco: pode perder docs pouco similares à query.

  Estratégia B — MAP-REDUCE (análise completa):
  "Analise o conjunto de documentos completamente"
    STEP 1: busca RESUMOS de TODOS os N documentos (1 chunk cada)
    STEP 2: LLM sintetiza sobre os resumos
            → "Docs B e C parecem críticos para esta análise"
    STEP 3: busca detalhada APENAS em B e C → gera resposta final
    Custo: O LLM paga preço alto só nos 1–2 docs que realmente importam.

━━━ VERIFICAÇÃO DE COBERTURA (FAIR-RAG INSPIRADO) ━━━

  Após a síntese, verifica quais fontes foram realmente consultadas:

  resumos = buscar_resumos(conjunto_id)       # todos os docs
  resposta = llm.gerar(resumos, query)

  nao_citados = [d for d in docs if d.id not in resposta.fontes_usadas]
  if nao_citados:
      relevancia = llm.avaliar(nao_citados, query)
      if relevancia.tem_info_nova:
          resposta = llm.refinar(resposta, relevancia.chunks)

  O sistema sabe o que leu e busca o que ficou fora antes de finalizar.
  "O sistema sabe exatamente o que não sabe."

━━━ COMPARAÇÃO DE CUSTO — 10 DOCUMENTOS ━━━

  Abordagem               Tokens/query   Custo aprox.   Cobertura
  Long context (tudo)     ~500k tokens   ~$1.75         100%
  RAG padrão (top-5)      ~5k tokens     ~$0.002        60–80%
  Map-Reduce hierárquico  ~30k tokens    ~$0.05         ~95%

  Map-Reduce: 95% de cobertura por apenas 3% do custo do long context.

━━━ QUANDO USAR CADA ESTRATÉGIA ━━━

  Query específica sobre 1 doc           → RAG padrão
  Análise completa de um conjunto        → Map-Reduce hierárquico
  < 5 docs curtos, análise esporádica   → Long context direto (simples)
  Docs com imagens como evidência        → OCR/Vision + Map-Reduce
  Não pode perder nenhuma fonte          → Map-Reduce + verificação de cobertura`,
  },

  /* ── 18. O Futuro do RAG ─────────────────────────────────────────────────── */
  {
    id: "future",
    title: "O Futuro do RAG",
    tag: "Pesquisa",
    color: "slate",
    content: `Tendências emergentes (2025–2026) e o debate definitivo: Long Context vs RAG.

━━━ TENDÊNCIAS 2025–2026 ━━━

  AGENTIC RAG COM RL:
  → Pipelines estáticos substituídos por agentes que aprendem quando/como buscar
  → DPO com supervisão de processo é a técnica dominante (RAG-Gym)
  → O sistema melhora com uso sem retreinamento explícito

  MCTS + RAG (Test-Time Compute):
  → Monte Carlo Tree Search explora múltiplos caminhos de raciocínio
  → RAG verifica cada passo da árvore antes de commitar o resultado
  → Cada token adicional em inferência melhora a qualidade da resposta

  COMPRESSÃO DE CONTEXTO (REFRAG, Meta 2025):
  → Chunks comprimidos em embeddings antes de entrar no decoder
  → 30× aceleração mantendo accuracy — caminho para infraestrutura padrão

  GRAPHRAG + HYPERGRAPHS:
  → Busca vetorial pura substituída por grafos para domínios relacionais
  → A informação está nas RELAÇÕES entre conceitos, não só nos textos
  → Microsoft GraphRAG: open-source, comunidades de entidades

  RAG MULTIMODAL:
  → Retriever e generator operam em imagens, vídeo, áudio e tabelas
  → T-RAG para tabelas em relatórios financeiros
  → AR-RAG para documentos com figuras científicas

━━━ LONG CONTEXT vs RAG — ANÁLISE DEFINITIVA ━━━

  A questão: se Gemini tem 1M tokens de contexto, por que construir RAG?

  ── QUANDO LONG CONTEXT SUBSTITUI RAG ──
  • < 100 docs, queries esporádicas → manda tudo, sem infraestrutura
  • Raciocínio GLOBAL obrigatório   → resumir TODOS, identificar contradições
  • Prototipagem rápida             → sem embedding, banco vetorial, pipeline

  ── POR QUE RAG AINDA VENCE NA MAIORIA DOS CASOS ──

  CUSTO — o argumento principal:
  Gemini 1.5 Pro: ~$3.50 por chamada com 1M tokens
  1.000 queries/dia com RAG (top-5 chunks):  ~$2/dia      → ~$60/mês
  1.000 queries/dia com long context (1M):   ~$3.500/dia  → ~$105.000/mês
  Diferença: 1.750× mais caro. Para qualquer volume real, encerra a discussão.

  LATÊNCIA:
  → Atenção é O(n²) → TTFT com 1M tokens: 30–60 segundos
  → REFRAG demonstrou 30× aceleração sobre contexto completo (Meta, 2025)

  LOST IN THE MIDDLE:
  → Modelos prestam mais atenção às bordas do contexto, mesmo com 1M tokens
  → RAG coloca os chunks mais relevantes sempre no início do prompt

  ESCALA:
  → 1M tokens ≈ 750k palavras ≈ ~2.500 páginas de PDF
  → Empresa média: milhões de docs — não cabe em nenhuma context window

  PRIVACIDADE:
  → Long context = enviar TODA a base para uma API a cada chamada
  → RAG envia apenas 3–10 chunks por query — exposição mínima de dados

  EXPLICABILIDADE:
  → Quando long context alucina, não há como rastrear a origem do erro
  → RAG: cada afirmação tem chunk de origem identificável e auditável

━━━ LINHA DO TEMPO ━━━

  2020: RAG inventado — Lewis et al., Facebook AI Research
  2022: Popularizado com ChatGPT + LangChain + primeiros bancos vetoriais
  2023: RAGAS para avaliação. Advanced RAG. Self-RAG. CRAG.
  2024: Multi-hop RAG. RAG-Star (MCTS). IBM Blended RAG. RAPTOR.
  2025: REFRAG (30×). RAG-Gym (DPO processo). Agentic RAG consolidando.
  2026: GraphRAG enterprise. RAG multimodal. RAG quântico (teórico).
  2027+: RAG integrado nativo em LLMs? Context engineering?

  Conclusão: long context para RACIOCÍNIO interno.
  RAG para ACESSO A CONHECIMENTO externo.
  Não é "um ou outro" — é usar cada um onde melhor se aplica.`,
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   BANCO DE PERGUNTAS DE ENTREVISTA (72 perguntas)
   ───────────────────────────────────────────────────────────────────────────── */

const QA_POOL = [
  // ── RAG Fundamentos ──
  { q: "O que é RAG e qual problema central ele resolve nos LLMs?", topic: "RAG" },
  { q: "Qual a diferença entre Naive RAG e Advanced RAG?", topic: "RAG" },
  { q: "O que é HyDE (Hypothetical Document Embeddings) e por que melhora o retrieval?", topic: "RAG" },
  { q: "O que é re-ranking e qual a diferença entre bi-encoder e cross-encoder?", topic: "RAG" },
  { q: "O que é MMR (Maximal Marginal Relevance) e quando usar?", topic: "RAG" },
  { q: "Qual a diferença entre Self-RAG e CRAG (Corrective RAG)?", topic: "RAG" },
  { q: "O que é RAPTOR e qual o problema que resolve em documentos longos?", topic: "RAG" },
  { q: "O que é hybrid search e como RRF combina os resultados?", topic: "RAG" },
  { q: "Como avaliar a qualidade de um sistema RAG? Quais métricas usar?", topic: "RAG" },
  { q: "Quando usar RAG vs fine-tuning? Quais as vantagens de cada?", topic: "RAG" },

  // ── Chunking e Embeddings ──
  { q: "Quais são as principais estratégias de chunking e como escolher?", topic: "Embeddings" },
  { q: "O que é chunk_overlap e por que é importante?", topic: "Embeddings" },
  { q: "O que é Parent-Child chunking (Small-to-Big)?", topic: "Embeddings" },
  { q: "O que é cosine similarity e por que é preferida sobre distância euclidiana em NLP?", topic: "Embeddings" },
  { q: "Qual a diferença entre dense embeddings e sparse embeddings (BM25)?", topic: "Embeddings" },
  { q: "O que são os operadores <=>, <-> e <#> no pgvector?", topic: "pgvector" },

  // ── LangChain ──
  { q: "O que faz create_retrieval_chain e qual o fluxo interno?", topic: "LangChain" },
  { q: "Qual a diferença entre stuff, map_reduce e refine chains?", topic: "LangChain" },
  { q: "O que é LCEL (LangChain Expression Language) e como usar pipe (|)?", topic: "LangChain" },
  { q: "O que é um VectorStoreRetriever e como configurar k e search type?", topic: "LangChain" },
  { q: "Como funciona ConversationBufferMemory vs ConversationSummaryMemory?", topic: "LangChain" },
  { q: "Qual a estrutura do objeto Document no LangChain?", topic: "LangChain" },
  { q: "Qual a diferença entre langchain-core, langchain e langchain-community?", topic: "LangChain" },

  // ── LlamaIndex ──
  { q: "O que é o objeto Settings no LlamaIndex e por que é global?", topic: "LlamaIndex" },
  { q: "Qual a diferença entre Document e Node no LlamaIndex?", topic: "LlamaIndex" },
  { q: "O que é ResponseSynthesizer e quais os modos disponíveis?", topic: "LlamaIndex" },
  { q: "Como criar um VectorStoreIndex conectando a um pgvector existente?", topic: "LlamaIndex" },
  { q: "O que é StorageContext no LlamaIndex e o que ele agrega?", topic: "LlamaIndex" },
  { q: "Como acessar os source nodes de uma resposta LlamaIndex?", topic: "LlamaIndex" },

  // ── pgvector + SQLAlchemy ──
  { q: "O que é o índice HNSW e quando usar vs IVFFlat?", topic: "pgvector" },
  { q: "Quais as tabelas criadas pelo LangChain no PostgreSQL e seus campos?", topic: "pgvector" },
  { q: "Como mapear uma coluna vector(768) com SQLAlchemy 2.x?", topic: "SQLAlchemy" },
  { q: "O que é pool_pre_ping=True no SQLAlchemy e por que importa?", topic: "SQLAlchemy" },
  { q: "Quando usar NullPool vs pool padrão no SQLAlchemy?", topic: "SQLAlchemy" },
  { q: "Como filtrar por campo JSONB com SQLAlchemy?", topic: "SQLAlchemy" },
  { q: "Qual a diferença entre session.query() e session.execute(select())?", topic: "SQLAlchemy" },

  // ── OpenTelemetry ──
  { q: "Quais são os 3 pilares (sinais) do OpenTelemetry?", topic: "OpenTelemetry" },
  { q: "O que é um Span e quais são seus atributos essenciais?", topic: "OpenTelemetry" },
  { q: "Qual a diferença entre TracerProvider, Tracer e Span?", topic: "OpenTelemetry" },
  { q: "O que é BatchSpanProcessor vs SimpleSpanProcessor?", topic: "OpenTelemetry" },
  { q: "O que é o OTel Collector e qual a vantagem de usá-lo?", topic: "OpenTelemetry" },
  { q: "O que é FastAPIInstrumentor e quais atributos ele adiciona aos spans?", topic: "OpenTelemetry" },

  // ── Stack de Observabilidade ──
  { q: "Qual a diferença entre Jaeger e Grafana Tempo?", topic: "Observabilidade" },
  { q: "O que é Loki e como ele difere do Elasticsearch para logs?", topic: "Observabilidade" },
  { q: "O que é Promtail e qual o seu papel no stack de observabilidade?", topic: "Observabilidade" },
  { q: "O que é PromQL? Cite um exemplo para calcular o p95 de latência.", topic: "Observabilidade" },
  { q: "O que é LogQL? Como filtrar logs de nível ERROR no Loki?", topic: "Observabilidade" },
  { q: "Como correlacionar um trace no Tempo com logs no Loki no Grafana?", topic: "Observabilidade" },

  // ── Como um LLM Funciona ──
  { q: "Qual a diferença entre memória paramétrica e memória contextual em um LLM?", topic: "LLM" },
  { q: "O que é geração autorregressiva e como funciona token a token?", topic: "LLM" },
  { q: "O que é o fenômeno 'Lost in the Middle' e como mitigar em RAG?", topic: "LLM" },
  { q: "Por que usar temperatura 0 ou baixa em sistemas RAG factuais?", topic: "LLM" },
  { q: "O que é KV Cache e como impacta RAG com contextos longos?", topic: "LLM" },

  // ── Tokenização ──
  { q: "O que é um token e por que '1 token ≠ 1 palavra'?", topic: "Tokenização" },
  { q: "Por que tokenização importa para definir chunk_size em RAG?", topic: "Tokenização" },
  { q: "Qual a diferença entre tiktoken, SentencePiece e WordPiece?", topic: "Tokenização" },
  { q: "Quantos tokens tem aproximadamente 1 página A4 de texto em português?", topic: "Tokenização" },

  // ── Retrieval Avançado ──
  { q: "O que é o algoritmo BM25 e quando supera busca vetorial densa?", topic: "Retrieval" },
  { q: "Como funciona o Reciprocal Rank Fusion (RRF) em busca híbrida?", topic: "Retrieval" },
  { q: "O que é FAIR-RAG e como o gap analysis melhora respostas multi-hop?", topic: "Retrieval" },
  { q: "O que é RAG-Star e qual o papel do MCTS no processo de retrieval?", topic: "Retrieval" },
  { q: "O que é REFRAG e qual o ganho de performance demonstrado (Meta, 2025)?", topic: "Retrieval" },
  { q: "O que é busca multi-hop e qual a diferença para busca vetorial padrão?", topic: "Retrieval" },
  { q: "O que é Collab-RAG e como o SLM e LLM colaboram para reduzir custo sem perda de qualidade?", topic: "Retrieval" },

  // ── LangChain / DSPy ──
  { q: "Qual a diferença fundamental de paradigma entre LangChain e DSPy (Stanford)?", topic: "LangChain" },
  { q: "O que é uma Signature no DSPy e como ela substitui o prompt engineering manual?", topic: "LangChain" },
  { q: "O que faz um Teleprompter/Optimizer no DSPy? Cite exemplos.", topic: "LangChain" },

  // ── GraphRAG ──
  { q: "O que é GraphRAG e em que casos supera a busca vetorial padrão?", topic: "GraphRAG" },
  { q: "Qual a diferença entre Knowledge Graph, Property Graph e Hypergraph em RAG?", topic: "GraphRAG" },
  { q: "O que é um Hierarchical Graph (RAPTOR) e como ele resolve perguntas abstratas vs específicas?", topic: "GraphRAG" },
  { q: "Compare BFS, DFS e Personalized PageRank como algoritmos de traversal em GraphRAG.", topic: "GraphRAG" },
  { q: "Como o Microsoft GraphRAG usa comunidades de entidades para responder perguntas globais?", topic: "GraphRAG" },
  { q: "Descreva a arquitetura combinada vetorial + grafo e quando justifica o custo de indexação.", topic: "GraphRAG" },

  // ── Avaliação / Métricas ──
  { q: "O que é Faithfulness no RAGAS e como é calculado?", topic: "Avaliação" },
  { q: "Qual a diferença entre Recall@K e Precision@K em retrieval?", topic: "Avaliação" },
  { q: "O que é MRR (Mean Reciprocal Rank) e quando usar vs NDCG?", topic: "Avaliação" },
  { q: "O que é LLM-as-a-judge e por que é alternativa à avaliação humana?", topic: "Avaliação" },
  { q: "Como montar uma pirâmide de avaliação para sistema RAG em produção?", topic: "Avaliação" },

  // ── Padrões / Map-Reduce ──
  { q: "O que é o padrão Map-Reduce hierárquico em RAG e qual problema resolve?", topic: "Padrões" },
  { q: "Como a verificação de cobertura garante que nenhum documento foi perdido?", topic: "Padrões" },
  { q: "Compare custo e cobertura: RAG padrão vs Map-Reduce vs Long Context.", topic: "Padrões" },
  { q: "Por que long context com 1M tokens não substitui RAG em produção (custo)?", topic: "Padrões" },
];

/* ─────────────────────────────────────────────────────────────────────────────
   ESTILOS
   ───────────────────────────────────────────────────────────────────────────── */

const colorMap: Record<string, string> = {
  indigo:  "text-indigo-400 border-indigo-700/60 bg-indigo-950/30",
  emerald: "text-emerald-400 border-emerald-700/60 bg-emerald-950/30",
  teal:    "text-teal-400 border-teal-700/60 bg-teal-950/30",
  yellow:  "text-yellow-400 border-yellow-700/60 bg-yellow-950/30",
  blue:    "text-blue-400 border-blue-700/60 bg-blue-950/30",
  orange:  "text-orange-400 border-orange-700/60 bg-orange-950/30",
  rose:    "text-rose-400 border-rose-700/60 bg-rose-950/30",
  purple:  "text-purple-400 border-purple-700/60 bg-purple-950/30",
  violet:  "text-violet-400 border-violet-700/60 bg-violet-950/30",
  amber:   "text-amber-400 border-amber-700/60 bg-amber-950/30",
  cyan:    "text-cyan-400 border-cyan-700/60 bg-cyan-950/30",
  lime:    "text-lime-400 border-lime-700/60 bg-lime-950/30",
  fuchsia: "text-fuchsia-400 border-fuchsia-700/60 bg-fuchsia-950/30",
  sky:     "text-sky-400 border-sky-700/60 bg-sky-950/30",
  pink:    "text-pink-400 border-pink-700/60 bg-pink-950/30",
  green:   "text-green-400 border-green-700/60 bg-green-950/30",
  slate:   "text-slate-400 border-slate-700/60 bg-slate-950/30",
};

const tagColor: Record<string, string> = {
  indigo:  "bg-indigo-900/60 text-indigo-300",
  emerald: "bg-emerald-900/60 text-emerald-300",
  teal:    "bg-teal-900/60 text-teal-300",
  yellow:  "bg-yellow-900/60 text-yellow-300",
  blue:    "bg-blue-900/60 text-blue-300",
  orange:  "bg-orange-900/60 text-orange-300",
  rose:    "bg-rose-900/60 text-rose-300",
  purple:  "bg-purple-900/60 text-purple-300",
  violet:  "bg-violet-900/60 text-violet-300",
  amber:   "bg-amber-900/60 text-amber-300",
  cyan:    "bg-cyan-900/60 text-cyan-300",
  lime:    "bg-lime-900/60 text-lime-300",
  fuchsia: "bg-fuchsia-900/60 text-fuchsia-300",
  sky:     "bg-sky-900/60 text-sky-300",
  pink:    "bg-pink-900/60 text-pink-300",
  green:   "bg-green-900/60 text-green-300",
  slate:   "bg-slate-900/60 text-slate-300",
};

const topicColor: Record<string, string> = {
  RAG:             "text-indigo-400",
  Embeddings:      "text-yellow-400",
  LangChain:       "text-blue-400",
  LlamaIndex:      "text-orange-400",
  pgvector:        "text-rose-400",
  SQLAlchemy:      "text-pink-400",
  OpenTelemetry:   "text-purple-400",
  Observabilidade:  "text-violet-400",
  LLM:              "text-cyan-400",
  "Tokenização":    "text-lime-400",
  Retrieval:        "text-fuchsia-400",
  GraphRAG:         "text-green-400",
  "Avaliação":      "text-pink-400",
  "Padrões":        "text-green-400",
};

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENTE
   ───────────────────────────────────────────────────────────────────────────── */

export default function GuidePage() {
  const [open, setOpen]             = useState<string>("what-is-rag");
  const [qaItem, setQaItem]         = useState<typeof QA_POOL[0] | null>(null);
  const [answer, setAnswer]         = useState("");
  const [userAnswer, setUserAnswer] = useState("");
  const [checking, setChecking]     = useState(false);
  const [feedback, setFeedback]     = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [filterTopic, setFilterTopic] = useState<string>("Todos");

  const topics = ["Todos", ...Array.from(new Set(QA_POOL.map(q => q.topic)))];
  const filteredPool = filterTopic === "Todos"
    ? QA_POOL
    : QA_POOL.filter(q => q.topic === filterTopic);

  function drawQuestion() {
    const pick = filteredPool[Math.floor(Math.random() * filteredPool.length)];
    setQaItem(pick);
    setAnswer("");
    setUserAnswer("");
    setFeedback("");
    setShowAnswer(false);
  }

  async function checkAnswer() {
    if (!qaItem || !userAnswer.trim()) return;
    setChecking(true);
    setFeedback("");
    try {
      const res = await ragQuery(
        `Você é um entrevistador técnico sênior. Avalie esta resposta para a pergunta de entrevista: "${qaItem.q}". ` +
        `Resposta do candidato: "${userAnswer}". ` +
        `Dê uma nota de 0 a 10, explique o que está correto, o que está incompleto ou errado, e o que seria a resposta ideal. Seja direto e técnico.`,
        "langchain",
        6
      );
      setFeedback(res.answer);
    } catch (e) {
      setFeedback(`Erro ao avaliar: ${String(e)}`);
    } finally {
      setChecking(false);
    }
  }

  async function generateModelAnswer() {
    if (!qaItem) return;
    setChecking(true);
    try {
      const res = await ragQuery(
        `Responda de forma técnica e detalhada, como num livro especializado: ${qaItem.q}`,
        "langchain",
        6
      );
      setAnswer(res.answer);
      setShowAnswer(true);
    } catch (e) {
      setAnswer(`Erro: ${String(e)}`);
      setShowAnswer(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Cabeçalho */}
      <h1 className="text-2xl font-bold text-white mb-1">Guia Completo — RAG & Stack de Dados</h1>
      <p className="text-gray-400 text-sm mb-2">
        Conceitos detalhados: RAG, Chunking, Embeddings, LangChain, LlamaIndex, pgvector, SQLAlchemy e OpenTelemetry
      </p>
      <p className="text-gray-500 text-xs mb-8">
        {SECTIONS.length} seções · {QA_POOL.length} perguntas de entrevista · Use o treinador abaixo para praticar
      </p>

      {/* ── Treinador de Entrevista ──────────────────────────────────────── */}
      <div className="mb-10 bg-gray-900 border border-yellow-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="text-yellow-400" size={20} />
          <h2 className="text-lg font-bold text-white">Treinador de Entrevista</h2>
          <span className="ml-auto text-xs text-gray-500">{filteredPool.length} perguntas disponíveis</span>
        </div>

        {/* Filtro por tópico */}
        <div className="flex flex-wrap gap-2 mb-5">
          {topics.map(t => (
            <button
              key={t}
              onClick={() => setFilterTopic(t)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filterTopic === t
                  ? "bg-yellow-600 border-yellow-500 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {!qaItem ? (
          <div className="text-center py-6">
            <p className="text-gray-400 text-sm mb-4">
              Escolha um tópico e clique para receber uma pergunta aleatória.
            </p>
            <button
              onClick={drawQuestion}
              className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 mx-auto"
            >
              <RefreshCw size={16} />
              Gerar Pergunta
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pergunta */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded bg-gray-800 inline-block mb-2 ${topicColor[qaItem.topic] ?? "text-gray-400"}`}>
                  {qaItem.topic}
                </span>
                <p className="text-white font-semibold text-base leading-relaxed">{qaItem.q}</p>
              </div>
              <button onClick={drawQuestion} className="text-gray-500 hover:text-yellow-400 shrink-0 mt-1" title="Outra pergunta">
                <RefreshCw size={16} />
              </button>
            </div>

            {/* Campo de resposta */}
            <textarea
              value={userAnswer}
              onChange={e => setUserAnswer(e.target.value)}
              rows={5}
              placeholder="Escreva sua resposta aqui antes de ver a resposta modelo… Seja detalhado."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 resize-none leading-relaxed"
            />

            {/* Ações */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={checkAnswer}
                disabled={checking || !userAnswer.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {checking ? "Avaliando…" : "Avaliar minha resposta"}
              </button>
              <button
                onClick={generateModelAnswer}
                disabled={checking}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {checking ? "Gerando…" : "Ver resposta modelo (RAG)"}
              </button>
              <button
                onClick={drawQuestion}
                disabled={checking}
                className="ml-auto bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-1"
              >
                <RefreshCw size={13} /> Próxima
              </button>
            </div>

            {/* Feedback da avaliação */}
            {feedback && (
              <div className="bg-gray-800 border border-indigo-700/50 rounded-xl p-4">
                <p className="text-xs text-indigo-400 font-semibold mb-2 uppercase tracking-wide">Avaliação do entrevistador (via RAG)</p>
                <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{feedback}</p>
              </div>
            )}

            {/* Resposta modelo */}
            {showAnswer && answer && (
              <div className="bg-gray-800 border border-emerald-700/50 rounded-xl p-4">
                <p className="text-xs text-emerald-400 font-semibold mb-2 uppercase tracking-wide">Resposta modelo gerada pelo RAG</p>
                <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{answer}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Accordion de Conceitos ────────────────────────────────────────── */}
      <h2 className="text-lg font-bold text-white mb-4">Conceitos Técnicos Detalhados</h2>
      <div className="space-y-3">
        {SECTIONS.map(section => {
          const isOpen = open === section.id;
          const colors = colorMap[section.color] ?? colorMap.indigo;
          return (
            <div key={section.id} className={`border rounded-xl overflow-hidden transition-all ${colors}`}>
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-left"
                onClick={() => setOpen(isOpen ? "" : section.id)}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${tagColor[section.color] ?? tagColor.indigo}`}>
                    {section.tag}
                  </span>
                  <span className="font-semibold text-white">{section.title}</span>
                </div>
                {isOpen
                  ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                  : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
              </button>
              {isOpen && (
                <div className="px-6 pb-7 pt-1">
                  <pre className="whitespace-pre-wrap text-sm text-gray-300 leading-7 font-sans">
                    {section.content}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
