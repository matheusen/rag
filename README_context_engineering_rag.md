# README — RAG em Produção como Engenharia de Contexto
> Guia mestre para estudo, alinhamento técnico e construção da apresentação para a equipe

---

## Objetivo deste documento

Este README consolida a visão final do projeto de estudo sobre **RAG em produção**.

A ideia não é tratar RAG apenas como “buscar chunks e colocar no prompt”, mas como um problema mais amplo de **engenharia de contexto**:

- qual contexto precisa existir;
- onde esse contexto deve ser armazenado;
- como ele será selecionado;
- como será comprimido;
- como será isolado entre tarefas, agentes e estados;
- como tudo isso será avaliado, governado e protegido.

Este documento serve como ponte entre:

1. o **guide técnico**;
2. a **apresentação em slides**;
3. a **narrativa final** que será usada com a equipe.

---

# 1. Tese central

## Frase principal

**RAG em produção é um problema de engenharia de contexto.**

RAG continua importante, mas passa a ser entendido como uma **técnica dentro de uma camada maior de controle de contexto**.

Em sistemas reais, especialmente os que usam agentes, o desafio não é apenas recuperar informação semanticamente parecida. O desafio é:

- fornecer o contexto certo;
- no momento certo;
- na forma certa;
- com a granularidade certa;
- com custo, latência e risco aceitáveis.

---

# 2. Estrutura conceitual principal

## 2.1. Context Engineering

A moldura principal do material será baseada em quatro movimentos:

### Write
Escrever contexto fora da janela atual do modelo.

Exemplos:
- memória persistente;
- scratchpads;
- estado intermediário;
- facts store;
- resultados parciais de ferramentas;
- logs resumidos de execução.

### Select
Selecionar o contexto que deve entrar no passo atual.

Exemplos:
- RAG tradicional;
- hybrid retrieval;
- metadata-aware retrieval;
- graph retrieval;
- tool retrieval;
- memory retrieval.

### Compress
Comprimir o contexto para reduzir ruído, custo e conflito.

Exemplos:
- summarization;
- pruning;
- reranking;
- deduplicação;
- reordenação;
- compressão semântica.

### Isolate
Isolar contexto entre tarefas, subagentes, ferramentas e ambientes.

Exemplos:
- subagentes com contextos próprios;
- separação entre memória de longo prazo e contexto operacional;
- sandbox por ferramenta;
- state objects independentes;
- isolamento por domínio ou fluxo.

---

# 3. Como o guide técnico deve ser organizado

O guide não deve ser apenas uma introdução a RAG.  
Ele deve evoluir para um **manual de arquitetura de contexto para sistemas com LLM**.

## Estrutura recomendada do guide

### 1. Introdução
- O problema dos LLMs sozinhos
- Por que RAG surgiu
- Limites do RAG ingênuo
- A evolução para engenharia de contexto

### 2. Fundamentos
- O que é RAG
- Memória paramétrica vs memória contextual
- Tokenização e embeddings
- Vetores, retrieval e bancos vetoriais

### 3. Pipeline clássico
- ingestão;
- parsing;
- chunking;
- embeddings;
- indexação;
- retrieval;
- geração.

### 4. O que muda em produção
- retrieval como gargalo;
- qualidade do contexto;
- desambiguação;
- metadados;
- redundância;
- ordenação;
- custo e latência.

### 5. Context Engineering
- write;
- select;
- compress;
- isolate.

### 6. Retrieval moderno
- dense retrieval;
- sparse retrieval;
- hybrid retrieval;
- metadata-aware retrieval;
- reranking;
- coverage e diversidade;
- retrieval iterativo.

### 7. Arquiteturas de RAG
- standard RAG;
- conversational RAG;
- corrective RAG;
- adaptive RAG;
- agentic RAG;
- GraphRAG;
- table-aware RAG.

### 8. Falhas comuns
- chunk ruim;
- OCR ruim;
- contexto redundante;
- contexto irrelevante;
- contexto contraditório;
- “lost in the middle”;
- retrieval sem metadata;
- top-k semanticamente parecido, mas insuficiente.

### 9. Avaliação
- retrieval metrics;
- faithfulness;
- answer relevance;
- context relevance;
- Ragas;
- avaliação component-level;
- benchmark por tipo de pergunta.

### 10. Segurança, privacidade e governança
- corpus poisoning;
- membership inference;
- vazamento do retrieval DB;
- proveniência;
- controle de acesso;
- auditoria.

### 11. Decisão arquitetural
- quando usar Advanced RAG;
- quando usar GraphRAG;
- quando usar long context;
- quando usar fine-tuning;
- quando usar agentes;
- quando não usar RAG.

### 12. Cenário recomendado
- arquitetura escolhida;
- stack;
- trade-offs;
- roadmap de adoção.

---

# 4. O que o guide deve afirmar com clareza

O guide deve defender explicitamente as seguintes posições:

## 4.1. Retrieval é necessário, mas não suficiente
Recuperar “algo parecido” não garante contexto útil.

É preciso:
- filtrar;
- desambiguar;
- ordenar;
- medir;
- proteger.

## 4.2. Hybrid retrieval deve ser o padrão inicial
Para corpora reais, a combinação de:
- busca vetorial;
- sinais esparsos;
- metadados;
- reranking

tende a ser um ponto de partida melhor do que dense retrieval puro.

## 4.3. Metadata deve ser tratada como sinal de retrieval
Metadata não serve apenas para exibição ou filtro manual.

Ela deve ajudar a distinguir:
- empresa;
- ano;
- seção;
- tipo documental;
- entidade;
- produto;
- fonte;
- página;
- sistema de origem.

## 4.4. Multi-hop exige mais do que top-k
Perguntas complexas exigem:
- cobertura;
- diversidade;
- decomposição;
- refinement iterativo;
- análise de gaps de evidência.

## 4.5. Avaliação é parte da arquitetura
Não basta mostrar uma demo boa.

É preciso medir:
- contexto recuperado;
- fidelidade da resposta;
- robustez;
- latência;
- custo;
- segurança.

## 4.6. Segurança e privacidade são requisitos de arquitetura
Em produção, o datastore externo vira superfície de ataque.

Isso exige:
- controle de acesso;
- minimização de exposição;
- observabilidade;
- avaliação de ataques;
- governança.

## 4.7. OCR e parsing fazem parte do problema
Sem ingestão confiável, não existe retrieval confiável.

Em documentos corporativos reais, OCR, parsing de PDF, tabelas e leitura multimodal podem ser determinantes para a qualidade final.

---

# 5. O que deve mudar na apresentação

A apresentação deve deixar de ter como eixo principal:

- “tipos de RAG”

e passar a ter como eixo principal:

- **“como construir contexto confiável para LLMs em produção”**

## Estrutura recomendada da apresentação

### Slide 1 — Título
**RAG em Produção: de Retrieval para Engenharia de Contexto**

### Slide 2 — O problema
- LLM sozinho é limitado
- conhecimento desatualizado
- alucinação
- ausência de dados privados
- baixa auditabilidade

### Slide 3 — O que é RAG
- retrieval + geração
- memória contextual
- conceito base

### Slide 4 — O salto conceitual
**RAG é uma peça de Context Engineering**
- agentes exigem mais que retrieval
- o problema real é controlar contexto

### Slide 5 — Os 4 movimentos de Context Engineering
- write
- select
- compress
- isolate

### Slide 6 — O pipeline clássico
- ingestão
- parsing
- chunking
- embeddings
- indexação
- retrieval
- geração

### Slide 7 — Onde o RAG simples quebra
- perguntas multi-hop
- corpora ambíguos
- documentos técnicos
- tabelas
- OCR ruim
- redundância de contexto

### Slide 8 — O stack de produção
- ingestão e parsing
- metadata
- hybrid retrieval
- reranking
- evaluation
- observability
- security

### Slide 9 — Metadata não é detalhe
- metadata como sinal de retrieval
- melhora desambiguação
- melhora precisão prática

### Slide 10 — Quando subir de complexidade
- standard RAG
- advanced RAG
- adaptive / corrective
- agentic
- GraphRAG
- table-aware

### Slide 11 — Avaliação
- Ragas
- faithfulness
- answer relevance
- context relevance
- benchmark por tipo de query

### Slide 12 — Segurança e privacidade
- corpus poisoning
- membership inference
- vazamento do retrieval DB
- governança

### Slide 13 — RAG, long context, fine-tuning e agentes
- comparação de papéis
- complementaridade
- trade-offs

### Slide 14 — Arquitetura recomendada
- advanced RAG pragmático
- hybrid retrieval
- metadata
- reranking
- avaliação contínua
- OCR local forte para ingestão

### Slide 15 — Conclusão
**RAG em produção é engenharia de contexto**
- retrieval é só uma parte
- contexto precisa ser selecionado, comprimido, isolado e medido
- começar simples, evoluir com evidência

---

# 6. Recomendação final de arquitetura

## Ponto de partida recomendado

### Advanced RAG pragmático
- parsing forte;
- chunking semântico;
- metadata estruturada;
- embeddings densos;
- sparse retrieval/BM25;
- hybrid fusion;
- reranking;
- citações/proveniência;
- Ragas e avaliação contínua;
- observabilidade;
- controles de segurança.

## Quando subir para algo mais avançado
Subir apenas quando houver evidência clara de necessidade:

### Conversational RAG
Quando diálogo multi-turno for essencial.

### Corrective / Adaptive RAG
Quando a complexidade das consultas variar muito.

### Agentic / Iterative RAG
Quando as perguntas exigirem decomposição, multi-hop ou planejamento.

### GraphRAG
Quando o domínio depender fortemente de relações explícitas entre entidades.

### Table-aware RAG
Quando boa parte do conhecimento estiver em tabelas.

---

# 7. OCR e ingestão documental

Como camada de ingestão, a conclusão prática assumida neste material é:

- **GLM OCR** e **Chandra OCR 2** aparecem como opções fortes para OCR;
- para PDFs complexos, OCR não deve ser tratado como detalhe operacional;
- a qualidade do parsing influencia diretamente chunking, metadata, retrieval e grounding.

### Diretriz prática
Para bases com:
- PDFs digitalizados;
- tabelas complexas;
- múltiplas colunas;
- fórmulas;
- leitura visual difícil;

vale ter pipeline explícito de ingestão documental antes do RAG.

---

# 8. O que remover ou reduzir de peso

## No guide
Reduzir:
- densidade excessiva de teoria interna de LLM;
- claims muito absolutos;
- peso excessivo de DSPy/GEPA no corpo central.

## Na apresentação
Reduzir:
- slides em formato “catálogo de 9 arquiteturas”;
- foco exagerado em técnicas de fronteira;
- qualquer framing de que RAG “morreu”.

Substituir por:
- RAG evoluiu;
- retrieval continua importante;
- mas agora faz parte de uma camada maior de contexto.

---

# 9. Frases-chave para usar na fala

- “O problema real não é buscar texto; é controlar contexto.”
- “RAG em produção não é só retrieval, é engenharia de contexto.”
- “Contexto demais também piora resposta.”
- “Metadata não é detalhe; é sinal de recuperação.”
- “Avaliação não é etapa final, é parte da arquitetura.”
- “Sem parsing confiável, não existe retrieval confiável.”
- “Começamos com Advanced RAG pragmático e só aumentamos complexidade quando a query exige.”

---

# 10. Entregáveis derivados deste README

Este README deve gerar dois artefatos principais:

## A. Guide técnico
Um documento detalhado para estudo e referência interna, com:
- conceitos;
- pipeline;
- decisões arquiteturais;
- taxonomia;
- métricas;
- segurança;
- recomendações.

## B. Apresentação em slides
Um deck mais enxuto, orientado a narrativa, com:
- visão geral;
- problema;
- arquitetura;
- trade-offs;
- recomendação prática;
- próximos passos.

---

# 11. Resumo executivo

## O que fica
- RAG continua central;
- hybrid retrieval deve ser o padrão inicial;
- metadata, reranking e avaliação precisam subir de importância;
- GraphRAG e agentic RAG são evoluções úteis, mas não ponto de partida;
- OCR/parsing são parte do problema real;
- segurança e privacidade precisam entrar no desenho desde o início.

## Mensagem final
**O valor real de RAG em produção não está em usar um banco vetorial.  
Está em construir, controlar e avaliar o contexto certo para a pergunta certa.**

---
