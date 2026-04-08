# Estado da Arte em RAG — Resumo Executivo
> Síntese de 42 artigos científicos (2020–2026)

---

## O que está acontecendo com RAG

RAG não está morto. RAG ingênuo está obsoleto. É uma distinção importante.

O pipeline original de 2020 — recuperar os k documentos mais próximos e jogar no prompt — ainda funciona, mas está sendo superado em todo benchmark relevante pelos 13 papers de técnicas avançadas deste corpus. Cada um deles existe porque o RAG clássico tem limitações reais e documentadas.

O que está acontecendo é uma maturação acelerada. Em 2020 havia um paper. Em 2026, há uma taxonomia completa com ao menos três gerações de sistemas, investimentos bilionários em infraestrutura e uma subárea de segurança dedicada. Isso não é o fim de RAG. É RAG virando adulto.

---

## Os 5 Melhores Papers do Corpus

### 1. REFRAG — Meta Superintelligence Labs (2025)
**O problema que resolve:** RAG em produção é lento. Cada vez que você recupera mais contexto para melhorar a qualidade, a latência explode e o KV cache esgota memória. Esse é o trade-off que mata RAG em produção.

**O que ele faz:** Identifica que chunks recuperados têm atenção praticamente zero entre si (block-diagonal attention) porque vêm de documentos diferentes e passaram por reranking. Isso significa que 90%+ dos cálculos de atenção sobre o contexto RAG são desperdício. REFRAG comprime cada chunk em um único embedding com um encoder leve e alimenta esses embeddings diretamente ao decoder, eliminando a computação redundante.

**Resultado:** 30,85x de aceleração no tempo para o primeiro token. Zero perda de accuracy. Contexto estendido em 16x. Vindo do Meta com código público — vai se tornar infraestrutura padrão.

**Por que é o melhor:** É o único paper que resolve o problema *real* de produção. Todos os outros melhoram accuracy. REFRAG melhora viabilidade econômica.

---

### 2. RAG-Gym — UVA / NIH / UIUC (2025)
**O problema que resolve:** Como treinar um agente RAG que realmente generalize — não apenas que memorize padrões de um benchmark?

**O que ele faz:** Formaliza Agentic RAG como MDP hierárquico e compara sistematicamente as três dimensões de otimização: prompt engineering, actor tuning e critic training. Descobre que DPO com supervisão de *processo* (não apenas de resultado) é a abordagem mais eficaz.

**Resultado:** +8,5% a +24,7% em datasets **não vistos**. Essa é a métrica que importa: generalização real, não overfitting de benchmark.

**Por que é o segundo melhor:** Responde a pergunta mais difícil em Agentic RAG — como treinar, não apenas como arquitetar.

---

### 3. RAG-Star — Renmin University (2024)
**O problema que resolve:** LLMs conflitam com documentos recuperados quando o conhecimento paramétrico contradiz o externo. O resultado são respostas inconsistentes ou alucinações.

**O que ele faz:** Usa Monte Carlo Tree Search para explorar o espaço de raciocínio. O RAG não injeta documentos no raciocínio — ele *verifica* cada passo do MCTS. Separa claramente: MCTS pensa, RAG confirma.

**Resultado:** +18,98% com Llama-3.1-8B. +16,19% com GPT-4o. Em múltiplos datasets de raciocínio complexo.

**Por que importa:** Conecta RAG ao paradigma de test-time compute scaling — a tendência mais quente em LLMs em 2025-2026. É o paper que aponta para onde o campo está indo.

---

### 4. FAIR-RAG — Sharif University (2025)
**O problema que resolve:** Em perguntas complexas que exigem múltiplos passos, o sistema não sabe o que ainda não sabe. Recupera documentos, encontra informação parcial, gera resposta com lacunas sem perceber.

**O que ele faz:** O módulo SEA (Structured Evidence Assessment) decompõe a query em um checklist de evidências necessárias, audita o que foi encontrado, identifica as lacunas explicitamente e direciona novas buscas especificamente para preencher essas lacunas.

**Resultado:** Estado da arte nos três principais benchmarks de multi-hop QA: HotpotQA (+8,3 pts), 2WikiMultiHopQA (+6,9 pts), MuSiQue.

**Por que importa:** É o sistema mais pronto para produção em casos enterprise críticos. Um sistema que sabe o que não sabe é fundamentalmente mais confiável.

---

### 5. Collab-RAG — Emory / Georgia Tech (2025)
**O problema que resolve:** Modelos grandes são caros. Fine-tuning é caro. Como construir um sistema RAG de alta qualidade sem pagar para treinar ou chamar um modelo de 70B+ parâmetros?

**O que ele faz:** Um SLM pequeno (3B parâmetros, white-box, treinável) decompõe queries complexas em sub-perguntas atômicas. Um LLM black-box (GPT-4o-mini) responde e dá feedback. O SLM aprende via preference optimization sem nenhuma anotação humana.

**Resultado:** SLM de 3B supera LLM frozen de 32B em decomposição de questões. +1,8% a +14,2% sobre baselines em 5 datasets multi-hop.

**Por que importa:** É o paper com maior potencial de adoção imediata. Especialização vence escala para subtarefas específicas — e custa uma fração do preço.

---

## As 7 Técnicas que Realmente Importam

### 1. Agentic RAG com DPO e supervisão de processo
Não é suficiente treinar o agente para dar a resposta certa. É necessário treiná-lo para dar os *passos* certos. DPO com process rewards (RAG-Gym) generaliza muito melhor que treinamento supervisionado simples por resultado final.

### 2. MCTS como mecanismo de raciocínio com RAG como verificador
A separação entre exploração (MCTS) e verificação (RAG) resolve o problema clássico de conflito entre conhecimento paramétrico e externo. RAG-Star mostra que essa arquitetura produz ganhos substanciais em raciocínio complexo.

### 3. Gap Analysis explícito — o sistema sabe o que não sabe
SEA (FAIR-RAG) transforma recuperação iterativa de "buscar mais coisas" para "buscar especificamente o que falta". É a diferença entre um pesquisador que vaga por uma biblioteca e um que tem uma lista de fontes específicas a encontrar.

### 4. Diversidade semântica como objetivo de recuperação
Top-k nearest neighbors é um proxy ruim para "os melhores documentos para responder esta pergunta". Vendi Score (Vendi-RAG) e submodular optimization (Beyond Nearest Neighbors) formalizam diversidade como objetivo de primeiro nível. Mais de 4% de ganho consistente em QA multi-hop.

### 5. Compressão de contexto no decoder (REFRAG)
Não é otimização marginal — é viabilidade econômica. 30x de aceleração muda a equação de custo de sistemas RAG com contexto longo. Combinável com qualquer técnica de retrieval.

### 6. Busca híbrida com múltiplos tipos de índice
BM25 + dense vector + sparse encoder combinados (Blended RAG) consistentemente superam qualquer índice individual e em alguns casos superam fine-tuning. É a intervenção de maior custo-benefício para sistemas já em produção.

### 7. Metadata como parte do embedding
Para domínios com corpora estruturados (financeiro, regulatório, jurídico), embeddings que incorporam metadata melhoram coesão intra-documento e reduzem confusão inter-documento. Unified embeddings (Utilizing Metadata) são mais simples de manter e frequentemente superiores a prefixo de texto.

---

## O RAG Ainda Faz Sentido?

**Sim. A pergunta errada é "usar RAG?". A pergunta certa é "qual geração de RAG?"**

| Geração | Características | Quando usar |
|---|---|---|
| RAG 1.0 — Naive | top-k → prompt direto | Protótipos, queries simples, FAQ |
| RAG 2.0 — Advanced | reranking, query rewrite, hybrid search | Produção atual, maioria dos casos |
| RAG 3.0 — Agentic | iterativo, autônomo, RL, multi-hop nativo | Queries complexas, raciocínio em cadeia |
| Engenharia de Contexto | RAG + memória + grafos + ferramentas | Sistemas agênticos de longo prazo |

O mercado confirma: aquisições bilionárias em 2024–2025, GraphRAG da Microsoft em produção, consolidação de camadas semânticas. Não é o sinal de uma tecnologia morrendo. É o sinal de uma tecnologia que está sendo levada a sério.

O que morreu é a ilusão de que RAG é simples. Nunca foi.

---

## O que Implementar Agora (Prioridade Decrescente)

**Impacto imediato sem mudar arquitetura:**
1. Busca híbrida — adicionar BM25 ao pgvector existente. Ganho garantido com baixo custo.
2. Metadata nos embeddings — para PDFs científicos, incluir título, autores e ano no embedding.
3. Reranking cross-encoder — adicionar um passo de reranking após recuperação vetorial.

**Próximo nível:**
4. Query rewriting — usar LLM para reformular a query antes de buscar.
5. Iteração com gap analysis — inspirado em FAIR-RAG: verificar se a resposta cobre a pergunta antes de gerar.

**Fronteira:**
6. Agente com DPO — treinar um SLM pequeno para decompor queries complexas (Collab-RAG).
7. REFRAG — quando latência se tornar o gargalo principal.

---

## Uma Linha por Artigo

| Artigo | Uma Linha |
|---|---|
| Lewis et al. 2020 | O paper que inventou RAG — memória paramétrica + não-paramétrica end-to-end |
| RAG Survey (Tongji/Fudan) | Naive/Advanced/Modular: o mapa de navegação padrão da área |
| RAG and Beyond (Microsoft) | Taxonomia de 4 níveis para saber qual arquitetura RAG escolher |
| Engineering the RAG Stack | O único survey focado em segurança e confiança para enterprise |
| O RAG está morto? | Diagnóstico do setor: RAG ingênuo morreu, RAG evoluído prospera |
| REFRAG (Meta) | 30x de aceleração de inferência sem perda de accuracy — infraestrutura do futuro |
| RAG-Gym | Como treinar Agentic RAG que generaliza: DPO com supervisão de processo |
| Auto-RAG | LLM decide autonomamente quando e o que buscar em múltiplos turnos |
| FAIR-RAG | O sistema sabe o que não sabe e busca exatamente isso — gap analysis |
| RAG-Star | MCTS pensa, RAG verifica: +19% em raciocínio complexo |
| Collab-RAG | SLM de 3B supera LLM frozen de 32B com preference optimization sem supervisão humana |
| Vendi-RAG | Vendi Score: diversidade + qualidade de forma iterativa e adaptativa |
| CARROT | Seleção de chunks é NP-hard — mais chunks podem degradar a resposta |
| Blended RAG | BM25 + dense + sparse: busca híbrida supera fine-tuning |
| Beyond Nearest Neighbors | Submodular optimization substitui top-k como paradigma de recuperação |
| IGMiRAG | Hypergraph hierárquico com diffusion bidirecional para raciocínio multi-granular |
| Utilizing Metadata | Metadata integrado ao embedding melhora coesão em corpora estruturados |
| MultiHop-RAG | Todos os LLMs falham em multi-hop — o benchmark que prova isso |
| BYOKG-RAG (Amazon) | Múltiplas estratégias de recuperação em grafos: +4,5 pts em 5 benchmarks |
| EVOR | RAG para código com bases de conhecimento que evoluem via feedback do compilador |
| RAG over Tables | Hipergrafo + multi-stage retrieval para corpora de tabelas enterprise |
| HAKES | Banco vetorial distribuído: 16x de throughput sobre concorrentes |
| GleanVec | Redução de dimensionalidade piecewise linear — sem hiperparâmetros |
| TigerVector | Busca vetorial nativa em grafo MPP com GSQL declarativo |
| In-Memory Graph Search | Taxonomia de 12 algoritmos: inserção incremental + diversificação vence em escala |
| RAGPart & RAGMask | Defesas contra envenenamento de corpus diretamente no retriever |
| Privacy in RAG | RAG vaza dados da base de recuperação mas protege dados de treinamento |
| Riddle Me This! | Ataque de membership inference furtivo: US$ 0,02 por documento, 30 queries |
| Enhancing Critical Thinking | Avisos personalizados de alucinação para usuários em contexto educacional |
| Ragas | Fidelidade + Relevância da Resposta + Relevância do Contexto — padrão de avaliação |
| LLM Deductive Coding | Codificação automática de diálogos com 96% de concordância com humanos |
| RETA-LLM | Toolkit modular de 5 componentes com verificação de fatos incluída |
| Developing RAG from PDFs | Guia prático: lições aprendidas construindo RAG sobre PDFs com GPT e Llama |
| LangChain vs DSPy (Medium) | ⚠️ DSPy descrito erroneamente; real DSPy = otimização declarativa de pipelines LLM (Stanford, Khattab 2023) |
| Telco-RAG | RAG para 3GPP: 90,8% de accuracy, 45% menos RAM com NN router |
| MUST-RAG | Base vetorial especializada em música: 82% vs. 39% sem RAG |
| RoleRAG | Fronteiras cognitivas do personagem: sabe o que não sabe e recusa responder |
| RAG for Fintech | Pipeline de 8 agentes para fintech com avaliação segura para dados confidenciais |
| Leveraging Generative AI | Data augmentation com LLM para classificação de comentários de código |
| PersonalAI | 6 algoritmos de travessia de grafo com hiper-arestas temporais para memória pessoal |
| Bhakti | Banco vetorial leve para protótipos — sem HNSW, sem scale |
| AR-RAG (Meta/VT) | Primeiro RAG no nível de patch para geração autorregressiva de imagens |
| Quantum Vector DB | Busca vetorial com algoritmo de Grover: O(√N) — teórico, futuro promissor |
