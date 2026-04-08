# Queries PostgreSQL — RAG System

Consultas puras para inspecionar os dados do pgvector diretamente no banco.

**Conectar ao banco:**
```powershell
docker exec -it tabzer-postgres psql -U postgres -d ragsys
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
```
