# Acervo de Artigos — RAG, LLMs e Bancos de Dados Vetoriais

Repositório com 42 artigos científicos cobrindo o ecossistema completo de Retrieval-Augmented Generation (RAG): desde o artigo fundador (Lewis et al., 2020) até fronteiras emergentes como RAG quântico e RAG para geração de imagens.

---

## Índice por Categoria

1. [Artigos Fundamentais e Surveys](#1-artigos-fundamentais-e-surveys)
2. [Técnicas de Retrieval Avançado](#2-técnicas-de-retrieval-avançado)
3. [RAG Agêntico e Iterativo](#3-rag-agêntico-e-iterativo)
4. [Raciocínio Multi-hop e Perguntas Complexas](#4-raciocínio-multi-hop-e-perguntas-complexas)
5. [Infraestrutura de Busca Vetorial](#5-infraestrutura-de-busca-vetorial)
6. [Eficiência de Inferência](#6-eficiência-de-inferência)
7. [Segurança e Privacidade em RAG](#7-segurança-e-privacidade-em-rag)
8. [Avaliação de Sistemas RAG](#8-avaliação-de-sistemas-rag)
9. [Aplicações de Domínio Específico](#9-aplicações-de-domínio-específico)
10. [Ferramentas, Toolkits e Experiências Práticas](#10-ferramentas-toolkits-e-experiências-práticas)
11. [Fronteiras Emergentes](#11-fronteiras-emergentes)

---

## 1. Artigos Fundamentais e Surveys

### Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks
**Arquivo:** `Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks.pdf`  
**Autores:** Patrick Lewis et al. — Facebook AI Research, UCL, NYU (2020)  
**Novidade:** Alta

**Contribuição:**
O artigo fundador do paradigma RAG. Combina memória paramétrica (modelo seq2seq BART) com memória não-paramétrica (índice vetorial denso da Wikipedia via DPR) de forma diferenciável end-to-end. Propõe duas formulações: RAG-Sequence (mesmo documento para toda a sequência) e RAG-Token (documentos diferentes por token gerado), com marginalização sobre documentos latentes durante o treinamento.

**Resultados:**
- Estado da arte em três tarefas de QA de domínio aberto em 2020
- NaturalQuestions: 44,5% (RAG-Seq) vs. 41,5% (DPR)
- Geração Jeopardy: considerado mais factual em 42,7% dos casos vs. 7,1% do BART base
- Supera modelos puramente paramétricos e arquiteturas de recuperação extrativa

**Por que ler:** É o ponto de partida de toda a literatura RAG. Entender a formulação original — especialmente a marginalização sobre documentos latentes — é essencial para compreender as evoluções subsequentes.

---

### Retrieval-Augmented Generation for Large Language Models: A Survey
**Arquivo:** `Retrieval-Augmented Generation for Large Language Models_ A Survey.pdf`  
**Autores:** Tongji University / Fudan University (2024)  
**Novidade:** Alta

**Contribuição:**
O survey de referência da área. Mapeia a evolução do RAG em três paradigmas: *Naive RAG* (indexar → recuperar → gerar), *Advanced RAG* (query optimization, reranking, pós-processamento) e *Modular RAG* (componentes intercambiáveis, fluxo não-linear). Cobre mais de 100 papers e introduz framework de avaliação com 26 tarefas e ~50 datasets.

**Resultados:**
- Technology tree visual do campo
- Mapeamento exaustivo dos componentes de Retrieval, Generation e Augmentation
- Análise de benchmarks existentes e direções futuras

**Por que ler:** A tripartição Naive/Advanced/Modular RAG se tornou a linguagem padrão da comunidade. É o mapa de orientação essencial para qualquer pesquisador ou praticante da área.

---

### Retrieval Augmented Generation (RAG) and Beyond: A Comprehensive Survey on How to Make Your LLMs Use External Data More Efficiently
**Arquivo:** `Retrieval Augmented Generation (RAG) and Beyond_ A Comprehensive Survey on How to Make your LLMs use External Data More .pdf`  
**Autores:** Microsoft Research Asia (2024)  
**Novidade:** Alta

**Contribuição:**
Propõe uma taxonomia de 4 níveis para classificar queries em sistemas RAG com dados externos: *Level-1 Explicit Facts* (fatos diretos), *Level-2 Implicit Facts* (raciocínio simples), *Level-3 Interpretable Rationales* (aplicação de regras de domínio) e *Level-4 Hidden Rationales* (raciocínio indutivo sobre padrões ocultos). Orienta qual das três formas de integração usar (contexto, modelo auxiliar ou fine-tuning) dependendo do nível da query.

**Resultados:**
- Framework analítico com survey de mais de 100 trabalhos
- Guia sistemático para desenvolvimento de aplicações data-augmented
- Análise comparativa dos três paradigmas de integração

**Por que ler:** A taxonomia de 4 níveis é o framework mais prático para diagnosticar falhas em sistemas RAG e escolher a arquitetura correta. Vai além dos surveys anteriores em orientação prática.

---

### Engineering the RAG Stack: A Comprehensive Review of Architecture and Trust Frameworks
**Arquivo:** `Engineering the RAG Stack_ A Comprehensive Review of the Architecture and Trust Frameworks for Retrieval-Augmented Gener.pdf`  
**Autores:** IBM Research / AI Alliance (2025)  
**Novidade:** Média-Alta

**Contribuição:**
Revisão sistemática da literatura (metodologia Kitchenham) cobrindo 2018–2025. Propõe taxonomia arquitetural unificada com cinco dimensões: Retrieval (single-pass, multi-hop, iterativo), Fusion (early, late, marginal), Modality (texto, multi-modal, grafos), Adaptivity (estático, agêntico, auto-configurável) e Trust Layer (citação, abstension, filtragem de fontes). Diferencial: foco explícito em frameworks de confiança e segurança.

**Resultados:**
- Identificação de fragmentação e falta de padronização de benchmarks no campo
- Anti-patterns de implementação documentados
- Direções emergentes: multi-agent RAG, differentiable training

**Por que ler:** O único survey com foco explícito em Trust Layer — citação de fontes, estratégias de abstención, red teaming. Essencial para deployments enterprise em contextos críticos.

---

### O RAG está morto? A ascensão da engenharia de contexto e das camadas semânticas para IA agente
**Arquivo:** `O RAG está morto_ A ascensão da engenharia de contexto e das camadas semânticas para IA agente _ Rumo à Ciência de Dados.pdf`  
**Autores:** Towards Data Science (2025)  
**Novidade:** Média

**Contribuição:**
Artigo de análise da indústria que argumenta que o RAG "ingênuo" está obsoleto, mas seus descendentes prosperam. Propõe que a recuperação evoluiu para *Engenharia de Contexto* — um ciclo mais amplo onde agentes escrevem, comprimem, isolam e selecionam contexto dinamicamente. Defende que Knowledge Graphs e Camadas Semânticas são o próximo passo para RAG enterprise.

**Resultados:**
- Análise de aquisições 2023–2025 (totalizando bilhões de dólares)
- Histórico de adoção industrial
- Emergência de GraphRAG (Microsoft, julho 2024), RAG 2.0 e Agentic RAG

**Por que ler:** Captura o estado prático da indústria e provê diagnóstico claro sobre a evolução do campo. Útil para contextualizar decisões arquiteturais com o que está acontecendo em produção.

---

## 2. Técnicas de Retrieval Avançado

### Blended RAG: Improving RAG Accuracy with Semantic Search and Hybrid Query-Based Retrievers
**Arquivo:** `Blended RAG_ Improving RAG (Retriever-Augmented Generation) Accuracy with Semantic Search and Hybrid Query-Based Retriev.pdf`  
**Autores:** IBM (2024)  
**Novidade:** Média

**Contribuição:**
Propõe o método *Blended RAG* combinando três tipos de índice (BM25 keyword, KNN dense vector, ELSER sparse encoder) com estratégias de query híbridas (Cross Fields, Most Fields, Best Fields, Phrase Prefix). Avalia sistematicamente todas as combinações e seleciona as 6 melhores para o pipeline RAG completo.

**Resultados:**
- 88,77% de top-10 accuracy no dataset NQ
- Supera fine-tuning no SQUAD
- Sparse Encoder + Best Fields mostrou desempenho superior consistente

**Por que ler:** A avaliação sistemática de combinações de índices é o estudo mais completo disponível sobre busca híbrida. O resultado de superar fine-tuning é contraintuitivo e relevante para escolhas de arquitetura.

---

### Beyond Nearest Neighbors: Semantic Compression and Graph-Augmented Retrieval for Enhanced Vector Search
**Arquivo:** `Beyond Nearest Neighbors_ Semantic Compression and Graph-Augmented Retrieval for Enhanced Vector Search.pdf`  
**Autores:** CMU / Stanford / LinkedIn (2025)  
**Novidade:** Alta

**Contribuição:**
Introduz o paradigma de *Semantic Compression* — selecionar um conjunto compacto e representativo de vetores que capture a estrutura semântica em torno de uma query, em vez de apenas os k mais próximos. Formaliza o objetivo usando *submodular optimization* e *information geometry* (cobertura + diversidade). Propõe *graph-augmented vector retrieval* com grafos semânticos e Personalized PageRank para busca multi-hop context-aware.

**Resultados:**
- Métodos baseados em grafos com conexões densas superam ANN puro em diversidade semântica mantendo alta relevância
- Fundação teórica rigorosa para sistemas de busca centrados em significado

**Por que ler:** Quebra o paradigma de top-k nearest neighbors com fundamentação matemática sólida. A conexão entre submodular optimization e graph-augmented retrieval é uma das contribuições teóricas mais relevantes do corpus.

---

### Vendi-RAG: Adaptively Trading-Off Diversity and Quality Significantly Improves Retrieval Augmented Generation
**Arquivo:** `Vendi-RAG_ Adaptively Trading-Off Diversity And Quality Significantly Improves Retrieval Augmented Generation With LLMs.pdf`  
**Autores:** University of Toronto / Princeton (2025)  
**Novidade:** Alta

**Contribuição:**
Usa o *Vendi Score* (métrica de diversidade baseada em similaridade de kernel) para otimizar iterativamente diversidade e qualidade na recuperação. Um LLM-judge avalia a qualidade das respostas candidatas e retroalimenta o retriever: respostas de baixa qualidade disparam mais diversidade; respostas de alta qualidade disparam mais relevância. Processo iterativo até atingir threshold de qualidade.

**Resultados:**
- +4,2% em HotpotQA, +4,1% em 2WikiMultiHopQA, +1,3% em MuSiQue sobre Adaptive-RAG
- Melhorias consistentes com GPT-3.5, GPT-4 e GPT-4o-mini (model-agnostic)
- Ganhos crescem com número de documentos: até +7,8% com 10 docs

**Por que ler:** A retroalimentação do LLM-judge para o retriever é uma contribuição de arquitetura elegante. O Vendi Score como métrica de diversidade para recuperação é original e bem motivado.

---

### CARROT: A Learned Cost-Constrained Retrieval Optimization System for RAG
**Arquivo:** `CARROT_ A Learned Cost-Constrained Retrieval Optimization System for RAG.pdf`  
**Autores:** Nanyang Technological University / Alibaba (2026)  
**Novidade:** Alta

**Contribuição:**
Formaliza a seleção de chunks como problema de otimização NP-hard e usa Monte Carlo Tree Search para encontrar a combinação ótima de chunks considerando: (1) correlações entre chunks (redundância, complementaridade), (2) não-monotonicidade da utilidade (mais chunks nem sempre é melhor), (3) ordem de apresentação (fenômeno "lost in the middle"). Um Configuration Agent prediz configurações ótimas por domínio de query.

**Resultados:**
- Até 30% de melhoria sobre modelos baseline
- Adaptabilidade a workloads difíceis e cenários de contexto longo
- Código open-source disponível

**Por que ler:** O insight de não-monotonicidade da utilidade — mais chunks podem degradar a qualidade — é contraintuitivo e ignorado por todos os outros sistemas. O rigor teórico (NP-hard + MCTS) é diferenciado.

---

### Utilizing Metadata for Better Retrieval-Augmented Generation
**Arquivo:** `Utilizing Metadata for Better Retrieval-Augmented Generation.pdf`  
**Autores:** Virginia Tech / Vectorize.io (2026)  
**Novidade:** Média

**Contribuição:**
Estudo sistemático de estratégias de recuperação metadata-aware para corpora estruturados e repetitivos (ex: filings SEC Form 10-K). Compara: plain-text baseline, metadata-as-text (prefix/suffix), dual-encoder unified embedding, dual-encoder late-fusion e metadata-aware query reformulation. Libera o dataset RAGMATE-10K.

**Resultados:**
- Prefix de metadata e unified embeddings superam consistentemente o baseline plain-text
- Metadata aumenta coesão intra-documento e reduz confusão inter-documento
- Unified embedding frequentemente supera prefix sendo mais simples de manter

**Por que ler:** O estudo mais sistemático e rigoroso disponível sobre metadata em RAG. Imprescindível para domínios com corpora estruturados: financeiro, regulatório, jurídico.

---

### BYOKG-RAG: Multi-Strategy Graph Retrieval for Knowledge Graph Question Answering
**Arquivo:** `10.48550_arXiv.2507.04127.pdf`  
**Autores:** Costas Mavromatis et al. — Amazon (2025)  
**Novidade:** Alta

**Contribuição:**
Framework que combina LLMs com ferramentas especializadas de recuperação em grafos para responder perguntas sobre grafos de conhecimento customizados ("Bring Your Own Knowledge Graph"). O LLM gera artefatos de grafo (entidades, caminhos, consultas OpenCypher) e ferramentas especializadas executam múltiplas estratégias de recuperação (por entidade, caminho, tripla e consulta) de forma iterativa e refinada.

**Resultados:**
- Supera o segundo melhor método em 4,5 pontos percentuais em 5 benchmarks (WebQSP, CWQ, CronQuestions, MedQA, Text2Cypher)
- Wiki-KG: 80,1%; Temp-KG: 65,5%; Med-KG: 65,0%

**Por que ler:** Primeira abordagem que combina múltiplas estratégias de recuperação em grafos (tripla, caminho, consulta executável OpenCypher) de forma sinérgica e iterativa para grafos arbitrários, sem depender de um schema fixo.

---

## 3. RAG Agêntico e Iterativo

### RAG-Gym: Systematic Optimization of Language Agents for Retrieval-Augmented Generation
**Arquivo:** `RAG-Gym_ Systematic Optimization of Language Agents for Retrieval-Augmented Generation.pdf`  
**Autores:** University of Virginia / NIH / UIUC (2025)  
**Novidade:** Alta

**Contribuição:**
Plataforma que formaliza Agentic RAG como Markov Decision Process (MDP) hierárquico e sistematiza três dimensões de otimização: (1) Prompt Engineering — propõe Re2Search com reasoning reflection, (2) Actor Tuning — avalia SFT, DPO e PPO com supervisão de processo, identificando DPO como mais eficaz, (3) Critic Training — treina modelo crítico para selecionar passos intermediários de maior qualidade.

**Resultados:**
- Re2Search++ supera Search-R1 em +3,2% a +11,6% em F1 médio
- +8,5% a +24,7% em datasets não vistos (generalização real)
- HotpotQA: F1 do ReAct baseline sobe de 41,09% para 60,19%

**Por que ler:** É o trabalho que sistematiza de forma mais rigorosa as três dimensões de otimização de Agentic RAG. A generalização de +24,7% em datasets não vistos é a métrica mais importante para produção.

---

### Auto-RAG: Autonomous Retrieval-Augmented Generation for Large Language Models
**Arquivo:** `Auto-RAG_ Autonomous Retrieval-Augmented Generation for Large Language Models.pdf`  
**Autores:** ICT/CAS (Chinese Academy of Sciences) (2024)  
**Novidade:** Alta

**Contribuição:**
Modelo de recuperação iterativa autônoma que elimina regras manuais e few-shot prompting. O modelo realiza multi-turn dialogues com o retriever, planejando e refinando queries automaticamente até acumular conhecimento suficiente. A decisão de quando parar de buscar é tomada pelo próprio LLM com base em raciocínio sobre a adequação do conhecimento coletado. Expressão em linguagem natural melhora interpretabilidade.

**Resultados:**
- Supera baselines em 6 benchmarks
- Adapta autonomamente o número de iterações à dificuldade da pergunta
- Fine-tuning de LLMs open-source com instruções de raciocínio sintetizadas automaticamente

**Por que ler:** Eliminar a dependência de regras manuais para iteração é o avanço prático mais significativo. A arquitetura de diálogo multi-turno com o retriever é original e o modelo é interpretável.

---

### FAIR-RAG: Faithful Adaptive Iterative Refinement for Retrieval-Augmented Generation
**Arquivo:** `FAIR-RAG_ Faithful Adaptive Iterative Refinement for Retrieval-Augmented Generation.pdf`  
**Autores:** Sharif University / Iran University of Science and Technology (2025)  
**Novidade:** Alta

**Contribuição:**
Framework agêntico com três componentes: (1) Adaptive Routing para classificar complexidade da query, (2) Iterative Refinement Loop com ciclo de refinamento de evidências, e (3) Structured Evidence Assessment (SEA) — módulo central que decompõe a query em checklist de achados necessários, audita evidências coletadas, identifica lacunas explícitas e direciona novas sub-queries para preencher essas lacunas. Geração final enforçada a ser fiel apenas às evidências verificadas.

**Resultados:**
- F1 de 0,453 em HotpotQA (+8,3 pts sobre Iter-Retgen)
- F1 de 0,320 em 2WikiMultiHopQA (+6,9 pts sobre Self-RAG)
- F1 de 0,264 em MuSiQue — estado da arte para métodos iterativos

**Por que ler:** O módulo SEA com gap analysis explícito é o mecanismo mais eficaz para multi-hop QA: o sistema sabe exatamente o que ainda não sabe e busca isso. Essencial para casos enterprise críticos (saúde, jurídico, financeiro).

---

### IGMiRAG: Intuition-Guided Retrieval-Augmented Generation with Adaptive Mining of In-Depth Memory
**Arquivo:** `IGMiRAG_ Intuition-Guided Retrieval-Augmented Generation with Adaptive Mining of.pdf`  
**Autores:** Xi'an Jiaotong University (2026)  
**Novidade:** Alta

**Contribuição:**
Framework inspirado no raciocínio humano intuitivo. Constrói um Hierarchical Heterogeneous Hypergraph organizando conhecimento em múltiplas granularidades (átomos, entidades, eventos, relações) com hyperedges hierárquicas representando caminhos dedutivos. Durante a query, gera uma "estratégia intuitiva" via question parser para controlar profundidade e janela de memória; usa dual-focus retrieval e executa bidirectional diffusion (top-down para detalhes, bottom-up para abstração).

**Resultados:**
- +4,8% EM e +5,0% F1 sobre estado da arte em 6 benchmarks
- Custo de tokens adapta à complexidade (média 6.3k, mínimo 3.0k tokens)

**Por que ler:** A arquitetura de hypergraph hierárquico heterogêneo com diffusion bidirecional é uma contribuição estrutural significativa. A analogia com cognição humana é bem materializada em mecanismos concretos e eficientes.

---

### Collab-RAG: Boosting RAG for Complex QA via White-Box and Black-Box LLM Collaboration
**Arquivo:** `Collab-RAG_ Boosting Retrieval-Augmented Generation for Complex Question Answering via White-Box and Black-Box LLM Colla.pdf`  
**Autores:** Emory University / UT Southwestern / Georgia Tech (2025)  
**Novidade:** Alta

**Contribuição:**
Framework colaborativo onde um SLM (Small Language Model, white-box, treinável) decompõe queries complexas em sub-perguntas atômicas, melhorando a recuperação; e um LLM black-box (ex: GPT-4o-mini) responde às sub-perguntas e fornece feedback para treinar o SLM via iterative preference optimization. O SLM aprende sem anotações humanas ou destilação de modelos frontier — apenas feedback do black-box LLM.

**Resultados:**
- +1,8% a +14,2% sobre baselines em 5 datasets multi-hop QA
- SLM de 3B parâmetros supera LLM frozen de 32B em decomposição de questões
- Generalização para múltiplos LLMs black-box

**Por que ler:** A colaboração SLM/LLM com preference optimization sem supervisão humana tem altíssimo potencial de adoção em produção. Especialização vence escala para subtarefas específicas.

---

### RAG-Star: Enhancing Deliberative Reasoning with Retrieval Augmented Verification and Refinement
**Arquivo:** `RAG-Star_ Enhancing Deliberative Reasoning with Retrieval Augmented Verification and Refinement.pdf`  
**Autores:** Renmin University of China (2024)  
**Novidade:** Alta

**Contribuição:**
Integra RAG com Monte Carlo Tree Search (MCTS) para habilitar raciocínio deliberativo "System 2" em LLMs. O RAG-Star itera sub-queries e sub-respostas em estrutura de árvore, explorando o espaço de soluções. A recuperação externa não interfere diretamente no raciocínio, mas serve como verificação e refinamento dos passos intermediários via reward modeling query- e answer-aware, reduzindo conflitos entre conhecimento paramétrico e externo.

**Resultados:**
- +18,98% sobre baselines com Llama-3.1-8B
- +16,19% com GPT-4o em média em múltiplos datasets de raciocínio complexo
- Outperforms métodos RAG e de raciocínio anteriores significativamente

**Por que ler:** A ideia de usar RAG como verificador dos passos do MCTS — em vez de injetar documentos diretamente — é conceitualmente elegante e resolve o conflito clássico entre conhecimento paramétrico e externo. Conecta RAG ao paradigma de test-time compute scaling.

---

### RAG for Fintech: Agentic Design and Evaluation
**Arquivo:** `Retrieval Augmented Generation (RAG) for Fintech_ Agentic Design and Evaluation.pdf`  
**Autores:** TU Dublin / Maynooth University / Mastercard / NCI (2025)  
**Novidade:** Média

**Contribuição:**
Arquitetura RAG agêntica (A-RAG) para domínio fintech com pipeline modular de 8 agentes especializados: classificador de intenção, reformulador de consulta, gerenciador de recuperação, gerador de sub-consultas, re-ranqueador cross-encoder, agente de sumarização, agente QA e orquestrador. Inclui metodologia de avaliação semi-automatizada (LLM-as-a-judge) adaptada para restrições de confidencialidade empresarial.

**Resultados:**
- A-RAG: 62,35% de Hit Rate @5 vs. 54,12% do baseline B-RAG
- Latência: 5,02s (A-RAG) vs. 0,79s (B-RAG) — trade-off explícito
- Testado em base Mastercard com 30.000+ chunks de 1.624 documentos

**Por que ler:** A metodologia de avaliação segura para ambientes corporativos (sem expor dados sensíveis) é um diferencial relevante. O trade-off explícito accuracy/latência é importante para decisões de arquitetura em fintech.

---

## 4. Raciocínio Multi-hop e Perguntas Complexas

### MultiHop-RAG: Benchmarking Retrieval-Augmented Generation for Multi-Hop Queries
**Arquivo:** `MultiHop-RAG_ Benchmarking Retrieval-Augmented Generation for Multi-Hop Queries.pdf`  
**Autores:** HKUST (2024)  
**Novidade:** Média-Alta

**Contribuição:**
Cria o dataset MultiHop-RAG para avaliar RAG em queries multi-hop, categorizadas em 4 tipos: Inference, Comparison, Temporal e Null (query sem resposta na base). Usa GPT-4 para geração de queries a partir de artigos de notícias. Demonstra sistematicamente que sistemas RAG existentes falham nesse tipo de query.

**Resultados:**
- GPT-4, PaLM, Claude-2, Llama2-70B, Mixtral-8x7B — todos com performance insatisfatória em multi-hop
- Diferenças significativas de desempenho entre embedding models testados

**Por que ler:** É o paper de diagnóstico que motivou grande parte da pesquisa subsequente (FAIR-RAG, Vendi-RAG, Collab-RAG). O dataset é recurso comunitário valioso e a categoria Null (sem resposta) é frequentemente negligenciada.

---

### EVOR: Evolving Retrieval for Code Generation
**Arquivo:** `EVOR_ Evolving Retrieval for Code Generation.pdf`  
**Autores:** University of Hong Kong / Fudan University / Sea AI Lab (2025)  
**Novidade:** Alta

**Contribuição:**
Pipeline de geração de código aumentada por recuperação (RACG) com evolução síncrona tanto das consultas quanto das bases de conhecimento. A base de conhecimento é diversa ("knowledge soup"), integrando documentação, feedback de execução, snippets de código e busca web, e evolui iterativamente com base no feedback do compilador/interpretador.

**Resultados:**
- 2 a 4 vezes mais precisão de execução comparado a Reflexion e DocPrompting
- EVOR-BENCH com ChatGPT: 35,3% vs. 19,2% do segundo melhor (DocPrompting)
- Com CodeLlama: 32,2% vs. 16,0%

**Por que ler:** É a aplicação mais eficaz de RAG para geração de código. A evolução síncrona de queries e bases de conhecimento com feedback do compilador é uma contribuição original que pode ser adaptada para outros domínios.

---

### RAG over Tables: Hierarchical Memory Index, Multi-Stage Retrieval, and Benchmarking
**Arquivo:** `RAG over Tables_ Hierarchical Memory Index, Multi-Stage Retrieval, and Benchmarking.pdf`  
**Autores:** UIUC / Meta AI / IBM Research (2025)  
**Novidade:** Alta

**Contribuição:**
Propõe o T-RAG, framework RAG específico para corpora de tabelas, com: (1) índice de memória hierárquico organizando tabelas em hipergrafo heterogêneo via clustering multiway; (2) recuperação multi-estágio coarse-to-fine com PageRank personalizado; (3) prompting com consciência de grafo e Chain-of-Thought longa. Cria o benchmark MultiTableQA com 57.193 tabelas e 23.758 questões de cenários reais.

**Resultados:**
- T-RAG lidera em acurácia, revocação e tempo de execução no MultiTableQA
- Supera RAG genérico, métodos de recuperação tabular e métodos de representação tabelo-grafo

**Por que ler:** Dados estruturados em tabelas são um dos casos mais comuns em enterprise (BI, ERP, relatórios), mas RAG para tabelas é sistematicamente negligenciado. Primeira abordagem sistêmica para corpora heterogêneos de tabelas com benchmark próprio.

---

## 5. Infraestrutura de Busca Vetorial

### HAKES: Scalable Vector Database for Embedding Search Service
**Arquivo:** `HAKES_ Scalable Vector Database for Embedding Search Service.pdf`  
**Autores:** NUS / Deakin University / Zhejiang University  
**Novidade:** Alta

**Contribuição:**
Banco de dados vetorial distribuído com design explícito de dois estágios (filtro + refinamento) e técnica de ML leve para ajuste de parâmetros do índice. Inclui verificação de encerramento antecipado adaptativa por consulta e arquitetura desagregada para escalabilidade. O índice HAKES-Index usa redução de dimensionalidade + IVF + quantização por produto (4-bit).

**Resultados:**
- Supera 12 índices estado da arte na região de alta revocação
- Até 16x mais throughput que bancos de dados vetoriais distribuídos concorrentes sob cargas mistas

**Por que ler:** A combinação de aprendizado de parâmetros de compressão baseado em distribuição de similaridade com arquitetura desagregada é inédita. Alta relevância para sistemas RAG de produção em grande escala.

---

### GleanVec: Accelerating Vector Search with Minimalist Nonlinear Dimensionality Reduction
**Arquivo:** `GleanVec_ Accelerating vector search with minimalist nonlinear dimensionality reduction.pdf`  
**Autores:** Intel Labs  
**Novidade:** Alta

**Contribuição:**
Apresenta dois novos métodos de redução de dimensionalidade para busca vetorial: LeanVec-Sphering (linear, solução fechada baseada em SVD, sem hiperparâmetros) e GleanVec (não-linear, "piecewise linear"). Ambos são projetados para cenários com consultas in-distribution e out-of-distribution (OOD), como busca cross-modal (texto para imagem).

**Resultados:**
- LeanVec-Sphering supera outros métodos lineares em accuracy e velocidade
- GleanVec melhora ainda mais com impacto mínimo na performance computacional
- Avanço do estado da arte em busca vetorial de alta dimensão

**Por que ler:** LeanVec-Sphering oferece solução fechada sem hiperparâmetros — fácil de adotar. GleanVec é a primeira abordagem piecewise linear eficiente para busca vetorial, com aplicação direta em sistemas multi-modal.

---

### TigerVector: Supporting Vector Search in Graph Databases for Advanced RAGs
**Arquivo:** `TigerVector_ Supporting Vector Search in Graph Databases for Advanced RAGs.pdf`  
**Autores:** TigerGraph / Purdue University (2024)  
**Novidade:** Média

**Contribuição:**
Integra busca vetorial nativa ao TigerGraph (banco de dados em grafo MPP). Introduz o tipo de dado `embedding` como atributo de vértice, armazenamento desacoplado de vetores, índice HNSW por segmento para processamento paralelo distribuído, e suporte a busca vetorial declarativa via GSQL (busca filtrada, em padrões de grafo e similarity join).

**Resultados:**
- Supera Neo4j, Amazon Neptune e Milvus em busca híbrida e escalabilidade
- Integrado ao TigerGraph v4.2 (dezembro de 2024) como produto comercial

**Por que ler:** Solução de produção para quem precisa combinar busca vetorial com travessais de grafo em uma única plataforma. O suporte a similarity join declarativo via GSQL é único no mercado.

---

### Toward Efficient and Scalable Design of In-Memory Graph-Based Vector Search
**Arquivo:** `Toward Efficient and Scalable Design of In-Memory Graph-Based Vector Search.pdf`  
**Autores:** CY Cergy Paris Université / UM6P / Université Paris Cité (2025)  
**Novidade:** Média

**Contribuição:**
Avaliação experimental exaustiva de 12 algoritmos estado da arte de busca vetorial em grafo na memória, em 7 coleções reais com até 1 bilhão de vetores. Propõe taxonomia original de 5 paradigmas de design: seleção de semente, inserção incremental, propagação de vizinhança, diversificação de vizinhança e divisão e conquista.

**Resultados:**
- Os melhores métodos combinam inserção incremental (II) e diversificação de vizinhança (ND)
- RND (Relative Neighborhood Diversification) supera MOND e RRND consistentemente
- Tendências mudam significativamente ao escalar além de 1 milhão de vetores

**Por que ler:** É o guia de referência para escolha de algoritmo de busca vetorial em grafo. A taxonomia de 5 paradigmas é original e as conclusões em escala de 1 bilhão de vetores são críticas para planejamento de capacidade.

---

### Bhakti: A Lightweight Vector Database Management System
**Arquivo:** `Bhakti_ A Lightweight Vector Database Management System for Endowing Large Language Models with Semantic Search Capabili.pdf`  
**Autores:** Fujian University of Technology (2025)  
**Novidade:** Baixa

**Contribuição:**
Sistema de banco de dados vetorial leve para conjuntos de dados de pequeno e médio porte. Inclui suporte a múltiplos métodos de similaridade, DSL para filtragem baseada em padrões, portabilidade de dados e integração com Python. Propõe solução de diálogo com memória que atribui pesos diferentes a perguntas e respostas no histórico.

**Resultados:**
- Resultados experimentais em busca semântica e QA sem benchmarks numéricos padronizados
- Sem suporte a HNSW, limitando escalabilidade para grandes datasets

**Por que ler:** Referência para cenários de pequena/média escala onde simplicidade de deployment é prioritária. Relevante como alternativa leve ao pgvector ou Chroma para prototipagem.

---

### PersonalAI: A Systematic Comparison of Knowledge Graph Storage and Retrieval Approaches
**Arquivo:** `PersonalAI_ A Systematic Comparison of Knowledge Graph Storage and Retrieval App.pdf`  
**Autores:** Skoltech / Sberbank / AIRI, Rússia (2025)  
**Novidade:** Média

**Contribuição:**
Framework de memória externa baseado em grafos de conhecimento com design híbrido de hiper-arestas (suportando arestas padrão e dois tipos de hiper-arestas para representações semânticas e temporais). Implementa e avalia sistematicamente 6 algoritmos de travessia de grafo (A*, WaterCircle, BeamSearch e combinações) com controle ortogonal de hiperparâmetros.

**Resultados:**
- Diferentes configurações são ótimas para diferentes tarefas
- Supera baselines GraphRAG em múltiplos datasets
- Extensão do DiaASQ com anotações temporais

**Por que ler:** O estudo comparativo mais sistemático disponível de estratégias de travessia para memória em grafos. Útil para quem está escolhendo entre diferentes algoritmos para GraphRAG personalizado.

---

## 6. Eficiência de Inferência

### REFRAG: Rethinking RAG-based Decoding
**Arquivo:** `REFRAG RethinkingRAGbasedDecoding.pdf`  
**Autores:** Meta Superintelligence Labs / NUS / Rice University (2025)  
**Novidade:** Muito Alta

**Contribuição:**
Resolve o gargalo de eficiência de RAG em produção. Em RAG, os chunks recuperados são semanticamente independentes (resultado do reranking/deduplicação), criando um padrão de atenção block-diagonal — praticamente zero atenção cruzada entre chunks. Isso significa que a maioria dos cálculos de atenção sobre o contexto RAG são desnecessários. REFRAG: (1) comprime cada chunk com um encoder leve (RoBERTa) em um único embedding, (2) alimenta esses embeddings diretamente ao decoder em vez dos tokens completos, (3) reutiliza embeddings já calculados pelo retriever e (4) usa política RL leve para expandir seletivamente apenas os chunks mais críticos.

**Resultados:**
- **30,85x** de aceleração no Time-to-First-Token (TTFT)
- **3,75x** de melhoria sobre o SOTA anterior (CEPE)
- Extensão do contexto por **16x** sem perda de accuracy
- **6,78x** de throughput vs. LLaMA base
- Zero perda de accuracy em múltiplos benchmarks RAG

**Por que ler:** É o paper mais voltado para impacto em produção do corpus. Ele é complementar a todos os outros — você pode rodar FAIR-RAG ou Vendi-RAG em cima do REFRAG. Vindo do Meta Superintelligence Labs com código público, tem alta probabilidade de se tornar infraestrutura padrão.

---

## 7. Segurança e Privacidade em RAG

### RAGPart & RAGMask: Retrieval-Stage Defenses Against Corpus Poisoning in RAG
**Arquivo:** `RAGPart & RAGMask_ Retrieval-Stage Defenses Against Corpus Poisoning in Retrieva.pdf`  
**Autores:** University of Maryland / Capital One / Peraton Labs  
**Novidade:** Alta

**Contribuição:**
Propõe duas defesas complementares na etapa de recuperação contra ataques de envenenamento de corpus: RAGPart (particionamento de documentos + embedding independente + pooling médio para diluir tokens adversariais) e RAGMask (identificação de tokens suspeitos por variação de similaridade sob mascaramento). Ambas operam no retriever sem modificar o modelo gerador. Introduz também o ataque interpretável AdvRAGgen.

**Resultados:**
- Reduzem consistentemente a taxa de sucesso de ataques em 2 benchmarks e 4 estratégias de envenenamento
- Testadas com 4 retrievers estado da arte
- RAGPart tem base teórica para sua eficácia

**Por que ler:** Primeiras defesas práticas exclusivamente na etapa de recuperação, sem premissas fortes sobre o gerador. Essencial para sistemas RAG que aceitam documentos de fontes externas ou não-confiáveis.

---

### The Good and The Bad: Exploring Privacy Issues in Retrieval-Augmented Generation (RAG)
**Arquivo:** `The Good and The Bad_ Exploring Privacy Issues in Retrieval-Augmented Generation (RAG).pdf`  
**Autores:** Michigan State University / Baidu / Jilin University (2024)  
**Novidade:** Alta

**Contribuição:**
Estudo empírico com dois achados opostos: (1) RAG é VULNERÁVEL ao vazamento de dados privados da base de recuperação via ataques de prompting composto estruturado; (2) RAG REDUZ significativamente o vazamento de dados de treinamento do LLM comparado ao uso sem RAG.

**Resultados:**
- Ataques direcionados extraíram 89 fragmentos médicos e 107 PIIs do Enron em apenas 250 prompts
- Vazamento de dados de treinamento cai substancialmente com RAG, superando ruído e prompts de sistema como proteção
- Taxa de sucesso de extração próxima a 50% em cenários favoráveis

**Por que ler:** Revela a dualidade privacidade/RAG: simultaneamente vulnerável (dados de recuperação) e protetor (dados de treinamento). Insights fundamentais para qualquer design seguro de sistema RAG.

---

### Riddle Me This! Stealthy Membership Inference for Retrieval-Augmented Generation
**Arquivo:** `Riddle Me This! Stealthy Membership Inference for Retrieval-Augmented Generation.pdf`  
**Autores:** UMass Amherst / Northeastern University (2025)  
**Novidade:** Alta

**Contribuição:**
Propõe o Interrogation Attack (IA), técnica de inferência de pertencimento furtiva para datastores RAG. Gera consultas em linguagem natural específicas ao documento-alvo via doc2query few-shot, evitando detecção por ferramentas de segurança — ao contrário de métodos anteriores baseados em jailbreaking ou consultas de alta perplexidade.

**Resultados:**
- Sucesso com apenas 30 consultas, custando menos de US$ 0,02 por documento
- Detectores identificam prompts adversariais anteriores até 76x mais frequentemente que o IA
- 2x melhoria no TPR@1%FPR sobre ataques anteriores

**Por que ler:** Primeiro ataque de inferência de pertencimento verdadeiramente furtivo contra RAG, operando em caixa-preta e resistente a mecanismos de detecção convencionais. Essencial para modelagem de ameaças em sistemas RAG com dados sensíveis.

---

### Enhancing Critical Thinking with AI: A Tailored Warning System for RAG Models
**Arquivo:** `Enhancing Critical Thinking with AI_ A Tailored Warning System for RAG Models.pdf`  
**Autores:** Stanford University (2025)  
**Novidade:** Média

**Contribuição:**
Sistema de avisos personalizados que detecta alucinações em dois níveis (recuperação e geração) em sistemas RAG e gera mensagens de alerta contextualizadas ao usuário, com objetivo de estimular pensamento crítico em contextos educacionais.

**Resultados:**
- Estudo piloto com 18 participantes
- Grupo com avisos personalizados: +0,67 em confiança (escala Likert 5 pontos) vs. grupos sem aviso ou com aviso genérico
- Maior facilidade de uso reportada

**Por que ler:** Abordagem original na intersecção entre RAG e design de interação humano-IA. Relevante para aplicações educacionais e sistemas onde o usuário precisa avaliar a confiabilidade das respostas.

---

## 8. Avaliação de Sistemas RAG

### Ragas: Automated Evaluation of Retrieval Augmented Generation
**Arquivo:** `Ragas_ Automated Evaluation of Retrieval Augmented Generation.pdf`  
**Autores:** Exploding Gradients / Cardiff University (2023)  
**Novidade:** Alta

**Contribuição:**
Framework para avaliação automática e sem referência de pipelines RAG, definindo três métricas: Fidelidade (a resposta é suportada pelo contexto?), Relevância da Resposta (a resposta endereça a pergunta?) e Relevância do Contexto (o contexto recuperado é focado?). Todas as métricas são implementadas via prompting de LLM, sem anotações humanas.

**Resultados:**
- Fidelidade: 95% de concordância com anotadores humanos (vs. 72% do GPT Score)
- Relevância da Resposta: 78% de concordância (vs. 52% do GPT Score)
- Relevância do Contexto: 70% de concordância (vs. 63% do GPT Score)

**Por que ler:** Framework pioneiro e amplamente adotado para avaliação sem referência de RAG. As três métricas cobrem as dimensões críticas do pipeline e a implementação via prompting elimina a necessidade de datasets anotados. É o padrão de facto para avaliação de sistemas RAG em produção.

---

### LLM-Assisted Automated Deductive Coding of Dialogue Data
**Arquivo:** `LLM-Assisted Automated Deductive Coding of Dialogue Data_ Leveraging Dialogue-Sp.pdf`  
**Autores:** University of Hong Kong (2025)  
**Novidade:** Média

**Contribuição:**
Framework de codificação automática de dados de diálogo baseado em LLMs que explora características específicas do diálogo (atos comunicativos e eventos comunicativos) com prompts separados. Inclui verificação de consistência entre níveis e uso colaborativo de múltiplos LLMs (GPT-4-turbo, GPT-4o, DeepSeek).

**Resultados:**
- Concordância entre anotadores humanos de 96,11% (Cohen's Kappa)
- Verificação de consistência contextual foi o fator com maior impacto positivo
- Precisão de atos comunicativos consistentemente superior à de eventos

**Por que ler:** Metodologia original para análise automática de diálogos educacionais com verificação hierárquica de consistência. Aplicável em sistemas RAG para análise de logs de conversa.

---

## 9. Aplicações de Domínio Específico

### Telco-RAG: Navigating the Challenges of RAG for Telecommunications
**Arquivo:** `Telco-RAG_ Navigating the Challenges of Retrieval-Augmented Language Models for Telecommunications.pdf`  
**Autores:** Huawei Paris Research Center / Yale University  
**Novidade:** Média

**Contribuição:**
Framework RAG open-source adaptado para documentos técnicos de telecomunicações (especialmente 3GPP). Inclui pipeline de dois estágios: melhoria de consulta (glossário de termos técnicos + respostas candidatas) e recuperação refinada. Roteador de rede neural (NN router) para seleção dinâmica de documentos com redução de RAM.

**Resultados:**
- 90,8% no TeleQnA vs. 84,8% do RAG benchmark e 80,2% sem contexto
- NN router reduz consumo de RAM em 45% (de 2,3 GB para 1,25 GB)
- Chunks de 125 tokens oferecem melhor desempenho que chunks maiores

**Por que ler:** Demonstração prática de adaptação de RAG para domínio altamente especializado com terminologia densa. As soluções para limitações de RAM e tamanho de chunk são aplicáveis a outros domínios técnicos.

---

### MUST-RAG: MUSical Text Question Answering with Retrieval Augmented Generation
**Arquivo:** `MUST-RAG_ MUSical Text Question Answering with Retrieval Augmented Generation.pdf`  
**Autores:** KAIST, Coreia do Sul  
**Novidade:** Média

**Contribuição:**
Framework RAG para QA de música em texto. Combina MusWikiDB (base de dados vetorial especializada com 31K páginas e 629K trechos da Wikipedia musical) com fine-tuning do LLM que incorpora o contexto recuperado. Introduz o benchmark ArtistMus para avaliação de questões sobre artistas musicais.

**Resultados:**
- RAG Inference com Llama 3.1 8B: 82,0% em questões factuais vs. 39,0% sem RAG
- RAG Fine-tuning: 92,0% em questões contextuais
- MusWikiDB supera Wikipedia geral em desempenho e eficiência

**Por que ler:** Demonstra o valor de bases vetoriais especializadas por domínio vs. bases generalistas. A combinação RAG+fine-tuning para domínios especializados tem resultado expressivo e padrão replicável.

---

### RoleRAG: Enhancing LLM Role-Playing via Graph Guided Retrieval
**Arquivo:** `RoleRAG_ Enhancing LLM Role-Playing via Graph Guided Retrieval.pdf`  
**Autores:** Nanyang Technological University / Alibaba-NTU Lab (2025)  
**Novidade:** Média

**Contribuição:**
Framework de recuperação em grafo para roleplay com LLMs. Inclui: (1) algoritmo eficiente de normalização de entidades para deduplicação semântica de nomes; (2) módulo de recuperação com consciência de fronteiras cognitivas do personagem, que distingue entidades específicas, gerais e fora do escopo, rejeitando ativamente perguntas fora do conhecimento do personagem.

**Resultados:**
- Supera todos os baselines (Vanilla, RAG simples, perfil de personagem, GraphRAG)
- LLMs menores com RoleRAG (Qwen 2.5 14B) superam LLMs maiores (Llama 3.3 70B) sem o framework
- Redução de alucinações e melhora na rejeição de questões desconhecidas

**Por que ler:** O mecanismo de fronteiras cognitivas que rejeita perguntas fora do escopo do personagem é o diferenciador principal. Aplicável a qualquer sistema onde o assistente deve operar com conhecimento limitado e definido.

---

### Leveraging Generative AI: Improving Software Metadata Classification with Generated Code-Comment Pairs
**Arquivo:** `Leveraging Generative AI_ Improving Software Metadata Classification with Genera.pdf`  
**Autores:** Sri Sivasubramaniya Nadar College of Engineering, Índia  
**Novidade:** Baixa

**Contribuição:**
Investiga uso de BERT para classificar comentários de código como "Úteis" ou "Não Úteis", aumentando dataset original (9.048 pares C) com 739 pares gerados por LLM. Avalia 7 modelos de ML (Regressão Logística, SVM, GBT, Random Forest, Redes Neurais) com e sem dados aumentados por LLM.

**Resultados:**
- SVM com dado aumentado: F1 de 0,8161 (vs. 0,8130 sem aumento)
- GBT com dados aumentados: recall de 0,9097
- Melhorias modestas e variáveis por modelo

**Por que ler:** Referência para aplicação de data augmentation com LLMs em datasets de código pequenos. Demonstra limitações da abordagem quando o dataset já é representativo.

---

## 10. Ferramentas, Toolkits e Experiências Práticas

### RETA-LLM: A Retrieval-Augmented Large Language Model Toolkit
**Arquivo:** `RETA-LLM_ A Retrieval-Augmented Large Language Model Toolkit.pdf`  
**Autores:** Renmin University of China (2023)  
**Novidade:** Média

**Contribuição:**
Toolkit modular para sistemas RAG com cinco módulos plug-and-play: reescrita de requisições, recuperação de documentos, extração de trechos, geração de resposta e verificação de fatos. O design desacoplado entre IR system e LLM facilita customização e construção de sistemas domain-specific. Inclui módulo adicional de verificação de fatos.

**Resultados:**
- Demonstrado em sistema de assistente de matrícula da Renmin University (YuLan-13B)
- Arquitetura modular validada em caso real de uso educacional

**Por que ler:** Infraestrutura de referência para construção de sistemas RAG customizáveis. O módulo de verificação de fatos é uma adição útil não presente em outros toolkits. Relevante para equipes que querem construir RAG sem depender de frameworks fechados.

---

### Developing RAG-based LLM Systems from PDFs: An Experience Report
**Arquivo:** `Developing Retrieval Augmented Generation (RAG) based LLM Systems from PDFs_ An Experience Report.pdf`  
**Autores:** Tampere University, Finlândia (2024)  
**Novidade:** Baixa

**Contribuição:**
Relatório de experiência prática documentando o desenvolvimento de sistemas RAG a partir de PDFs, comparando API OpenAI (GPT) com modelos open-source Llama. Cobre todo o pipeline — coleta de dados, pré-processamento, indexação vetorial e geração — destacando desafios técnicos e soluções. Inclui framework de decisão para escolher entre fine-tuning, RAG e modelos base.

**Resultados:**
- Guia qualitativo de aprendizados práticos
- Framework de decisão fine-tuning vs. RAG vs. modelo base
- Sem métricas numéricas de benchmark

**Por que ler:** Valioso como ponto de partida para equipes implementando RAG sobre PDFs pela primeira vez. O framework de decisão entre fine-tuning e RAG é um recurso prático frequentemente negligenciado pela literatura acadêmica.

---

### LangChain vs DSPy — Comparativo de Frameworks para LLMs

**Arquivo:** `Langchain vs Dspy. Eu entendo que aprender ciência de dados… _ por Hey Amit _ Diário de um Cientista de Dados _ Medium.pdf`  
**Autores:** Hey Amit (Medium, 2024)  
**Novidade:** Baixa

**Contribuição:**
Artigo comparativo de blog explorando as diferenças de propósito e uso entre LangChain e DSPy. LangChain é corretamente posicionado como framework de orquestração de LLMs com suporte a chains, agentes, memória e integrações com modelos como GPT e BERT. Cobre casos de uso como chatbots, análise de documentos e pipelines NLP encadeados, comparando escalabilidade, suporte da comunidade e curva de aprendizado.

**⚠️ Observação crítica — DSPy descrito incorretamente:**  
O artigo descreve DSPy como ferramenta de ciência de dados tradicional (pandas, scikit-learn, modelagem estatística) — isso está **errado**. O **DSPy real** (Stanford NLP, Omar Khattab et al., 2023) é um framework de *programação declarativa com LLMs* que:

- Define tarefas via **Signatures** (`question → answer`) em vez de prompts manuais
- Usa **Teleprompters/Optimizers** (BootstrapFewShot, MIPRO, BayesianSignatureOptimizer) para encontrar automaticamente os melhores prompts e pesos
- Compila pipelines LLM em vez de escrevê-los manualmente — mais próximo de PyTorch para LLMs do que de pandas
- É diretamente relevante ao ecossistema RAG: pipelines RAG com DSPy se auto-otimizam sem prompt engineering manual

**Resultados:**

- Artigo não apresenta benchmarks quantitativos — é análise qualitativa de posicionamento
- Comparação de escalabilidade e integração com ecosistema Python

**Por que ler:** Útil como orientação inicial para escolher entre frameworks de orquestração de LLMs. O contraste real LangChain vs DSPy é: **LangChain = orquestração explícita e modular** vs **DSPy = otimização declarativa automática de pipelines LLM**. Para sistemas RAG em produção, os dois são complementares: LangChain gerencia o fluxo, DSPy otimiza os prompts.

---

## 11. Fronteiras Emergentes

### AR-RAG: Autoregressive Retrieval Augmentation for Image Generation
**Arquivo:** `AR-RAG_ Autoregressive Retrieval Augmentation for Image Generation.pdf`  
**Autores:** Virginia Tech / Meta / UC Davis (2025)  
**Novidade:** Alta

**Contribuição:**
Primeiro paradigma de recuperação aumentada que opera no nível de patch de imagem de forma autorregressiva durante a geração. Em vez de recuperar imagens inteiras antes da geração, o sistema recupera os k-vizinhos mais próximos de patches a cada etapa, usando os patches já gerados como consulta. Propõe dois frameworks: DAiD (sem treinamento, combinação de distribuições) e FAiD (ajuste fino eficiente com convolução multiescala).

**Resultados:**
- Janus-Pro com FAiD: FID de 6,67 no Midjourney-30K
- 0,78 de pontuação geral no GenEval — novo estado da arte entre modelos autorregressivos comparáveis

**Por que ler:** Estende o paradigma RAG para geração de imagens de forma fundamentalmente nova — recuperação no nível de patch durante a geração, não antes. Abre direção de pesquisa em RAG multi-modal para outros tipos de conteúdo gerado.

---

### Synthesis of Quantum Vector Databases Based on Grover's Algorithm
**Arquivo:** `Synthesis of Quantum Vector Databases Based on Grovers Algorithm.pdf`  
**Autores:** MADI, Moscow (2023)  
**Novidade:** Média

**Contribuição:**
Propõe método de banco de dados vetorial quântico usando o algoritmo de Grover, onde embeddings são armazenados como gates Controlled-S em registros quânticos. O processo clássico gera embeddings; o computador quântico realiza a busca com complexidade O(√(N/M)) — quadraticamente melhor que busca clássica. O circuito permite armazenar múltiplos embeddings em um único registro quântico.

**Resultados:**
- Demonstrações via simulador Quirk e IBM Quantum em pequena escala
- Sem benchmarks com dados reais — exploração teórica com circuitos de poucos qubits

**Por que ler:** Exploração conceitual pioneira de busca vetorial quântica. Relevante para pesquisadores interessados em vantagens quânticas para IR. A proposta é tecnicamente válida, mas limitada pelo estado atual do hardware quântico.

---

### RAG-Gym: Systematic Optimization of Language Agents (ver seção 3)

*Este artigo aparece tanto em RAG Agêntico quanto como fronteira emergente por sua formalização MDP.*

---

## Resumo Executivo

### Distribuição por categoria

| Categoria | Artigos |
|---|---|
| Surveys e Fundamentais | 5 |
| Retrieval Avançado | 7 |
| RAG Agêntico e Iterativo | 7 |
| Multi-hop e Complexidade | 3 |
| Infraestrutura Vetorial | 6 |
| Eficiência de Inferência | 1 |
| Segurança e Privacidade | 4 |
| Avaliação | 2 |
| Domínios Específicos | 5 |
| Ferramentas e Prática | 3 |
| Fronteiras Emergentes | 2 |

### Top 5 para leitura prioritária

1. **REFRAG** (Meta, 2025) — maior impacto em produção: 30x de aceleração sem perda de accuracy
2. **RAG-Gym** (UVA/NIH, 2025) — melhor framework para treinar Agentic RAG com generalização real
3. **FAIR-RAG** (Sharif, 2025) — melhor solução para multi-hop com gap analysis explícito
4. **RAG-Star** (Renmin, 2024) — MCTS + RAG: +19% em raciocínio complexo
5. **Ragas** (Exploding Gradients, 2023) — padrão de facto para avaliação sem referência

### Tendências dominantes (2025–2026)

- **Agentic RAG com RL** supera pipelines estáticos em generalização
- **MCTS + RAG** conecta retrieval ao paradigma de test-time compute scaling
- **Diversidade semântica** substitui top-k nearest neighbors como paradigma de recuperação
- **GraphRAG e Hypergraphs** evoluem para representações de conhecimento de alta ordem
- **Eficiência de inferência** (REFRAG) torna-se crítica à medida que contextos crescem
- **Segurança** (corpus poisoning, membership inference) emerge como área autônoma
