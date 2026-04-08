# RAG System com PostgreSQL + pgvector

Projeto de RAG com dois fluxos paralelos para comparacao e aprendizado:

- **LangChain** — pipeline principal com ingestão segura por documento, índice de resumos, OCR local para imagens, retrieval híbrido e coverage mode
- **LlamaIndex** — baseline vetorial com `PGVectorStore` + `RetrieverQueryEngine`

Ambos usam:

- PostgreSQL 16 + pgvector (embeddings vetoriais)
- SQLAlchemy 2.x (ORM e inspeção das tabelas)
- Ollama local (LLM e embeddings sem custo de API)
- FastAPI (backend REST)
- Next.js 16 (frontend de estudo e chat)

Stack de observabilidade completa:

- OpenTelemetry (traces distribuídos)
- Jaeger (UI de traces)
- Grafana + Tempo + Loki + Prometheus (métricas, logs e traces unificados)

---

## Cenário escolhido

O cenário escolhido para este projeto foi **Advanced RAG híbrido, hierárquico e coverage-aware com LangChain como orquestrador principal**.

O que entra nesse cenário:

- **retrieval denso + busca lexical** com fusão por **RRF**
- **resumo por documento + chunks detalhados** para cobrir perguntas amplas sem mandar tudo ao LLM
- **OCR local com GLM + Chandra 2** para imagens e páginas visualmente ricas
- **tabelas relacionais para imagens OCR + embeddings próprios**, ligadas ao documento pai por `source_key` e página
- **coverage mode** para triagem por documento antes da busca detalhada
- **resposta com fontes obrigatórias** e metadados de retrieval na API
- **ingestão por documento com hash**, sem apagar a coleção inteira a cada novo arquivo

Por que esta foi a escolha:

- entrega mais precisão do que RAG ingênuo sem o custo e a complexidade de um Agentic RAG completo
- reduz a chance de perder documentos relevantes porque todo documento pode ser triado pelo resumo
- reduz alucinação com abstention explícita e fonte retornada junto com a resposta
- preserva custo e latência melhores do que long context bruto ou loops agênticos em toda query

O que não virou padrão inicial:

- **Naive RAG**: simples demais para produção
- **GraphRAG**: excelente para domínios relacionais, mas overkill para o corpus documental atual
- **Agentic RAG completo**: melhor deixar para a próxima etapa, depois que o retrieval híbrido estiver bem medido

---

## Estrutura do projeto

```
rag/
├── api/
│   ├── main.py              — FastAPI, CORS, OTel, Prometheus /metrics
│   ├── Dockerfile           — imagem da API para o docker compose
│   ├── telemetry.py         — setup OpenTelemetry + logging JSON
│   ├── schemas.py           — modelos Pydantic
│   └── routers/
│       ├── langchain.py     — endpoints /langchain/*
│       ├── llamaindex.py    — endpoints /llamaindex/*
│       └── sqlalchemy.py    — endpoints /sqlalchemy/*
├── rag/
│   ├── langchain/
│   │   ├── advanced.py      — ingestão segura, OCR relacional, retrieval híbrido e coverage mode
│   │   ├── ingest.py        — wrapper CLI/API para ingestão por documento
│   │   ├── ocr.py           — extração de imagens + roteamento OCR local
│   │   └── query.py         — consulta avançada com fontes e metadados
│   └── llamaindex/
│       ├── ingest.py        — ingestão PDF → nodes → PGVectorStore
│       └── query.py         — RetrieverQueryEngine baseline com fontes mínimas
├── frontend/                — Next.js 16 (App Router + Tailwind)
│   └── app/
│       ├── explorer/        — inspetor SQLAlchemy (artigos/chunks)
│       ├── chat/            — chat RAG (LangChain ou LlamaIndex)
│       └── guide/           — guia de conceitos + treinador de entrevista
├── observability/
│   ├── otel-collector-config.yaml
│   ├── tempo-config.yaml
│   ├── loki-config.yaml
│   ├── promtail-config.yaml
│   ├── prometheus.yml
│   └── grafana/provisioning/datasources/datasources.yaml
├── requirements-ocr.txt     — dependências opcionais para GLM OCR + Chandra 2
├── artigos/                 — PDFs da base documental
├── logs/                    — logs JSON do FastAPI (lidos pelo Promtail)
├── docker-compose.yml       — todos os serviços
└── .env                     — variáveis de ambiente
```

---

## Requisitos

- Python 3.11+
- Docker Desktop
- Node.js 18+

---

## 1. Subir toda a infra com Docker Compose

O `docker-compose.yml` sobe todos os serviços necessários:

| Container | Imagem | Porta | Função |
|---|---|---|---|
| `rag-postgres` | pgvector/pgvector:pg16 | 5433 | PostgreSQL + pgvector |
| `rag-ollama` | ollama/ollama:latest | 11434 | LLMs locais |
| `rag-api` | build local (`api/Dockerfile`) | 8000 | FastAPI na mesma rede da observabilidade |
| `rag-otel-collector` | otel/opentelemetry-collector-contrib | 4317, 4318, 8888, 8889 | Hub de traces + spanmetrics |
| `rag-jaeger` | jaegertracing/all-in-one | 16686 | UI de traces |
| `rag-tempo` | grafana/tempo:2.7.2 | 3200 | Backend de traces |
| `rag-prometheus` | prom/prometheus | 9090 | Coleta de métricas |
| `rag-loki` | grafana/loki | 3100 | Agregação de logs |
| `rag-promtail` | grafana/promtail | — | Agente de coleta de logs |
| `rag-grafana` | grafana/grafana | 3030 | UI unificada |
| `rag-pgadmin` | dpage/pgadmin4:latest | 5050 | UI web para administrar o PostgreSQL 16 |

```powershell
docker compose up -d
```

UIs principais após o boot:

- API: http://localhost:8000/docs
- Grafana: http://localhost:3030
- Jaeger: http://localhost:16686
- Prometheus: http://localhost:9090
- pgAdmin: http://localhost:5050
- Abre em modo desktop, sem tela de login separada
- O servidor `RAG PostgreSQL 16` já aparece pré-configurado e detecta automaticamente o PostgreSQL 16 do container.

Verificar se todos estão rodando:

```powershell
docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
```

---

## 2. Baixar os modelos Ollama

Na primeira vez, é necessário baixar os modelos dentro do container:

```powershell
# Modelo de embeddings (768 dimensões — compatível com o schema do pgvector)
docker exec rag-ollama ollama pull nomic-embed-text

# LLM para geração de respostas
docker exec rag-ollama ollama pull llama3.2
```

Verificar modelos disponíveis:

```powershell
docker exec rag-ollama ollama list
```

---

## 3. Configurar o ambiente Python

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Opcional: OCR local para imagens e PDFs escaneados
pip install -r requirements-ocr.txt
```

---

## 4. Configurar o .env

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DB=ragsys
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Ollama local (Docker)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_LLM_MODEL=llama3.2

# OpenTelemetry
OTEL_SERVICE_NAME=rag-system
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# OCR local (opcional)
RAG_OCR_ENABLED=true
RAG_OCR_BACKENDS=chandra2,glm
RAG_OCR_CHANDRA_ENABLED=true
RAG_OCR_GLM_ENABLED=true
RAG_OCR_GLM_MODEL_ID=seu-modelo-glm-ocr-local-no-hf
RAG_OCR_LOCAL_FILES_ONLY=true
```

No `docker compose`, a API sobrescreve automaticamente `POSTGRES_HOST`, `OLLAMA_BASE_URL`, `OTEL_EXPORTER_OTLP_ENDPOINT` e `OTEL_SERVICE_NAME` para usar os nomes internos da rede Docker.

---

## 5. Habilitar a extensão pgvector

```powershell
docker exec rag-postgres psql -U postgres -d ragsys -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Verificar:

```sql
SELECT extname FROM pg_extension WHERE extname = 'vector';
```

---

## 6. Ingestão de documentos

Coloque documentos na pasta `artigos/` e execute. O pipeline do LangChain agora aceita PDF, texto e imagens (`png`, `jpg`, `webp`, `tiff`). Quando OCR local estiver configurado, imagens extraídas do PDF e arquivos de imagem geram registros próprios em tabelas relacionais com embeddings separados.

### LangChain

```powershell
.\.venv\Scripts\python.exe -m rag.langchain.ingest artigos
```

Reprocessar arquivos mesmo que o hash não tenha mudado:

```powershell
.\.venv\Scripts\python.exe -m rag.langchain.ingest artigos --reset
```

### LlamaIndex

```powershell
.\.venv\Scripts\python.exe -m rag.llamaindex.ingest artigos
```

Ingerir um único PDF:

```powershell
.\.venv\Scripts\python.exe -m rag.langchain.ingest ".\artigos\meu-artigo.pdf"
```

Ingerir uma imagem isolada com OCR:

```powershell
.\.venv\Scripts\python.exe -m rag.langchain.ingest ".\artigos\screenshot-erro.png"
```

---

## 7. API FastAPI

Ao subir o `docker compose`, a API já entra na mesma rede do PostgreSQL, Ollama, OTel Collector, Prometheus, Loki e Grafana.

```powershell
docker compose up -d api
```

Se preferir rodar a API fora do Docker durante desenvolvimento:

```powershell
.\.venv\Scripts\uvicorn.exe api.main:app --reload --port 8000
```

Endpoints disponíveis:

- Swagger UI: `http://localhost:8000/docs`
- Health check: `GET http://localhost:8000/health`
- Métricas Prometheus: `GET http://localhost:8000/metrics`

---

## 8. Testar queries via terminal

### LangChain

```powershell
.\.venv\Scripts\python.exe -m rag.langchain.query "O que e RAG e como funciona?"
```

Para perguntas amplas, o endpoint do LangChain pode ativar triagem por documento (`coverage_mode`) antes da busca detalhada.

### LlamaIndex

```powershell
.\.venv\Scripts\python.exe -m rag.llamaindex.query "Quais artigos falam sobre diffusion models?"
```

---

## 9. Testar via API (PowerShell)

```powershell
# LangChain
Invoke-RestMethod -Method Post `
    -Uri "http://localhost:8000/langchain/query" `
    -ContentType "application/json" `
    -Body '{"question":"Qual o melhor cenario de RAG para esta base?","k":4,"coverage_mode":true}'

# LlamaIndex
Invoke-RestMethod -Method Post `
    -Uri "http://localhost:8000/llamaindex/query" `
    -ContentType "application/json" `
    -Body '{"question":"O que e diffusion-based AI?","k":4}'

# Listar artigos
Invoke-RestMethod -Method Get -Uri "http://localhost:8000/sqlalchemy/articles"

# Listar chunks de um artigo
Invoke-RestMethod -Method Get `
    -Uri "http://localhost:8000/sqlalchemy/chunks?article=Diffusion&limit=5"
```

---

## 10. Frontend Next.js

```powershell
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:3001` (ou 3000 se não estiver ocupada).

### Páginas disponíveis

| Rota | Função |
|---|---|
| `/guide` | Guia de conceitos RAG + treinador de perguntas para entrevista |
| `/chat` | Chat com a base de conhecimento (LangChain ou LlamaIndex) |
| `/explorer` | Inspetor SQLAlchemy: artigos → chunks → embedding preview |

---

## 11. Observabilidade — como ver os dados

### Fluxo de dados

```
FastAPI (8000)
  ├── OTLP HTTP ──▶ OTel Collector (4318) ──▶ Jaeger  (16686)
  │                                        ──▶ Tempo   (3200) → Grafana
  ├── /metrics ◀── Prometheus (9090)  → Grafana
  └── logs/api.log ◀── Promtail → Loki (3100) → Grafana
```

### UIs

| URL | O que ver |
|---|---|
| `http://localhost:3030` | **Grafana** — dashboard unificado (traces + metrics + logs) |
| `http://localhost:16686` | **Jaeger** — busca de traces por serviço/operação |
| `http://localhost:9090` | **Prometheus** — explorar métricas com PromQL |

### Ver traces no Jaeger

1. Abra `http://localhost:16686`
2. Em **Service** selecione `rag-api`
3. Clique **Find Traces**
4. Clique em qualquer trace para ver os spans aninhados

Cada requisição `POST /langchain/query` gera uma árvore de spans:

```
HTTP POST /langchain/query          (FastAPIInstrumentor)
  └── langchain.rag.query           (span manual — question, k, framework)
        └── langchain.chain.invoke  (span manual — chunks_retrieved)
              └── SELECT ...        (SQLAlchemyInstrumentor — query SQL)
```

### Ver traces no Grafana Tempo

1. Abra `http://localhost:3030`
2. Vá em **Explore** → selecione datasource **Tempo**
3. Use **Search** → Service Name: `rag-api`
4. Clique num trace para ver o flamegraph de spans

Diferencial do Tempo vs Jaeger: ao clicar num span, aparece botão **Logs** que abre os logs do mesmo período no Loki (correlação automática).

### Ver métricas no Prometheus

1. Abra `http://localhost:9090`
2. Em **Expression** insira uma PromQL:

```promql
# Taxa de requisições por segundo
rate(http_requests_total{job="rag-api"}[5m])

# Latência p95 dos endpoints
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Quantidade total de queries LangChain
http_requests_total{handler="/langchain/query"}
```

### Ver métricas no Grafana

1. Abra `http://localhost:3030`
2. Vá em **Explore** → selecione datasource **Prometheus**
3. Cole qualquer PromQL do exemplo acima

Para criar um dashboard:

1. Clique em **+** → **New Dashboard** → **Add visualization**
2. Selecione **Prometheus** como datasource
3. Use a PromQL desejada

### Ver logs no Grafana Loki

Os logs do FastAPI são escritos como JSON em `logs/api.log` e coletados pelo Promtail.

1. Abra `http://localhost:3030`
2. Vá em **Explore** → selecione datasource **Loki**
3. Use LogQL:

```logql
# Todos os logs do serviço
{job="rag-api"}

# Apenas erros
{job="rag-api"} | json | level="ERROR"

# Logs de um período específico com filtro por texto
{job="rag-api"} | json | line_format "{{.message}}" |= "query"
```

### Correlação Logs ↔ Traces

Ao ver um log no Loki que contenha `trace_id`, aparece um botão **Tempo** para abrir o trace correspondente — e vice-versa.

---

## 12. Queries SQL diretas no PostgreSQL

Abrir shell SQL:

```powershell
docker exec -it rag-postgres psql -U postgres -d ragsys
```

### Ver artigos ingeridos

```sql
SELECT DISTINCT cmetadata->>'source' AS fonte, COUNT(*) AS chunks
FROM langchain_pg_embedding
GROUP BY fonte
ORDER BY chunks DESC;
```

### Ver chunks de um artigo

```sql
SELECT
    id,
    cmetadata->>'page' AS pagina,
    LEFT(document, 200) AS trecho
FROM langchain_pg_embedding
WHERE cmetadata->>'source' ILIKE '%Diffusion%'
ORDER BY (cmetadata->>'page')::int, id;
```

### Busca semântica manual (pgvector)

```sql
-- Os k=4 chunks mais similares a um vetor de consulta (substitua pelo vetor real)
SELECT id, LEFT(document, 150) AS trecho
FROM langchain_pg_embedding
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 4;
```

### Contagem geral

```powershell
docker exec rag-postgres psql -U postgres -d ragsys `
    -c "SELECT COUNT(*) FROM langchain_pg_embedding;"
```

---

## 13. Fluxo completo de início do zero

```powershell
# 1. Subir infraestrutura
docker compose up -d

# 2. Baixar modelos Ollama (primeira vez)
docker exec rag-ollama ollama pull nomic-embed-text
docker exec rag-ollama ollama pull llama3.2

# 3. Ambiente Python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 4. Extensão pgvector
docker exec rag-postgres psql -U postgres -d ragsys -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 5. Ingestão
.\.venv\Scripts\python.exe -m rag.langchain.ingest artigos

# 6. Frontend (outro terminal)
cd frontend; npm install; npm run dev
```

Acessos após o boot:

| URL | Serviço |
|---|---|
| http://localhost:8000/docs | FastAPI Swagger |
| http://localhost:3001 | Frontend Next.js |
| http://localhost:3030 | Grafana (traces + logs + metrics) |
| http://localhost:16686 | Jaeger (traces) |
| http://localhost:9090 | Prometheus (metrics) |

---

## Tabelas criadas automaticamente

| Tabela | Framework | Descrição |
|---|---|---|
| `langchain_pg_collection` | LangChain | namespaces de coleções |
| `langchain_pg_embedding` | LangChain | chunks + embeddings + metadados |
| `rag_document_registry` | LangChain | registro por documento com hash, resumo e embedding do resumo |
| `rag_document_image_asset` | LangChain | imagens extraídas + OCR + vínculo com documento pai |
| `rag_document_image_embedding` | LangChain | chunks OCR de imagem com embeddings próprios |
| `llamaindex_documents` | LlamaIndex | nodes + embeddings |

Cada artigo PDF gera múltiplos chunks. Imagens relevantes entram em tabelas próprias e são recuperadas junto com os chunks textuais pelo mesmo retrieval híbrido.