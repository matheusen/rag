# Jira Issue Triage — Validação Automática com LLM + OCR

Sistema de triagem automática de issues do Jira via webhook. Ao criar uma issue, a API valida automaticamente se ela está corretamente preenchida, analisa a coerência das evidências e preenche o Document of Ready (DoR), orientando o autor sobre o que falta.

---

## Índice

- [Jira Issue Triage — Validação Automática com LLM + OCR](#jira-issue-triage--validação-automática-com-llm--ocr)
  - [Índice](#índice)
  - [1. Visão Geral](#1-visão-geral)
    - [Objetivo](#objetivo)
    - [O que é validado](#o-que-é-validado)
  - [2. Fluxo Completo](#2-fluxo-completo)
  - [3. Camada 1 — Validação Estrutural](#3-camada-1--validação-estrutural)
  - [4. Camada 2 — Estratégia por Tipo de Anexo](#4-camada-2--estratégia-por-tipo-de-anexo)
    - [Tabela de roteamento final](#tabela-de-roteamento-final)
  - [5. Modelos OCR — Chandra 2 e MonkeyOCR](#5-modelos-ocr--chandra-2-e-monkeyocr)
    - [Chandra 2 — Datalab (Mar 2026)](#chandra-2--datalab-mar-2026)
    - [MonkeyOCR-pro-3B — Yuliang Liu et al. (Jun 2025)](#monkeyocr-pro-3b--yuliang-liu-et-al-jun-2025)
    - [Quando usar cada um](#quando-usar-cada-um)
  - [6. Schemas JSON por Tipo de Anexo](#6-schemas-json-por-tipo-de-anexo)
    - [Schema: Screenshot de erro](#schema-screenshot-de-erro)
    - [Schema: Arquivo de log](#schema-arquivo-de-log)
    - [Schema: Documento PDF](#schema-documento-pdf)
    - [Schema: Genérico (fallback)](#schema-genérico-fallback)
  - [7. Camada 3 — Validação Semântica com LLM](#7-camada-3--validação-semântica-com-llm)
  - [8. Camada 4 — Preenchimento do DoR e Orientação Final](#8-camada-4--preenchimento-do-dor-e-orientação-final)
  - [9. Implementação da API FastAPI](#9-implementação-da-api-fastapi)
  - [10. Exemplo de Comentário no Jira](#10-exemplo-de-comentário-no-jira)
  - [11. Custo por Issue](#11-custo-por-issue)
  - [12. Estratégia RAG vs Long Context vs Map-Reduce](#12-estratégia-rag-vs-long-context-vs-map-reduce)
  - [13. Stack e Dependências](#13-stack-e-dependências)
    - [Estrutura de arquivos sugerida](#estrutura-de-arquivos-sugerida)

---

## 1. Visão Geral

### Objetivo

Quando uma issue é criada no Jira, o sistema:

1. Valida campos obrigatórios (sem LLM — rápido e barato)
2. Processa todos os anexos com OCR dedicado e converte para JSON
3. Analisa a coerência entre descrição, passos de reprodução e evidências
4. Preenche o checklist do DoR automaticamente
5. Posta um comentário no Jira com resultado + orientação

### O que é validado

- Campos obrigatórios preenchidos (título, descrição, ambiente, versão, etc.)
- Passos de reprodução completos e ordenados
- Evidências presentes (log, screenshot, vídeo)
- Coerência dos logs com o problema descrito
- Screenshots mostrando o erro relatado
- DoR completo com orientação de próximos passos

---

## 2. Fluxo Completo

```
Jira cria issue
      │
      ▼
[Webhook] ──POST──► FastAPI /webhook/jira/issue-created
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
      [Campos]    [Anexos]    [Reprodução]
      (rápido)   (pesado)     (semântico)
            │           │           │
            └───────────┴───────────┘
                        │
                        ▼
              [Camada 1: Validação Estrutural]
              Sem LLM — regras fixas
              Se reprovado → posta no Jira e PARA
                        │
                        ▼
              [Camada 2: OCR dos Anexos]
              Chandra 2 / MonkeyOCR → JSON por anexo
              Paralelo com asyncio.gather
                        │
                        ▼
              [Camada 3: Validação Semântica]
              LLM analisa coerência entre campos e evidências
                        │
                        ▼
              [Camada 4: Prompt DoR + Checklist]
              LLM preenche checklist e orienta
                        │
                        ▼
              [POST comment no Jira]
              Label: DoR-OK ou DoR-PENDENTE
```

---

## 3. Camada 1 — Validação Estrutural

Roda primeiro, sem LLM. Se já reprova aqui, para imediatamente — sem custo de inferência.

```python
class DORChecker:
    CAMPOS_OBRIGATORIOS = [
        "summary",              # título
        "description",          # descrição
        "priority",             # prioridade
        "components",           # componente afetado
        "environment",          # ambiente (prod/homolog/dev)
        "steps_to_reproduce",   # campo customizado Jira
        "expected_behavior",    # comportamento esperado
        "actual_behavior",      # comportamento atual
        "version",              # versão afetada
    ]

    ANEXOS_MINIMOS = {
        "deve_ter_pelo_menos_um": True,
        "tipos_aceitos": [".log", ".txt", ".pdf", ".png", ".jpg", ".mp4"],
        "tamanho_maximo_mb": 50,
    }

    def validar(self, issue: JiraIssue) -> ResultadoEstrutural:
        erros = []
        avisos = []

        # Verifica campos obrigatórios
        for campo in self.CAMPOS_OBRIGATORIOS:
            if not issue.get(campo):
                erros.append(f"Campo obrigatório ausente: {campo}")

        # Reprodução tem conteúdo mínimo
        steps = issue.get("steps_to_reproduce", "")
        if len(steps.strip().split("\n")) < 2:
            avisos.append("Reprodução parece incompleta — menos de 2 passos descritos")

        # Pelo menos um anexo
        if not issue.attachments:
            erros.append("Nenhuma evidência anexada (log, screenshot ou vídeo)")

        return ResultadoEstrutural(
            erros=erros,
            avisos=avisos,
            reprovado_critico=len(erros) > 0
        )
```

**Regra:** se `reprovado_critico == True` → posta comentário com lista de erros e encerra. Nenhuma chamada de LLM ou OCR é feita.

---

## 4. Camada 2 — Estratégia por Tipo de Anexo

Cada tipo de anexo tem uma estratégia diferente. **Não existe abordagem única** — log, CSV e PDF têm naturezas distintas e exigem pipelines distintos.

### Por que estratégias diferentes

```
Tipo            | Tamanho típico     | Tokens brutos     | Problema
────────────────|--------------------|-------------------|──────────────────────
Screenshot      | ~200 KB            | ~400 tokens       | Precisa de OCR
Log (1h prod)   | ~5 MB              | ~80.000 tokens    | Enorme, maioria irrelevante
Log (1 dia)     | ~50 MB             | ~800.000 tokens   | Não cabe em contexto algum
CSV (10k linhas)| ~2 MB              | ~80.000 tokens    | Busca semântica não funciona
CSV (100k linhas)| ~20 MB            | ~800.000 tokens   | Precisa de análise estatística
PDF simples     | ~500 KB            | ~5.000 tokens     | Cabe direto no contexto
PDF grande      | ~10 MB             | ~80.000 tokens    | RAG por seções
```

Mandar log ou CSV inteiro para o LLM é caro e ineficaz. A solução é **reduzir antes de enviar**.

---

### Estratégia: Screenshot → Chandra 2 OCR → JSON

```python
async def processar_screenshot(conteudo: bytes, nome: str) -> dict:
    # Chandra 2 extrai o texto da imagem
    texto = chandra.parse(conteudo, output_format="markdown")

    # Gemini Flash mapeia para o schema de erro
    return await mapear_para_json(texto, SCHEMA_SCREENSHOT, nome)
```

Resultado: ~400 tokens → JSON direto. Custo: ~$0,001.

---

### Estratégia: Log → Parser estruturado → JSON de eventos críticos

Log não precisa de OCR (já é texto) e **não deve ser enviado inteiro ao LLM**.

```python
def processar_log(log_texto: str, nome: str) -> dict:

    linhas = log_texto.split("\n")

    # 1. Filtra só o que importa — sem LLM, sem custo
    niveis_criticos = ["ERROR", "CRITICAL", "FATAL", "WARN", "Exception", "Traceback"]
    linhas_criticas = [l for l in linhas if any(n in l for n in niveis_criticos)]
    # Log de 80k tokens → 200–500 linhas críticas → ~3.000 tokens

    # 2. Agrupa por componente
    erros_por_componente = Counter(
        extrair_componente(l) for l in linhas_criticas if "ERROR" in l
    )

    # 3. Extrai janela de contexto ao redor de cada erro (5 linhas antes/depois)
    contextos = extrair_janelas(linhas, linhas_criticas, janela=5)

    # 4. LLM analisa APENAS as linhas críticas + contexto — nunca o log inteiro
    resumo = await gemini_flash.generate(f"""
        Analise estes eventos críticos de log e retorne JSON:
        {json.dumps(contextos[:15], indent=2)}
    """)

    return {
        "tipo": "log",
        "nome_arquivo": nome,
        "total_linhas": len(linhas),
        "total_erros": len([l for l in linhas_criticas if "ERROR" in l]),
        "total_warnings": len([l for l in linhas_criticas if "WARN" in l]),
        "erros_por_componente": dict(erros_por_componente),
        "primeiro_erro_timestamp": extrair_timestamp(linhas_criticas[0]) if linhas_criticas else None,
        "contextos_criticos": contextos[:15],
        "resumo_llm": resumo,
        "relevancia_para_issue": "ALTA" if erros_por_componente else "BAIXA"
    }
```

**Resultado:** log de 80k tokens → JSON de ~3k tokens. **Custo: ~$0,003. Economia: 96%.**

---

### Estratégia: CSV → Análise estatística → JSON de anomalias

CSV é dado estruturado. Busca semântica não funciona. A abordagem correta é análise estatística:

```python
def processar_csv(csv_bytes: bytes, nome: str, contexto_issue: str) -> dict:
    df = pd.read_csv(io.BytesIO(csv_bytes))

    # 1. Perfil automático — sem LLM
    perfil = {
        "linhas": len(df),
        "colunas": list(df.columns),
        "nulos_por_coluna": df.isnull().sum().to_dict(),
        "tipos_de_dados": df.dtypes.astype(str).to_dict(),
        "amostra": df.head(3).to_dict()
    }

    # 2. Detecção de anomalias — sem LLM
    anomalias = []
    for col in df.select_dtypes(include="number").columns:
        z = zscore(df[col].dropna())
        outliers = df[abs(z) > 3]
        if len(outliers):
            anomalias.append({
                "coluna": col,
                "total_outliers": len(outliers),
                "exemplos": outliers.head(3).to_dict()
            })

    # 3. LLM interpreta perfil + anomalias em relação à issue
    # Envia apenas o PERFIL (~500 tokens), nunca o CSV inteiro
    interpretacao = await gemini_flash.generate(f"""
        Issue relatada: {contexto_issue}

        Perfil do CSV "{nome}":
        {json.dumps(perfil, indent=2)}

        Anomalias detectadas:
        {json.dumps(anomalias, indent=2)}

        Este CSV é uma evidência relevante para a issue? O que revela?
        Retorne JSON com: relevancia (ALTA/MEDIA/BAIXA/NENHUMA), analise, campos_suspeitos.
    """)

    return {**perfil, "anomalias": anomalias, "interpretacao": json.loads(interpretacao)}
```

**Resultado:** CSV de 800k tokens → JSON de ~2k tokens. **Custo: ~$0,002. Economia: 99%.**

---

### Estratégia: PDF pequeno (<30 pág) → Long context direto

```python
async def processar_pdf_pequeno(pdf_bytes: bytes, nome: str) -> dict:
    # pypdf para PDFs simples (sem imagens/tabelas complexas)
    texto = extrair_pdf_pypdf(pdf_bytes)           # ~5.000 tokens
    # MonkeyOCR para PDFs com layout complexo
    # texto = monkey_ocr.parse(pdf_bytes, output="markdown")
    return await mapear_para_json(texto, SCHEMA_DOCUMENTO, nome)
```

---

### Estratégia: PDF grande (>30 pág) → RAG temporário por issue

Para PDFs grandes, RAG é a abordagem certa — você não precisa de todas as seções, só das relevantes para a issue:

```python
async def processar_pdf_grande(
    pdf_bytes: bytes,
    nome: str,
    query_issue: str,
    issue_key: str
) -> dict:

    # 1. MonkeyOCR extrai o PDF em chunks por seção
    chunks = monkey_ocr.parse(pdf_bytes, output_format="chunks")
    # 200 páginas → ~80 chunks de ~1.000 tokens cada

    # 2. Indexa temporariamente no pgvector (só para essa issue)
    vectorstore = PGVector.from_documents(
        documents    = chunks,
        embedding    = VertexAIEmbeddings(model="text-embedding-004"),
        collection_name = f"issue_temp_{issue_key}_{nome}"
    )

    # 3. RAG: recupera as 5 seções mais relevantes para a issue
    secoes = vectorstore.similarity_search(query_issue, k=5)
    # 80 chunks → 5 relevantes → ~5.000 tokens

    # 4. LLM analisa apenas as seções relevantes
    analise = await gemini_pro.generate(f"""
        Issue: {query_issue}
        Seções relevantes do PDF "{nome}":
        {[s.page_content for s in secoes]}
        Retorne JSON com: relevancia, analise, campos_encontrados, campos_ausentes.
    """)

    # 5. Remove índice temporário
    vectorstore.delete_collection(f"issue_temp_{issue_key}_{nome}")

    return {
        "tipo": "pdf_grande",
        "nome_arquivo": nome,
        "total_chunks": len(chunks),
        "chunks_usados": len(secoes),
        "analise": json.loads(analise)
    }
```

---

### Tabela de roteamento final

| Tipo de anexo | Tamanho | Estratégia | Tokens enviados ao LLM | RAG? |
| --- | --- | --- | --- | --- |
| Screenshot | qualquer | Chandra 2 OCR → JSON | ~400 | Não |
| Log pequeno (<500 linhas) | <1 MB | Long context direto | ~3.000 | Não |
| Log grande (>500 linhas) | >1 MB | Parser + janela deslizante | ~3.000 | Não |
| CSV pequeno (<5k linhas) | <500 KB | Long context direto | ~5.000 | Não |
| CSV grande (>5k linhas) | >500 KB | pandas + zscore | ~2.000 | Não |
| PDF simples (<30 pág) | <2 MB | pypdf + long context | ~5.000 | Não |
| PDF complexo (<30 pág) | <2 MB | MonkeyOCR + long context | ~8.000 | Não |
| PDF grande (>30 pág) | >2 MB | MonkeyOCR + RAG temporário | ~5.000 | **Sim** |
| Formulário / checkbox | qualquer | Chandra 2 OCR → JSON | ~600 | Não |
| Manuscrito / foto | qualquer | Chandra 2 OCR → JSON | ~500 | Não |

**Conclusão:** RAG entra apenas para PDFs grandes. Para logs e CSVs — por maiores que sejam — parsing estruturado e análise estatística são mais eficazes e ordens de magnitude mais baratos que busca por similaridade semântica.

---

## 5. Modelos OCR — Chandra 2 e MonkeyOCR

### Chandra 2 — Datalab (Mar 2026)

Modelo de 5B parâmetros especializado em conversão de documentos para markdown, HTML e JSON com preservação de layout.

**Benchmarks:**

| Benchmark | Chandra 2 | Gemini 2.5 Flash | Diferença |
| --- | --- | --- | --- |
| olmOCR Benchmark | **85,9%** | — | SOTA |
| 90 idiomas | **72,7%** | 60,8% | +12pp |
| Tabelas (olmOCR) | **89,9%** | — | SOTA |
| ArXiv parsing | **90,2%** | — | SOTA |

**Pontos fortes:** formulários, checkboxes, manuscritos, 90+ idiomas, tabelas complexas.

**Deploy:**
```bash
pip install chandra-ocr

# CLI
chandra input.pdf ./output --format json

# Python
from chandra_ocr import ChandraOCR
ocr = ChandraOCR()
resultado = ocr.parse(pdf_bytes, output_format="json")

# vLLM (recomendado para produção — 1,44 pág/seg em H100)
vllm serve datalab-to/chandra-ocr-2
```

---

### MonkeyOCR-pro-3B — Yuliang Liu et al. (Jun 2025)

Modelo de 3B parâmetros baseado no paradigma SRR (Structure-Recognition-Relation) para parsing de documentos complexos.

**Benchmarks:**

| Benchmark | MonkeyOCR | Referência | Resultado |
| --- | --- | --- | --- |
| OmniDocBench v1.5 | **SOTA** | MinerU 2.5 | +2,34% |
| OmniDocBench v1.5 | **SOTA** | Gemini 2.0 Flash | Supera |
| PubTabNet | **SOTA** | Qwen2.5-VL-72B | Supera |
| OCRFlux-complex | — | PaddleOCR-VL | +9,2% |

**Diferencial:** output JSON com coordenadas de bloco, posições, tipo de conteúdo e relações entre elementos — ideal para documentos com layout complexo.

**Deploy:**
```bash
git clone https://github.com/Yuliang-Liu/MonkeyOCR
cd MonkeyOCR
pip install -r requirements.txt

# CLI
python parse.py input_path --output json

# FastAPI (built-in)
python app.py  # expõe endpoint /parse
```

---

### Quando usar cada um

| Situação | Chandra 2 | MonkeyOCR |
| --- | --- | --- |
| Screenshots com texto | Primeira opção | — |
| Formulários e checkboxes | Primeira opção | — |
| PDFs com tabelas complexas | — | Primeira opção |
| PDFs com layout elaborado | — | Primeira opção |
| Múltiplos idiomas / manuscrito | Primeira opção | — |
| Código / logs em imagem | Chandra 2 | MonkeyOCR |
| Documentos técnicos estruturados | — | Primeira opção |

---

## 6. Schemas JSON por Tipo de Anexo

### Schema: Screenshot de erro

```json
{
  "tipo": "screenshot_erro",
  "nome_arquivo": "string",
  "erro": {
    "codigo_http": "string ou null",
    "mensagem": "string",
    "stack_trace_visivel": "boolean",
    "url_afetada": "string ou null",
    "timestamp_visivel": "string ou null"
  },
  "ambiente": {
    "browser": "string ou null",
    "resolucao": "string ou null",
    "sistema_operacional": "string ou null"
  },
  "estado_ui": "descrição do estado da interface no momento do erro",
  "relevancia_para_issue": "ALTA | MEDIA | BAIXA | NENHUMA",
  "confirma_problema_descrito": "boolean",
  "observacoes": "string"
}
```

### Schema: Arquivo de log

```json
{
  "tipo": "log",
  "nome_arquivo": "string",
  "periodo": {
    "inicio": "ISO datetime ou null",
    "fim": "ISO datetime ou null"
  },
  "erros": [
    {
      "nivel": "ERROR | CRITICAL | FATAL",
      "timestamp": "string",
      "componente": "string",
      "mensagem": "string",
      "tem_stack_trace": "boolean"
    }
  ],
  "warnings": [
    {
      "timestamp": "string",
      "componente": "string",
      "mensagem": "string"
    }
  ],
  "componentes_envolvidos": ["lista de serviços/classes mencionados"],
  "relevancia_para_issue": "ALTA | MEDIA | BAIXA | NENHUMA",
  "confirma_componente_descrito": "boolean",
  "observacoes": "string"
}
```

### Schema: Documento PDF

```json
{
  "tipo": "documento",
  "nome_arquivo": "string",
  "secoes_identificadas": ["lista de seções encontradas"],
  "tabelas_encontradas": "integer",
  "campos_extraidos": {
    "versao_sistema": "string ou null",
    "data_ocorrencia": "string ou null",
    "frequencia_reproducao": "string ou null",
    "usuario_afetado": "string ou null"
  },
  "completude_estimada": "0.0 a 1.0",
  "campos_ausentes": ["campos esperados mas não encontrados"],
  "relevancia_para_issue": "ALTA | MEDIA | BAIXA | NENHUMA",
  "observacoes": "string"
}
```

### Schema: Genérico (fallback)

```json
{
  "tipo": "generico",
  "nome_arquivo": "string",
  "conteudo_resumido": "string de até 500 caracteres",
  "relevancia_para_issue": "ALTA | MEDIA | BAIXA | NENHUMA",
  "observacoes": "string"
}
```

---

## 7. Camada 3 — Validação Semântica com LLM

Uma issue típica tem ~4.000–6.000 tokens com todos os campos e anexos processados. Cabe inteiramente no contexto do Gemini — **sem necessidade de RAG aqui**. Long context direto é mais simples e mais confiável para análise de uma issue individual.

```python
PROMPT_VALIDACAO_SEMANTICA = """
Você é um analista de qualidade de software revisando uma issue de bug.
Analise a COERÊNCIA entre todos os elementos abaixo.

=== CAMPOS DA ISSUE ===
Título: {titulo}
Descrição: {descricao}
Comportamento esperado: {expected}
Comportamento atual: {actual}
Passos para reprodução:
{steps}
Ambiente: {ambiente}
Versão: {versao}
Componente: {componente}

=== ANEXOS PROCESSADOS ===
{anexos_em_json}

=== TAREFA ===
Analise e retorne SOMENTE um JSON com esta estrutura:

{{
  "reproducao": {{
    "completa": true | false,
    "numero_de_passos": integer,
    "passos_ausentes": ["lista de gaps identificados nos passos"],
    "sugestoes": ["o que está faltando para reproduzir o problema"]
  }},
  "coerencia_evidencias": {{
    "logs_confirmam_problema": true | false | null,
    "screenshots_mostram_erro": true | false | null,
    "analise": "explicação detalhada — os anexos confirmam o problema descrito?",
    "evidencias_relevantes": ["anexos que confirmam o problema e por quê"],
    "evidencias_irrelevantes": ["anexos que não ajudam a entender o problema"],
    "conflitos_identificados": ["inconsistências entre campos e anexos"]
  }},
  "qualidade_geral": {{
    "score": 0,
    "justificativa": "resumo executivo de uma linha"
  }}
}}

Score de qualidade: 0 (vazio) a 10 (perfeita para triagem).
"""
```

---

## 8. Camada 4 — Preenchimento do DoR e Orientação Final

```python
PROMPT_DOR_FINAL = """
Com base na validação estrutural e semântica abaixo, preencha o
Document of Ready (DoR) e forneça orientação clara ao autor.

=== RESULTADO DA VALIDAÇÃO ESTRUTURAL ===
{resultado_estrutural}

=== RESULTADO DA VALIDAÇÃO SEMÂNTICA ===
{resultado_semantico}

=== CHECKLIST DoR ===
Preencha cada item como:
✅ OK — presente e completo
⚠️ PARCIAL — presente mas incompleto ou com ressalvas
❌ AUSENTE — não encontrado

[ ] Título claro e descritivo do problema
[ ] Descrição objetiva do contexto
[ ] Comportamento esperado definido
[ ] Comportamento atual descrito
[ ] Passos de reprodução completos e ordenados
[ ] Ambiente especificado (versão, SO, browser, etc.)
[ ] Pelo menos uma evidência anexada
[ ] Logs coerentes com o problema descrito
[ ] Screenshots mostram o estado de erro
[ ] Impacto e criticidade justificados

=== ORIENTAÇÃO ===
Gere três seções:

1. AÇÕES PARA O AUTOR — o que deve ser corrigido/adicionado, por campo
2. STATUS DA ISSUE — pronta para triagem técnica OU aguardando complemento
3. PRÓXIMOS PASSOS — orientação para o time de desenvolvimento
   (se pronta: por onde começar a investigar)
   (se não pronta: o que bloqueia a triagem)

Seja direto. Cite campos e anexos pelo nome.
"""
```

---

## 9. Implementação da API FastAPI

```python
# jira_triage/router.py

from fastapi import APIRouter, BackgroundTasks
import asyncio

router = APIRouter(prefix="/webhook/jira", tags=["Jira Triage"])


@router.post("/issue-created")
async def receber_webhook_jira(
    payload: JiraWebhookPayload,
    background_tasks: BackgroundTasks
):
    # Responde imediatamente ao Jira (evita timeout do webhook)
    background_tasks.add_task(processar_issue, payload.issue)
    return {"status": "aceito", "issue": payload.issue.key}


async def processar_issue(issue: JiraIssue):

    # 1 — Validação estrutural (sem LLM, rápida)
    resultado_estrutural = DORChecker().validar(issue)
    if resultado_estrutural.reprovado_critico:
        comentario = formatar_rejeicao_estrutural(resultado_estrutural)
        await jira_client.postar_comentario(issue.key, comentario)
        await jira_client.atualizar_label(issue.key, "DoR-PENDENTE")
        return

    # 2 — Download e OCR dos anexos em paralelo
    anexos_processados = await asyncio.gather(*[
        processar_anexo(
            anexo   = a,
            schema  = escolher_schema(a.mimetype, a.nome)
        )
        for a in issue.attachments
    ])

    # 3 — Validação semântica (LLM — long context direto)
    contexto = montar_contexto(issue, anexos_processados)
    resultado_semantico = await gemini_pro.generate_json(
        PROMPT_VALIDACAO_SEMANTICA.format(**contexto)
    )

    # 4 — DoR + orientação final
    resultado_dor = await gemini_pro.generate(
        PROMPT_DOR_FINAL.format(
            resultado_estrutural = resultado_estrutural.to_text(),
            resultado_semantico  = json.dumps(resultado_semantico, indent=2)
        )
    )

    # 5 — Posta resultado no Jira
    comentario = formatar_comentario_jira(
        resultado_estrutural = resultado_estrutural,
        resultado_semantico  = resultado_semantico,
        resultado_dor        = resultado_dor
    )
    await jira_client.postar_comentario(issue.key, comentario)

    # 6 — Atualiza label e campo customizado
    label = "DoR-OK" if resultado_semantico["qualidade_geral"]["score"] >= 7 else "DoR-PENDENTE"
    await jira_client.atualizar_label(issue.key, label)
    await jira_client.atualizar_campo(issue.key, "dor_score", resultado_semantico["qualidade_geral"]["score"])
```

---

## 10. Exemplo de Comentário no Jira

```
🤖 Triagem Automática — Document of Ready

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CHECKLIST DoR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Título claro e descritivo
✅ Descrição objetiva do contexto
✅ Comportamento esperado definido
✅ Comportamento atual descrito
⚠️ Passos de reprodução — 2 passos encontrados, falta especificar a versão
    do browser utilizado no passo 2
✅ Ambiente especificado
✅ Evidências anexadas
⚠️ Logs — error_payment.log refere-se ao PaymentService, mas o erro
    relatado é no CheckoutController. Podem estar relacionados,
    mas não confirmam diretamente o problema.
❌ Screenshots — screen1.png mostra a tela inicial, não o erro ocorrendo.
    Nenhum screenshot mostra o erro 500 descrito.
✅ Impacto e criticidade justificados

Score de qualidade: 6/10

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 ANÁLISE DAS EVIDÊNCIAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Conflito identificado: os logs enviados mostram timeout no PaymentService,
mas a descrição relata erro 500 no CheckoutController. Adicione o log do
CheckoutController para confirmar a causa raiz.

screen1.png: não relevante — mostra página inicial sem nenhum indicador de erro.
error_payment.log: relevância MÉDIA — relacionado ao fluxo, mas não confirma o ponto de falha.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 AÇÕES PARA O AUTOR — @fulano
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Adicionar screenshot da tela exibindo o erro 500
2. Substituir ou complementar os logs com o arquivo do CheckoutController
3. Complementar o passo 2 da reprodução com a versão do browser

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️ STATUS: AGUARDANDO COMPLEMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Issue não está pronta para triagem técnica. Os 3 itens acima bloqueiam
a análise do time de desenvolvimento.

Label: DoR-PENDENTE
```

---

## 11. Custo por Issue

### Cenário típico: 1 screenshot + 1 log (1h) + 1 CSV (10k linhas) + 1 PDF (50 pág)

```
SEM estratégia por tipo (long context tudo):
  ~500.000 tokens de entrada               ~$1,75 por issue

COM estratégia por tipo (pipeline abaixo):
  Screenshot (Chandra 2 → JSON):           ~$0,001
  Log (parser + janela deslizante):        ~$0,003
  CSV (pandas + zscore → JSON):            ~$0,002
  PDF grande (MonkeyOCR + RAG temporário): ~$0,008
  Gemini Flash (mapeamentos → JSON):       ~$0,006
  Validação semântica (Gemini Pro):        ~$0,015
  DoR final (Gemini Pro):                  ~$0,008
  ─────────────────────────────────────────
  Total:                                   ~$0,043
  ─────────────────────────────────────────
  Economia vs long context bruto:          ~97%
  Cobertura de evidências:                 ~95%
```

### Escala mensal

| Volume | Custo com estratégia | Custo sem estratégia |
| --- | --- | --- |
| 500 issues/mês | ~$22 | ~$875 |
| 5.000 issues/mês | ~$215 | ~$8.750 |
| 50.000 issues/mês | ~$2.150 | ~$87.500 |

### Com OCR self-hosted (GPU própria ou RunPod)

```
OCR (Chandra 2 + MonkeyOCR via vLLM):     ~$0,000 (infra fixa)
Gemini Flash (mapeamentos):                ~$0,008
Gemini Pro (validação + DoR):              ~$0,023
─────────────────────────────────────────
Total por issue:                           ~$0,031
─────────────────────────────────────────
```

---

## 12. Estratégia RAG vs Long Context vs Map-Reduce

### Decisão por tipo de operação neste sistema

| Operação | Estratégia | Justificativa |
| --- | --- | --- |
| Validar campos da issue | Regras fixas | Sem LLM — mais rápido e barato |
| Analisar screenshot | Chandra 2 + long context | ~400 tokens — trivial |
| Analisar log | Parser + janela deslizante | Busca semântica não funciona em logs |
| Analisar CSV | pandas + análise estatística | Dados estruturados exigem agregação, não similaridade |
| Analisar PDF pequeno | Long context direto | Cabe no contexto, mais simples |
| Analisar PDF grande | **RAG temporário por issue** | Único caso onde RAG faz sentido aqui |
| Buscar issues históricas similares | **RAG permanente** | Base de centenas/milhares de issues indexadas |
| Sugerir solução de bugs anteriores | **RAG permanente** | "PROJ-87 tinha esse stack trace — resolvido com X" |
| Cruzar com documentação técnica | **RAG permanente** | Base documental indexada no pgvector |
| Padrões de falha recorrentes | **RAG + Analytics** | Múltiplas issues + metadados agregados |

### Por que RAG não resolve log e CSV

RAG busca por **similaridade semântica**. Log e CSV têm problemas diferentes:

```
Log com 80k tokens:
  Query RAG: "erro no checkout"
  → recupera chunks com "ERROR" e "checkout" ✓
  → MAS perde: "pool exhausted" num chunk diferente que é a causa raiz ✗
  → E não responde: "esse erro aparece 47 vezes? ou foi isolado?" ✗

  Solução correta: parser de linhas críticas + contagem por componente

CSV com 100k linhas:
  Query RAG: "transações com erro"
  → embedding de linhas de CSV é ruído — não há semântica ✗
  → não responde: "qual % das transações falhou?" ✗
  → não detecta: "valor médio fora do padrão em determinada coluna" ✗

  Solução correta: pandas + zscore + agregações
```

### Roadmap de evolução do sistema

```
v1 — Triagem básica (este documento)
  Validação estrutural + OCR + análise semântica de UMA issue

v2 — Triagem com contexto histórico
  + RAG sobre issues anteriores indexadas no pgvector
  + "Esse erro ocorreu antes em PROJ-87 — resolvido com X"

v3 — Triagem com contexto arquitetural
  + RAG sobre documentação técnica interna (wiki, runbooks, diagramas)
  + "O CheckoutController depende de fila — o timeout pode ser na fila"

v4 — Detecção de padrões
  + Analytics sobre base de issues indexadas
  + "Esse componente gerou 12 bugs neste sprint — padrão de instabilidade"
```

---

## 13. Stack e Dependências

```
Infraestrutura existente no projeto:
  ✅ FastAPI (api/main.py)          → adicionar router jira_triage
  ✅ Google Vertex AI / Gemini      → validação semântica + DoR
  ✅ pgvector + PostgreSQL          → futuro: indexar issues para RAG
  ✅ LangChain / LlamaIndex         → loaders de PDF se necessário

Novas dependências:
  chandra-ocr                       → pip install chandra-ocr
  atlassian-python-api              → pip install atlassian-python-api
  MonkeyOCR                         → git clone + pip install -r requirements.txt

Variáveis de ambiente (.env):
  JIRA_BASE_URL=https://sua-empresa.atlassian.net
  JIRA_USER=seu@email.com
  JIRA_API_TOKEN=seu_token
  JIRA_WEBHOOK_SECRET=segredo_para_validar_webhook

Opcional (self-hosted OCR):
  GPU mínima recomendada: RTX 3090 / A10G
  Chandra 2 via vLLM: 1,44 pág/seg em H100
  MonkeyOCR-pro-1.2B: alternativa mais leve (-1,6% accuracy, +36% velocidade)
```

### Estrutura de arquivos sugerida

```
jira-triage/
├── README.md               ← este arquivo
├── router.py               ← endpoint FastAPI do webhook
├── dor_checker.py          ← validação estrutural (sem LLM)
├── ocr_service.py          ← Chandra 2 + MonkeyOCR + roteamento
├── schemas.py              ← JSON schemas por tipo de anexo
├── prompts.py              ← prompts de validação semântica e DoR
├── jira_client.py          ← client Jira (postar comentário, labels)
├── formatter.py            ← formata o comentário final para o Jira
└── models.py               ← Pydantic models (JiraIssue, ResultadoDoR, etc.)
```

---

*Baseado em pesquisa de 42 artigos sobre RAG (2020–2026) e benchmarks de OCR de 2025–2026 (olmOCR Benchmark, OmniDocBench, OCRBench v2).*
