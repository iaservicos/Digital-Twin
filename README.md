# 🌟 Plataforma Digital Twin - Programa Brilha+

> **Sistema Corporativo de Gestão de Desempenho Técnico, Gamificação e Ingestão de Dados Databricks**  
> *Positivo Tecnologia — Operações de Campo e Assistência Técnica (ATP)*

---

## 📌 Visão Geral

O **Digital Twin - Brilha+** é uma solução *end-to-end* desenvolvida para monitorar, gamificar e otimizar o desempenho das equipes técnicas de campo (atendimentos *On-Site*) e das Bases ATP (Assistência Técnica Positivo). 

A plataforma consolida dados brutos de ordens de serviço, reincidências e consumo de peças diretamente do **Databricks SQL Warehouse (Data Lake)**, processa regras de negócio e indicadores de qualidade (SLA, Perdas, Reincidências, Peças e NPS) e entrega uma experiência interativa e gamificada com rankings, apuração mensal de pontos e painel de supervisão em tempo real.

---

## 🏛️ Arquitetura do Sistema

```
                      ┌──────────────────────────────────────────────┐
                      │        Databricks SQL Warehouse              │
                      │  (datalake_prod.indicadores_servicos)        │
                      └──────────────────────┬───────────────────────┘
                                             │ (PyArrow Streaming)
                                             ▼
                               ┌───────────────────────────┐
                               │   DataIngest Microservice │
                               │     (Python / FastAPI)    │
                               │   Porta: 8000 (Render)    │
                               └─────────────┬─────────────┘
                                             │ (Binary COPY / Upsert)
                                             ▼
                               ┌───────────────────────────┐
                               │    PostgreSQL Database    │
                               │   (Supabase / AWS Pooler) │
                               └───────┬───────────▲───────┘
                                       │           │ (Queries JPA/Flyway)
        (REST API / JWT Auth)          ▼           │
┌──────────────────────────┐    ┌──────────────────────────┐
│      Frontend Web        │◄───┤    Backend de Negócio    │
│  (React / Vite / TS PWA) │    │  (Java 21 / Spring Boot) │
│   Porta: 3000 (Vercel)   │───►│   Porta: 8080 (Render)   │
└────────────┬─────────────┘    └──────────────────────────┘
             │
             └──────── (Trigger Sync / Polling) ────────► [DataIngest]
```

O ecossistema é dividido em 3 pilares desacoplados:

1. **`DataIngest` (Engine de Ingestão e Processamento Analítico):**
   - **Tecnologias:** Python 3.12, FastAPI, Polars, PyArrow, Psycopg 3, APScheduler.
   - **Função:** Extração em lote de alto desempenho via streaming (*zero-copy*), sincronização idempotente com PostgreSQL e motor analítico para apuração de notas e metas.
2. **`backend_java` (API de Domínio e Regras de Negócio):**
   - **Tecnologias:** Java 21, Spring Boot 3/4, Spring Security, JWT, Spring Data JPA, Flyway, Bucket4j, Swagger / OpenAPI 3.
   - **Função:** Gestão de usuários e permissões RBAC, campanhas de incentivo, elegibilidade, histórico de chamados, supervisão regional e auditoria.
3. **`frontend_react` (Interface Web & PWA):**
   - **Tecnologias:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Recharts, Zustand.
   - **Função:** Experiência do técnico (painel de notas, detalhamento de chamados, elegibilidade), ranking nacional/regional, widget de *Live Sync* do Databricks e painel administrativo para supervisores.

---

## 🎯 Regras de Negócio e Motor de Pontuação (KPIs)

O programa apura mensalmente uma pontuação máxima de **100 pontos** distribuídos em 6 indicadores:

| Indicador | Escopo | Peso | Meta / Critérios de Pontuação |
| :--- | :---: | :---: | :--- |
| **SLA da Equipe** | Base ATP | **32.5 pts** | $\ge 100\% \rightarrow 32.5\text{ pts}$ \| $\ge 90\% \rightarrow 28.0\text{ pts}$ \| $< 90\% \rightarrow 0\text{ pts}$ (Gatilho) |
| **Perdas da Equipe** | Base ATP | **20.0 pts** | $\le 1.0\% \rightarrow 20.0\text{ pts}$ \| $\le 2.0\% \rightarrow 15.0\text{ pts}$ \| $> 2.0\% \rightarrow 0\text{ pts}$ |
| **Reincidência da Equipe** | Base ATP | **15.0 pts** | $\le 7.0\% \rightarrow 15.0\text{ pts}$ \| $\le 10.0\% \rightarrow 10.0\text{ pts}$ \| $> 10.0\% \rightarrow 0\text{ pts}$ |
| **Reincidência Individual** | Técnico | **15.0 pts** | $\le 7.0\% \rightarrow 15.0\text{ pts}$ \| $\le 10.0\% \rightarrow 10.0\text{ pts}$ \| $> 10.0\% \rightarrow 0\text{ pts}$ |
| **Consumo de Peças** | Técnico | **12.5 pts** | $\le 25.0\% \rightarrow 12.5\text{ pts}$ \| $> 25.0\% \rightarrow 0\text{ pts}$ *(Placas, LCD, SSD, HD)* |
| **NPS da Equipe** | Geral | **5.0 pts** | Meta padrão de qualidade atendida ($100\% \rightarrow 5.0\text{ pts}$) |

> **Critério de Elegibilidade:** Nota final $\ge 70.0\text{ pontos}$ e volume de atendimentos no mês $> 0$.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- [Docker](https://www.docker.com/) e Docker Compose instalados.
- [Node.js](https://nodejs.org/) (v18+) *(opcional para rodar localmente fora de containers)*.
- [Java JDK 21](https://adoptium.net/) & Maven 3.9+ *(opcional para rodar localmente)*.
- [Python 3.12](https://www.python.org/) *(opcional para rodar localmente)*.

---

### 🐳 Execução via Docker Compose (Recomendado)

1. **Configuração de Variáveis:**
   Crie o arquivo `.env` na raiz do projeto clonando o modelo `.env.example`:
   ```bash
   cp .env.example .env
   ```

2. **Ambiente de Desenvolvimento (Live Reload & Hot Recompile):**
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```
   *Ou no Windows:* Execute o script `iniciar-dev.bat`.

3. **Ambiente de Produção (Build Otimizado):**
   ```bash
   docker-compose up --build -d
   ```

---

### 🌐 Endpoints e Portas

| Serviço | Porta Local | Descrição |
| :--- | :---: | :--- |
| **Frontend Web** | `http://localhost:3000` | Interface do usuário e PWA |
| **Backend Spring Boot** | `http://localhost:8080` | API REST e Swagger Docs (`/swagger-ui.html`) |
| **DataIngest FastAPI** | `http://localhost:8000` | Sincronização Databricks e Docs (`/docs`) |

---

## 📁 Estrutura do Repositório

```
DigitalTwin/
├── .agent/               # Regras de agentes de IA, workflows e skills
├── DataIngest/           # Microserviço Python (Databricks, Polars ETL, FastAPI)
│   ├── src/
│   │   ├── api/          # Endpoints REST e segurança por API Key
│   │   ├── connectors/   # Clientes Databricks SQL e PostgreSQL Psycopg3
│   │   ├── services/     # Motor analítico (calculo_pontuacao.py) e ETL
│   │   └── scheduler.py  # Agendamento diário de cargas
│   ├── Dockerfile
│   └── requirements.txt
├── backend_java/         # Backend de Negócio (Spring Boot 3/4 + Java 21)
│   ├── src/main/java/br/com/positivo/digitaltwin/
│   │   ├── core/         # Configurações de segurança, JWT, CORS, Handler
│   │   └── modules/brilhamais/ # Controllers, Services, Repositories, DTOs
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   └── db/migration/ # Scripts Flyway versionados (V1 a V63)
│   ├── Dockerfile
│   └── pom.xml
├── frontend_react/       # Aplicação Web SPA / PWA (React 18 + Vite + TS)
│   ├── src/
│   │   ├── components/   # Modais de detalhes, métricas, layout e live sync
│   │   ├── screens/      # Dashboard, Ranking, Perfil, Supervisão, Login
│   │   ├── store/        # Gerenciamento de estado global (Zustand)
│   │   └── services/     # Integração com APIs Backend e DataIngest
│   ├── vite.config.ts
│   └── tailwind.config.js
├── db_scripts/           # Views auxiliares e DDLs complementares
├── docs/                 # Documentação técnica detalhada, mapeamentos e guias
├── docker-compose.yml     # Orquestrador de produção multi-container
├── docker-compose.dev.yml # Orquestrador de desenvolvimento com live reload
└── render.yaml           # Configuração de infraestrutura como código (Render)
```

---

## 🔒 Segurança e Boas Práticas

- **Autenticação Stateless:** Tokens JWT com refresh token e expiração segura.
- **Proteção de Endpoints:** Spring Security com controle de acesso por papéis (RBAC).
- **Proteção Inter-Serviços:** `DATA_INGEST_API_KEY` para chamadas entre Backend/Frontend e a engine Python.
- **Rate Limiting:** Implementado via Bucket4j para prevenir ataques de negação de serviço e *brute-force*.
- **Migrações Seguras:** Esquemas versionados via Flyway garantindo consistência estrutural no PostgreSQL.

---

## 📄 Licença

Este projeto é desenvolvido para a **Positivo Tecnologia**. Todos os direitos reservados.
