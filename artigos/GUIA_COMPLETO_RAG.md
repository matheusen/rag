# Guia Completo de RAG
> Do zero à fronteira da pesquisa — baseado em 42 artigos científicos (2020–2026)

---

## Índice

1. [O que é RAG](#1-o-que-é-rag)
2. [Por que RAG existe — Limitações dos LLMs](#2-por-que-rag-existe--limitações-dos-llms)
3. [Como um LLM funciona — Fundamentos](#3-como-um-llm-funciona--fundamentos)
4. [Tokenização — Do texto ao número](#4-tokenização--do-texto-ao-número)
5. [Embeddings — Do número ao significado](#5-embeddings--do-número-ao-significado)
6. [O Pipeline RAG Clássico](#6-o-pipeline-rag-clássico)
7. [Tipos de RAG — As Três Gerações](#7-tipos-de-rag--as-três-gerações)
8. [Técnicas de Retrieval](#8-técnicas-de-retrieval)
9. [Técnicas de Geração e Pós-Processamento](#9-técnicas-de-geração-e-pós-processamento)
10. [As Melhores Técnicas Atuais](#10-as-melhores-técnicas-atuais)
11. [Interação RAG com o LLM — O que acontece por dentro](#11-interação-rag-com-o-llm--o-que-acontece-por-dentro)
12. [Quando Usar RAG](#12-quando-usar-rag)
13. [Quando NÃO Usar RAG](#13-quando-não-usar-rag)
14. [RAG vs Fine-tuning vs Prompt Engineering](#14-rag-vs-fine-tuning-vs-prompt-engineering)
15. [Métricas de Avaliação](#15-métricas-de-avaliação)
16. [Padrão Map-Reduce — Analisar Tudo com Baixo Custo](#16-padrão-map-reduce--analisar-tudo-com-baixo-custo)
17. [O Futuro do RAG](#17-o-futuro-do-rag)

---

## 1. O que é RAG

RAG significa **Retrieval-Augmented Generation** — Geração Aumentada por Recuperação.

É uma arquitetura de sistema de IA que combina dois componentes:
- Um **sistema de recuperação** (busca documentos relevantes em uma base de conhecimento)
- Um **modelo de linguagem** (usa os documentos recuperados para gerar uma resposta)

A ideia central é simples: em vez de esperar que o LLM "saiba" tudo de memória, você dá a ele documentos relevantes no momento da pergunta.

```
Pergunta do usuário
        │
        ▼
┌───────────────────┐
│   RETRIEVER       │ ← busca os documentos mais relevantes
│  (busca vetorial) │
└───────────────────┘
        │
        ▼ documentos relevantes
┌───────────────────┐
│      LLM          │ ← usa os documentos para gerar a resposta
│   (gerador)       │
└───────────────────┘
        │
        ▼
   Resposta gerada
```

**Analogia:** Imagine que você vai fazer uma prova de história. Sem RAG, você tenta lembrar de cabeça tudo o que estudou. Com RAG, você tem permissão de consultar resumos específicos durante a prova. O LLM continua sendo você — RAG é o conjunto de resumos que você pode consultar.

---

## 2. Por que RAG existe — Limitações dos LLMs

LLMs são extraordinários, mas têm limitações estruturais que RAG resolve diretamente.

### Problema 1: Knowledge Cutoff (Conhecimento desatualizado)

LLMs são treinados com dados até uma data específica. Um modelo treinado em 2024 não sabe nada de 2025. Com RAG, você pode indexar documentos novos e o LLM os usa imediatamente — sem retreinar nada.

### Problema 2: Alucinação (Informação inventada)

LLMs geram texto estatisticamente plausível. Quando não sabem algo, tendem a inventar de forma convincente. Com RAG, o modelo tem acesso a documentos reais e pode citar fontes verificáveis — o que reduz (não elimina) alucinações.

### Problema 3: Conhecimento privado/proprietário

LLMs públicos não foram treinados com os documentos internos da sua empresa. RAG permite que você indexe manuais internos, contratos, e-mails, relatórios — e o LLM passa a "conhecer" esse conteúdo sem que nenhuma informação sensível saia da sua infraestrutura.

### Problema 4: Tamanho do contexto (Context Window)

Mesmo LLMs com janela de contexto grande (100k+ tokens) não conseguem "memorizar" uma base de documentos inteira de 10.000 PDFs. RAG seleciona os trechos mais relevantes para cada pergunta, colocando no contexto apenas o que importa.

### Problema 5: Custo e latência

Enviar documentos completos a cada chamada de LLM é caro e lento. RAG recupera apenas os fragmentos necessários, reduzindo o tamanho do prompt e o custo.

---

## 3. Como um LLM funciona — Fundamentos

Para entender RAG profundamente, é necessário entender o que acontece dentro de um LLM.

### 3.1 Dois tipos de memória

Um LLM tem dois tipos de "memória":

**Memória Paramétrica** — o que está "nos pesos" do modelo. Tudo que o modelo aprendeu durante o treinamento está codificado nos bilhões de parâmetros. É como a memória de longo prazo do modelo — permanente, mas não atualizável sem retreinamento.

**Memória Contextual** — o que está no prompt atual (o "contexto"). O modelo processa o texto que você enviou nesta chamada. Temporária, esquecida após a chamada.

RAG funciona adicionando conhecimento à **memória contextual** — sem alterar a memória paramétrica.

### 3.2 Como o LLM gera texto

LLMs são modelos autorregressivos: geram um token de cada vez, condicionado em todos os tokens anteriores.

```
Prompt: "A capital do Brasil é"
    │
    ▼
Token 1 gerado: "Brasília"  ← probabilidade mais alta
Token 2 gerado: "."
Token 3 gerado: [FIM]
```

Em cada passo, o modelo calcula uma distribuição de probabilidade sobre todo o vocabulário (50.000+ tokens) e escolhe o próximo token. Essa escolha pode ser determinística (argmax) ou estocástica (sampling com temperatura).

### 3.3 Atenção (Attention)

O mecanismo de atenção é o coração do Transformer. Ele permite que o modelo, ao gerar cada token, "preste atenção" a todos os tokens anteriores de forma ponderada — alguns influenciam mais, outros menos.

Em RAG, isso é fundamental: o modelo presta atenção tanto na pergunta original quanto nos documentos recuperados ao gerar cada token da resposta. É por isso que documentos relevantes melhoram a qualidade — eles aumentam a atenção sobre fatos corretos.

---

## 4. Tokenização — Do texto ao número

LLMs não processam texto diretamente. Processam números. A tokenização é o processo de converter texto em sequências de inteiros.

### 4.1 O que é um token

Um token não é necessariamente uma palavra. É um fragmento de texto definido pelo vocabulário do modelo.

```
Texto:  "Retrieval-Augmented Generation"
Tokens: ["Retrieval", "-", "Aug", "mented", " Generation"]
IDs:    [   17891,    12,   2325,   1703,      27592    ]
```

Na prática:
- Palavras comuns em inglês: geralmente 1 token
- Palavras longas ou raras: 2–4 tokens
- Palavras em outros idiomas: frequentemente mais tokens
- Código: variável, geralmente mais tokens que texto natural

### 4.2 Por que tokenização importa para RAG

**Chunking depende de tokens, não palavras.** Quando você divide um documento em chunks para indexar, o limite relevante é o número de tokens, não o número de palavras. Um chunk de "256 tokens" pode ter ~150–200 palavras.

**Custo é medido em tokens.** APIs de LLM cobram por token de entrada (prompt) + token de saída (resposta). Documentos recuperados aumentam os tokens de entrada. Tamanho do chunk × número de chunks = custo direto.

**Context window tem limite de tokens.** GPT-4 tem 128k tokens de contexto. Llama-3.1 tem 128k. Gemini 1.5 Pro tem 1M. O número de documentos que cabem no contexto é limitado por esse número.

### 4.3 Tokenizadores principais

| Modelo | Tokenizador | Vocabulário |
|---|---|---|
| GPT-4, GPT-3.5 | tiktoken (cl100k_base) | ~100k tokens |
| Llama 2/3 | SentencePiece | ~32k–128k tokens |
| Gemini | SentencePiece customizado | ~256k tokens |
| BERT / E5 / text-embedding-004 | WordPiece | ~30k–32k tokens |

### 4.4 Chunking estratégico

A forma como você divide documentos em chunks é uma das decisões mais impactantes em RAG.

**Por tamanho fixo (naive):**
```
[chunk 1: tokens 0–256] [chunk 2: tokens 257–512] ...
```
Problema: corta frases no meio, perde contexto entre chunks.

**Com overlap:**
```
[chunk 1: tokens 0–256]
[chunk 2: tokens 200–456]  ← overlap de 56 tokens
[chunk 3: tokens 400–656]
```
Reduz perda de contexto na fronteira entre chunks.

**Semântico (recomendado):**
Divide por unidades naturais de significado: parágrafos, seções, sentenças. Mais complexo, mas chunks são semanticamente coerentes.

**Hierárquico:**
Mantém múltiplos níveis: documento → seção → parágrafo → sentença. Permite recuperação em diferentes granularidades.

---

## 5. Embeddings — Do número ao significado

Após tokenização, os tokens são convertidos em embeddings — vetores de números que capturam significado semântico.

### 5.1 O que é um embedding

Um embedding é um vetor de números reais de alta dimensão (tipicamente 768 a 3072 dimensões) que representa o significado de um texto.

```
"O gato subiu no telhado" → [0.23, -0.87, 0.41, 0.09, ..., -0.33]  (768 dimensões)
"O felino escalou a cobertura" → [0.24, -0.85, 0.43, 0.08, ..., -0.31]  (muito próximo!)
"A taxa de juros subiu" → [0.71, 0.12, -0.56, 0.88, ..., 0.45]  (muito diferente)
```

Textos semanticamente similares produzem vetores próximos no espaço. Textos semanticamente diferentes produzem vetores distantes.

### 5.2 Modelos de embedding

| Modelo | Dimensões | Contexto | Destaque |
|---|---|---|---|
| text-embedding-004 (Google) | 768 | 2048 tokens | Usado neste projeto |
| text-embedding-3-large (OpenAI) | 3072 | 8191 tokens | Alta precisão |
| E5-large-v2 | 1024 | 512 tokens | Open-source, eficiente |
| BGE-M3 | 1024 | 8192 tokens | Multilingual, open-source |
| Nomic Embed | 768 | 8192 tokens | Open-source, janela grande |

### 5.3 Similaridade vetorial

Para encontrar documentos relevantes a uma query, calculamos a distância entre o embedding da query e os embeddings dos chunks indexados.

**Cosine Similarity** (mais comum em RAG):
```
similarity = (A · B) / (||A|| × ||B||)
```
Valor entre -1 e 1. Quanto mais próximo de 1, mais similar semanticamente.

**Produto interno (dot product):** similar ao cosine quando vetores são normalizados.

**Distância Euclidiana (L2):** mede distância geométrica. Menos usada em RAG por ser sensível à magnitude dos vetores.

### 5.4 Bancos de Dados Vetoriais

Os embeddings precisam ser armazenados e consultados eficientemente. Bancos de dados vetoriais são otimizados para isso.

```
Indexação (offline):
  Documento → Chunking → Embedding → Armazenar no banco vetorial

Consulta (online):
  Query → Embedding → Busca por similaridade → Top-k chunks
```

**pgvector** (usado neste projeto): extensão do PostgreSQL. Suporta HNSW e IVFFlat. Ideal para projetos que já usam Postgres — sem infraestrutura extra.

**Milvus/Zilliz:** banco vetorial dedicado de alta escala.

**Chroma:** banco vetorial em-memória, ideal para prototipagem.

**Qdrant:** banco vetorial de alta performance, open-source.

**Pinecone:** serviço gerenciado, sem infraestrutura para gerenciar.

### 5.5 HNSW — Como a busca vetorial funciona na prática

Busca exata em bilhões de vetores é impraticável. O algoritmo HNSW (Hierarchical Navigable Small World) é o mais usado para busca aproximada eficiente.

```
Camada 2 (esparsa):    1 ─────── 5
Camada 1 (média):      1 ── 3 ── 5 ── 8
Camada 0 (densa):      1─2─3─4─5─6─7─8─9─10
```

A busca começa na camada mais esparsa (poucos nós, conexões longas), navega para a região aproximada da query e desce para camadas mais densas para refinar. É como buscar em um mapa: primeiro o continente, depois o país, depois a cidade, depois a rua.

Resultado: busca em ~10ms em bilhões de vetores com ~95–99% de recall.

---

## 6. O Pipeline RAG Clássico

O pipeline completo de um sistema RAG tem duas fases: **Indexação** (offline) e **Consulta** (online).

### 6.1 Fase de Indexação (Ingestão)

```
Documentos brutos (PDFs, HTML, DOCX, etc.)
         │
         ▼
   [1. Parsing / Extração de texto]
         │
         ▼
   [2. Chunking]
     Divide em chunks de N tokens com overlap M
         │
         ▼
   [3. Geração de Embeddings]
     Cada chunk → vetor de D dimensões
         │
         ▼
   [4. Armazenamento]
     Vetores + metadados + texto original → banco vetorial
```

**O que vai para o banco vetorial por chunk:**
- O vetor (embedding) — para busca por similaridade
- O texto original do chunk — para enviar ao LLM
- Metadados — fonte, página, data, autor, etc.

### 6.2 Fase de Consulta (Query Time)

```
Pergunta do usuário: "Quais são os principais desafios de RAG multi-hop?"
         │
         ▼
   [1. Embedding da query]
     Query → vetor de D dimensões (mesmo modelo de embedding)
         │
         ▼
   [2. Busca por similaridade]
     Encontra os k chunks mais próximos do vetor da query
         │
         ▼
   [3. Construção do prompt]
     [System prompt]
     [Contexto: chunk 1 + chunk 2 + ... + chunk k]
     [Pergunta do usuário]
         │
         ▼
   [4. Geração LLM]
     LLM processa o prompt e gera a resposta
         │
         ▼
   Resposta final
```

### 6.3 O Prompt RAG

O prompt enviado ao LLM tem estrutura definida:

```
System: Você é um assistente especializado. Responda apenas com base
        nos documentos fornecidos. Se a informação não estiver nos
        documentos, diga que não sabe.

Contexto:
[Documento 1]
Fonte: artigo_rag_survey.pdf, página 3
"Em sistemas RAG avançados, a recuperação iterativa permite..."

[Documento 2]
Fonte: fair_rag.pdf, página 7
"O módulo SEA identifica lacunas de evidência explicitamente..."

[Documento 3]
Fonte: multi_hop_rag.pdf, página 2
"Queries multi-hop requerem raciocínio sobre múltiplos documentos..."

Pergunta: Quais são os principais desafios de RAG multi-hop?
```

---

## 7. Tipos de RAG — As Três Gerações

A literatura define três gerações de sistemas RAG com complexidade crescente.

### 7.1 Naive RAG (RAG Ingênuo)

O pipeline original e mais simples.

```
Query → Embedding → Top-K busca vetorial → Prompt → LLM → Resposta
```

**Características:**
- Uma única rodada de busca
- Sem modificação da query
- Sem reranking
- Sem verificação da resposta

**Quando funciona bem:** FAQs simples, documentos homogêneos, perguntas factuais diretas, prototipagem.

**Limitações:**
- Falha em perguntas que requerem múltiplos documentos
- Chunks redundantes degradam a resposta
- Sem adaptação à dificuldade da query
- Alucinações não são detectadas

---

### 7.2 Advanced RAG (RAG Avançado)

Adiciona etapas de pré e pós-processamento ao pipeline básico.

```
                 ┌─── Pre-retrieval ───┐
Query original   │  Query rewriting    │   Query otimizada
      │          │  Query expansion    │         │
      │          │  HyDE               │         │
      └──────────┴─────────────────────┴─────────┘
                                                  │
                                                  ▼
                               ┌─── Retrieval ───┐
                               │  Busca híbrida  │
                               │  (dense+sparse) │
                               └────────┬────────┘
                                        │ Top-K docs (grande)
                                        ▼
                              ┌─── Post-retrieval ──┐
                              │  Reranking          │
                              │  Filtragem          │
                              │  Compressão         │
                              └──────────┬──────────┘
                                         │ Top-K docs (refinado)
                                         ▼
                                   Prompt → LLM
```

**Técnicas de Pre-retrieval:**

*Query Rewriting:* Usa um LLM para reformular a query antes de buscar.
```
Original: "Como resolver erro 500?"
Reescrita: "Quais são as causas mais comuns de HTTP 500 Internal Server Error
            e como diagnosticá-las em aplicações web?"
```

*Query Expansion:* Gera múltiplas variações da query e busca com todas.

*HyDE (Hypothetical Document Embeddings):* Gera um documento hipotético que responderia a query, e usa o embedding desse documento para buscar — funciona porque documentos são mais similares entre si do que uma query curta é similar a um documento longo.

*Step-Back Prompting:* Abstrai a query para um nível mais geral antes de buscar.

**Técnicas de Post-retrieval:**

*Reranking:* Um modelo cross-encoder (mais preciso que bi-encoder) reordena os chunks recuperados.
```
Top-20 chunks → Cross-encoder avalia cada par (query, chunk) → Top-5 mais relevantes
```

*Filtragem por metadados:* Remove chunks de fontes irrelevantes, muito antigos, ou com score abaixo de threshold.

*Compressão de contexto:* Remove sentenças irrelevantes de chunks longos antes de enviar ao LLM.

---

### 7.3 Modular RAG (RAG Modular)

Componentes intercambiáveis com fluxo não-linear. Permite múltiplas rodadas de busca, roteamento por tipo de query e integração de ferramentas externas.

```
             ┌──────────────────────────┐
             │      ORCHESTRATOR        │
             │  (decide o próximo passo) │
             └──────────┬───────────────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
    [Retriever]   [Calculator]  [Code Runner]
          │             │             │
          └─────────────┼─────────────┘
                        │
                        ▼
                  [Reranker]
                        │
                        ▼
                    [LLM Generator]
                        │
                        ▼
                  [Fact Checker]
                        │
                   Resposta final
```

**Módulos comuns:**
- Router: classifica a query e direciona ao pipeline correto
- Retriever: busca vetorial, BM25, busca em grafo, busca web
- Reranker: reordena por relevância
- Generator: LLM que produz a resposta
- Critic: avalia a qualidade da resposta gerada
- Memory: contexto de conversas anteriores

---

### 7.4 Agentic RAG (RAG Agêntico) — Geração Atual

O LLM toma decisões autônomas sobre quando, o que e como buscar. É um loop iterativo onde o modelo planeja, busca, avalia e refina.

```
          Pergunta
              │
              ▼
        ┌─────────────┐
        │   AGENTE    │ ← "Preciso de mais informação?"
        │    LLM      │ ← "O que exatamente preciso buscar?"
        └──────┬──────┘
               │ se precisar buscar
               ▼
        [RETRIEVER]
               │
               ▼ documentos
        ┌──────────────┐
        │   AVALIADOR  │ ← "Isso responde minha pergunta?"
        │              │ ← "Tenho lacunas de informação?"
        └──────┬───────┘
               │
          ┌────┴────┐
          │         │
       Não          Sim
          │         │
          ▼         ▼
    Refina query  Gera resposta
    e busca de
    novo
```

**Propriedades:**
- Número de iterações determinado pelo problema, não por configuração fixa
- O agente gera sub-queries específicas para lacunas identificadas
- Pode combinar múltiplas fontes de informação
- Pode usar ferramentas além da busca vetorial (calculadora, código, API)

---

## 8. Técnicas de Retrieval

### 8.1 Busca Densa (Dense Retrieval)

Usa embeddings de texto. É o tipo padrão em RAG.

```
Query embedding × Chunk embeddings → Cosine similarity → Top-K
```

**Vantagem:** Captura similaridade semântica. "automóvel" encontra chunks com "carro", "veículo", "transporte".  
**Desvantagem:** Pode perder correspondências exatas de termos técnicos, siglas ou nomes próprios.

---

### 8.2 Busca Esparsa — BM25

Algoritmo clássico de recuperação de informação baseado em frequência de termos. Retorna documentos com alta ocorrência dos termos da query.

```
BM25(query, doc) = Σ IDF(t) × (tf(t,d) × (k₁+1)) / (tf(t,d) + k₁ × (1 - b + b × |d|/avgdl))
```

**Vantagem:** Excelente para termos técnicos, siglas, nomes próprios, código.  
**Desvantagem:** Sem compreensão semântica. "carro" não encontra "automóvel".

---

### 8.3 Busca Híbrida (Hybrid Search)

Combina busca densa + BM25. Os scores são fundidos (tipicamente por Reciprocal Rank Fusion — RRF).

```
Score_final = α × Score_denso + (1-α) × Score_BM25
```

ou

```
RRF(d) = Σ 1/(k + rank_i(d))   para cada sistema de ranqueamento i
```

Segundo Blended RAG (IBM, 2024), busca híbrida supera qualquer índice individual e em alguns casos supera fine-tuning específico.

---

### 8.4 Busca Esparsa Aprendida (SPLADE / ELSER)

Gera representações esparsas *aprendidas* — diferente do BM25 que é baseado em frequência, o SPLADE aprende quais termos são relevantes para expansão de query.

```
"automóvel"  →  {carro: 0.8, veículo: 0.6, transporte: 0.3, motor: 0.4, ...}
```

Combina vantagens da busca densa (compreensão semântica) com vantagens da busca esparsa (eficiência, interpretabilidade).

---

### 8.5 Busca em Grafo (Graph Retrieval) e GraphRAG

RAG vetorial trata documentos como unidades isoladas — encontra os mais similares à query, mas não sabe que eles se relacionam. Grafos capturam essas relações explicitamente.

#### Por que grafos importam

Considere a pergunta: *"Quais frameworks de avaliação foram usados nos artigos que propõem técnicas agênticas de RAG?"*

Com RAG vetorial:
```
Query → busca por "avaliação frameworks agêntico RAG"
  → retorna chunks sobre Ragas, RAG-Gym, Auto-RAG separadamente
  → LLM tenta inferir as conexões
  → pode errar ou perder relações
```

Com GraphRAG:
```
Query → identifica entidades: [frameworks de avaliação] [técnicas agênticas] [RAG]
  → traversal no grafo:
      Auto-RAG  ──usa──► 6 benchmarks
      RAG-Gym   ──usa──► HotpotQA, MuSiQue, 2WikiMultiHopQA
      FAIR-RAG  ──usa──► Ragas framework
  → resposta com relações explícitas já mapeadas
```

A informação não está só nos documentos — está nas **conexões** entre eles.

#### Tipos de estrutura em grafo para RAG

**Knowledge Graph (KG) simples:**
```
[entidade] ──[relação]──► [entidade]

FAIR-RAG ──propõe──► SEA module
SEA module ──resolve──► multi-hop QA
multi-hop QA ──benchmarkado por──► HotpotQA
HotpotQA ──criado por──► HKUST
```
Nós = entidades. Arestas = relações tipadas. Ideal para domínios com ontologia bem definida (medicina, direito, telecomunicações).

**Property Graph:**
```
[entidade + propriedades] ──[relação + propriedades]──► [entidade]

(FAIR-RAG, {ano: 2025, instituição: Sharif, f1_hotpotqa: 0.453})
    ──supera {margem: 8.3pts}──►
(Iter-Retgen, {f1_hotpotqa: 0.370})
```
Nós e arestas têm atributos. Permite filtros e buscas mais ricas. Usado em TigerVector e Neo4j.

**Hypergraph:**
```
hyperedge conecta N entidades simultaneamente:

{FAIR-RAG, SEA module, gap analysis, multi-hop QA}
    ──"técnica que resolve"──► {HotpotQA, 2WikiMultiHopQA, MuSiQue}
```
Uma aresta normal conecta 2 nós. Uma hiperaresta conecta N nós. Captura relações de ordem superior — eventos, processos, interações entre múltiplas entidades. Usado em IGMiRAG (2026) com ganhos de +4,8% EM.

**Grafo hierárquico:**
```
Nível 3 (conceito):    RAG
                        │
Nível 2 (técnica):  Agentic RAG ── Iterative RAG
                        │
Nível 1 (paper):   RAG-Gym ── Auto-RAG ── FAIR-RAG
                        │
Nível 0 (chunk):   [chunk 1] [chunk 2] [chunk 3]
```
Organiza conhecimento em múltiplas granularidades. Recuperação começa no nível alto e desce conforme necessário. Usado em T-RAG (RAG sobre tabelas) e IGMiRAG.

#### Como funciona o GraphRAG na prática

**Fase de construção do grafo (offline):**
```
Documentos
    │
    ▼
[Extração de entidades e relações]   ← LLM ou NLP
    │
    ├── Entidades: FAIR-RAG, SEA, HotpotQA, Sharif University...
    └── Relações: propõe, usa, supera, criado-por, mede...
    │
    ▼
[Deduplicação e normalização]        ← RoleRAG usa algoritmo específico
    │  "FAIR RAG" = "FAIR-RAG" = "Faithful Adaptive Iterative..."
    ▼
[Grafo de conhecimento]              ← Neo4j, TigerGraph, NetworkX
```

**Fase de consulta (online):**
```
Query: "Como FAIR-RAG resolve multi-hop?"
    │
    ▼
[Entity linking]  → identifica: FAIR-RAG, multi-hop
    │
    ▼
[Graph traversal]
    FAIR-RAG
      ├──propõe──► SEA module
      │               └──resolve──► gap analysis
      │                               └──melhora──► multi-hop QA
      └──avaliado em──► HotpotQA (+8,3 pts), 2WikiMultiHopQA (+6,9 pts)
    │
    ▼
[Subgrafo relevante → chunks associados → LLM]
```

#### Algoritmos de traversal

| Algoritmo | Como funciona | Quando usar |
| --- | --- | --- |
| BFS/DFS | Percorre nós vizinhos em camadas | Grafos pequenos, relações simples |
| Personalized PageRank | Propaga relevância a partir de nós-âncora | Grafos grandes, ranking por importância |
| Beam Search | Mantém os K melhores caminhos a cada passo | Multi-hop com controle de custo |
| A* | Busca com heurística de custo mínimo | Quando há custo definido por aresta |
| WaterCircle | Propagação radial com decaimento | Memória pessoal com contexto temporal |

PersonalAI (Skoltech, 2025) avalia sistematicamente 6 desses algoritmos — diferentes algoritmos são ótimos para diferentes tipos de tarefa.

#### GraphRAG vs RAG vetorial — quando cada um

| Situação | RAG Vetorial | GraphRAG |
| --- | --- | --- |
| Busca de fato isolado | Ideal | Overhead desnecessário |
| Relação entre entidades | Ruim | Ideal |
| Raciocínio multi-hop | Limitado | Nativo |
| Domínio sem ontologia clara | Funciona | Difícil de construir |
| Ontologia bem definida (medicina, jurídico) | Suficiente | Muito melhor |
| Base pequena (<1.000 docs) | Simples | Pode ser overkill |
| Base grande com entidades repetidas | Redundância | Deduplicação nativa |

#### Implementações de referência dos papers analisados

**BYOKG-RAG (Amazon, 2025):** 4 estratégias de recuperação em grafo combinadas — por entidade, caminho, tripla e consulta OpenCypher. +4,5 pts sobre segundo melhor em 5 benchmarks. Funciona com grafos arbitrários ("traga seu próprio KG").

**IGMiRAG (Xi'an Jiaotong, 2026):** Hypergraph hierárquico heterogêneo com bidirectional diffusion. Recuperação top-down (detalhes) + bottom-up (abstração). +4,8% EM e +5,0% F1 em 6 benchmarks. Custo adaptativo (mínimo 3k tokens).

**RoleRAG (NTU/Alibaba, 2025):** GraphRAG para roleplay com LLMs. Diferencial: módulo de fronteiras cognitivas que sabe o que o personagem não sabe e recusa responder a perguntas fora do escopo.

**TigerVector (TigerGraph, 2024):** Busca vetorial nativa em banco de dados em grafo MPP. Permite similarity join e busca em padrões de grafo via GSQL declarativo. Em produção desde dez/2024.

**Beyond Nearest Neighbors (CMU/Stanford, 2025):** Formaliza graph-augmented retrieval com Personalized PageRank sobre kNN graph. Submodular optimization para maximizar cobertura semântica. Fundação teórica para sistemas de busca centrados em significado.

#### Quando a combinação vetorial + grafo é superior a ambos

A maioria dos sistemas de produção de ponta usa os dois juntos:

```
Query
  │
  ├──► Busca vetorial (similaridade semântica)
  │         └── Top-K chunks candidatos
  │
  ├──► Graph traversal (relações estruturais)
  │         └── Subgrafo relevante + chunks associados
  │
  └──► Fusão dos resultados
            └── LLM recebe chunks de ambas as fontes
```

Busca vetorial encontra o que é *semanticamente similar*. Grafo encontra o que é *estruturalmente relacionado*. São complementares — o que um perde, o outro pega.

---

### 8.6 Busca Multi-hop

Para perguntas que requerem combinar informação de múltiplos documentos:

```
Pergunta: "Quem fundou a empresa que criou o modelo que venceu o GPT-4 no benchmark X?"

Passo 1: Busca "benchmark X" → encontra "modelo Y venceu GPT-4"
Passo 2: Busca "modelo Y" → encontra "criado pela empresa Z"
Passo 3: Busca "empresa Z" → encontra "fundada por pessoa W"
Resposta: "W"
```

Requer iteração — cada busca usa o resultado da anterior como nova query.

---

### 8.7 Reranking

O reranker é um modelo que recebe pares (query, chunk) e produz um score de relevância mais preciso que a similaridade vetorial. Usa um cross-encoder (mais lento, mais preciso) em vez de bi-encoder.

```
Bi-encoder (retrieval):  encode(query) × encode(doc)  → rápido, paralelo
Cross-encoder (rerank):  encode(query + doc)           → lento, preciso
```

Fluxo típico:
```
Query → busca vetorial → Top-50 chunks → reranker → Top-5 melhores
```

Modelos populares: `cross-encoder/ms-marco-MiniLM-L-6-v2`, Cohere Rerank, `bge-reranker-large`

---

## 9. Técnicas de Geração e Pós-Processamento

### 9.1 Construção do Prompt

A qualidade do prompt tem impacto direto na qualidade da resposta.

**Componentes de um prompt RAG bem construído:**

```
1. Instrução de sistema (quem o LLM é, o que deve fazer)
2. Instrução de faithfulness (responder apenas com base nos documentos)
3. Instrução de abstension (dizer que não sabe quando não encontrar)
4. Contexto formatado (chunks com identificação de fonte)
5. Pergunta do usuário
```

**Exemplo:**
```
Sistema: Você é um especialista em RAG. Use APENAS as informações dos
         documentos abaixo. Se a informação não estiver presente, responda
         "Não encontrei essa informação nos documentos disponíveis."
         Ao final, cite as fontes usadas.

---DOCUMENTO 1 (fair_rag.pdf, pág. 3)---
O módulo SEA decompõe a query em um checklist...
---DOCUMENTO 2 (rag_gym.pdf, pág. 7)---
DPO com supervisão de processo supera PPO em generalização...
---FIM DOS DOCUMENTOS---

Pergunta: Como melhorar RAG para perguntas complexas?
```

### 9.2 Modos de Fusion

**RAG-Sequence:** O mesmo documento é usado para toda a geração. Mais simples.

**RAG-Token:** Documentos diferentes podem influenciar tokens diferentes da resposta. Mais flexível, mais complexo. Requer marginalização sobre documentos.

### 9.3 Verificação de Fatos (Fact-Checking)

Após a geração, um módulo verifica se cada afirmação da resposta é suportada pelos documentos recuperados.

```
Resposta gerada → Extração de claims → Verificação por chunk → Flagging de não-suportados
```

### 9.4 Citação de Fontes

O sistema identifica qual chunk suportou cada parte da resposta e adiciona citações inline.

```
Resposta: "O módulo SEA identifica lacunas de evidência [1] e o DPO com
           supervisão de processo melhora a generalização [2]."
Fontes: [1] fair_rag.pdf, pág. 3  [2] rag_gym.pdf, pág. 7
```

### 9.5 Self-RAG (Auto-avaliação)

O LLM gera tokens especiais de reflexão durante a geração:
- `[Retrieve]`: decide se precisa buscar mais informação
- `[Relevant]`: avalia se o documento recuperado é relevante
- `[Supported]`: avalia se a resposta gerada é suportada pelo documento
- `[Useful]`: avalia se a resposta é útil para o usuário

---

## 10. As Melhores Técnicas Atuais

Baseado nos 42 papers analisados, estas são as técnicas com maior evidência empírica de eficácia.

### Tier 1 — Alto impacto, implementação acessível

**1. Busca Híbrida (Blended RAG)**
- O que fazer: adicionar BM25 ao pipeline de busca vetorial densa
- Ganho típico: 3–10% de melhoria em recall
- Custo de implementação: baixo — a maioria dos bancos vetoriais suporta
- Por que funciona: cobre a lacuna semântica (dense) + exata (BM25)

**2. Reranking cross-encoder**
- O que fazer: após top-50 da busca vetorial, reranquear com cross-encoder
- Ganho típico: 5–15% de melhoria em precision
- Custo de implementação: médio — requer modelo adicional, latência extra
- Por que funciona: cross-encoder vê query e documento juntos, mais preciso

**3. Metadata nos embeddings**
- O que fazer: incluir título, autor, data, fonte no texto antes de embeddar
- Ganho: melhora coesão intra-documento e filtragem
- Custo de implementação: baixo — mudança no pipeline de ingestão
- Por que funciona: embedding com metadata é mais discriminativo para corpora estruturados

**4. Query Rewriting**
- O que fazer: usar um LLM menor para reformular a query antes de buscar
- Ganho típico: 5–12% em datasets de perguntas ambíguas
- Custo de implementação: baixo — uma chamada extra de LLM por query
- Por que funciona: queries dos usuários são frequentemente ambíguas ou incompletas

### Tier 2 — Alto impacto, implementação moderada

**5. Recuperação Iterativa com Gap Analysis (FAIR-RAG)**
- O que fazer: verificar após cada busca se a pergunta foi respondida; se não, identificar o que falta e buscar especificamente isso
- Ganho: +8 pts em HotpotQA, estado da arte em multi-hop
- Custo: médio-alto — requer loop de verificação com LLM
- Por que funciona: o sistema sabe exatamente o que não sabe

**6. Diversidade na Recuperação (Vendi-RAG)**
- O que fazer: maximizar diversidade semântica dos chunks recuperados, não apenas relevância
- Ganho: +4% em QA multi-hop
- Custo: médio — requer cálculo de Vendi Score ou MMR (Maximal Marginal Relevance)
- Por que funciona: chunks redundantes desperdiçam contexto, chunks diversos cobrem mais facetas

**7. MCTS + RAG para raciocínio (RAG-Star)**
- O que fazer: usar busca em árvore para explorar caminhos de raciocínio, com RAG verificando cada passo
- Ganho: +19% em raciocínio complexo
- Custo: alto — requer implementação de MCTS
- Por que funciona: separa exploração (MCTS) de verificação (RAG), elimina conflito paramétrico/externo

### Tier 3 — Fronteira, alto impacto futuro

**8. Compressão de contexto no decoder (REFRAG)**
- O que fazer: comprimir chunks em embeddings antes de enviar ao decoder
- Ganho: 30x de aceleração de inferência
- Custo: alto — requer continual pre-training do modelo
- Por que funciona: atenção entre chunks é block-diagonal — a maioria é desperdício

**9. Agentic RAG com DPO de processo (RAG-Gym)**
- O que fazer: treinar agente com DPO usando supervisão de passos intermediários
- Ganho: +24% em generalização out-of-distribution
- Custo: alto — requer treinamento
- Por que funciona: supervisão de processo ensina *como* raciocinar, não apenas *o que* responder

---

## 11. Interação RAG com o LLM — O que acontece por dentro

### 11.1 O fluxo completo de tokens

Quando o prompt RAG chega ao LLM, isso é o que acontece:

```
Prompt (texto) → Tokenizador → IDs de tokens → Embedding layer → Vetores de entrada
                                                                          │
                                                                          ▼
                                                               N camadas de Transformer
                                                               (cada camada tem atenção
                                                                multi-head + FFN)
                                                                          │
                                                                          ▼
                                                               Logits sobre vocabulário
                                                                          │
                                                                          ▼
                                                               Softmax → Distribuição
                                                                          │
                                                                          ▼
                                                               Sampling → próximo token
```

### 11.2 Como os documentos influenciam a geração

Os documentos recuperados tornam-se parte dos tokens de entrada. O mecanismo de atenção permite que cada token gerado "consulte" todos os tokens anteriores — incluindo os documentos.

Na prática, o que acontece:
- Tokens da resposta prestam alta atenção a tokens dos documentos relevantes
- Tokens dos documentos que contradizem o conhecimento paramétrico criam competição
- A posição do documento no prompt importa — documentos no início e no fim recebem mais atenção que os do meio ("lost in the middle")

### 11.3 O problema "Lost in the Middle"

Estudos demonstram que LLMs prestam mais atenção a informações no início e no fim do contexto. Informações no meio de um contexto longo tendem a ser "esquecidas".

**Implicações para RAG:**
- Não concatene simplesmente chunks em ordem de score
- Coloque os chunks mais relevantes no início e no fim
- Limite o número de chunks para que o contexto não fique excessivamente longo
- CARROT (Alibaba) formaliza isso e usa MCTS para encontrar a ordenação ótima

### 11.4 Temperatura e sampling em RAG

- **Temperatura 0 (greedy):** sempre escolhe o token mais provável. Respostas determinísticas. Recomendado para RAG factual.
- **Temperatura > 0:** introduz aleatoriedade. Útil para geração criativa, mas aumenta risco de alucinação em RAG.

Para sistemas RAG em produção onde precisão factual importa: use temperatura 0 ou próxima de 0.

### 11.5 O KV Cache

LLMs usam KV Cache (Key-Value Cache) para evitar recomputar a atenção de tokens já processados. Em RAG com contextos longos:

- Contextos maiores = KV cache maior = mais memória GPU
- REFRAG resolve isso comprimindo chunks antes de entrar no decoder
- Alguns sistemas pré-computam e cacheiam os KV de documentos estáticos

---

## 12. Quando Usar RAG

### Cenários ideais para RAG

**1. Base de conhecimento proprietária e especializada**
- Manuais internos, contratos, políticas da empresa
- O LLM não foi treinado nesse conteúdo
- Exemplo: chatbot de RH que responde sobre políticas internas

**2. Informação que muda frequentemente**
- Preços, notícias, documentação técnica atualizada
- RAG indexa novos documentos sem retreinar o modelo
- Exemplo: assistente de suporte técnico com documentação versionada

**3. Perguntas que exigem citação de fontes verificáveis**
- Contextos regulatórios, jurídicos, médicos
- RAG permite rastrear de onde veio cada informação
- Exemplo: assistente jurídico que cita artigos de lei específicos

**4. Domínios altamente especializados**
- Telecomunicações (padrões 3GPP), medicina, direito, engenharia
- LLMs gerais têm conhecimento superficial; RAG sobre documentos especializados supre
- Exemplo: Telco-RAG com 90,8% de accuracy em padrões 3GPP

**5. Escalas de documento que não cabem no contexto**
- Bases com 10.000+ documentos, PDFs de centenas de páginas
- Mesmo modelos com 1M de contexto não conseguem carregar tudo
- Exemplo: sistema de P&D que consulta todos os artigos científicos de uma área

**6. Multi-modal com documentos ricos**
- PDFs com tabelas, gráficos, fórmulas
- RAG pode extrair e indexar conteúdo estruturado separadamente
- Exemplo: T-RAG para RAG sobre tabelas de relatórios financeiros

---

## 13. Quando NÃO Usar RAG

### Situações em que RAG não é a solução certa

**1. Conhecimento puramente paramétrico é suficiente**
- Se o LLM já sabe a resposta com alta confiança, RAG adiciona latência e custo sem benefício
- Exemplo: "Qual é a capital da França?" — não precisa de RAG

**2. Tarefas criativas sem base factual**
- Geração de histórias, brainstorming, tradução
- RAG pode restringir a criatividade indesejavelmente
- Exemplo: geração de copy publicitário

**3. Volume muito baixo de documentos**
- 10–20 documentos cabem inteiros no contexto
- Simplesmente concatene e envie — evita complexidade de RAG
- Regra prática: se cabe no contexto, não precisa de RAG

**4. Latência é crítica e não pode ser sacrificada**
- RAG adiciona latência de busca vetorial + reranking
- Para aplicações de tempo real muito sensíveis: avaliar custo-benefício
- Solução: REFRAG (30x de aceleração) ou cache de KV pré-computado

**5. Respostas precisam ser 100% determinísticas**
- RAG com retrieval dinâmico pode retornar resultados ligeiramente diferentes para a mesma query
- Para sistemas regulatórios onde a resposta deve ser sempre idêntica: fine-tuning pode ser mais adequado

**6. Base documental estática e pequena com perguntas padronizadas**
- Fine-tuning em um dataset curado pode superar RAG
- Exemplo: classificador de sentimentos em domínio específico

---

## 14. RAG vs Fine-tuning vs Prompt Engineering

Três formas de especializar um LLM, com trade-offs distintos.

```
                    RAG              Fine-tuning        Prompt Engineering
                     │                    │                    │
Conhecimento     Externo (docs)       Paramétrico           Contextual
Atualização      Imediata             Retreinamento         Imediata
Custo inferência Médio                Baixo (após treino)   Baixo
Custo setup      Médio                Alto                  Baixo
Explicabilidade  Alta (cita fontes)   Baixa                 Média
Escalabilidade   Alta                 Média                 Baixa (contexto)
Privacidade      Alta (dados locais)  Média                 Depende
```

### Quando cada um?

| Situação | Melhor abordagem |
|---|---|
| Documentos proprietários, atualizados frequentemente | RAG |
| Comportamento específico de domínio (estilo, formato, tom) | Fine-tuning |
| Tarefa simples com exemplos fixos | Prompt Engineering (few-shot) |
| Alta precisão factual com fontes verificáveis | RAG |
| Volume alto de inferência com baixo custo | Fine-tuning |
| Protótipo rápido | Prompt Engineering → RAG |
| Perguntas complexas multi-hop | Agentic RAG |
| Domínio especializado com muitos documentos | RAG + Fine-tuning (ambos) |

### A combinação ideal (estado da arte atual)

Para sistemas de produção de alta qualidade:

```
RAG (recuperação) + Fine-tuning (comportamento) + Prompt Engineering (instruções)
```

O RAG busca a informação certa. O fine-tuning ensina como processar essa informação. O prompt engineering instrui o comportamento pontual.

MUST-RAG (KAIST) demonstra isso: RAG sozinho dá 82% de accuracy em QA musical. Fine-tuning sozinho também tem limitações. RAG + fine-tuning: 92%.

---

## 15. Métricas de Avaliação

### 15.1 Métricas de Retrieval

**Recall@K:** Fração de documentos relevantes que aparecem entre os K recuperados.
```
Recall@5 = documentos_relevantes_no_top_5 / total_documentos_relevantes
```

**Precision@K:** Fração dos K recuperados que são realmente relevantes.
```
Precision@5 = documentos_relevantes_no_top_5 / 5
```

**MRR (Mean Reciprocal Rank):** Quão alto está o primeiro documento relevante.
```
MRR = média de (1 / posição_do_primeiro_relevante)
```

**NDCG (Normalized Discounted Cumulative Gain):** Considera posição e grau de relevância.

---

### 15.2 Métricas de Geração

**Exact Match (EM):** A resposta gerada é exatamente igual à resposta de referência. Rígida.

**F1 Token-level:** Sobreposição de tokens entre resposta gerada e referência. Mais flexível que EM.

**ROUGE:** Sobreposição de n-gramas. Usado principalmente em sumarização.

**BLEU:** Originalmente para tradução, mas usado em RAG às vezes.

---

### 15.3 Métricas sem Referência — Ragas Framework

O framework Ragas (2023) define métricas avaliadas por LLM, sem necessidade de anotações humanas:

**Fidelidade (Faithfulness):**
```
Fidelidade = afirmações_suportadas_pelo_contexto / total_afirmações_na_resposta
```
Mede se a resposta é fiel aos documentos recuperados. Alta concordância com humanos (95%).

**Relevância da Resposta (Answer Relevancy):**
```
Relevância = similaridade(query, query_reconstruída_da_resposta)
```
Mede se a resposta endereça a pergunta. Um LLM gera queries hipotéticas a partir da resposta e calcula similaridade com a query original.

**Relevância do Contexto (Context Relevancy):**
```
Relevância = sentenças_relevantes_no_contexto / total_sentenças_no_contexto
```
Mede se o contexto recuperado é focado e não tem ruído excessivo.

---

### 15.4 Pirâmide de Avaliação

```
                ┌─────────────────┐
                │ Avaliação humana │  ← Mais confiável, mais caro
                └────────┬────────┘
                         │
               ┌─────────┴────────────┐
               │  LLM-as-a-judge       │  ← Escalável, custo médio
               │  (Ragas, GPT-4-eval)  │
               └──────────┬───────────┘
                          │
              ┌───────────┴──────────────┐
              │  Métricas automáticas     │  ← Barato, menos confiável
              │  (EM, F1, ROUGE, NDCG)   │
              └──────────────────────────┘
```

Para produção: use métricas automáticas para monitoramento contínuo + LLM-as-a-judge para avaliações periódicas + avaliação humana para decisões de arquitetura.

---

## 16. Padrão Map-Reduce — Analisar Tudo com Baixo Custo

Um dos problemas mais comuns na prática: **"quero que o RAG analise todos os documentos de uma issue/caso/processo, sem perder nenhum, mas sem custo absurdo."**

RAG padrão seleciona por similaridade — por design, ignora documentos pouco similares à query. Long context lê tudo, mas custa muito. A solução é o padrão **Map-Reduce Hierárquico**.

### O problema central

```
Analisar TUDO  →  precisa ler todos os documentos
Baixo custo    →  precisa ler o mínimo possível

Esses dois objetivos se contradizem... na primeira leitura.
```

A solução é separar **quando** você lê cada coisa: resumos baratos na ingestão, conteúdo completo apenas onde é necessário na consulta.

### Fase 1 — Ingestão (feita uma vez, offline)

Para cada documento/anexo, um modelo **pequeno e barato** gera um resumo durante a indexação:

```
Anexo A (PDF 50 páginas)  → modelo barato → "Relatório de bug no módulo X,
                                              causa raiz: timeout em Y,
                                              reproduzível em versão 2.3"

Anexo B (stack_trace.txt) → modelo barato → "NullPointerException linha 47
                                              em UserService.java, chamada
                                              originada em AuthController"

Anexo C (screenshot.png)  → OCR/Vision    → "Tela de erro 500 com mensagem
                                              Connection refused no header"
```

O que vai para o banco vetorial por documento:

```
Nível 1 (documento):  resumo    → 1 chunk por documento  (busca rápida)
Nível 2 (conteúdo):   chunks    → N chunks por documento  (busca detalhada)
Metadados:            {issue_id, doc_id, tipo, data, autor}
```

Custo de ingestão: ~$0,001–0,005 por documento com modelos como Gemini Flash ou GPT-4o-mini.

### Fase 2 — Consulta (duas estratégias combinadas)

#### Estratégia A — RAG rápido (queries específicas)

```
"Qual a causa raiz do bug PROJ-123?"
  → busca vetorial nos chunks
  → retorna os 5 mais relevantes
  → LLM responde

Custo: ~$0,002. Rápido. Pode perder um documento que não foi recuperado.
```

#### Estratégia B — Map-Reduce (análise completa)

```
"Analise a issue PROJ-123 completamente"
         │
         ├─ Busca os RESUMOS de todos os N documentos
         │   (pequenos, baratos — 1 chunk por doc)
         │
         ├─ LLM sintetiza sobre os resumos
         │   → "Os documentos B e C parecem críticos para esta análise"
         │
         └─ Busca detalhada APENAS nos documentos identificados
             → lê chunks completos de B e C
             → gera resposta final
```

O LLM só paga o preço alto nos 1–2 documentos que realmente importam. Os demais são vistos apenas pelo resumo.

### Verificação de cobertura — garantia de que nada foi perdido

Inspirado no FAIR-RAG: após a síntese, o sistema verifica quais fontes foram consultadas e busca as que ficaram de fora antes de responder:

```python
resumos = buscar_resumos(issue_id)           # todos os documentos
resposta = llm.gerar(resumos, query)

nao_citados = [d for d in documentos if d.id not in resposta.fontes_usadas]

if nao_citados:
    relevancia = llm.avaliar(nao_citados, query)
    if relevancia.tem_informacao_nova:
        resposta = llm.refinar(resposta, relevancia.chunks_relevantes)
```

O sistema sabe o que já leu e vai buscar o que ficou de fora antes de finalizar.

### Comparação de custo — issue com 10 documentos

| Abordagem | Tokens por query | Custo aprox. | Cobertura |
| --- | --- | --- | --- |
| Long context (tudo) | ~500k tokens | ~$1,75 | 100% |
| RAG padrão (top-5 chunks) | ~5k tokens | ~$0,002 | 60–80% |
| Map-Reduce hierárquico | ~30k tokens | ~$0,05 | ~95% |

Map-Reduce chega a **95% de cobertura** por **3% do custo** do long context.

### Aplicação prática — documentos com múltiplos anexos

```
Ingestão (uma vez por caso/issue):
  Texto principal + comentários → chunking direto
  PDFs / arquivos de código     → parser + chunking
  Imagens / screenshots         → OCR ou modelo Vision → descrição textual
  Resumo global por documento   → modelo barato (Flash / GPT-4o-mini)
  Custo: ~$0,01–0,05 por conjunto de documentos

Query (por consulta):
  Query específica              → RAG padrão         (~$0,002)
  "Analise tudo"                → Map-Reduce          (~$0,05)
  + verificação de cobertura    →                     (+$0,01)

Total por análise completa com 10 anexos: ~$0,06
vs. long context direto:                  ~$1,75
```

### Quando usar cada estratégia

| Situação | Estratégia |
|---|---|
| Pergunta específica sobre um documento | RAG padrão |
| Análise completa de um conjunto de documentos | Map-Reduce hierárquico |
| Conjunto pequeno (< 5 docs curtos) | Long context direto |
| Documentos com imagens como evidência principal | OCR/Vision + Map-Reduce |
| Análise que não pode perder nenhuma fonte | Map-Reduce + verificação de cobertura |

---

## 17. O Futuro do RAG

### O que está emergindo agora (2025–2026)

**Agentic RAG com RL** substitui pipelines estáticos. O agente aprende quando e como buscar via reinforcement learning. DPO com supervisão de processo é a técnica dominante. O sistema melhora com uso.

**MCTS + RAG** conecta retrieval ao paradigma de test-time compute. Em vez de um único passo de geração, o sistema explora múltiplos caminhos de raciocínio, verificados por RAG. Cada token computado em inferência melhora a qualidade.

**Compressão de contexto** (REFRAG) torna-se infraestrutura padrão. A medida que contextos crescem para suportar mais documentos, a compressão de chunks no decoder se torna economicamente necessária.

**GraphRAG e Hypergraphs** substituem busca vetorial pura para domínios com estrutura relacional forte. A informação não está apenas nos documentos, mas nas relações entre conceitos e entidades.

**RAG multimodal** estende o paradigma para imagens (AR-RAG), vídeo, áudio e dados estruturados (tabelas). O retriever e o gerador operam em múltiplas modalidades simultaneamente.

**RAG quântico** ainda é teórico, mas a busca de Grover oferece aceleração quadrática teórica. Relevante quando computadores quânticos tolerantes a falhas estiverem disponíveis.

### A linha do tempo da maturação

```
2020: RAG inventado (Lewis et al., Facebook AI)
2022: RAG popularizado com ChatGPT e LangChain
2023: Ragas para avaliação; RETA-LLM como toolkit
2024: Advanced RAG; Multi-hop RAG; RAG-Star com MCTS
2025: Agentic RAG com RL; REFRAG (Meta); RAG segurança
2026: GraphRAG enterprise; RAG multimodal; RAG quântico (teórico)
2027+: RAG integrado nativamente em LLMs? Context engineering?
```

### A questão central que permanece aberta — Long Context vs RAG

Modelos como Gemini 1.5 Pro (1M tokens) e Gemini 1.5 Ultra colocam uma pergunta direta na mesa: se você pode colocar tudo no contexto, por que construir RAG?

A resposta exige números, não intuição.

#### Quando long context SUBSTITUI RAG

Para alguns cenários, sim — jogar tudo no contexto é a resposta certa:

- **Poucos documentos, queries únicas:** analisar um contrato de 200 páginas uma vez. Manda tudo, sem infraestrutura.
- **Raciocínio global obrigatório:** resumir *todos* os documentos juntos, identificar contradições entre eles, síntese que exige visão do conjunto. RAG por design só vê partes.
- **Prototipagem rápida:** sem embedding, sem banco vetorial, sem pipeline. Long context é RAG sem engenharia.

#### Por que RAG ainda vence na maioria dos casos

##### 1. Custo — o argumento mais forte

Gemini 1.5 Pro cobra por token processado. Cada query com 1M tokens de contexto custa ~$3,50.

```
Sistema com RAG (10 chunks × 500 tokens = 5.000 tokens):
  Custo por query:   ~$0,002
  1.000 queries/dia: ~$2/dia    → ~$60/mês

Sistema com 1M tokens fixos no contexto:
  Custo por query:   ~$3,50
  1.000 queries/dia: ~$3.500/dia → ~$105.000/mês
```

Fator de diferença: **~1.750x mais caro.** Para qualquer sistema com volume relevante, isso encerra a discussão.

##### 2. Latência — TTFT cresce quadraticamente

A atenção no Transformer é O(n²) em relação ao tamanho do contexto. O Time to First Token com 1M de tokens pode chegar a 30–60 segundos dependendo da infraestrutura.

RAG com REFRAG (Meta, 2025) demonstra **30x de aceleração** sobre contexto completo com zero perda de accuracy — o paper foi criado exatamente porque esse problema é real mesmo dentro do Google.

##### 3. "Lost in the Middle" — atenção se dilui com escala

Mesmo com 1M de contexto, o modelo presta mais atenção ao início e ao fim do prompt. Experimentos de *needle in a haystack* — encontrar uma informação específica enterrada no meio — mostram degradação real de performance conforme a informação se distancia das bordas, e o problema piora à medida que o contexto cresce.

RAG coloca os documentos mais relevantes sempre no começo do contexto — onde a atenção é máxima.

##### 4. Escala — 1M tokens não é infinito

1M tokens ≈ 750.000 palavras ≈ ~2.500 páginas de PDF.

Uma empresa média tem:

- Políticas e manuais internos: centenas de PDFs
- E-mails e documentos históricos: potencialmente milhões
- Base de conhecimento de suporte: dezenas de milhares de artigos
- Artigos científicos de uma área: centenas de milhares

Não cabe. RAG é a única solução que escala para esse volume.

##### 5. Conteúdo que muda — invalidação de cache

Se você mantém 1M tokens de contexto fixo e um documento é atualizado, você precisa reconstruir o contexto inteiro a cada chamada, ou trabalhar com contexto desatualizado.

Com RAG, você re-indexa apenas o documento alterado. O restante da base continua válido instantaneamente.

##### 6. Privacidade e controle

Mandar 1M tokens para a API do Google significa enviar **toda a sua base de conhecimento** em cada chamada. Para dados sensíveis (contratos, dados médicos, propriedade intelectual), isso é inadmissível.

RAG envia apenas os 3–10 chunks relevantes para aquela query específica — minimizando a exposição de dados a serviços externos.

##### 7. Explicabilidade e auditoria

RAG sabe exatamente quais chunks foram usados para gerar cada resposta. Você pode citar fontes, auditar decisões e rastrear erros até o documento de origem.

Com contexto de 1M tokens, quando o modelo alucina ou comete um erro, você não tem como determinar qual parte do contexto o influenciou.

#### Long context e RAG são complementares, não substitutos

| Situação | Long Context | RAG |
|---|---|---|
| < 100 documentos, uso esporádico | Sim | Desnecessário |
| > 1.000 documentos | Não cabe | Sim |
| Volume alto de queries (>100/dia) | Muito caro | Sim |
| Raciocínio global sobre todos os docs | Necessário | Não resolve |
| Raciocínio local sobre partes específicas | Ineficiente | Ideal |
| Dados sensíveis / privados | Risco | Sim |
| Latência < 5 segundos obrigatória | Difícil | Sim |
| Conteúdo atualizado frequentemente | Trabalhoso | Simples |
| Citação de fontes obrigatória | Difícil | Natural |

**A direção que a pesquisa indica:** usar long context para *raciocínio* (MCTS, chain-of-thought interno) e RAG para *acesso a conhecimento externo*. REFRAG mostra que você pode ter os dois — contexto expandido *e* eficiência. O futuro não é escolher um dos dois. É usar cada um no que faz melhor.

RAG não é um patch para contextos pequenos. É uma solução arquitetural para o problema fundamental de como LLMs devem acessar conhecimento externo de forma eficiente, verificável e escalável — e esse problema não desaparece com janelas de contexto maiores.

---

## Referência Rápida

| Componente | O que faz | Tecnologias |
|---|---|---|
| Tokenizador | Texto → IDs numéricos | tiktoken, SentencePiece |
| Embedding model | Texto → vetor semântico | text-embedding-004, E5, BGE |
| Vector store | Armazena e busca vetores | pgvector, Milvus, Qdrant |
| Chunker | Divide documentos em fragmentos | LangChain, LlamaIndex |
| Retriever | Busca chunks relevantes | HNSW, BM25, híbrido |
| Reranker | Reordena por relevância | cross-encoder, Cohere |
| LLM Generator | Gera resposta com contexto | Gemini, GPT-4, Llama |
| Evaluator | Mede qualidade do sistema | Ragas, LLM-as-judge |

---

*Documento baseado em 42 artigos científicos publicados entre 2020 e 2026, incluindo pesquisas de Meta AI, Google, Microsoft, IBM, Amazon, KAIST, Renmin University, Stanford, MIT e outros.*
