# LangGraph — Pipeline de Validação de Issues Jira (Core Banking)

Documentação técnica completa da orquestração com LangGraph para o pipeline de triagem automática de issues.

---

## Índice

1. [Por que LangGraph aqui](#1-por-que-langgraph-aqui)
2. [Arquitetura do Grafo](#2-arquitetura-do-grafo)
3. [Estado compartilhado](#3-estado-compartilhado)
4. [Nós do grafo](#4-nós-do-grafo)
5. [Edges e condicionais](#5-edges-e-condicionais)
6. [Código completo](#6-código-completo)
7. [Como rodar](#7-como-rodar)
8. [Integração com a API FastAPI](#8-integração-com-a-api-fastapi)
9. [Extensões futuras](#9-extensões-futuras)

---

## 1. Por que LangGraph aqui

O pipeline tem características que tornam LangGraph a escolha correta:

| Necessidade | Solução LangGraph |
|---|---|
| Agente 1 escreve resultado → Agente 2 lê | `TypedDict` state compartilhado entre nós |
| Gap crítico reprova sem chamar Agente 2 | `add_conditional_edges` com router |
| Baixa confiança → revisão humana | `interrupt_before` no nó `human_review` |
| Auditoria de qual nó rodou com qual estado | `checkpointer` nativo + `thread_id` |
| Re-tentar OCR se retornou vazio | Loop condicional no nó `ingest_attachments` |

Uma chain LangChain linear resolveria apenas o fluxo happy-path. Com branches, loops, estado entre etapas e human-in-the-loop, o grafo é a abstração certa.

---

## 2. Arquitetura do Grafo

### Diagrama completo

```
                     START
                       │
                       ▼
            ┌─────────────────────┐
            │  ingest_attachments │  ← Compress
            │  OCR / log / CSV    │    Chandra2, GLM, RapidOCR
            └──────────┬──────────┘    Log parser, CSV analyzer
                       │
                 OCR vazio?
                  ┌────┴─────┐
                 Sim         Não
                  │           │
                  ▼           │
            [retry_ocr]       │    ← Loop de retry (max 1x)
                  │           │
                  └─────┬─────┘
                        │
                        ▼
            ┌─────────────────────┐
            │   select_context    │  ← Select
            │   RAG: DoR          │    pgvector hybrid search
            │   RAG: issues sim.  │    nomic-embed-text + BM25
            └──────────┬──────────┘
                        │
                        ▼
            ┌─────────────────────┐
            │ agent_checklist_dor │  ← Agente 1
            │ valida campos DoR   │    Isolate: contexto próprio
            │ escreve scratchpad  │    Write: gaps → state
            └──────────┬──────────┘
                        │
              gap crítico?
          ┌─────────────┴──────────────┐
         Sim                          Não / parcial
          │                            │
          ▼                            ▼
  ┌───────────────┐      ┌──────────────────────────┐
  │ build_output  │      │ agent_semantic_coherence  │  ← Agente 2
  │  (DESCARTAR)  │      │ anexos ↔ descrição        │    Isolate: contexto próprio
  └───────┬───────┘      │ coerência semântica       │
          │              └─────────────┬────────────┘
          │                            │
          │               ┌────────────▼────────────┐
          │               │     build_decision       │
          │               │  merge Ag1 + Ag2         │
          │               │  calcula confiança final │
          │               └────────────┬────────────┘
          │                            │
          │                confiança < 0.6?
          │               ┌────────────┴────────────┐
          │              Sim                        Não
          │               │                          │
          │               ▼                          ▼
          │      ┌─────────────────┐       ┌────────────────────┐
          │      │  human_review   │       │  build_output_final │
          │      │ [interrupt]     │       │  REFINAMENTO ou     │
          │      │ awaits override │       │  DESCARTAR          │
          │      └────────┬────────┘       └──────────┬─────────┘
          │               │                           │
          └───────────────┴───────────────────────────┘
                                    │
                                   END
                         POST comment no Jira
```

### Context Engineering no grafo

```
┌──────────────────────────────────────────────────────────────────┐
│  MOVIMENTOS DE CONTEXTO POR NÓ                                   │
│                                                                  │
│  ingest_attachments  → COMPRESS                                  │
│    OCR extrai texto de imagens                                   │
│    Parser extrai linhas críticas de logs                         │
│    pandas extrai anomalias de CSVs                               │
│    PDF grande → RAG temporário por issue                         │
│                                                                  │
│  select_context      → SELECT                                    │
│    RAG: DoR atual (memória procedural)                           │
│    RAG: issues similares resolvidas (memória episódica)          │
│    Filtro: issue_id + versão_dor = current                       │
│                                                                  │
│  agent_checklist_dor → WRITE (scratchpad)                        │
│    Escreve gaps no state para Agente 2 ler                       │
│    Não repassa o contexto interno — apenas o resultado           │
│                                                                  │
│  agent_semantic_coherence → ISOLATE                              │
│    Lê scratchpad do Ag1 + anexos processados                     │
│    Contexto independente — não vê raciocínio do Ag1              │
│                                                                  │
│  human_review → INTERRUPT                                        │
│    Suspende o grafo e aguarda override humano                    │
│    Checkpointer persiste estado até retomada                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Estado compartilhado

```python
# jira_triage/state.py

from __future__ import annotations

from typing import TypedDict, Optional, Literal


class ChecklistResult(TypedDict):
    """Saída do Agente 1 — gravada no scratchpad do state."""
    status: Literal["ok", "gaps_parciais", "gap_critico"]
    gaps: list[dict]           # [{"campo": "...", "motivo": "..."}]
    resumo: str


class CoherenceResult(TypedDict):
    """Saída do Agente 2."""
    score: float               # 0.0 – 1.0
    observacoes: list[str]
    anexos_relevantes: list[str]
    anexos_contraditorios: list[str]


class TriageState(TypedDict):
    """Estado global do grafo — passado entre todos os nós."""

    # Input
    issue_key: str
    issue_fields: dict         # campos Jira brutos
    attachments_raw: list[dict]  # [{"nome": "...", "bytes": b"...", "tipo": "..."}]

    # Após ingest_attachments (Compress)
    attachments_processed: list[dict]  # JSONs estruturados por tipo
    ocr_retry_count: int

    # Após select_context (Select)
    dor_chunks: list[str]      # chunks do DoR recuperados por RAG
    similar_issues: list[dict] # top-3 issues similares resolvidas

    # Após agent_checklist_dor (Write — scratchpad)
    checklist_result: Optional[ChecklistResult]

    # Após agent_semantic_coherence (Isolate)
    coherence_result: Optional[CoherenceResult]

    # Após build_decision
    confidence: float
    decision: Literal["REFINAMENTO", "DESCARTAR", "REVISAR_HUMANO", ""]
    justification: str
    sources_used: list[str]

    # Human override (se human_review for acionado)
    human_override: Optional[Literal["REFINAMENTO", "DESCARTAR"]]
    human_notes: Optional[str]
```

---

## 4. Nós do grafo

### 4.1 `ingest_attachments` — Compress

Processa cada anexo segundo sua natureza: screenshot → OCR, log → parser, CSV → pandas, PDF → pypdf ou RAG temporário.

```python
# jira_triage/nodes/ingest.py

from __future__ import annotations

import io
import json
from collections import Counter

import pandas as pd
from scipy.stats import zscore

from rag.langchain.ocr import _get_backends
from .state import TriageState


def ingest_attachments(state: TriageState) -> dict:
    """
    Nó 1 — COMPRESS.
    Transforma cada anexo em um JSON estruturado com informação relevante.
    Nunca envia conteúdo bruto ao LLM.
    """
    processed = []
    ocr_backends = _get_backends()  # singleton — carregados uma vez

    for attachment in state["attachments_raw"]:
        nome = attachment["nome"]
        conteudo = attachment["bytes"]
        tipo = attachment["tipo"].lower()

        if tipo in (".png", ".jpg", ".jpeg", ".webp", ".tiff", ".bmp"):
            resultado = _processar_imagem(conteudo, nome, ocr_backends)

        elif tipo in (".log", ".txt") and len(conteudo) > 0:
            resultado = _processar_log(conteudo.decode("utf-8", errors="replace"), nome)

        elif tipo == ".csv":
            resultado = _processar_csv(conteudo, nome, state["issue_fields"].get("summary", ""))

        elif tipo == ".pdf":
            resultado = _processar_pdf(conteudo, nome, state["issue_key"])

        else:
            resultado = {"tipo": "desconhecido", "nome_arquivo": nome, "relevancia": "IGNORADO"}

        processed.append(resultado)

    return {"attachments_processed": processed, "ocr_retry_count": state.get("ocr_retry_count", 0)}


def _processar_imagem(conteudo: bytes, nome: str, backends) -> dict:
    texto = ""
    backend_usado = "nenhum"

    for backend in backends:
        try:
            texto = backend.extract(conteudo)
            if texto.strip():
                backend_usado = type(backend).__name__
                break
        except Exception:
            continue

    return {
        "tipo": "imagem",
        "nome_arquivo": nome,
        "texto_ocr": texto,
        "backend_ocr": backend_usado,
        "relevancia": "ALTA" if texto.strip() else "BAIXA",
    }


def _processar_log(log_texto: str, nome: str) -> dict:
    linhas = log_texto.split("\n")
    niveis_criticos = ["ERROR", "CRITICAL", "FATAL", "WARN", "Exception", "Traceback"]

    linhas_criticas = [l for l in linhas if any(n in l for n in niveis_criticos)]
    erros_por_componente = Counter(
        _extrair_componente(l) for l in linhas_criticas if "ERROR" in l or "CRITICAL" in l
    )

    contextos = _extrair_janelas(linhas, linhas_criticas[:10], janela=3)

    return {
        "tipo": "log",
        "nome_arquivo": nome,
        "total_linhas": len(linhas),
        "total_erros": sum(1 for l in linhas_criticas if "ERROR" in l or "CRITICAL" in l),
        "total_warnings": sum(1 for l in linhas_criticas if "WARN" in l),
        "erros_por_componente": dict(erros_por_componente),
        "contextos_criticos": contextos[:10],
        "relevancia": "ALTA" if erros_por_componente else "MEDIA",
    }


def _processar_csv(csv_bytes: bytes, nome: str, contexto_issue: str) -> dict:
    try:
        df = pd.read_csv(io.BytesIO(csv_bytes))
    except Exception as e:
        return {"tipo": "csv", "nome_arquivo": nome, "erro": str(e), "relevancia": "IGNORADO"}

    perfil = {
        "linhas": len(df),
        "colunas": list(df.columns),
        "nulos_por_coluna": df.isnull().sum().to_dict(),
        "amostra": df.head(3).to_dict(),
    }

    anomalias = []
    for col in df.select_dtypes(include="number").columns:
        z = zscore(df[col].dropna())
        outliers_idx = df[col].dropna().index[abs(z) > 3]
        if len(outliers_idx):
            anomalias.append({
                "coluna": col,
                "total_outliers": len(outliers_idx),
                "exemplos": df.loc[outliers_idx[:3], col].tolist(),
            })

    return {
        "tipo": "csv",
        "nome_arquivo": nome,
        "perfil": perfil,
        "anomalias": anomalias,
        "relevancia": "ALTA" if anomalias else "MEDIA",
    }


def _processar_pdf(pdf_bytes: bytes, nome: str, issue_key: str) -> dict:
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        paginas = len(reader.pages)
        texto = "\n".join(p.extract_text() or "" for p in reader.pages[:30])
    except Exception as e:
        return {"tipo": "pdf", "nome_arquivo": nome, "erro": str(e), "relevancia": "IGNORADO"}

    return {
        "tipo": "pdf",
        "nome_arquivo": nome,
        "total_paginas": paginas,
        "texto_extraido": texto[:6000],  # ~4.500 tokens máximo
        "relevancia": "ALTA" if texto.strip() else "BAIXA",
    }


def _extrair_componente(linha: str) -> str:
    """Extrai nome de classe/módulo de linha de log."""
    import re
    match = re.search(r"([A-Z][a-zA-Z0-9]+(?:Service|Controller|Repository|Handler|Manager))", linha)
    return match.group(1) if match else "desconhecido"


def _extrair_janelas(linhas: list[str], criticas: list[str], janela: int) -> list[dict]:
    resultado = []
    for critica in criticas[:10]:
        try:
            idx = linhas.index(critica)
            inicio = max(0, idx - janela)
            fim = min(len(linhas), idx + janela + 1)
            resultado.append({
                "linha_critica": critica,
                "contexto": linhas[inicio:fim],
            })
        except ValueError:
            resultado.append({"linha_critica": critica, "contexto": []})
    return resultado
```

---

### 4.2 `select_context` — Select (RAG)

Recupera o DoR atualizado e issues similares via RAG híbrido usando a infraestrutura existente.

```python
# jira_triage/nodes/select.py

from __future__ import annotations

import os

import psycopg
from langchain_ollama import OllamaEmbeddings

from .state import TriageState


def select_context(state: TriageState) -> dict:
    """
    Nó 2 — SELECT.
    RAG híbrido (denso + lexical) para recuperar:
    1. DoR atual (memória procedural) — filtrado por versao_dor = current
    2. Issues similares resolvidas (memória episódica) — top-3
    """
    query = _build_query(state)
    dor_chunks = _retrieve_dor(query)
    similar_issues = _retrieve_similar_issues(query)

    return {
        "dor_chunks": dor_chunks,
        "similar_issues": similar_issues,
    }


def _build_query(state: TriageState) -> str:
    """Constrói query de retrieval a partir da issue."""
    fields = state["issue_fields"]
    parts = [
        fields.get("summary", ""),
        fields.get("description", "")[:500],
        fields.get("components", ""),
        fields.get("actual_behavior", "")[:300],
    ]
    return " ".join(p for p in parts if p).strip()


def _retrieve_dor(query: str) -> list[str]:
    """
    Recupera chunks do DoR por RAG híbrido.
    Filtra por metadata: tipo = 'dor' AND versao = 'current'
    """
    embedder = OllamaEmbeddings(
        model=os.environ["OLLAMA_EMBEDDING_MODEL"],
        base_url=os.environ["OLLAMA_BASE_URL"],
    )
    query_vec = embedder.embed_query(query)

    dsn = (
        f"host={os.environ['POSTGRES_HOST']} "
        f"port={os.environ['POSTGRES_PORT']} "
        f"dbname={os.environ['POSTGRES_DB']} "
        f"user={os.environ['POSTGRES_USER']} "
        f"password={os.environ['POSTGRES_PASSWORD']}"
    )

    with psycopg.connect(dsn) as conn:
        rows = conn.execute(
            """
            SELECT content
            FROM langchain_pg_embedding
            WHERE cmetadata->>'tipo' = 'dor'
              AND cmetadata->>'versao' = 'current'
            ORDER BY embedding <=> %s::vector
            LIMIT 5
            """,
            (query_vec,),
        ).fetchall()

    return [row[0] for row in rows]


def _retrieve_similar_issues(query: str) -> list[dict]:
    """
    Recupera issues similares já resolvidas (memória episódica).
    Filtra por metadata: tipo = 'issue_resolvida'
    Retorna os 3 mais similares com decisão final registrada.
    """
    embedder = OllamaEmbeddings(
        model=os.environ["OLLAMA_EMBEDDING_MODEL"],
        base_url=os.environ["OLLAMA_BASE_URL"],
    )
    query_vec = embedder.embed_query(query)

    dsn = (
        f"host={os.environ['POSTGRES_HOST']} "
        f"port={os.environ['POSTGRES_PORT']} "
        f"dbname={os.environ['POSTGRES_DB']} "
        f"user={os.environ['POSTGRES_USER']} "
        f"password={os.environ['POSTGRES_PASSWORD']}"
    )

    with psycopg.connect(dsn) as conn:
        rows = conn.execute(
            """
            SELECT content, cmetadata
            FROM langchain_pg_embedding
            WHERE cmetadata->>'tipo' = 'issue_resolvida'
            ORDER BY embedding <=> %s::vector
            LIMIT 3
            """,
            (query_vec,),
        ).fetchall()

    return [{"resumo": row[0], "meta": row[1]} for row in rows]
```

---

### 4.3 `agent_checklist_dor` — Agente 1 (Write)

Valida campos obrigatórios contra o DoR recuperado. Escreve o resultado no scratchpad (state).

```python
# jira_triage/nodes/agent_checklist.py

from __future__ import annotations

import json
import os

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama

from .state import ChecklistResult, TriageState


def agent_checklist_dor(state: TriageState) -> dict:
    """
    Agente 1 — WRITE (scratchpad).
    Contexto isolado: vê apenas campos da issue + DoR.
    Não vê os anexos processados — isso é responsabilidade do Agente 2.
    Resultado é escrito no state para o Agente 2 ler.
    """
    llm = ChatOllama(
        model=os.environ.get("OLLAMA_LLM_MODEL", "llama3.2"),
        base_url=os.environ["OLLAMA_BASE_URL"],
        temperature=0,
    )

    dor_context = "\n\n".join(state["dor_chunks"]) if state["dor_chunks"] else "DoR não disponível."

    similar_ctx = ""
    if state["similar_issues"]:
        similar_ctx = "\n\nISSUES SIMILARES RESOLVIDAS:\n"
        for s in state["similar_issues"]:
            meta = s.get("meta", {})
            similar_ctx += f"- {s['resumo'][:200]} [decisão: {meta.get('decisao', '?')}]\n"

    fields = state["issue_fields"]
    issue_text = json.dumps({
        "summary": fields.get("summary", ""),
        "description": fields.get("description", "")[:1000],
        "priority": fields.get("priority", ""),
        "components": fields.get("components", ""),
        "environment": fields.get("environment", ""),
        "steps_to_reproduce": fields.get("steps_to_reproduce", ""),
        "expected_behavior": fields.get("expected_behavior", ""),
        "actual_behavior": fields.get("actual_behavior", ""),
        "version": fields.get("version", ""),
        "total_anexos": len(state["attachments_raw"]),
    }, ensure_ascii=False, indent=2)

    messages = [
        SystemMessage(content=(
            "Você é um analista de qualidade de issues de sistemas core banking.\n"
            "Valide se a issue abaixo atende ao Definition of Ready (DoR) fornecido.\n"
            "Responda APENAS com base nos documentos fornecidos.\n"
            "Retorne SOMENTE JSON válido, sem texto adicional.\n\n"
            "Formato obrigatório:\n"
            '{ "status": "ok" | "gaps_parciais" | "gap_critico",\n'
            '  "gaps": [{"campo": "...", "motivo": "..."}],\n'
            '  "resumo": "..." }'
        )),
        HumanMessage(content=(
            f"DEFINITION OF READY (versão atual):\n{dor_context}\n"
            f"{similar_ctx}\n"
            f"ISSUE A VALIDAR:\n{issue_text}"
        )),
    ]

    response = llm.invoke(messages)
    raw = response.content.strip()

    # Tenta extrair JSON mesmo se o LLM adicionou texto ao redor
    import re
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            result: ChecklistResult = json.loads(match.group())
        except json.JSONDecodeError:
            result = {
                "status": "gaps_parciais",
                "gaps": [{"campo": "parse_error", "motivo": f"Resposta LLM inválida: {raw[:200]}"}],
                "resumo": "Erro ao parsear resposta do LLM.",
            }
    else:
        result = {
            "status": "gaps_parciais",
            "gaps": [{"campo": "parse_error", "motivo": "LLM não retornou JSON."}],
            "resumo": raw[:300],
        }

    return {"checklist_result": result}
```

---

### 4.4 `agent_semantic_coherence` — Agente 2 (Isolate)

Verifica se os anexos processados são coerentes com a descrição da issue. Contexto completamente isolado do Agente 1 — recebe apenas o scratchpad com os gaps já identificados.

```python
# jira_triage/nodes/agent_coherence.py

from __future__ import annotations

import json
import os
import re

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama

from .state import CoherenceResult, TriageState


def agent_semantic_coherence(state: TriageState) -> dict:
    """
    Agente 2 — ISOLATE.
    Contexto independente: vê apenas anexos processados + scratchpad do Ag1.
    Nunca vê o raciocínio interno do Agente 1 — apenas o resultado estruturado.
    Avalia se as evidências são coerentes com o problema descrito.
    """
    llm = ChatOllama(
        model=os.environ.get("OLLAMA_LLM_MODEL", "llama3.2"),
        base_url=os.environ["OLLAMA_BASE_URL"],
        temperature=0,
    )

    # Scratchpad do Agente 1 — apenas o resultado, não o raciocínio
    checklist_summary = ""
    if state.get("checklist_result"):
        r = state["checklist_result"]
        checklist_summary = (
            f"RESULTADO DO CHECKLIST (Agente 1):\n"
            f"Status: {r['status']}\n"
            f"Resumo: {r['resumo']}\n"
            f"Gaps identificados: {json.dumps(r['gaps'], ensure_ascii=False)}\n"
        )

    # Apenas anexos relevantes — ignora os marcados como IGNORADO
    anexos_relevantes = [
        a for a in state["attachments_processed"]
        if a.get("relevancia") not in ("IGNORADO", "BAIXA")
    ]

    # Limita tamanho para não ultrapassar contexto do modelo local
    anexos_str = json.dumps(anexos_relevantes, ensure_ascii=False, indent=2)
    if len(anexos_str) > 6000:
        # Trunca textos OCR longos
        for a in anexos_relevantes:
            if "texto_ocr" in a:
                a["texto_ocr"] = a["texto_ocr"][:500]
            if "texto_extraido" in a:
                a["texto_extraido"] = a["texto_extraido"][:500]
        anexos_str = json.dumps(anexos_relevantes, ensure_ascii=False, indent=2)

    fields = state["issue_fields"]
    issue_summary = (
        f"Título: {fields.get('summary', '')}\n"
        f"Descrição: {fields.get('description', '')[:600]}\n"
        f"Comportamento esperado: {fields.get('expected_behavior', '')[:300]}\n"
        f"Comportamento atual: {fields.get('actual_behavior', '')[:300]}\n"
        f"Ambiente: {fields.get('environment', '')}\n"
        f"Versão: {fields.get('version', '')}\n"
    )

    messages = [
        SystemMessage(content=(
            "Você é um analista sênior de sistemas core banking.\n"
            "Avalie se as evidências anexadas são coerentes com o problema descrito.\n"
            "Perguntas-guia:\n"
            "  1. Os logs/screenshots mostram o erro que a issue descreve?\n"
            "  2. O ambiente e versão nos anexos batem com os campos da issue?\n"
            "  3. Os anexos contradizem alguma afirmação da descrição?\n"
            "Retorne SOMENTE JSON válido:\n"
            '{ "score": 0.0-1.0,\n'
            '  "observacoes": ["..."],\n'
            '  "anexos_relevantes": ["nome_do_arquivo"],\n'
            '  "anexos_contraditorios": ["nome_do_arquivo"] }'
        )),
        HumanMessage(content=(
            f"{checklist_summary}\n"
            f"ISSUE:\n{issue_summary}\n\n"
            f"ANEXOS PROCESSADOS:\n{anexos_str}"
        )),
    ]

    response = llm.invoke(messages)
    raw = response.content.strip()

    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            result: CoherenceResult = json.loads(match.group())
            # Garante que score é float entre 0 e 1
            result["score"] = max(0.0, min(1.0, float(result.get("score", 0.5))))
        except (json.JSONDecodeError, ValueError):
            result = {
                "score": 0.5,
                "observacoes": [f"Erro ao parsear: {raw[:200]}"],
                "anexos_relevantes": [],
                "anexos_contraditorios": [],
            }
    else:
        result = {
            "score": 0.5,
            "observacoes": ["LLM não retornou JSON válido."],
            "anexos_relevantes": [],
            "anexos_contraditorios": [],
        }

    return {"coherence_result": result}
```

---

### 4.5 `build_decision` — Fusão e score final

```python
# jira_triage/nodes/decision.py

from __future__ import annotations

from .state import TriageState


def build_decision(state: TriageState) -> dict:
    """
    Nó de fusão — combina resultados dos dois agentes e calcula score final.
    Não chama LLM. Lógica determinística.
    """
    checklist = state["checklist_result"]
    coherence = state["coherence_result"]

    # Score do checklist
    checklist_score = {
        "ok": 1.0,
        "gaps_parciais": 0.5,
        "gap_critico": 0.0,
    }.get(checklist["status"], 0.5)

    coherence_score = coherence["score"] if coherence else 0.5

    # Score combinado: checklist tem peso maior (70/30)
    combined = (checklist_score * 0.7) + (coherence_score * 0.3)

    # Decisão
    if combined >= 0.65:
        decision = "REFINAMENTO"
    elif combined >= 0.4:
        decision = "REVISAR_HUMANO"
    else:
        decision = "DESCARTAR"

    # Sources
    sources = []
    for chunk in state.get("dor_chunks", []):
        sources.append("dor_v_current")
    for a in state.get("attachments_processed", []):
        if a.get("relevancia") == "ALTA":
            sources.append(a["nome_arquivo"])

    justification = _build_justification(checklist, coherence, combined, decision)

    return {
        "confidence": round(combined, 3),
        "decision": decision,
        "justification": justification,
        "sources_used": list(dict.fromkeys(sources)),  # dedup preservando ordem
    }


def _build_justification(checklist, coherence, score: float, decision: str) -> str:
    parts = [f"Score combinado: {score:.2f}. Decisão: {decision}."]

    if checklist:
        parts.append(f"Checklist DoR: {checklist['status']} — {checklist['resumo']}")
        if checklist["gaps"]:
            gaps_str = "; ".join(f"{g['campo']} ({g['motivo']})" for g in checklist["gaps"])
            parts.append(f"Gaps: {gaps_str}")

    if coherence:
        parts.append(f"Coerência semântica: {coherence['score']:.2f}")
        if coherence["observacoes"]:
            parts.append("Observações: " + " | ".join(coherence["observacoes"][:3]))
        if coherence["anexos_contraditorios"]:
            parts.append(f"Contradições: {', '.join(coherence['anexos_contraditorios'])}")

    return " ".join(parts)
```

---

### 4.6 `human_review` — Interrupt para revisão humana

```python
# jira_triage/nodes/human_review.py

from __future__ import annotations

from langchain_core.runnables import RunnableConfig

from .state import TriageState


def human_review(state: TriageState, config: RunnableConfig) -> dict:
    """
    Nó de interrupt — pausa o grafo e aguarda override humano.
    O grafo fica suspenso até que seja retomado via:
      graph.invoke(Command(resume={"human_override": "REFINAMENTO", "human_notes": "..."}), config)

    O checkpointer persiste o estado completo durante a espera.
    """
    # Este nó é declarado com interrupt_before — o grafo para ANTES de chegar aqui.
    # Quando retomado, o override já foi injetado no state pelo chamador.
    override = state.get("human_override")
    notes = state.get("human_notes", "")

    if override:
        return {
            "decision": override,
            "justification": (
                state.get("justification", "") +
                f" [Revisão humana: {notes}]" if notes else state.get("justification", "")
            ),
        }

    # Se retomado sem override, mantém a decisão original
    return {}
```

---

### 4.7 `build_output_discard` e `build_output_final`

```python
# jira_triage/nodes/output.py

from __future__ import annotations

import json

from .state import TriageState


def build_output_discard(state: TriageState) -> dict:
    """
    Rota rápida: gap crítico detectado no checklist.
    Não passa pelo Agente 2 — economiza inferência.
    """
    checklist = state["checklist_result"]
    gaps_str = "; ".join(
        f"{g['campo']}: {g['motivo']}" for g in checklist.get("gaps", [])
    )
    return {
        "decision": "DESCARTAR",
        "confidence": 0.0,
        "justification": f"Gap crítico no DoR: {gaps_str}",
        "sources_used": ["dor_v_current"],
    }


def build_output_final(state: TriageState) -> dict:
    """Nó terminal — formata saída final para a API."""
    # O state já tem decision, confidence, justification.
    # Este nó apenas retorna sem modificar — o output é lido pela API.
    return {}


def format_jira_comment(state: TriageState) -> str:
    """Formata o comentário final para postar no Jira."""
    checklist = state.get("checklist_result", {})
    coherence = state.get("coherence_result", {})

    icon = "✅" if state["decision"] == "REFINAMENTO" else "❌"
    label = "DoR-OK" if state["decision"] == "REFINAMENTO" else "DoR-PENDENTE"

    lines = [
        f"{icon} *Validação Automática DoR — {label}*",
        f"*Decisão:* {state['decision']}",
        f"*Confiança:* {state['confidence']:.0%}",
        "",
        f"*Resumo:* {checklist.get('resumo', 'N/A')}",
    ]

    if checklist.get("gaps"):
        lines.append("\n*Campos a corrigir:*")
        for g in checklist["gaps"]:
            lines.append(f"  • {g['campo']}: {g['motivo']}")

    if coherence and coherence.get("observacoes"):
        lines.append("\n*Coerência das evidências:*")
        for obs in coherence["observacoes"][:3]:
            lines.append(f"  • {obs}")

    if state.get("human_notes"):
        lines.append(f"\n_Nota de revisão humana: {state['human_notes']}_")

    lines.append(f"\n_Fontes: {', '.join(state.get('sources_used', []))}_")

    return "\n".join(lines)
```

---

## 5. Edges e condicionais

```python
# jira_triage/graph.py

from __future__ import annotations

import os
from typing import Literal

from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, START, StateGraph

from .nodes.agent_checklist import agent_checklist_dor
from .nodes.agent_coherence import agent_semantic_coherence
from .nodes.decision import build_decision
from .nodes.human_review import human_review
from .nodes.ingest import ingest_attachments
from .nodes.output import build_output_discard, build_output_final
from .nodes.select import select_context
from .state import TriageState


# ─── Funções de roteamento ─────────────────────────────────────────────────

def route_after_ingest(state: TriageState) -> Literal["select_context", "ingest_attachments"]:
    """Se OCR retornou vazio nos anexos de imagem e ainda não tentamos retry, tenta de novo."""
    imagens_sem_ocr = [
        a for a in state.get("attachments_processed", [])
        if a.get("tipo") == "imagem" and not a.get("texto_ocr", "").strip()
    ]
    retry_count = state.get("ocr_retry_count", 0)

    if imagens_sem_ocr and retry_count < 1:
        return "ingest_attachments"  # loop de retry
    return "select_context"


def route_after_checklist(state: TriageState) -> Literal[
    "agent_semantic_coherence", "build_output_discard"
]:
    """Gap crítico reprova sem chamar o Agente 2."""
    checklist = state.get("checklist_result", {})
    if checklist.get("status") == "gap_critico":
        return "build_output_discard"
    return "agent_semantic_coherence"


def route_after_decision(state: TriageState) -> Literal[
    "human_review", "build_output_final"
]:
    """Baixa confiança aciona revisão humana."""
    if state.get("decision") == "REVISAR_HUMANO":
        return "human_review"
    return "build_output_final"


# ─── Construção do grafo ───────────────────────────────────────────────────

def build_graph():
    """Constrói e compila o StateGraph de triagem."""

    builder = StateGraph(TriageState)

    # Registra nós
    builder.add_node("ingest_attachments", ingest_attachments)
    builder.add_node("select_context", select_context)
    builder.add_node("agent_checklist_dor", agent_checklist_dor)
    builder.add_node("agent_semantic_coherence", agent_semantic_coherence)
    builder.add_node("build_decision", build_decision)
    builder.add_node("human_review", human_review)
    builder.add_node("build_output_discard", build_output_discard)
    builder.add_node("build_output_final", build_output_final)

    # Edges simples
    builder.add_edge(START, "ingest_attachments")
    builder.add_edge("select_context", "agent_checklist_dor")
    builder.add_edge("agent_semantic_coherence", "build_decision")
    builder.add_edge("build_output_discard", END)
    builder.add_edge("build_output_final", END)
    builder.add_edge("human_review", "build_output_final")

    # Edges condicionais
    builder.add_conditional_edges("ingest_attachments", route_after_ingest)
    builder.add_conditional_edges("agent_checklist_dor", route_after_checklist)
    builder.add_conditional_edges("build_decision", route_after_decision)

    # Checkpointer — PostgreSQL para persistir estado durante human_review
    dsn = (
        f"postgresql://{os.environ['POSTGRES_USER']}:{os.environ['POSTGRES_PASSWORD']}"
        f"@{os.environ['POSTGRES_HOST']}:{os.environ['POSTGRES_PORT']}"
        f"/{os.environ['POSTGRES_DB']}"
    )
    checkpointer = PostgresSaver.from_conn_string(dsn)
    checkpointer.setup()  # cria tabelas de checkpoint se não existirem

    return builder.compile(
        checkpointer=checkpointer,
        interrupt_before=["human_review"],  # pausa ANTES do nó de revisão
    )


# Instância singleton — carregada uma vez por processo
_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph
```

---

## 6. Código completo

### Estrutura de arquivos

```
jira-triage/
├── README.md                     ← Visão geral do sistema
├── LANGGRAPH_PIPELINE.md         ← Este documento
│
├── jira_triage/
│   ├── __init__.py
│   ├── state.py                  ← TypedDict: TriageState
│   ├── graph.py                  ← StateGraph: construção + edges
│   │
│   └── nodes/
│       ├── __init__.py
│       ├── ingest.py             ← Nó 1: OCR + log + CSV + PDF
│       ├── select.py             ← Nó 2: RAG DoR + issues similares
│       ├── agent_checklist.py    ← Agente 1: validação DoR
│       ├── agent_coherence.py    ← Agente 2: coerência semântica
│       ├── decision.py           ← Fusão + score final
│       ├── human_review.py       ← Interrupt (revisão humana)
│       └── output.py             ← Formatação Jira + nós terminais
│
└── main.py                       ← Entrypoint de teste
```

### `main.py` — Entrypoint para teste manual

```python
# jira_triage/main.py

from __future__ import annotations

import json
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from jira_triage.graph import get_graph
from jira_triage.nodes.output import format_jira_comment

# Issue de exemplo
issue_simulada = {
    "issue_key": "COREB-4521",
    "issue_fields": {
        "summary": "Erro no processamento de TEDs acima de R$ 50.000",
        "description": "Ao tentar realizar TED acima de 50k, o sistema retorna erro 500 sem mensagem de detalhe.",
        "priority": "Alta",
        "components": "ted-processor",
        "environment": "homologação",
        "steps_to_reproduce": "1. Acessar módulo TED\n2. Inserir valor > 50.000\n3. Confirmar operação",
        "expected_behavior": "TED processado com confirmação",
        "actual_behavior": "HTTP 500 - Internal Server Error",
        "version": "2.14.3",
    },
    "attachments_raw": [
        {
            "nome": "screenshot-erro.png",
            "bytes": Path("fixtures/screenshot-erro.png").read_bytes(),
            "tipo": ".png",
        },
        {
            "nome": "application.log",
            "bytes": Path("fixtures/application.log").read_bytes(),
            "tipo": ".log",
        },
    ],
}

config = {"configurable": {"thread_id": issue_simulada["issue_key"]}}

graph = get_graph()

# 1ª execução — roda até o final (ou até interrupt)
result = graph.invoke(issue_simulada, config=config)

if result.get("decision") == "REVISAR_HUMANO":
    print("⏸  Pipeline pausado — aguardando revisão humana.")
    print(f"Confiança: {result['confidence']:.0%}")
    print(f"Justificativa: {result['justification']}")

    # Simula override humano
    from langgraph.types import Command
    result = graph.invoke(
        Command(resume={
            "human_override": "REFINAMENTO",
            "human_notes": "Evidências suficientes. Aprovado manualmente.",
        }),
        config=config,
    )

print("\n=== RESULTADO FINAL ===")
print(json.dumps({
    "decisao": result["decision"],
    "confianca": result["confidence"],
    "justificativa": result["justification"],
    "fontes": result["sources_used"],
}, ensure_ascii=False, indent=2))

print("\n=== COMENTÁRIO JIRA ===")
print(format_jira_comment(result))
```

---

## 7. Como rodar

### Dependências adicionais

```bash
# No requirements.txt já existente, adicionar:
pip install langgraph langgraph-checkpoint-postgres pypdf scipy pandas
```

### Variáveis de ambiente

Nenhuma nova variável necessária — usa o `.env` existente:

```
POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
OLLAMA_BASE_URL, OLLAMA_LLM_MODEL, OLLAMA_EMBEDDING_MODEL
```

### Executar o pipeline manualmente

```bash
cd c:\Users\mengl\Documents\GitHub\rag
.\.venv\Scripts\python.exe -m jira_triage.main
```

### Testar um nó isolado

```python
from jira_triage.nodes.ingest import ingest_attachments

state_parcial = {
    "issue_key": "TEST-001",
    "issue_fields": {"summary": "Teste"},
    "attachments_raw": [
        {"nome": "erro.png", "bytes": open("fixtures/erro.png", "rb").read(), "tipo": ".png"}
    ],
    "ocr_retry_count": 0,
    "attachments_processed": [],
}

resultado = ingest_attachments(state_parcial)
print(resultado["attachments_processed"])
```

---

## 8. Integração com a API FastAPI

```python
# api/routers/jira_webhook.py

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from jira_triage.graph import get_graph
from jira_triage.nodes.output import format_jira_comment

router = APIRouter(prefix="/webhook", tags=["jira"])


class JiraWebhookPayload(BaseModel):
    issue_key: str
    issue_fields: dict[str, Any]
    attachments: list[dict[str, Any]] = []


@router.post("/jira/issue-created")
async def handle_issue_created(
    payload: JiraWebhookPayload,
    background_tasks: BackgroundTasks,
):
    """
    Recebe webhook do Jira ao criar issue.
    Inicia o pipeline LangGraph em background.
    Retorna 202 imediatamente — não bloqueia o Jira.
    """
    background_tasks.add_task(_run_triage, payload)
    return {"status": "accepted", "issue_key": payload.issue_key}


async def _run_triage(payload: JiraWebhookPayload):
    graph = get_graph()
    config = {"configurable": {"thread_id": payload.issue_key}}

    initial_state = {
        "issue_key": payload.issue_key,
        "issue_fields": payload.issue_fields,
        "attachments_raw": payload.attachments,
        "ocr_retry_count": 0,
        "attachments_processed": [],
        "dor_chunks": [],
        "similar_issues": [],
        "checklist_result": None,
        "coherence_result": None,
        "confidence": 0.0,
        "decision": "",
        "justification": "",
        "sources_used": [],
        "human_override": None,
        "human_notes": None,
    }

    result = await asyncio.to_thread(graph.invoke, initial_state, config)

    comment = format_jira_comment(result)
    await _post_jira_comment(payload.issue_key, comment, result["decision"])


async def _post_jira_comment(issue_key: str, comment: str, decision: str):
    """Posta comentário e aplica label no Jira via API REST."""
    import httpx
    import os

    jira_base = os.environ.get("JIRA_BASE_URL", "")
    jira_token = os.environ.get("JIRA_API_TOKEN", "")

    if not jira_base or not jira_token:
        return  # Jira não configurado — apenas loga

    headers = {
        "Authorization": f"Bearer {jira_token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        # Posta comentário
        await client.post(
            f"{jira_base}/rest/api/3/issue/{issue_key}/comment",
            headers=headers,
            json={"body": {"type": "doc", "version": 1, "content": [
                {"type": "paragraph", "content": [{"type": "text", "text": comment}]}
            ]}},
        )

        # Aplica label
        label = "DoR-OK" if decision == "REFINAMENTO" else "DoR-PENDENTE"
        await client.put(
            f"{jira_base}/rest/api/3/issue/{issue_key}",
            headers=headers,
            json={"update": {"labels": [{"add": label}]}},
        )
```

Adicionar ao `.env`:
```
JIRA_BASE_URL=https://sua-empresa.atlassian.net
JIRA_API_TOKEN=seu_token_jira
```

---

## 9. Extensões futuras

### Human-in-the-loop via API

Adicionar endpoint para o lead técnico aprovar/reprovar via painel interno, sem precisar acessar o Jira:

```python
@router.post("/triage/{issue_key}/override")
async def human_override(issue_key: str, decision: str, notes: str):
    from langgraph.types import Command
    graph = get_graph()
    config = {"configurable": {"thread_id": issue_key}}
    result = graph.invoke(
        Command(resume={"human_override": decision, "human_notes": notes}),
        config=config,
    )
    return {"issue_key": issue_key, "decision": result["decision"]}
```

### Memória episódica — indexar issues validadas

Após cada decisão final, indexar a issue no pgvector como memória episódica para issues futuras:

```python
# Após build_output_final, adicionar nó: index_as_episodic_memory
def index_as_episodic_memory(state: TriageState) -> dict:
    """Indexa a issue resolvida para uso como exemplo em issues futuras."""
    from langchain_ollama import OllamaEmbeddings
    # ... indexa em langchain_pg_embedding com metadata tipo='issue_resolvida'
    return {}
```

### LangSmith para observabilidade

```bash
pip install langsmith
```

```
# .env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=seu_langsmith_key
LANGCHAIN_PROJECT=jira-triage
```

Cada execução do grafo aparece no painel LangSmith com trace completo: nós executados, duração, tokens consumidos por nó, state em cada passo.

---

*Stack: LangGraph + LangChain + ChatOllama (llama3.2) + OllamaEmbeddings (nomic-embed-text) + pgvector + psycopg + PostgresSaver (checkpointer). Integra com OCR existente: Chandra2, GLM TrOCR, RapidOCR.*
