# 🌟 Plataforma Digital Twin - Programa Brilha+

> **Sistema Corporativo de Gestão de Desempenho Técnico, Gamificação e Ingestão de Dados Databricks**  
> *Positivo Tecnologia — Operações de Campo e Assistência Técnica (ATP)*

---

## 📌 Visão Geral

O **Digital Twin - Brilha+** é uma solução corporativa *end-to-end* desenvolvida para monitorar, gamificar e otimizar o desempenho operacional das equipes técnicas de campo (atendimentos *On-Site*) e das Bases ATP (Assistência Técnica Positivo).

A plataforma consolida ordens de serviço, reincidências e consumo de peças diretamente do **Databricks SQL Warehouse (Data Lake)** e planilhas operacionais, calcula automaticamente indicadores de qualidade (SLA, Perdas, Reincidências, Peças e NPS) e entrega uma interface web gamificada com rankings nacionais e regionais, apuração de pontos, histórico de atendimentos e painel de supervisão e auditoria em tempo real.

---

## 🏛️ Arquitetura dos Dois Backends Desacoplados

O sistema opera com **dois backends independentes e desacoplados** para isolar cargas pesadas de dados analíticos dos serviços transacionais leves:

```
                            ┌──────────────────────────────────────────────┐
                            │        Databricks SQL Warehouse              │
                            │  (datalake_prod.indicadores_servicos)        │
                            └──────────────────────┬───────────────────────┘
                                                   │ (PyArrow Streaming Zero-Copy)
                                                   ▼
                                     ┌───────────────────────────┐
                                     │  [BACKEND 1: Render]      │
                                     │   DataIngest Microservice │
                                     │     (Python / FastAPI)    │
                                     │   Porta: 8000 (Docker)    │
                                     └─────────────┬─────────────┘
                                                   │ (Batch COPY / Upsert Staging)
                                                   ▼
                                     ┌───────────────────────────┐
                                     │    PostgreSQL Database    │
                                     │   (Supabase / AWS Pooler) │
                                     └───────┬───────────▲───────┘
                                             │           │ (Queries Parametrizadas)
              (REST API / JWT Auth)          ▼           │
 ┌────────────────────────────────────────┐ ┌────────────────────────────────────────┐
 │            FRONTEND WEB                │ │         [BACKEND 2: Vercel]            │
 │       (React 18 / Vite / TS PWA)       │ │     API Serverless de Negócio          │
 │  Porta: 3000 (Vercel / Produção CDN)   │ │   (frontend_react/api/index.py)        │
 │                                        │ │  *Espelho Local: backend_python :8080  │
 └───────────────────┬────────────────────┘ └────────────────────────────────────────┘
                     │
                     └──────── (Heavy Ingest / Excel Upload) ────────► [DataIngest :8000]
```

### 1. Ingestão Analítica Pesada — Render (`DataIngest`)
- **Hospedagem:** Render (Web Service Docker — Porta 8000).
- **Stack:** Python 3.12, FastAPI, Polars Engine, PyArrow Streaming, Psycopg 3, APScheduler.
- **Responsabilidades:**
  - Extração em lote de alto desempenho via streaming (*zero-copy*) do Databricks SQL Warehouse.
  - Ingestão e processamento de planilhas operacionais em memória via Polars.
  - Motor de cálculo analítico e consolidação mensal de notas em `tb_apuracao_mensal`.
  - Protegido por chave de serviço `DATA_INGEST_API_KEY`.

### 2. Serviços Transacionais e Negócio — Vercel Serverless (`frontend_react/api/`)
- **Hospedagem:** Vercel Serverless Functions (`api/index.py` via `vercel.json`).
- **Espelho de Desenvolvimento Local:** `backend_python` (FastAPI / Uvicorn na porta 8080).
- **Stack:** Python 3.12, FastAPI, Psycopg 3 Pooler, JWT (HS384).
- **Responsabilidades:**
  - Autenticação stateless, primeiro acesso e gerenciamento de sessões com heartbeat (`tb_sessao_acesso`).
  - Painel de Auditoria de acessos para moderadores (usuários online, dispositivo, IP, duração).
  - Consultas analíticas rápidas do Dashboard, rankings, detalhes de reincidentes e perdas.
  - Gestão de técnicos, supervisores e parametrização de campanhas/metas.
  - Modularizado com [dashboard_helpers.py](file:///c:/Users/marci/Documents/Positivo/Projetos/DigitalTwin/backend_python/routes/dashboard_helpers.py).

### 3. Interface Web & PWA — Vercel (`frontend_react`)
- **Stack:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Recharts, Zustand.
- **Responsabilidades:**
  - Visão do Técnico: painel de notas, detalhamento de chamados, elegibilidade, histórico.
  - Visão do Supervisor: gestão da equipe vinculada às suas Bases ATP autorizadas.
  - Visão do Moderador: controle de acesso, auditoria de sessões, campanhas e acionamento de sync do Databricks.

---

## 🎯 Regras de Negócio e Motor de Pontuação (KPIs)

O programa apura mensalmente uma pontuação máxima de **100 pontos** distribuídos em 6 indicadores:

| Indicador | Escopo | Peso | Meta / Critérios de Pontuação |
| :--- | :---: | :---: | :--- |
| **SLA da Equipe** | Base ATP | **32.5 pts** | $\ge 100\% \rightarrow 32.5\text{ pts}$ \| $\ge 90\% \rightarrow 28.0\text{ pts}$ \| $< 90\% \rightarrow 0\text{ pts}$ (Gatilho) |
| **Perdas da Equipe** | Base ATP | **20.0 pts** | $\le 1.0\% \rightarrow 20.0\text{ pts}$ \| $\le 2.0\% \rightarrow 15.0\text{ pts}$ \| $> 2.0\% \rightarrow 0\text{ pts}$ |
| **Reincidência da Equipe** | Base ATP | **15.0 pts** | $\le 7.0\% \rightarrow 15.0\text{ pts}$ \| $\le 10.0\% \rightarrow 10.0\text{ pts}$ \| $> 10.0\% \rightarrow 0\text{ pts}$ |
| **Reincidência Individual** | Técnico | **15.0 pts** | $\le 7.0\% \rightarrow 15.0\text{ pts}$ \| $\le 10.0\% \rightarrow 10.0\text{ pts}$ \| $> 10.0\% \rightarrow 0\text{ pts}$ |
| **Consumo de Peças** | Técnico | **12.5 pts** | $\le 25.0\% \rightarrow 12.5\text{ pts}$ \| $> 25.0\% \rightarrow 0\text{ pts}$ *(Exclui Urnas Eletrônicas)* |
| **NPS da Equipe** | Geral | **5.0 pts** | Meta padrão de qualidade atendida ($100\% \rightarrow 5.0\text{ pts}$) |

> **Critério de Elegibilidade:** Nota final $\ge 70.0\text{ pontos}$ e volume de atendimentos no mês $> 0$.

---

## 🔒 Segurança, Governança e Clean Code

- **Zero SQL Injection:** Todas as rotas e conectores utilizam consultas estritamente parametrizadas (`%s`), sem concatenação direta de dados de entrada. Scanner de segurança reporta **0 vulnerabilidades de padrão de código**.
- **Proteção Inviolável do Moderador:** A conta do moderador Márcio (`72916` / `MODERADOR`) possui blindagem permanente contra exclusão ou inativação no código e é coberta por testes automatizados.
- **Escopo Estrito de Supervisor por Base ATP:** Supervisores só possuem permissão para cadastrar ou gerenciar técnicos vinculados às suas próprias bases ATP autorizadas.
- **Auditoria de Sessões & Inatividade:** Monitoramento de sessões ativas (`tb_sessao_acesso`) com expiração automática após 3 minutos sem heartbeat.
- **Tratamento Estruturado de Erros:** Todas as rotas implementam tratamento padronizado com `HTTPException`, códigos HTTP semânticos (200, 400, 401, 403, 404, 500) e logging estruturado.

---

## 📁 Estrutura do Repositório

```
DigitalTwin/
├── .agents/                 # Protocolos, regras de arquitetura e skills de IA
├── DataIngest/              # [Backend Render] Engine pesada (Databricks, Polars, FastAPI)
│   ├── src/
│   │   ├── api/             # Rotas de sincronização pesada e upload de planilhas
│   │   ├── connectors/      # Conectores Databricks SQL e PostgreSQL (Psycopg 3)
│   │   ├── services/        # Motor analítico Polars (calculo_pontuacao.py, etl_service.py)
│   │   └── scheduler.py     # Agendamento de rotinas periódicas
│   ├── Dockerfile
│   └── requirements.txt
├── backend_python/          # [Backend Local :8080] Espelho de desenvolvimento da API de negócio
│   ├── core/                # Conexão de banco (database.py) e segurança JWT (security.py)
│   ├── routes/              # Rotas da API (auth, dashboard, campanhas, tecnicos, perfil, auditoria)
│   │   └── dashboard_helpers.py # Funções auxiliares desacopladas do dashboard
│   ├── main.py              # Ponto de entrada FastAPI com prefixos /api/v1
│   ├── Dockerfile
│   └── requirements.txt
├── frontend_react/          # [Frontend Vercel] Aplicação Web SPA + PWA e API Serverless
│   ├── api/                 # Backend serverless em produção na Vercel (espelho de backend_python)
│   │   ├── core/            # Conexão com Supabase e segurança JWT
│   │   ├── routes/          # Rotas serverless (auth, dashboard, campanhas, tecnicos, perfil, auditoria)
│   │   └── index.py         # Entrypoint serverless Vercel (/api/v1)
│   ├── src/
│   │   ├── components/      # Bento grid, modais analíticos, layout e cards de métricas
│   │   ├── screens/         # Dashboard, Ranking, Perfil, Configurações, Auditoria, Login
│   │   ├── store/           # Estados globais Zustand (authStore, syncStore)
│   │   └── services/        # Clientes HTTP (api.ts direciona rotas para Vercel / Render)
│   ├── vercel.json          # Configuração de rewrites serverless da Vercel
│   ├── vite.config.ts       # Configuração Vite e PWA
│   └── tailwind.config.js
├── database/
│   └── migrations/          # Migrações versionadas (V78 a V81) para evolução do schema
├── tests/
│   └── test_api.py          # Suíte unificada de testes automatizados (pytest)
├── db_scripts/              # Views analíticas e DDLs complementares
├── docs/ & Project_Docs/    # Documentação técnica e especificações de regras
├── docker-compose.yml       # Orquestrador multi-container para produção
├── docker-compose.dev.yml   # Orquestrador de desenvolvimento local com hot-reload
└── render.yaml              # Blueprint de infraestrutura como código (Render)
```

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- [Python 3.12](https://www.python.org/)
- [Node.js](https://nodejs.org/) (v18+)
- [Docker](https://www.docker.com/) e Docker Compose *(opcional para execução em containers)*

---

### 1. Configuração de Variáveis de Ambiente

Crie o arquivo `.env` na raiz clonando o modelo `.env.example`:

```bash
cp .env.example .env
```

Principais variáveis:
- `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`: Credenciais do banco PostgreSQL (Supabase / AWS Pooler).
- `JWT_SECRET`: Chave para assinatura de tokens JWT.
- `DATA_INGEST_URL`: URL do microserviço de ingestão (`http://localhost:8000` em dev, ou URL no Render).
- `DATA_INGEST_API_KEY`: Token de autorização para comunicação entre backends.
- `DATABRICKS_SERVER_HOSTNAME`, `DATABRICKS_HTTP_PATH`, `DATABRICKS_ACCESS_TOKEN`: Acesso ao Data Lake.

---

### 2. Execução Local dos Serviços

#### A. Backend Leve (Python / FastAPI)
```bash
# Na raiz do projeto:
python -m uvicorn backend_python.main:app --host 0.0.0.0 --port 8080 --reload
```
Acesse a documentação interativa em: `http://localhost:8080/docs`

#### B. Engine de Ingestão (DataIngest)
```bash
# Na raiz do projeto:
python -m uvicorn DataIngest.src.api.main:app --host 0.0.0.0 --port 8000 --reload
```
Acesse a documentação interativa em: `http://localhost:8000/docs`

#### C. Frontend React (Vite / PWA)
```bash
cd frontend_react
npm install
npm run dev
```
Acesse a aplicação em: `http://localhost:3000`

---

### 3. Execução via Docker Compose

```bash
# Modo desenvolvimento com Live Reload:
docker-compose -f docker-compose.dev.yml up --build

# Ou no Windows:
iniciar-dev.bat
```

---

## 🧪 Testes e Validações de Qualidade

### Executar Suíte de Testes Automatizados (pytest)
A suíte em [tests/test_api.py](file:///c:/Users/marci/Documents/Positivo/Projetos/DigitalTwin/tests/test_api.py) valida autenticação, primeiro acesso, normalização de senhas, validação de duplicidade, auditoria de sessões e a proteção permanente da conta do moderador:

```bash
pytest tests/test_api.py -v
```

### Validador de Boas Práticas de API
```bash
# Validar backend local:
python .agents/skills/api-patterns/scripts/api_validator.py backend_python

# Validar backend serverless da Vercel:
python .agents/skills/api-patterns/scripts/api_validator.py frontend_react/api
```

### Scanner de Segurança e Vulnerabilidades
```bash
python .agents/skills/vulnerability-scanner/scripts/security_scan.py .
```

### Build de Produção do Frontend
```bash
cd frontend_react
npm run build
```

---

## 📄 Licença e Governança

Este projeto é desenvolvido para a **Positivo Tecnologia — Operações e Assistência Técnica**.  
Todos os direitos reservados.
