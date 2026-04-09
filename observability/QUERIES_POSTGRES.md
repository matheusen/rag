# Queries PostgreSQL — RAG System

Consultas puras para inspecionar os dados do pgvector diretamente no banco.

**Conectar ao banco:**
```powershell
docker exec -it rag-postgres psql -U postgres -d ragsys
```

Ou via `psql` local na porta 5433:
```bash
psql -h localhost -p 5433 -U postgres -d ragsys
```

---

## Schema das tabelas

```
langchain_pg_collection
  uuid          UUID     — chave primária da coleção
  name          TEXT     — nome da coleção (ex: "lc_documents")
  cmetadata     JSON     — metadados opcionais da coleção

langchain_pg_embedding
  id            TEXT     — chave primária do chunk
  collection_id UUID     — FK → langchain_pg_collection.uuid
  embedding     vector(768) — vetor de 768 dimensões (nomic-embed-text)
  document      TEXT     — texto bruto do chunk
  cmetadata     JSONB    — {source: "arquivo.pdf", page: "3", ...}

rag_document_image_asset
  asset_id      UUID     — chave primária
  source_key    TEXT     — arquivo de origem (ex: "artigos/paper.pdf")
  asset_name    TEXT     — nome da imagem extraída
  asset_kind    TEXT     — "pdf_embedded_image" | "standalone_image"
  page_number   INT      — página do PDF onde a imagem aparece
  asset_index   INT      — índice da imagem na página
  content_hash  TEXT     — SHA-256 dos bytes da imagem
  mime_type     TEXT     — "image/png", "image/jpeg", etc.
  image_bytes   BYTEA    — bytes brutos da imagem
  ocr_engine    TEXT     — "chandra2" | "glm" | "rapid"
  ocr_text      TEXT     — texto extraído pelo OCR
  summary       TEXT     — resumo do texto (extractive)
  metadata      JSONB    — metadados extras
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ

rag_document_image_embedding
  chunk_id      TEXT     — chave primária
  asset_id      UUID     — FK → rag_document_image_asset.asset_id
  source_key    TEXT     — arquivo de origem
  page_number   INT      — página do PDF
  asset_name    TEXT     — nome da imagem
  asset_kind    TEXT     — tipo de asset
  chunk_index   INT      — índice do chunk dentro do asset
  ocr_engine    TEXT     — engine que gerou o OCR
  content       TEXT     — texto do chunk OCR
  embedding     vector(768) — embedding do texto OCR
  metadata      JSONB
  created_at    TIMESTAMPTZ
```

---

## 1. Visão geral

### Contagem total de chunks
```sql
SELECT COUNT(*) AS total_chunks
FROM langchain_pg_embedding;
```

### Coleções existentes
```sql
SELECT uuid, name, cmetadata
FROM langchain_pg_collection;
```

### Contagem por coleção
```sql
SELECT c.name AS colecao, COUNT(e.id) AS total_chunks
FROM langchain_pg_collection c
JOIN langchain_pg_embedding e ON e.collection_id = c.uuid
GROUP BY c.name
ORDER BY total_chunks DESC;
```

---

## 2. Artigos (fontes)

### Listar todos os artigos ingeridos com contagem de chunks
```sql
SELECT
    cmetadata->>'source' AS artigo,
    COUNT(*)             AS chunks
FROM langchain_pg_embedding
GROUP BY cmetadata->>'source'
ORDER BY chunks DESC;
```

### Listar apenas os nomes dos artigos
```sql
SELECT DISTINCT cmetadata->>'source' AS artigo
FROM langchain_pg_embedding
ORDER BY artigo;
```

### Buscar artigo pelo nome (parcial, case-insensitive)
```sql
SELECT DISTINCT cmetadata->>'source' AS artigo
FROM langchain_pg_embedding
WHERE cmetadata->>'source' ILIKE '%rag%';
```

---

## 3. Conteúdo original (texto dos chunks)

### Ver os primeiros chunks de um artigo
```sql
SELECT
    id,
    cmetadata->>'page'    AS pagina,
    document
FROM langchain_pg_embedding
WHERE cmetadata->>'source' ILIKE '%nome-do-artigo%'
ORDER BY (cmetadata->>'page')::int, id
LIMIT 10;
```

### Ver trecho curto de cada chunk (primeiros 300 chars)
```sql
SELECT
    cmetadata->>'source'    AS artigo,
    cmetadata->>'page'      AS pagina,
    LEFT(document, 300)     AS trecho
FROM langchain_pg_embedding
WHERE cmetadata->>'source' ILIKE '%nome-do-artigo%'
ORDER BY (cmetadata->>'page')::int;
```

### Buscar por palavra-chave dentro do conteúdo
```sql
SELECT
    cmetadata->>'source'  AS artigo,
    cmetadata->>'page'    AS pagina,
    LEFT(document, 400)   AS trecho
FROM langchain_pg_embedding
WHERE document ILIKE '%retrieval-augmented%'
ORDER BY cmetadata->>'source', (cmetadata->>'page')::int;
```

### Conteúdo completo de um chunk específico (pelo id)
```sql
SELECT
    id,
    cmetadata->>'source' AS artigo,
    cmetadata->>'page'   AS pagina,
    document
FROM langchain_pg_embedding
WHERE id = 'cole-aqui-o-uuid-do-chunk';
```

---

## 4. Vectors (embeddings)

### Ver o vetor de um chunk específico
```sql
SELECT
    id,
    cmetadata->>'source'  AS artigo,
    LEFT(document, 150)   AS trecho,
    embedding             AS vetor
FROM langchain_pg_embedding
WHERE cmetadata->>'source' ILIKE '%nome-do-artigo%'
LIMIT 1;
```

### Ver as primeiras 10 dimensões do vetor
```sql
SELECT
    id,
    cmetadata->>'source'            AS artigo,
    LEFT(document, 100)             AS trecho,
    (embedding::text)               AS vetor_completo
FROM langchain_pg_embedding
LIMIT 5;
```

### Tamanho (norma L2) do vetor — confirma normalização
```sql
SELECT
    id,
    cmetadata->>'source'             AS artigo,
    SQRT(embedding <#> embedding) * -1 AS norma_l2
FROM langchain_pg_embedding
LIMIT 10;
```

> Vetores normalizados têm norma ≈ 1.0. `nomic-embed-text` normaliza por padrão.

---

## 5. Busca por similaridade (pgvector)

> Para buscar por texto você precisa do embedding da query. As queries abaixo
> exemplificam com um vetor fictício de 768 dimensões. Substitua pelo vetor real
> gerado via Ollama ou a API de embeddings.

### Busca cosine — os 5 chunks mais similares
```sql
SELECT
    id,
    cmetadata->>'source'  AS artigo,
    cmetadata->>'page'    AS pagina,
    LEFT(document, 300)   AS trecho,
    1 - (embedding <=> '[0.1, 0.2, ...]'::vector) AS similarity
FROM langchain_pg_embedding
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

### Busca cosine filtrada por artigo
```sql
SELECT
    id,
    cmetadata->>'page'   AS pagina,
    LEFT(document, 300)  AS trecho,
    1 - (embedding <=> '[0.1, 0.2, ...]'::vector) AS similarity
FROM langchain_pg_embedding
WHERE cmetadata->>'source' ILIKE '%fair-rag%'
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

### Busca euclidiana (L2)
```sql
SELECT
    id,
    cmetadata->>'source'  AS artigo,
    LEFT(document, 300)   AS trecho,
    embedding <-> '[0.1, 0.2, ...]'::vector AS distancia_l2
FROM langchain_pg_embedding
ORDER BY embedding <-> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

### Busca por produto interno (dot product)
```sql
SELECT
    id,
    cmetadata->>'source'  AS artigo,
    LEFT(document, 300)   AS trecho,
    (embedding <#> '[0.1, 0.2, ...]'::vector) * -1 AS dot_product
FROM langchain_pg_embedding
ORDER BY embedding <#> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

---

## 6. Artigo + conteúdo + vetor juntos

### Tudo de um artigo em uma query só
```sql
SELECT
    e.id,
    e.cmetadata->>'source'  AS artigo,
    e.cmetadata->>'page'    AS pagina,
    e.document               AS conteudo,
    e.embedding              AS vetor,
    c.name                   AS colecao
FROM langchain_pg_embedding e
JOIN langchain_pg_collection c ON c.uuid = e.collection_id
WHERE e.cmetadata->>'source' ILIKE '%nome-do-artigo%'
ORDER BY (e.cmetadata->>'page')::int, e.id;
```

### Resumo: nome + primeiro trecho + dimensão do vetor
```sql
SELECT
    cmetadata->>'source'              AS artigo,
    cmetadata->>'page'                AS pagina,
    LEFT(document, 200)               AS inicio_do_chunk,
    vector_dims(embedding)            AS dimensoes_do_vetor
FROM langchain_pg_embedding
ORDER BY cmetadata->>'source', (cmetadata->>'page')::int
LIMIT 20;
```

---

## 7. Metadados e estrutura

### Ver todos os campos disponíveis no cmetadata
```sql
SELECT DISTINCT jsonb_object_keys(cmetadata) AS campo
FROM langchain_pg_embedding;
```

### Ver metadados completos de um chunk
```sql
SELECT id, cmetadata
FROM langchain_pg_embedding
LIMIT 5;
```

### Chunks por página de um artigo
```sql
SELECT
    (cmetadata->>'page')::int AS pagina,
    COUNT(*)                  AS chunks
FROM langchain_pg_embedding
WHERE cmetadata->>'source' ILIKE '%nome-do-artigo%'
GROUP BY pagina
ORDER BY pagina;
```

---

## 8. Índices vetoriais

### Listar índices existentes na tabela
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'langchain_pg_embedding';
```

### Criar índice HNSW (recomendado para produção)
```sql
CREATE INDEX IF NOT EXISTS idx_hnsw_embedding
ON langchain_pg_embedding
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### Criar índice IVFFlat (alternativa, menor memória)
```sql
CREATE INDEX IF NOT EXISTS idx_ivfflat_embedding
ON langchain_pg_embedding
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### Verificar tamanho dos índices
```sql
SELECT
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS tamanho
FROM pg_indexes
WHERE tablename = 'langchain_pg_embedding';
```

---

## 9. Utilitários

### Tamanho total da tabela
```sql
SELECT
    pg_size_pretty(pg_total_relation_size('langchain_pg_embedding')) AS tamanho_total,
    pg_size_pretty(pg_relation_size('langchain_pg_embedding'))        AS so_dados;
```

### Extensões instaladas (confirmar pgvector)
```sql
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'vector';
```

### Estatísticas da tabela
```sql
SELECT
    reltuples::bigint AS linhas_estimadas,
    pg_size_pretty(pg_total_relation_size(oid)) AS tamanho
FROM pg_class
WHERE relname = 'langchain_pg_embedding';
```

### VACUUM ANALYZE após ingestão grande
```sql
VACUUM ANALYZE langchain_pg_embedding;
VACUUM ANALYZE rag_document_image_asset;
VACUUM ANALYZE rag_document_image_embedding;
```

---

## 10. Imagens e OCR

### Contagem geral de imagens extraídas
```sql
SELECT
    COUNT(*)                        AS total_imagens,
    COUNT(DISTINCT source_key)      AS documentos,
    COUNT(DISTINCT ocr_engine)      AS engines_usadas
FROM rag_document_image_asset;
```

### Imagens por documento (com contagem)
```sql
SELECT
    source_key                          AS documento,
    COUNT(*)                            AS total_imagens,
    SUM(LENGTH(ocr_text))               AS chars_ocr
FROM rag_document_image_asset
GROUP BY source_key
ORDER BY total_imagens DESC;
```

### Distribuição por engine OCR
```sql
SELECT
    ocr_engine,
    COUNT(*)                    AS imagens,
    AVG(LENGTH(ocr_text))::int  AS media_chars
FROM rag_document_image_asset
GROUP BY ocr_engine
ORDER BY imagens DESC;
```

### Listar imagens de um documento com texto OCR
```sql
SELECT
    asset_id,
    asset_name,
    page_number,
    asset_index,
    ocr_engine,
    LEFT(ocr_text, 500)         AS texto_ocr
FROM rag_document_image_asset
WHERE source_key ILIKE '%nome-do-artigo%'
ORDER BY page_number, asset_index;
```

### Ver texto OCR completo de uma imagem específica
```sql
SELECT
    asset_id,
    source_key,
    asset_name,
    page_number,
    ocr_engine,
    ocr_text,
    summary
FROM rag_document_image_asset
WHERE asset_id = 'cole-aqui-o-uuid';
```

https://base64.guru/converter/decode/image

### Recuperar imagem como base64 (para visualizar no navegador ou salvar)
```sql
SELECT
    asset_id,
    asset_name,
    mime_type,
    encode(image_bytes, 'base64') AS base64
FROM rag_document_image_asset
WHERE asset_id = 'cole-aqui-o-uuid';
```

> Cole o valor de `base64` numa tag HTML para pré-visualizar:
> `<img src="data:image/png;base64,VALOR_AQUI">`

### Verificar tamanho das imagens armazenadas
```sql
SELECT
    source_key                          AS documento,
    asset_name,
    page_number,
    mime_type,
    pg_size_pretty(LENGTH(image_bytes)) AS tamanho_imagem,
    ocr_engine
FROM rag_document_image_asset
ORDER BY LENGTH(image_bytes) DESC
LIMIT 20;
```

### Espaço total ocupado pelas imagens no banco
```sql
SELECT
    pg_size_pretty(SUM(LENGTH(image_bytes))) AS total_imagens,
    COUNT(*)                                 AS quantidade,
    pg_size_pretty(AVG(LENGTH(image_bytes))::bigint) AS media_por_imagem
FROM rag_document_image_asset
WHERE image_bytes IS NOT NULL;
```

---

### Script Python — abrir/salvar imagem diretamente do banco

O script `observability/ver_imagem_ocr.py` extrai e abre imagens armazenadas.

```powershell
# Listar imagens de um documento
.\.venv\Scripts\python.exe observability/ver_imagem_ocr.py --source "Beyond Nearest" --list

# Abrir a primeira imagem de um documento (abre o visualizador do SO)
.\.venv\Scripts\python.exe observability/ver_imagem_ocr.py --source "Beyond Nearest"

# Abrir por asset_id exato
.\.venv\Scripts\python.exe observability/ver_imagem_ocr.py --id 55b8a40a-c592-4cc9-bfa7-c8da6c3efa36

# Salvar todas as imagens + arquivos .txt com OCR em um diretório
.\.venv\Scripts\python.exe observability/ver_imagem_ocr.py --source "Beyond Nearest" --save ./imagens_extraidas
```

### Buscar por palavra-chave dentro do OCR
```sql
SELECT
    source_key              AS documento,
    page_number,
    ocr_engine,
    LEFT(ocr_text, 400)     AS trecho
FROM rag_document_image_asset
WHERE ocr_text ILIKE '%retrieval%'
ORDER BY source_key, page_number;
```

### Imagens sem texto OCR (vazias ou falhas)
```sql
SELECT
    source_key,
    asset_name,
    page_number,
    mime_type,
    ocr_engine,
    LENGTH(image_bytes)     AS bytes_imagem
FROM rag_document_image_asset
WHERE ocr_text IS NULL OR TRIM(ocr_text) = ''
ORDER BY source_key, page_number;
```

### Exportar imagem como base64 (para inspecionar visualmente)
```sql
SELECT
    asset_id,
    source_key,
    asset_name,
    mime_type,
    encode(image_bytes, 'base64') AS base64
FROM rag_document_image_asset
WHERE source_key ILIKE '%nome-do-artigo%'
LIMIT 1;
```

### Chunks de embedding OCR por documento
```sql
SELECT
    e.source_key            AS documento,
    COUNT(*)                AS chunks_ocr,
    COUNT(DISTINCT e.asset_id) AS imagens
FROM rag_document_image_embedding e
GROUP BY e.source_key
ORDER BY chunks_ocr DESC;
```

### Busca semântica nos embeddings OCR
```sql
SELECT
    e.source_key            AS documento,
    e.page_number,
    e.ocr_engine,
    LEFT(e.content, 300)    AS trecho_ocr,
    1 - (e.embedding <=> '[0.1, 0.2, ...]'::vector) AS similarity
FROM rag_document_image_embedding e
ORDER BY e.embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;
```

### Join: imagem + chunks OCR juntos
```sql
SELECT
    a.source_key,
    a.page_number,
    a.asset_name,
    a.ocr_engine,
    LEFT(a.ocr_text, 200)   AS ocr_text,
    COUNT(e.chunk_id)       AS chunks_embedding
FROM rag_document_image_asset a
LEFT JOIN rag_document_image_embedding e ON e.asset_id = a.asset_id
GROUP BY a.asset_id, a.source_key, a.page_number, a.asset_name, a.ocr_engine, a.ocr_text
ORDER BY a.source_key, a.page_number;
```

### Tamanho das tabelas OCR
```sql
SELECT
    relname                                              AS tabela,
    pg_size_pretty(pg_total_relation_size(oid))          AS tamanho_total,
    pg_size_pretty(pg_relation_size(oid))                AS so_dados
FROM pg_class
WHERE relname IN ('rag_document_image_asset', 'rag_document_image_embedding')
ORDER BY pg_total_relation_size(oid) DESC;
```

---

## 11. LangGraph — Checkpoints de Triagem Jira

> As três tabelas abaixo são criadas automaticamente pelo `PostgresSaver` do LangGraph na primeira execução do grafo.

### 11.1 Verificar se as tabelas de checkpoint existem
```sql
SELECT tablename
FROM pg_tables
WHERE tablename IN ('checkpoints', 'checkpoint_writes', 'checkpoint_blobs')
ORDER BY tablename;
```

### 11.2 Total de execuções por issue Jira
```sql
SELECT
    thread_id                          AS issue_jira,
    COUNT(*)                           AS total_checkpoints,
    MIN(checkpoint_ns)                 AS inicio,
    MAX(checkpoint_ns)                 AS ultimo_passo
FROM checkpoints
GROUP BY thread_id
ORDER BY total_checkpoints DESC;
```

### 11.3 Nós executados em uma issue específica (passo a passo)
```sql
SELECT
    checkpoint_ns    AS passo,
    type,
    checkpoint       AS estado_resumido
FROM checkpoints
WHERE thread_id = 'COREB-4521'
ORDER BY checkpoint_ns ASC;
```

### 11.4 Estado completo no último checkpoint de uma issue
```sql
SELECT
    thread_id,
    checkpoint_ns,
    channel_values
FROM checkpoints
WHERE thread_id = 'COREB-4521'
ORDER BY checkpoint_ns DESC
LIMIT 1;
```

### 11.5 Decisão final de todas as issues processadas
```sql
SELECT DISTINCT ON (thread_id)
    thread_id                                              AS issue_jira,
    channel_values ->> 'decision'                          AS decisao,
    (channel_values -> 'checklist_result' ->> 'score')::float AS score_checklist,
    (channel_values -> 'coherence_result' ->> 'score')::float AS score_coerencia,
    checkpoint_ns                                          AS processado_em
FROM checkpoints
WHERE channel_values ? 'decision'
ORDER BY thread_id, checkpoint_ns DESC;
```

### 11.6 Distribuição de decisões (REFINAMENTO / DESCARTAR / REVISAR_HUMANO)
```sql
SELECT
    channel_values ->> 'decision'   AS decisao,
    COUNT(DISTINCT thread_id)       AS total_issues
FROM checkpoints
WHERE channel_values ? 'decision'
GROUP BY decisao
ORDER BY total_issues DESC;
```

### 11.7 Issues aguardando revisão humana (interrompidas)
```sql
SELECT
    thread_id                                   AS issue_jira,
    channel_values ->> 'jira_summary'           AS titulo,
    (channel_values -> 'checklist_result' ->> 'score')::float AS score_checklist,
    checkpoint_ns                               AS pausado_em
FROM checkpoints
WHERE channel_values ->> 'decision' = 'REVISAR_HUMANO'
  AND channel_values -> 'human_override' IS NULL
ORDER BY checkpoint_ns ASC;
```

### 11.8 Issues com gap crítico no checklist DoR
```sql
SELECT
    thread_id                               AS issue_jira,
    channel_values ->> 'jira_summary'       AS titulo,
    channel_values -> 'checklist_result'    AS resultado_checklist
FROM checkpoints
WHERE channel_values -> 'checklist_result' ->> 'status' = 'gap_critico'
ORDER BY (channel_values -> 'checklist_result' ->> 'score')::float ASC;
```

### 11.9 Piores scores de coerência semântica
```sql
SELECT
    thread_id                                               AS issue_jira,
    channel_values ->> 'jira_summary'                       AS titulo,
    (channel_values -> 'coherence_result' ->> 'score')::float AS score_coerencia,
    channel_values -> 'coherence_result' ->> 'justificativa' AS justificativa
FROM checkpoints
WHERE channel_values ? 'coherence_result'
ORDER BY score_coerencia ASC
LIMIT 20;
```

### 11.10 Anexos processados em uma issue específica
```sql
SELECT
    thread_id                   AS issue_jira,
    jsonb_array_elements(channel_values -> 'attachments_processed') AS anexo
FROM checkpoints
WHERE thread_id = 'COREB-4521'
  AND channel_values ? 'attachments_processed'
ORDER BY checkpoint_ns DESC
LIMIT 1;
```

### 11.11 Auditoria de overrides humanos
```sql
SELECT
    thread_id                                   AS issue_jira,
    channel_values -> 'human_override'          AS override,
    channel_values ->> 'decision'               AS decisao_final,
    checkpoint_ns                               AS revisado_em
FROM checkpoints
WHERE channel_values -> 'human_override' IS NOT NULL
ORDER BY checkpoint_ns DESC;
```

### 11.12 Tamanho das tabelas de checkpoint
```sql
SELECT
    relname                                             AS tabela,
    pg_size_pretty(pg_total_relation_size(oid))         AS tamanho_total,
    pg_size_pretty(pg_relation_size(oid))               AS so_dados
FROM pg_class
WHERE relname IN ('checkpoints', 'checkpoint_writes', 'checkpoint_blobs')
ORDER BY pg_total_relation_size(oid) DESC;
```

### 11.13 Limpeza de checkpoints antigos (> 30 dias)
> ⚠️ **ATENÇÃO: operação destrutiva — sem rollback possível.**
```sql
DELETE FROM checkpoints
WHERE checkpoint_ns < (NOW() - INTERVAL '30 days')::text;
```
