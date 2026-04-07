# RAG System com PostgreSQL + pgvector

Projeto de RAG com dois fluxos paralelos para comparacao:

- LangChain
- LlamaIndex

Ambos usam:

- PostgreSQL com pgvector
- SQLAlchemy 2.x
- Google Vertex AI para embeddings e LLM
- FastAPI para expor endpoints

## Estrutura principal

- `rag/langchain/ingest.py`: ingestao de documentos via LangChain
- `rag/langchain/query.py`: consulta RAG via LangChain
- `rag/llamaindex/ingest.py`: ingestao de documentos via LlamaIndex
- `rag/llamaindex/query.py`: consulta RAG via LlamaIndex
- `api/main.py`: inicializacao da API FastAPI
- `artigos/`: PDFs usados como base documental
- `.env`: configuracao do ambiente

## Requisitos

- Python 3.11
- Docker Desktop
- Conta Google Cloud com Vertex AI habilitado
- Chave de servico com acesso ao Vertex AI

## Instalacao do ambiente Python

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

O arquivo `requirements.txt` ja inclui `SQLAlchemy==2.0.49`.

Se quiser instalar separadamente, o comando recomendado pela documentacao oficial e:

```powershell
.\.venv\Scripts\python.exe -m pip install SQLAlchemy
```

## Configuracao do .env

Exemplo compativel com o projeto:

```env
GOOGLE_APPLICATION_CREDENTIALS=./api-project-1013904049487-5040f1347041.json
GOOGLE_CLOUD_PROJECT=api-project-1013904049487
GOOGLE_CLOUD_LOCATION=us-central1

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ragsys
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

GEMINI_EMBEDDING_MODEL=text-embedding-004
GEMINI_LLM_MODEL=gemini-2.0-flash
```

## PostgreSQL com pgvector via Docker

Neste projeto, a forma mais simples no Windows e usar a imagem Docker que ja vem com o pgvector embutido.

Validacao da imagem:

- `pgvector/pgvector:pg16` esta correta e e oficial do projeto pgvector para PostgreSQL 16.
- A documentacao oficial do pgvector lista `pg16` como tag suportada, junto com variantes como `pg16-bookworm` e `0.8.2-pg16`.
- Se quiser uma versao mais reprodutivel no README, a alternativa equivalente e `pgvector/pgvector:0.8.2-pg16`.
- Mesmo usando a imagem correta, ainda e necessario rodar `CREATE EXTENSION IF NOT EXISTS vector;` dentro do database.

### Subir o container

```powershell
docker pull pgvector/pgvector:pg16

docker volume create ragsys_pg_data

docker run --name tabzer-postgres `
  -e POSTGRES_DB=ragsys `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -p 5432:5432 `
  -v ragsys_pg_data:/var/lib/postgresql/data `
  -d pgvector/pgvector:pg16
```

### Habilitar a extensao vector

```powershell
docker exec tabzer-postgres psql -U postgres -d ragsys -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Comandos uteis do Docker

Ver containers:

```powershell
docker ps -a
```

Ver logs:

```powershell
docker logs tabzer-postgres
```

Parar o container:

```powershell
docker stop tabzer-postgres
```

Iniciar novamente:

```powershell
docker start tabzer-postgres
```

Abrir shell SQL:

```powershell
docker exec -it tabzer-postgres psql -U postgres -d ragsys
```

Verificar se o pgvector esta habilitado:

```sql
SELECT extname FROM pg_extension WHERE extname = 'vector';
```

## Script PowerShell para preparar PostgreSQL com pgvector

Se quiser automatizar a subida do PostgreSQL com pgvector, use este script:

```powershell
param(
    [string]$ContainerName = "tabzer-postgres",
    [string]$VolumeName = "ragsys_pg_data",
    [string]$Database = "ragsys",
    [string]$User = "postgres",
    [string]$Password = "postgres",
    [int]$HostPort = 5432
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI nao encontrado. Instale o Docker Desktop antes de continuar."
}

Write-Host "Pull da imagem pgvector/pgvector:pg16..."
docker pull pgvector/pgvector:pg16 | Out-Host

$volumeExists = docker volume ls --format "{{.Name}}" | Select-String -SimpleMatch $VolumeName
if (-not $volumeExists) {
    Write-Host "Criando volume $VolumeName..."
    docker volume create $VolumeName | Out-Host
}

$containerExists = docker ps -a --format "{{.Names}}" | Select-String -SimpleMatch $ContainerName
if (-not $containerExists) {
    Write-Host "Criando container $ContainerName..."
    docker run --name $ContainerName `
        -e POSTGRES_DB=$Database `
        -e POSTGRES_USER=$User `
        -e POSTGRES_PASSWORD=$Password `
        -p "${HostPort}:5432" `
        -v "${VolumeName}:/var/lib/postgresql/data" `
        -d pgvector/pgvector:pg16 | Out-Host
}
else {
    Write-Host "Container ja existe. Garantindo que esta em execucao..."
    docker start $ContainerName | Out-Host
}

Write-Host "Aguardando PostgreSQL ficar pronto..."
$maxAttempts = 30
$attempt = 0
$ready = $false

while (-not $ready -and $attempt -lt $maxAttempts) {
    $attempt++
    try {
        docker exec $ContainerName psql -U $User -d $Database -c "SELECT 1;" | Out-Null
        $ready = $true
    }
    catch {
        Start-Sleep -Seconds 2
    }
}

if (-not $ready) {
    throw "PostgreSQL nao ficou pronto a tempo."
}

Write-Host "Habilitando extensao vector..."
docker exec $ContainerName psql -U $User -d $Database -c "CREATE EXTENSION IF NOT EXISTS vector;" | Out-Host

Write-Host "Ambiente PostgreSQL com pgvector pronto."
```

## Fluxo de ingestao

Antes de rodar qualquer comando do projeto:

```powershell
.\.venv\Scripts\Activate.ps1
```

### LangChain

Ingestao completa:

```powershell
.\.venv\Scripts\python.exe -m rag.langchain.ingest artigos
```

Retomar a partir de um chunk especifico:

```powershell
.\.venv\Scripts\python.exe -m rag.langchain.ingest artigos 400
```

Ingerir um unico arquivo PDF:

```powershell
.\.venv\Scripts\python.exe -m rag.langchain.ingest ".\artigos\Exploring the Power of Diffusion Large Language Models for Software Engineering_ An Empirical Investigation.pdf"
```

### LlamaIndex

```powershell
.\.venv\Scripts\python.exe -m rag.llamaindex.ingest artigos
```

Ingerir um unico arquivo PDF:

```powershell
.\.venv\Scripts\python.exe -m rag.llamaindex.ingest ".\artigos\Exploring the Power of Diffusion Large Language Models for Software Engineering_ An Empirical Investigation.pdf"
```

## Fluxo de consulta

### LangChain

Teste de query pelo terminal:

```powershell
.\.venv\Scripts\python.exe -m rag.langchain.query "O que e diffusion-based AI content generation?"
```

Outro exemplo:

```powershell
.\.venv\Scripts\python.exe -m rag.langchain.query "Resuma os principais temas dos artigos carregados"
```

### LlamaIndex

Teste de query pelo terminal:

```powershell
.\.venv\Scripts\python.exe -m rag.llamaindex.query "O que e diffusion-based AI content generation?"
```

Outro exemplo:

```powershell
.\.venv\Scripts\python.exe -m rag.llamaindex.query "Quais artigos falam sobre diffusion models?"
```

## Subir a API

Subir o servidor local:

```powershell
.\.venv\Scripts\uvicorn.exe api.main:app --reload --port 8000
```

Swagger:

- `http://localhost:8000/docs`

Health check:

- `GET /health`

## Testar a API

### Verificar se a API esta no ar

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8000/health"
```

### Testar query via API com LangChain

```powershell
Invoke-RestMethod -Method Post `
    -Uri "http://localhost:8000/langchain/query" `
    -ContentType "application/json" `
    -Body '{"question":"O que e diffusion-based AI content generation?","k":4}'
```

### Testar query via API com LlamaIndex

```powershell
Invoke-RestMethod -Method Post `
    -Uri "http://localhost:8000/llamaindex/query" `
    -ContentType "application/json" `
    -Body '{"question":"O que e diffusion-based AI content generation?","k":4}'
```

### Ingerir um arquivo via API com LangChain

```powershell
Invoke-RestMethod -Method Post `
    -Uri "http://localhost:8000/langchain/ingest" `
    -Form @{ file = Get-Item ".\artigos\Exploring the Power of Diffusion Large Language Models for Software Engineering_ An Empirical Investigation.pdf" }
```

### Ingerir um arquivo via API com LlamaIndex

```powershell
Invoke-RestMethod -Method Post `
    -Uri "http://localhost:8000/llamaindex/ingest" `
    -Form @{ file = Get-Item ".\artigos\Exploring the Power of Diffusion Large Language Models for Software Engineering_ An Empirical Investigation.pdf" }
```

## Consultas com SQLAlchemy

O projeto agora tem um modulo dedicado para inspeção via SQLAlchemy em `rag/sqlalchemy_queries.py`.

Esse modulo consulta diretamente as tabelas do LangChain:

- `langchain_pg_collection`
- `langchain_pg_embedding`

### Usar por codigo Python

Exemplo simples no terminal:

```powershell
.\.venv\Scripts\python.exe -c "from rag.sqlalchemy_queries import list_articles; print(list_articles())"
```

Exemplo com mais controle:

```python
from rag.sqlalchemy_queries import get_chunk_detail, list_articles, list_chunks

articles = list_articles(contains="Diffusion", limit=10)
print(articles)

chunks = list_chunks(article="Diffusion", limit=5, preview_chars=150, embedding_dims=5)
print(chunks)

chunk = get_chunk_detail(chunk_id=chunks[0]["id"], embedding_dims=20)
print(chunk)
```

### Usar via interface Swagger

Suba a API:

```powershell
.\.venv\Scripts\uvicorn.exe api.main:app --reload --port 8000
```

Abra:

- `http://localhost:8000/docs`

Procure pela tag `SQLAlchemy`.

### Endpoints SQLAlchemy disponiveis

#### Listar artigos e quantidade de chunks

`GET /sqlalchemy/articles`

Exemplo no navegador ou Swagger:

- `contains`: filtra parte do nome do artigo
- `limit`: limita a quantidade de resultados

Exemplo via PowerShell:

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8000/sqlalchemy/articles?contains=Diffusion&limit=20"
```

#### Listar chunks com preview de texto e embedding

`GET /sqlalchemy/chunks`

Parâmetros úteis:

- `article`: parte do nome do artigo
- `page`: filtra por página
- `limit`: quantidade de chunks
- `preview_chars`: tamanho do preview do texto
- `embedding_dims`: quantas dimensões do vetor mostrar

Exemplo via PowerShell:

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8000/sqlalchemy/chunks?article=Diffusion&limit=5&preview_chars=120&embedding_dims=6"
```

#### Ver detalhe de um chunk com vetor

`GET /sqlalchemy/chunks/{chunk_id}`

Primeiro pegue um `id` em `/sqlalchemy/chunks`, depois consulte o detalhe:

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8000/sqlalchemy/chunks/SEU_CHUNK_ID?embedding_dims=30"
```

Na interface Swagger, o fluxo mais pratico e:

1. Abrir `GET /sqlalchemy/articles` e executar.
2. Escolher um nome de artigo.
3. Abrir `GET /sqlalchemy/chunks` com o filtro `article`.
4. Copiar um `id` retornado.
5. Abrir `GET /sqlalchemy/chunks/{chunk_id}` para ver o texto completo e o embedding.

### Fluxo rapido de validacao

1. Ative o ambiente: `\.venv\Scripts\Activate.ps1`
2. Rode a ingestao: `\.venv\Scripts\python.exe -m rag.langchain.ingest artigos`
3. Teste uma query no terminal: `\.venv\Scripts\python.exe -m rag.langchain.query "O que e diffusion-based AI content generation?"`
4. Suba a API: `\.venv\Scripts\uvicorn.exe api.main:app --reload --port 8000`
5. Teste o endpoint: `Invoke-RestMethod -Method Post -Uri "http://localhost:8000/langchain/query" -ContentType "application/json" -Body '{"question":"O que e diffusion-based AI content generation?","k":4}'`

## Como os vetores ficam salvos no PostgreSQL

### LangChain

O LangChain salva em tabelas do `langchain-postgres`:

- `langchain_pg_collection`
- `langchain_pg_embedding`

Cada linha de `langchain_pg_embedding` representa um chunk, nao um artigo inteiro.

Campos principais:

- `id`: identificador do chunk
- `collection_id`: referencia a colecao
- `document`: texto do chunk
- `embedding`: vetor do chunk
- `cmetadata`: metadados em JSON, como arquivo e pagina

### Importante

Nao existe 1 vetor por artigo.

Existe:

- 1 artigo PDF
- varias paginas
- varios chunks por pagina
- 1 vetor para cada chunk

Entao um artigo pode gerar dezenas de linhas em `langchain_pg_embedding`.

## Queries SQL para inspecao

### 1. Ver todos os artigos presentes no banco

```sql
SELECT DISTINCT cmetadata->>'source' AS source
FROM langchain_pg_embedding
ORDER BY source;
```

### Explicacao

Mostra os nomes reais dos arquivos salvos em `cmetadata->>'source'`. Use isso antes de filtrar por um artigo especifico.

## 2. Contar quantos chunks cada artigo gerou

```sql
SELECT
    cmetadata->>'source' AS artigo,
    COUNT(*) AS total_chunks
FROM langchain_pg_embedding
GROUP BY cmetadata->>'source'
ORDER BY artigo;
```

### Explicacao

Agrupa os registros por arquivo e conta quantos chunks foram persistidos para cada um.

## 3. Ver o texto de cada chunk de um artigo

```sql
SELECT
    id,
    cmetadata->>'source' AS artigo,
    cmetadata->>'page' AS pagina,
    document AS chunk_texto
FROM langchain_pg_embedding
WHERE cmetadata->>'source' ILIKE '%Diffusion%'
ORDER BY (cmetadata->>'page')::int, id;
```

### Explicacao

Retorna o texto salvo no campo `document` para todos os chunks de um artigo cujo nome contenha `Diffusion`.

## 4. Ver o vetor completo de cada chunk de um artigo

```sql
SELECT
    id,
    cmetadata->>'source' AS artigo,
    cmetadata->>'page' AS pagina,
    embedding::text AS vetor_completo
FROM langchain_pg_embedding
WHERE cmetadata->>'source' ILIKE '%Diffusion%'
ORDER BY (cmetadata->>'page')::int, id;
```

### Explicacao

Converte o campo `embedding` para texto para permitir inspecao manual. O resultado e grande porque cada vetor tem 768 dimensoes.

## 5. Ver texto e vetor juntos

```sql
SELECT
    id,
    cmetadata->>'source' AS artigo,
    cmetadata->>'page' AS pagina,
    document AS chunk_texto,
    embedding::text AS vetor_completo
FROM langchain_pg_embedding
WHERE cmetadata->>'source' ILIKE '%Diffusion%'
ORDER BY (cmetadata->>'page')::int, id;
```

### Explicacao

Util para inspecionar exatamente qual trecho textual gerou qual embedding.

## 6. Ver uma versao resumida para inspecao visual

```sql
SELECT
    id,
    cmetadata->>'source' AS artigo,
    cmetadata->>'page' AS pagina,
    LEFT(document, 200) AS trecho,
    LEFT(embedding::text, 300) AS vetor_inicio
FROM langchain_pg_embedding
WHERE cmetadata->>'source' ILIKE '%Diffusion%'
LIMIT 10;
```

### Explicacao

Mostra apenas o inicio do texto e o inicio do vetor. E a melhor forma de inspecionar sem poluir a saida do cliente SQL.

## Observacao sobre o tipo `vector`

O tipo `vector` do pgvector nao se comporta como um array PostgreSQL comum.

Por isso, expressoes como estas podem falhar:

- `embedding[1]`
- `embedding::float[]`

Para inspecao manual, a abordagem mais simples e:

- `embedding::text`
- `LEFT(embedding::text, ...)`

## Verificar quantos embeddings existem

```powershell
docker exec tabzer-postgres psql -U postgres -d ragsys -c "SELECT COUNT(*) FROM langchain_pg_embedding;"
```

## Situacao atual do projeto

- LangChain usa a colecao `lc_documents`
- LlamaIndex usa a tabela `llamaindex_documents`
- Os embeddings atuais usam o modelo `text-embedding-004`
- A dimensao esperada dos vetores e 768

## Observacao importante sobre os entrypoints

Para o fluxo atual do projeto, prefira os modulos abaixo:

- `python -m rag.langchain.ingest`
- `python -m rag.langchain.query`
- `python -m rag.llamaindex.ingest`
- `python -m rag.llamaindex.query`

O arquivo `rag/query.py` existe, mas nao representa o fluxo principal que esta alinhado com o estado atual da ingestao em LangChain.