# README — Guia de Estudo para Entrevista (Python, IA, RAG, Dados e Cloud)

Este material foi organizado para revisão rápida antes da entrevista.

---

# 1. RAG

## O que é RAG

**RAG** significa **Retrieval-Augmented Generation**.

É uma arquitetura em que, antes do LLM responder, o sistema **busca contexto externo relevante** — documentos, PDFs, wiki interna, tickets, base de conhecimento, embeddings, banco vetorial — e injeta esse contexto no prompt para que a resposta seja baseada em dados reais.

## Objetivo do RAG

O objetivo do RAG é:

- aumentar a precisão das respostas;
- reduzir alucinação;
- permitir respostas sobre dados privados da empresa;
- responder com base em conteúdo recente;
- melhorar rastreabilidade e auditoria;
- separar conhecimento do modelo do conhecimento do negócio.

## Por que RAG ainda é necessário hoje

Mesmo com LLMs mais fortes, RAG ainda é necessário porque:

- o modelo não conhece automaticamente os dados internos da empresa;
- o treinamento do modelo não contém necessariamente informações recentes;
- o modelo pode inventar resposta quando falta contexto;
- em cenários corporativos, o que importa não é só “falar bonito”, mas responder com base correta e verificável.

## Como explicar em entrevista

> “RAG é uma arquitetura em que o sistema recupera contexto externo relevante antes da geração da resposta. Ele continua importante porque o LLM sozinho não resolve bem o problema de conhecimento privado, atualizado e auditável.”

---

# 2. Técnicas atuais de RAG

## 2.1 Hybrid Search

Combina:

- **busca semântica** por embeddings;
- **busca lexical / keyword search**.

### Por que isso é importante

A busca semântica encontra significado.
A busca lexical encontra termos exatos, como:

- códigos de erro;
- IDs;
- nomes de classes;
- siglas;
- campos específicos.

### Resposta boa em entrevista

> “Hoje eu não confiaria em RAG puramente vetorial. Em muitos casos, hybrid search melhora recall e relevância, especialmente em documentos técnicos.”

## 2.2 Reranking

Primeiro o sistema busca vários candidatos.
Depois um modelo de rerank reorganiza os resultados do mais relevante para o menos relevante.

### Por que usar

Porque a primeira busca costuma recuperar resultados bons, mas nem sempre na melhor ordem.
O reranker melhora a qualidade do contexto final enviado ao LLM.

## 2.3 Chunking bem feito

Chunking é a forma como o documento é quebrado.

Chunk ruim gera contexto ruim.

### Boas práticas

- quebrar por seção ou subtítulo;
- manter sentido lógico do trecho;
- preservar metadados;
- evitar chunks grandes demais;
- evitar chunks pequenos demais que perdem contexto.

## 2.4 Metadata Filtering

Filtrar documentos por:

- projeto;
- cliente;
- produto;
- data;
- tipo de documento;
- permissão;
- idioma.

Isso reduz ruído e melhora muito a recuperação.

## 2.5 Context Assembly

Não basta pegar top-k e jogar no prompt.
É importante:

- remover duplicados;
- ordenar logicamente os trechos;
- evitar redundância;
- montar contexto coerente;
- respeitar limite de tokens.

## 2.6 Avaliação de Retrieval

Em produção, não basta avaliar só a resposta final.
Também é importante avaliar a busca.

### Métricas comuns

- Precision@K;
- Recall@K;
- MRR;
- hit rate;
- groundedness;
- faithfulness.

## Resumo forte para entrevista

> “O RAG moderno normalmente funciona melhor com hybrid search, reranking, chunking bem feito, filtros por metadado e avaliação séria da etapa de retrieval.”

---

# 3. LangChain, LangGraph e LlamaIndex

## LangChain

LangChain é um ecossistema muito usado para construir aplicações com LLMs.

É forte em:

- integração com modelos;
- tools;
- agentes;
- chains / workflows;
- chamadas a APIs;
- orquestração de etapas.

### Quando pensar em LangChain

Quando o problema envolve:

- agentes;
- múltiplas ferramentas;
- fluxo com várias etapas;
- integração ampla;
- lógica de execução mais complexa.

## LangGraph

LangGraph é uma camada voltada para **workflows stateful e agentes mais controláveis**.

Ele faz mais sentido quando você precisa de:

- fluxo com estado entre etapas;
- loops e reprocessamento;
- branches condicionais;
- checkpoints;
- memória de execução;
- human-in-the-loop;
- controle fino do caminho percorrido pelo agente.

### Ideia principal

Se o LangChain “puro” ajuda a integrar modelos, tools e componentes, o **LangGraph entra quando você quer modelar o fluxo como um grafo de estados e transições**.

### Quando LangGraph costuma ser melhor

- agentes que tomam várias decisões em sequência;
- pipelines com validação e retries;
- sistemas em que a execução pode voltar etapas anteriores;
- orquestração com múltiplos nós;
- cenários em que previsibilidade e depuração importam muito.

### Exemplo simples de uso mental

Imagine um agente que:

1. recebe uma pergunta;
2. decide se precisa buscar documentos;
3. faz retrieval;
4. avalia se o contexto foi suficiente;
5. se não foi, busca novamente com outra estratégia;
6. monta resposta;
7. envia para revisão humana em certos casos.

Esse tipo de fluxo combina muito mais com **LangGraph** do que com uma chain linear simples.

## LlamaIndex

LlamaIndex é muito forte na camada de **dados para aplicações com LLM**.

É especialmente útil para:

- ingestão de documentos;
- parsing;
- indexação;
- retrieval;
- query sobre bases documentais;
- aplicações centradas em RAG.

### Quando pensar em LlamaIndex

Quando o centro do problema é:

- conectar documentos ao LLM;
- montar pipeline de ingestão;
- estruturar índices;
- retrieval sobre conhecimento.

## Diferença prática

### LangChain
Mais voltado ao ecossistema de aplicações, integração de tools, agentes e workflows.

### LangGraph
Mais voltado a **orquestração stateful**, controle de execução e agentes complexos com fluxo não linear.

### LlamaIndex
Mais voltado à **camada de dados e retrieval**, especialmente quando a base documental é o centro da solução.

## Como explicar a relação entre LangChain e LangGraph

> “Eu vejo LangGraph como a camada mais adequada quando o agente precisa de fluxo stateful, branches, loops e controle fino de execução. LangChain cobre muito bem integrações e componentes, mas LangGraph fica mais forte quando a aplicação deixa de ser uma chain simples e vira um workflow de verdade.”

## Resposta de entrevista

> “LangChain eu vejo mais forte para aplicações orientadas a workflow, tools e agentes. LangGraph eu uso quando preciso de estado, branches, loops, memória e controle de execução em agentes mais complexos. LlamaIndex eu vejo mais forte na camada de dados, ingestão, indexação e retrieval sobre documentos.”

---

# 4. pgvector vs Qdrant

## O que é pgvector

`pgvector` é uma extensão do PostgreSQL para armazenar embeddings e fazer busca por similaridade vetorial no próprio Postgres.

### Vantagens

- simplicidade operacional;
- usar o mesmo banco relacional já existente;
- combinar SQL + filtros + vetores;
- manter dado transacional e vetorial próximos.

### Quando usar

- quando já existe Postgres no projeto;
- quando o volume ainda cabe bem no banco;
- quando a equipe quer menos complexidade operacional;
- quando filtros relacionais são importantes.

## O que é Qdrant

Qdrant é um banco / engine especializado em busca vetorial.

### Vantagens

- foco forte em vector search;
- otimizações específicas para retrieval;
- boa filtragem;
- recursos avançados de busca;
- arquitetura mais voltada para search semântica.

### Quando usar

- quando vector search é parte central do produto;
- quando retrieval precisa de tuning mais específico;
- quando o sistema exige escala e foco maior em busca vetorial.

## Diferença resumida

- **pgvector**: melhor quando você quer simplicidade e manter tudo no Postgres.
- **Qdrant**: melhor quando busca vetorial é protagonista do sistema.

## Resposta de entrevista

> “Eu escolheria pgvector quando quero simplicidade operacional e proximidade com o dado relacional. Escolheria Qdrant quando retrieval vetorial é uma preocupação de primeira classe do sistema.”

---

# 5. O que é GCP

**GCP** significa **Google Cloud Platform**.

É a plataforma de cloud do Google, com serviços de:

- compute;
- storage;
- banco de dados;
- redes;
- observabilidade;
- IA;
- serverless.

## O que normalmente querem dizer na vaga

Quando falam:

> “Ambiente em nuvem, conteinerizado e serverless: GCP”

normalmente querem avaliar se você entende:

- deploy de APIs em cloud;
- containers;
- serviços gerenciados;
- componentes serverless;
- observabilidade e operação.

## Serviços que costumam aparecer

### Cloud Run

Para rodar containers de forma serverless.

### GKE

Kubernetes gerenciado no Google Cloud.

### Cloud SQL

Banco gerenciado, como PostgreSQL.

### Pub/Sub

Mensageria assíncrona.

### Secret Manager

Gestão de segredos.

## Como explicar em entrevista

> “GCP é a plataforma de nuvem do Google. No contexto da vaga, eu pensaria principalmente em deploy de APIs/container, serviços gerenciados e soluções serverless como Cloud Run.”

---

# 6. Redis

## O que é Redis

Redis é uma estrutura de dados em memória, muito usada para:

- cache;
- sessão;
- rate limiting;
- contadores;
- locks simples;
- dados efêmeros;
- filas leves.

## Por que usar Redis

Porque ele oferece:

- latência muito baixa;
- redução de carga no banco principal;
- armazenamento temporário rápido;
- boa solução para padrões distribuídos simples.

## Situações comuns de uso

## 6.1 Cache

Exemplo:

- API consulta Postgres;
- salva resultado no Redis com TTL;
- próximas requisições leem do Redis.

### Benefícios

- menos carga no banco;
- resposta mais rápida;
- melhor comportamento em picos.

## 6.2 Sessão

Guardar informações temporárias de login e estado do usuário.

## 6.3 Rate Limiting

Controlar quantas requisições um cliente pode fazer por janela de tempo.

## 6.4 Contadores temporários

Exemplo:

- número de tentativas;
- métricas rápidas;
- flags temporárias.

## 6.5 Locks / idempotência simples

Evitar processar a mesma operação duas vezes.

## Como usar Redis corretamente

### Padrão cache-aside

1. tenta ler do Redis;
2. se não encontrar, lê do banco;
3. salva no Redis;
4. retorna resposta.

## Cuidados com Redis

- dado pode ficar stale;
- invalidação pode ficar difícil;
- memória é mais cara;
- não resolve modelagem ruim de banco;
- não deve virar “muleta” para query ruim.

## Frase de entrevista

> “Eu uso Redis principalmente quando preciso de baixa latência ou reduzir carga no banco, especialmente para cache, rate limiting, sessão e dados efêmeros.”

---

# 7. SQLAlchemy

## O que é SQLAlchemy

SQLAlchemy é uma biblioteca Python para acesso a banco relacional.

Ela possui duas camadas principais:

- **Core**: construção mais explícita de SQL;
- **ORM**: mapeamento objeto-relacional.

## O que é ORM

**ORM** significa **Object-Relational Mapping**.

A ideia é mapear:

- tabela → classe;
- coluna → atributo;
- linha → objeto.

### Exemplo mental

Tabela `users`:

- `id`
- `name`
- `email`

vira uma classe `User` com:

- `id`
- `name`
- `email`

## O que o ORM resolve

- persistência de objetos;
- leitura e atualização em alto nível;
- relacionamento entre entidades;
- redução de SQL repetitivo;
- maior produtividade em CRUD.

## Onde ORM ajuda muito

- cadastro e edição de entidades;
- relacionamentos 1:N e N:N;
- regras de persistência;
- manutenção do código.

## Onde não usar ORM cegamente

- queries muito complexas;
- SQL altamente otimizado;
- analytics pesado;
- casos onde SQL manual é mais claro.

---

# 8. SQLAlchemy vs Hibernate

## Semelhança

Ambos fazem mapeamento objeto-relacional.

Ou seja, SQLAlchemy ORM em Python e Hibernate/JPA em Java cumprem papéis parecidos:

- mapear entidades;
- gerenciar persistência;
- trabalhar com relacionamentos;
- abstrair boa parte do acesso ao banco.

## Diferença prática

### Hibernate

- muito associado ao ecossistema Java/Spring;
- forte em convenções e anotações;
- comum em ambientes enterprise Java.

### SQLAlchemy

- principal ORM do ecossistema Python;
- mais explícito e flexível;
- sensação mais “Pythonic” e composable.

## Resposta boa em entrevista

> “Conceitualmente, SQLAlchemy ORM em Python cumpre um papel parecido com Hibernate/JPA em Java: mapear entidades, relacionamentos e persistência. A diferença maior está no ecossistema e no estilo de uso.”

---

# 9. Comandos importantes de SQLAlchemy

## Exemplo de model

```python
from sqlalchemy import String, Integer, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(200), unique=True)
```

## Conectar no banco

```python
engine = create_engine("postgresql+psycopg://user:password@localhost/mydb")
```

## Criar tabelas

```python
Base.metadata.create_all(engine)
```

> Em projeto real, normalmente usa-se **Alembic** para migrations.

## Inserir registro

```python
with Session(engine) as session:
    user = User(name="Matheus", email="matheus@email.com")
    session.add(user)
    session.commit()
```

## Buscar registros

```python
with Session(engine) as session:
    result = session.execute(select(User))
    users = result.scalars().all()
```

## Buscar com filtro

```python
with Session(engine) as session:
    result = session.execute(
        select(User).where(User.email == "matheus@email.com")
    )
    user = result.scalar_one_or_none()
```

## Atualizar registro

```python
with Session(engine) as session:
    user = session.execute(
        select(User).where(User.email == "matheus@email.com")
    ).scalar_one()

    user.name = "Matheus M."
    session.commit()
```

## Deletar registro

```python
with Session(engine) as session:
    user = session.execute(
        select(User).where(User.email == "matheus@email.com")
    ).scalar_one()

    session.delete(user)
    session.commit()
```

---

# 10. Conceitos importantes de SQLAlchemy

## Session

A `Session` representa a unidade de trabalho.
Ela controla:

- objetos carregados;
- mudanças pendentes;
- flush;
- commit;
- rollback.

## Commit

Confirma a transação no banco.

## Rollback

Desfaz a transação em caso de erro.

## Flush

Envia mudanças pendentes ao banco antes do commit final.

## `select()`

Forma moderna de construir consultas na API mais nova do SQLAlchemy.

## `scalar_one_or_none()`

Retorna:

- um único resultado;
- ou `None` se não houver resultado;
- e falha se houver mais de um.

---

# 11. Respostas curtas prontas para a entrevista

## O que é RAG?

> “É uma arquitetura em que o sistema recupera contexto externo relevante antes do LLM responder, para melhorar grounding e precisão.”

## Por que RAG ainda é necessário?

> “Porque o problema real não é só geração de texto; é responder com base em dados privados, atuais e auditáveis.”

## Quais técnicas atuais de RAG você considera mais fortes?

> “Hybrid search, reranking, chunking bem feito, filtros por metadado e avaliação da etapa de retrieval.”

## O que é LangGraph?

> “É uma forma de orquestrar agentes e workflows stateful com memória, branches, loops e controle fino de execução.”

## Qual a diferença entre LangChain, LangGraph e LlamaIndex?

> “LangChain é mais forte para integração de tools, workflows e agentes. LangGraph entra quando eu preciso de fluxo stateful e mais controle do agente. LlamaIndex é muito forte em ingestão, indexação e retrieval sobre documentos.”

## pgvector ou Qdrant?

> “pgvector para simplicidade e proximidade com o dado relacional; Qdrant quando vector search é protagonista e precisa de foco maior em retrieval.”

## O que é GCP?

> “É a plataforma de cloud do Google. No contexto da vaga, eu penso principalmente em deploy de APIs/container, serviços gerenciados e serverless como Cloud Run.”

## Por que usar Redis?

> “Para reduzir latência e carga no banco, especialmente com cache, sessão, rate limiting e dados efêmeros.”

## O que é ORM?

> “É o mapeamento entre objetos da aplicação e tabelas relacionais, permitindo trabalhar com entidades e persistência de forma mais produtiva.”

## SQLAlchemy é parecido com Hibernate?

> “Sim, conceitualmente os dois resolvem ORM e persistência. A diferença maior está no ecossistema e no estilo de uso: Python com SQLAlchemy, Java com Hibernate/JPA.”

---

# 12. Resposta estratégica caso perguntem sobre profundidade prática

> “Tenho experiência prática mais forte em backend Python, APIs REST, modelagem de dados, SQLAlchemy, Postgres, Redis e soluções com IA/RAG. Em pontos como GCP mais profundo, OpenTelemetry ou Angular, dependendo do nível esperado, eu prefiro me posicionar com honestidade: tenho base e familiaridade, mas ainda posso evoluir mais em experiência hands-on de produção.”

---

# 13. Fechamento para revisão rápida

Se precisar memorizar só o essencial:

- **RAG** = recuperar contexto antes de gerar resposta;
- **RAG moderno** = hybrid search + reranking + metadata + avaliação;
- **LangChain** = workflows, tools, agentes;
- **LangGraph** = estado, loops, branches, controle do fluxo;
- **LlamaIndex** = ingestão, indexação, retrieval;
- **pgvector** = simplicidade no Postgres;
- **Qdrant** = engine vetorial especializada;
- **GCP** = cloud do Google;
- **Redis** = cache, sessão, rate limit, dados rápidos;
- **SQLAlchemy** = acesso a banco em Python;
- **ORM** = mapeamento de tabela para objeto;
- **Hibernate vs SQLAlchemy** = mesma ideia central, ecossistemas diferentes.
