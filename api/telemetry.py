"""
OpenTelemetry + Logging — configuração central de telemetria para o RAG System.

CONCEITOS OTEL:
  TracerProvider : fábrica de Tracers. Um por processo. Configurado com Resource e Exporters.
  Resource       : metadados imutáveis do serviço (nome, versão, ambiente).
  Tracer         : obtido via trace.get_tracer("nome"). Cria Spans.
  Span           : unidade de trabalho com início, fim, atributos e status.
  BatchSpanProcessor : acumula spans em memória e exporta em lotes (evita overhead).
  OTLPSpanExporter   : serializa spans como protobuf e envia via HTTP ao OTel Collector.

STACK COMPLETA:
  FastAPI app  → OTLP HTTP (4318) → OTel Collector → Jaeger  (traces, porta 16686)
                                                   → Tempo   (traces, via Grafana 3000)
  FastAPI app  → /metrics (HTTP)  ← Prometheus scrape         (metrics, porta 9090)
  FastAPI app  → logs/api.log     ← Promtail → Loki           (logs, via Grafana 3000)

Instrumentações automáticas:
  FastAPIInstrumentor   → span por requisição HTTP (method, route, status_code).
  SQLAlchemyInstrumentor → span por query SQL (db.statement, db.system, db.name).

Spans manuais (nos módulos de query):
  rag.langchain  → langchain.rag.query, langchain.chain.invoke
  rag.llamaindex → llamaindex.rag.query, llamaindex.engine.query

Logging estruturado (JSON):
  Nível INFO+, saída para stdout e logs/api.log.
  Promtail lê api.log e envia ao Loki com labels: job, service, level, logger.
"""

import logging
import logging.handlers
import os

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from pythonjsonlogger import jsonlogger


def setup_logging() -> None:
    """
    Configura o logging raiz para emitir JSON estruturado.

    Cada linha de log vira um objeto JSON como:
      {"asctime": "2026-04-07 21:00:00,000", "name": "api.routers.langchain",
       "levelname": "INFO", "message": "query iniciada", "question": "..."}

    O Promtail lê logs/api.log, extrai os campos via pipeline_stages e
    indexa as labels (level, logger) no Loki. O conteúdo full é pesquisável
    via LogQL mas não indexado (diferencial do Loki vs Elasticsearch).
    """
    # Garante que o diretório de logs existe (cria se necessário)
    os.makedirs("logs", exist_ok=True)

    # Formato JSON: os campos extras passados via extra={} aparecem automaticamente
    formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s",
        timestamp=True,
    )

    # Handler 1: arquivo rotativo (10MB por arquivo, mantém 5 backups)
    handler_file = logging.handlers.RotatingFileHandler(
        "logs/api.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    handler_file.setFormatter(formatter)

    # Handler 2: stdout (útil para Docker logs)
    handler_stdout = logging.StreamHandler()
    handler_stdout.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(logging.INFO)

    # Evita duplicar handlers se setup_logging() for chamada mais de uma vez
    if not root.handlers:
        root.addHandler(handler_file)
        root.addHandler(handler_stdout)


def setup_telemetry(app) -> None:
    """
    Inicializa o TracerProvider global e registra as auto-instrumentações.

    Deve ser chamada APÓS criar o app FastAPI e ANTES de incluir os routers.
    O fluxo de saída é:
      app → OTLPSpanExporter (HTTP) → OTel Collector (4318) → Jaeger + Tempo
    """
    # Resource: identifica este processo nos traces do Jaeger/Grafana
    resource = Resource.create(
        {
            SERVICE_NAME: os.environ.get("OTEL_SERVICE_NAME", "rag-system"),
            "service.version": "1.0.0",
            "deployment.environment": os.environ.get("APP_ENV", "development"),
        }
    )

    # TracerProvider: ponto central de coleta de spans
    provider = TracerProvider(resource=resource)

    # Exportador OTLP HTTP → OTel Collector (que distribui para Jaeger e Tempo)
    otlp_endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
    exporter = OTLPSpanExporter(endpoint=f"{otlp_endpoint}/v1/traces")

    # BatchSpanProcessor: exporta em lotes (assíncrono, baixo overhead)
    provider.add_span_processor(BatchSpanProcessor(exporter))

    # Registra como provider global — trace.get_tracer() usará este provider
    trace.set_tracer_provider(provider)

    # Auto-instrução: span por requisição HTTP (http.method, http.route, http.status_code)
    FastAPIInstrumentor.instrument_app(app)

    # Auto-instrução: span por query SQL (db.statement, db.system, db.name)
    SQLAlchemyInstrumentor().instrument(enable_commenter=True, commenter_options={})

    logging.getLogger(__name__).info(
        "Telemetria inicializada",
        extra={"otlp_endpoint": otlp_endpoint, "service": os.environ.get("OTEL_SERVICE_NAME", "rag-system")},
    )

