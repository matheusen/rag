# URLs — Stack de Observabilidade

URLs de acesso local e endpoints internos usados pela telemetria do projeto.

---

## UIs (acesso pelo browser)

| Serviço | URL | Descrição |
|---|---|---|
| **Grafana** | http://localhost:3030 | Dashboard unificado (Traces · Metrics · Logs) |
| **Jaeger** | http://localhost:16686 | UI de traces — flamegraph, comparação de spans |
| **Prometheus** | http://localhost:9090 | Explorador de métricas e PromQL |
| **Loki** (via Grafana) | http://localhost:3030 → Explore → Loki | Busca de logs com LogQL |
| **Tempo** (via Grafana) | http://localhost:3030 → Explore → Tempo | Busca de traces com TraceQL |

---

## Endpoints de ingestão (internos / app → serviço)

| Endpoint | Protocolo | Quem recebe | Quem envia |
|---|---|---|---|
| `http://localhost:4318/v1/traces` | OTLP HTTP | OTel Collector | FastAPI app (`telemetry.py`) |
| `localhost:4317` | OTLP gRPC | OTel Collector | qualquer SDK gRPC |
| `http://localhost:8000/metrics` | HTTP (Prometheus scrape) | Prometheus | FastAPI app (`prometheus-fastapi-instrumentator`) |

### Endpoints internos Docker (container → container)

| Endpoint | Serviço destino | Quem usa |
|---|---|---|
| `jaeger:4317` | Jaeger OTLP gRPC | OTel Collector |
| `tempo:4317` | Tempo OTLP gRPC | OTel Collector |
| `loki:3100/loki/api/v1/push` | Loki Push API | Promtail |
| `prometheus:9090` | Prometheus | Grafana (datasource) |
| `tempo:3200` | Tempo HTTP Query | Grafana (datasource) |
| `loki:3100` | Loki HTTP | Grafana (datasource) |

---

## Portas mapeadas (docker-compose)

| Serviço | Host → Container | Protocolo |
|---|---|---|
| FastAPI | `8000:8000` | HTTP |
| OTel Collector | `4317:4317` | gRPC (OTLP) |
| OTel Collector | `4318:4318` | HTTP (OTLP) |
| OTel Collector | `8888:8888` | HTTP (métricas internas do collector) |
| Jaeger | `16686:16686` | HTTP (UI) |
| Jaeger | `14250:14250` | gRPC (legado) |
| Grafana | `3030:3000` | HTTP (UI) — 3000 do host estava ocupado |
| Prometheus | `9090:9090` | HTTP |
| Loki | `3100:3100` | HTTP |
| Tempo | `3200:3200` | HTTP (query API) |

---

## Variáveis de ambiente relevantes

| Variável | Valor padrão | Onde é usada |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | `telemetry.py` → `OTLPSpanExporter` |
| `OTEL_SERVICE_NAME` | `rag-system` | `telemetry.py` → `Resource` |
| `APP_ENV` | `development` | `telemetry.py` → `Resource` |

---

## Fluxo completo de dados

```
FastAPI (8000)
  │
  ├── OTLP HTTP ──────→ OTel Collector (4318)
  │                           ├──→ Jaeger (16686)   traces
  │                           └──→ Tempo  (3200)    traces
  │
  ├── /metrics ←─── Prometheus scrape (9090)         metrics
  │
  └── logs/api.log ←── Promtail ──→ Loki (3100)      logs

Grafana (3030)
  ├── datasource: Prometheus → http://prometheus:9090
  ├── datasource: Tempo      → http://tempo:3200       (correlação → Loki)
  └── datasource: Loki       → http://loki:3100        (correlação → Tempo)
```

---

## Como verificar se os serviços estão UP

```powershell
docker compose ps
```

```powershell
# Health check rápido de cada UI
curl http://localhost:8000/health      # FastAPI
curl http://localhost:9090/-/healthy   # Prometheus
curl http://localhost:3100/ready       # Loki
curl http://localhost:3200/ready       # Tempo
curl http://localhost:16686            # Jaeger (HTML)
curl http://localhost:3030/api/health  # Grafana
```
