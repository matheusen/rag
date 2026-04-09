# RAG — Retrieval-Augmented Generation
### Apresentação para a Equipe

> **Como usar este documento:** cada `##` é um tópico de apresentação. Os bullets abaixo são os pontos que você explica em voz alta. Os blocos em destaque são exemplos concretos para ilustrar.

---

## 1. O Problema — Por que LLM sozinho não basta

- **Conhecimento estático:** o modelo foi treinado até uma data de corte. Tudo que aconteceu depois ele não sabe.
- **Alucinação:** sem fatos reais para ancorar a resposta, o modelo inventa com confiança. Cita artigos que não existem, APIs que mudaram, números errados.
- **Dados privados:** o LLM nunca viu sua documentação interna, seus contratos, seus tickets, seus manuais.
- **Sem rastreabilidade:** você não consegue auditar de onde veio a informação. Em contextos jurídicos, médicos ou regulatórios, isso é inaceitável.

> **Exemplo concreto:**
> Pergunta: *"Qual a versão atual da nossa API de pagamentos?"*
> GPT-4 sem RAG → responde com base no que aprendeu no treino, que pode estar desatualizado.
> GPT-4 com RAG → busca no Confluence/Notion/PDF interno → cita o trecho exato → resposta correta e rastreável.

---

## 2. O que é RAG

- **RAG = Retrieval-Augmented Generation** — geração aumentada por recuperação.
- A ideia central: **antes de gerar a resposta, o sistema busca os documentos relevantes e os injeta no prompt do LLM como contexto.**
- O LLM não precisa mais "saber de cabeça" — ele lê os documentos em tempo real.
- RAG resolve os 3 problemas ao mesmo tempo: atualiza o conhecimento, ancora em fatos reais, suporta dados privados.
- Foi proposto pelo Facebook AI Research (Lewis et al., 2020) e hoje é o padrão de mercado para sistemas de QA sobre documentos.

> **Analogia:** imagine um médico numa prova oral. Sem RAG, ele responde só do que memorizou. Com RAG, ele tem os prontuários e literatura médica na mesa — responde com base nos dados reais do paciente.

---

## 3. Como Funciona — O Pipeline Completo

### Fase 1: Indexação (acontece uma vez, offline)

```
PDFs / Docs / Tickets
        ↓
   Loader (PyPDF, etc.)
        ↓
   Chunks (pedaços de ~512 tokens)
        ↓
   Modelo de Embedding → vetor numérico [0.12, -0.34, 0.89...]
        ↓
   Banco Vetorial (pgvector no PostgreSQL)
```

- **Chunk:** pedaço de texto de tamanho fixo (ex: 512 tokens ≈ 380 palavras). Cada chunk vira um vetor.
- **Embedding:** representação matemática do significado do texto. Frases semanticamente similares ficam próximas no espaço vetorial.
- **Banco vetorial:** armazena os vetores e permite busca por similaridade em milissegundos.

### Fase 2: Consulta (acontece a cada pergunta, online)

```
Pergunta do usuário
        ↓
   Embedding da pergunta → vetor
        ↓
   Busca por similaridade no pgvector (cosine distance)
        ↓
   Top-K chunks mais relevantes (ex: top-5)
        ↓
   Prompt = "Responda com base nesses documentos: {chunks} \n Pergunta: {pergunta}"
        ↓
   LLM gera a resposta fundamentada nos documentos reais
```

- A busca leva **~5–50ms** com índice HNSW no pgvector.
- O LLM recebe **apenas os trechos relevantes**, não o documento inteiro.
- Cada resposta pode citar a fonte (arquivo, página).

---

## 4. Tipos de RAG — Da Simples à Avançada

### Naive RAG (básico)
- Fluxo linear: indexa → busca → gera.
- Problemas: retriever pode trazer chunks irrelevantes, sem verificação de qualidade.
- **Ainda útil:** para protótipos e bases de conhecimento simples.

### Advanced RAG (atual padrão de mercado)
Adiciona etapas antes e depois da busca:

| Quando | Técnica | O que faz |
|--------|---------|-----------|
| Antes da busca | **HyDE** | LLM gera documento hipotético → usa embedding dele para buscar (mais preciso) |
| Antes da busca | **Query Expansion** | Gera variações da pergunta, busca todas, combina |
| Na busca | **Hybrid Search** | Combina busca vetorial (semântica) + BM25 (palavras exatas) |
| Depois da busca | **Reranking** | Cross-encoder reordena os candidatos (mais lento, muito mais preciso) |

### Conversational RAG (com memória)

- Resolve a "cegueira contextual" do RAG padrão: se o usuário perguntar "Quanto custa?", o sistema precisa saber a que "isso" se refere.
- Adiciona uma **camada de memória com estado** que armazena as últimas 5–10 interações da conversa.
- Antes de buscar, um LLM reescreve a query usando o histórico — transforma "Você pode redefini-la?" em "Você pode redefinir minha chave de API?".
- Indispensável para chatbots e assistentes com conversa multi-turno.
- **Risco:** desvio de memória — contexto antigo pode contaminar a busca atual.

### Corrective RAG — CRAG (autoverificação)

- Introduz um **"Portão de Decisão"** que avalia a qualidade dos documentos recuperados *antes* de enviá-los ao gerador.
- Score por documento: **Correto** → prossegue | **Ambíguo** → filtra | **Incorreto** → descarta e aciona fallback na web (ex: Tavily, Google Search API).
- Indicado para domínios de alto risco: financeiro, médico, jurídico.
- **Custo:** acrescenta 2–4 segundos de latência quando o fallback é acionado.

> **Exemplo:** chatbot financeiro perguntado sobre o preço de uma ação não indexada — CRAG percebe a ausência e busca o preço em tempo real via API externa, sem alucinar.

### Adaptive RAG (roteamento por complexidade)

- Usa um **classificador de intenção** para escolher o caminho mais eficiente:
  - **Caminho A (sem busca):** saudações ou conhecimento geral → LLM responde direto.
  - **Caminho B (RAG simples):** perguntas factuais diretas → busca única.
  - **Caminho C (multi-step agêntico):** perguntas analíticas complexas → pipeline completo.
- Reduz custo significativamente: 80% das queries vão para os caminhos A ou B.
- **Risco:** classificador mal calibrado categoriza perguntas difíceis como fáceis.

### Agentic RAG (mais sofisticado)
- O LLM age como um **agente com ferramentas de busca**.
- Decide **quando buscar**, **o que buscar** e **quantas rodadas** são necessárias.
- Faz buscas encadeadas: resposta de uma busca vira pergunta da próxima.
- Estado da arte para perguntas complexas que exigem múltiplas fontes.

---

## 5. As Técnicas Mais Importantes de 2024–2025

### Busca Híbrida + RRF (recomendado como padrão)
- **Busca vetorial (densa):** entende semântica — "carro" encontra "automóvel".
- **BM25 (esparsa):** frequência de termos — excelente para siglas, nomes próprios, IDs.
- **RRF (Reciprocal Rank Fusion):** combina os rankings dos dois sistemas matematicamente.
- **Resultado:** supera qualquer sistema isolado. IBM demonstrou que supera até fine-tuning específico de domínio.

### Reranking com Cross-Encoder
- Recupera top-50 candidatos com busca vetorial rápida.
- Cross-encoder analisa query + documento juntos (mais lento, muito mais preciso).
- Retorna top-5 para o LLM.
- **Modelos:** Cohere Rerank, BGE Reranker.

### FAIR-RAG — Gap Analysis Iterativo
- Após cada rodada de busca, verifica se a pergunta foi completamente respondida.
- Se não: identifica o que falta e busca especificamente isso.
- *"O sistema sabe exatamente o que não sabe."*
- **Resultado:** +8 pontos em HotpotQA (benchmark de multi-hop).

### REFRAG — Meta, 2025
- Comprime os chunks em embeddings **antes** de entrar no decoder do LLM.
- A atenção entre chunks é block-diagonal — a maioria do cross-attention é redundante.
- **Resultado: 30× aceleração de inferência sem nenhuma perda de accuracy.**
- Torna RAG com contextos muito longos economicamente viável.

### RAG-Gym — Aprendizado por Reforço
- Treina o agente RAG com DPO (Direct Preference Optimization).
- Supervisão nos **passos intermediários**, não só na resposta final.
- *"Ensina como raciocinar, não apenas o que responder."*
- **Resultado: +24% em generalização out-of-distribution.**

### GEPA + DSPy — Otimização Automática de Prompts

- **DSPy** trata o LLM como um "dispositivo programável": você declara *o que* entra e sai (Language Signatures), não *como* escrever o prompt. O framework compila e otimiza os prompts automaticamente.
- **GEPA (Genetic-Pareto Prompt Optimizer):** em vez de escrever prompts manualmente ou usar RL com recompensa escalar simples, o sistema usa **algoritmos genéticos** para evoluir os prompts ao longo do tempo.
  - Combina prompts bons para gerar prompts melhores (crossover genético).
  - Mantém múltiplos prompts eficazes via **Pareto optimization** — não apenas um vencedor.
  - Aprende com os próprios erros lendo feedback textual, como um mentor que analisa tentativas anteriores e propõe correções.
  - Constrói uma **árvore de evolução de prompts**: cada melhoria cresce como um ramo, acumulando ganhos progressivos.
- **Resultado empírico:** 35× mais eficiente que MIPROv2, prompts 9× menores com 10% mais performance.
- **Posição no stack:** alternativa ao Prompt Engineering manual — escala automaticamente com dados de avaliação, sem retreinar o modelo.

---

## 6. GraphRAG — Quando as Relações Importam

- Busca vetorial responde: *"qual o conteúdo deste chunk?"*
- GraphRAG responde: *"qual a **relação** entre entidade A e entidade B?"*

### Os 4 tipos de grafo em RAG

| Tipo | Estrutura | Melhor para |
|------|-----------|-------------|
| **Knowledge Graph** | Triplas (sujeito→predicado→objeto) | Semântica formal, raciocínio simbólico |
| **Property Graph** | Nós/arestas com atributos | Dados flexíveis com metadados ricos |
| **Hypergraph** | Uma aresta conecta N nós | Relações N-árias complexas |
| **Hierarchical (RAPTOR)** | Árvore de resumos | Perguntas abstratas vs. específicas |

### Microsoft GraphRAG (open-source)
1. Extrai entidades e relações de todos os documentos → constrói Knowledge Graph
2. Detecta comunidades no grafo (algoritmo Leiden)
3. Gera resumo para cada comunidade
4. Query → encontra comunidades relevantes → responde com os resumos

> **Exemplo:** *"Quais são as relações entre os times de backend e as falhas no módulo de pagamentos nos últimos 3 meses?"*
> Busca vetorial: recupera chunks isolados sem ver a cadeia causal.
> GraphRAG: percorre o grafo time → serviço → falha → causa raiz.

### Quando usar grafo vs. vetorial

- **Vetorial:** FAQs, documentação simples, consultas locais → mais rápido e barato.
- **Grafo:** domínios relacionais (médico, jurídico, financeiro), perguntas multi-hop, análise de "quem se conecta com quem".

---

## 7. Long Context vs. RAG — A Questão do Gemini 1M Tokens

### A pergunta que todo mundo faz
*"Se o Gemini tem 1 milhão de tokens de contexto, por que construir RAG?"*

### A resposta em números

| Cenário | Custo/dia (1.000 queries) | Custo/mês |
|---------|--------------------------|-----------|
| RAG (top-5 chunks, ~5k tokens) | ~$2 | ~$60 |
| Long context (1M tokens) | ~$3.500 | ~$105.000 |
| **Diferença** | **1.750× mais caro** | |

### As 6 razões pelas quais RAG ainda vence

1. **Custo:** 1.750× mais barato — para qualquer volume real, encerra a discussão.
2. **Latência:** atenção é O(n²) — TTFT com 1M tokens leva 30–60 segundos. RAG: <1s.
3. **Lost in the Middle:** modelos prestam mais atenção às bordas do contexto, mesmo com janela grande.
4. **Escala:** empresa média tem milhões de documentos — não cabe em context window nenhuma.
5. **Privacidade:** long context = enviar TODA a base para uma API a cada chamada.
6. **Explicabilidade:** RAG cita a fonte de cada afirmação. Long context alucinando, não há rastreamento.

### Quando long context ganha
- Menos de 100 documentos curtos, queries esporádicas → manda tudo direto.
- Raciocínio global obrigatório → resumir TODOS os documentos, encontrar contradições.
- Prototipagem rápida → sem infraestrutura de embedding e banco vetorial.

> **Conclusão:** long context para raciocínio **interno**. RAG para acesso a conhecimento **externo**.

---

## 8. Guia de Decisão — Quando Usar RAG

```
Precisa de dados privados/internos?
    ├── SIM → RAG obrigatório
    └── NÃO ↓

A informação muda frequentemente?
    ├── SIM → RAG (atualiza sem retreinar)
    └── NÃO ↓

Precisa citar a fonte da resposta?
    ├── SIM → RAG (auditabilidade)
    └── NÃO ↓

São menos de ~50 documentos curtos?
    ├── SIM → Long context direto (mais simples)
    └── NÃO → RAG (escala e custo)
```

### RAG vs. Fine-tuning vs. Prompt Engineering vs. DSPy/GEPA

| Critério | Prompt Eng. | DSPy/GEPA | RAG | Fine-tuning |
| -------- | ----------- | --------- | --- | ----------- |
| Conhecimento atualizado | ✗ | ✗ | ✓ | ✗ (congelado) |
| Custo de setup | Baixo | Baixo–Médio | Médio | Alto |
| Custo de inferência | Baixo | Baixo | Médio | Baixo |
| Citação de fontes | ✗ | ✗ | ✓ | ✗ |
| Privacidade de dados | Média | Média | Alta | Média |
| Velocidade de atualização | Imediata | Imediata | Imediata | Dias/semanas |
| Otimização automática de prompts | ✗ | ✓ | ✗ | ✗ |
| Requer dados de avaliação | ✗ | ✓ (poucos) | ✗ | ✓ (muitos) |

**Regra prática:** comece com Prompt Engineering → adicione DSPy/GEPA se quiser otimizar prompts automaticamente sem retreinar → adicione RAG quando precisar de dados externos/privados → adicione Fine-tuning quando precisar mudar o comportamento estrutural do modelo.

### Framework de Decisão — Qual Arquitetura RAG Usar (5 passos)

**Passo 1 — Comece com Standard RAG.** Sem evidência de que não vai funcionar, comece aqui. Dominar chunking, embedding e avaliação antes de adicionar complexidade.

**Passo 2 — Adicione memória *só* se necessário.** Usuários fazem perguntas de acompanhamento? → RAG Conversacional. Caso contrário, ignore.

**Passo 3 — Adeque ao perfil real das queries:**

| Perfil da query | Arquitetura recomendada |
| --------------- | ----------------------- |
| Simples e diretas | Standard RAG |
| Complexidade muito variável | Adaptive RAG |
| Alto risco, precisão crítica | Corrective RAG (CRAG) |
| Pesquisa aberta, multi-hop | Agentic RAG |
| Terminologia ambígua do usuário | Fusion RAG |
| Relações entre entidades | GraphRAG |

**Passo 4 — Considere restrições:**

- Orçamento apertado → Standard RAG + otimize o retrieval. Evite Self-RAG e Agentic RAG.
- Velocidade crítica → Standard ou Adaptive. Evite CRAG com fallback externo.
- Precisão máxima → CRAG ou GraphRAG, independentemente do custo.

**Passo 5 — Combine arquiteturas.** Em produção, as melhores implementações combinam:

- **Standard + CRAG:** 95% das queries rápidas, 5% verificadas com fallback.
- **Adaptive + GraphRAG:** queries simples usam vetores, complexas usam grafo.
- **Fusion + Conversacional:** variações de query com memória de sessão.

---

## 9. Nossa Stack Técnica

### Banco de Dados Vetorial — pgvector
- Extensão nativa do **PostgreSQL** — não é um banco separado.
- Tipo `vector(768)` para armazenar embeddings.
- **Índice HNSW:** busca em O(log n), muito mais rápida que sequential scan.
- Operadores: `<=>` (cosine), `<->` (euclidiana), `<#>` (produto interno).

### Framework RAG — LangChain
- Orquestração explícita do pipeline: Loader → Splitter → Embedder → VectorStore → Chain.
- `PGVector` para integração com PostgreSQL.
- `create_retrieval_chain` monta o fluxo completo.
- Alternativa para indexação rica: **LlamaIndex** (melhor para estruturas de documento complexas).

### OCR multimodal local — GLM OCR + Chandra 2
- Modelos OCR locais entram para screenshots, figuras e PDFs com conteúdo visual relevante.
- Cada imagem extraída vira um **asset relacionado ao documento pai** por arquivo e página.
- O banco salva: **nome da imagem, bytes, texto OCR, embedding próprio e metadados**.
- Na consulta, os chunks OCR concorrem com os chunks textuais no mesmo retrieval híbrido.

### Modelo de Embedding — nomic-embed-text
- 768 dimensões, roda local via **Ollama** (sem custo de API).
- Alternativa paga com maior qualidade: `text-embedding-3-small` (OpenAI, 1536 dims).

### LLM — llama3.2 via Ollama
- Roda localmente — zero custo de API, zero envio de dados para terceiros.
- Para produção com maior qualidade: GPT-4o, Gemini 1.5 Pro, Claude 3.5 Sonnet.

### Observabilidade — OpenTelemetry + Grafana Stack
- **Traces:** Jaeger + Grafana Tempo → rastreia cada query end-to-end.
- **Métricas:** Prometheus + Grafana → latência p95, throughput, erros.
- **Logs:** Loki + Promtail → logs estruturados com correlação de trace_id.

---

## 10. Padrão Map-Reduce — Para Analisar Muitos Documentos

### O problema
- RAG padrão seleciona por similaridade → pode ignorar documentos menos similares mas relevantes.
- Long context para tudo → 1.750× mais caro.

### A solução: dois níveis de leitura

**Na indexação (uma vez por conjunto):**
- Para cada documento, um modelo barato gera um **resumo de 1 chunk**.
- O banco armazena: resumo (leitura rápida) + chunks detalhados (leitura profunda).

**Na consulta:**
- Pergunta específica → RAG padrão nos chunks detalhados.
- Análise completa → lê os **resumos de todos os documentos** → identifica os mais relevantes → detalha só esses.

### Custo comparado — 10 documentos

| Abordagem | Tokens/query | Custo aprox. | Cobertura |
|-----------|-------------|-------------|-----------|
| Long context (tudo) | ~500k | ~$1,75 | 100% |
| RAG padrão (top-5) | ~5k | ~$0,002 | 60–80% |
| Map-Reduce hierárquico | ~30k | ~$0,05 | ~95% |

> **95% de cobertura por 3% do custo do long context.**

---

## 11. Avaliação — Como Medir se o RAG Está Funcionando

### Métricas do Retriever (a busca)
- **Recall@K:** dos documentos relevantes existentes, quantos o retriever trouxe no top-K?
- **Precision@K:** dos K documentos trazidos, quantos são realmente relevantes?
- **MRR:** o primeiro documento relevante está em qual posição?

### Métricas do Generator (a resposta) — Framework RAGAS
- **Faithfulness:** a resposta é fiel aos documentos recuperados? Detecta alucinações.
  - `Faithfulness = afirmações_suportadas / total_afirmações_na_resposta`
- **Answer Relevancy:** a resposta endereça a pergunta ou desvia do tema?
- **Context Relevancy:** o contexto recuperado é focado ou cheio de ruído?

### Pipeline de avaliação em produção
```
Métricas automáticas (Recall, F1)  → monitoramento contínuo em tempo real
LLM-as-a-judge (RAGAS, GPT-4-eval) → avaliação periódica semanal/mensal
Avaliação humana                   → decisões de arquitetura e roadmap
```

---

## 12. Próximos Passos — Roadmap

### Curto prazo (imediato)
- **Busca híbrida como padrão:** combinar vetorial + BM25 em todas as queries.
- **Reranking:** adicionar Cohere Rerank ou BGE Reranker após o retrieval.
- **Metadados estruturados:** filtrar por arquivo, data, departamento antes de buscar.

### Médio prazo
- **Agentic RAG:** agente que decide quando buscar e faz multi-hop.
- **GraphRAG:** para domínios com muitas relações (ex: dependências entre serviços, histórico de bugs).
- **Avaliação automatizada:** pipeline RAGAS rodando em CI para cada mudança.

### Longo prazo
- **Multimodal RAG completo:** expandir de OCR textual para captions, diagramas e page-renders de documentos inteiros.
- **REFRAG:** compressão de contexto para queries com muitos documentos (Meta, 2025).
- **OCR local integrado:** consolidar GLM OCR + Chandra 2 em todos os fluxos visuais do corpus.

---

## 13. Cenário Escolhido Neste Projeto

### Escolha
- **Advanced RAG híbrido, hierárquico, coverage-aware e multimodal leve**, com **LangChain** como pipeline principal.

### O que entrou na implementação
- **Retrieval denso + busca lexical** com fusão por **RRF**.
- **Resumo por documento + chunks detalhados** para perguntas amplas sem custo de long context.
- **OCR local para imagens** com GLM OCR + Chandra 2 quando houver evidência visual relevante.
- **Tabela relacional para imagens extraídas**, com nome da imagem, bytes, texto OCR e embedding próprio.
- **Relação com o documento principal** por `source` e página, para recuperar texto e imagem no mesmo fluxo.
- **Coverage mode** para triagem por documento antes de buscar os trechos finos.
- **Resposta com fontes obrigatórias** e metadados de retrieval na API.
- **Ingestão por documento com hash**, sem apagar a coleção inteira a cada arquivo novo.

### Por que esse foi o melhor cenário
- **Maior precisão** que o RAG ingênuo sem depender de um agente completo em toda consulta.
- **Menor risco de perder documento relevante**, porque toda a base pode ser triada primeiro no nível de resumo.
- **Menor risco de perder evidência visual**, porque imagens relevantes também entram no índice com OCR e embedding.
- **Menos alucinação**, porque a resposta vem ancorada em contexto recuperado e retorna fonte.
- **Custo e latência controlados**, bem abaixo de long context bruto ou loops agênticos permanentes.

### O que ficou fora do padrão inicial
- **Naive RAG:** simples demais para produção.
- **GraphRAG:** reservado para domínios realmente relacionais.
- **Agentic RAG completo:** próximo passo, depois que o retrieval híbrido estiver bem medido.

---

## Resumo Final — Os 7 Pontos Que Ficam

1. **RAG não é opcional para dados privados** — o LLM não foi treinado no seu sistema.
2. **Qualidade do retrieval determina a qualidade da resposta** — garbage in, garbage out.
3. **Busca híbrida (vetorial + BM25) deve ser o padrão**, não a exceção.
4. **Long context não substitui RAG** — 1.750× mais caro e com problemas de latência, privacidade e escala.
5. **Não existe uma única arquitetura RAG** — Conversacional, CRAG, Adaptive, Agentic e GraphRAG resolvem problemas diferentes; escolher a errada custa meses.
6. **Comece simples, aumente complexidade só com evidência** — Standard RAG primeiro; adicione camadas quando medir que são necessárias.
7. **Prompt Engineering pode ser automatizado** — DSPy/GEPA evolui prompts como código, 35× mais eficiente que otimização manual, sem retreinar o modelo.

---

*Baseado em análise de 43+ artigos científicos (2023–2025) e artigos de referência — REFRAG (Meta), RAG-Gym (UVA/NIH), FAIR-RAG (Sharif), RAG-Star (Renmin University), IBM Blended RAG, DSPy/GEPA (Stanford/CMU), e outros.*
