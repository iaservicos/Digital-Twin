# Plano de Implementação: Controle de Acesso e Auditoria de Sessões

> **Objetivo:** Criar um sistema robusto de controle de acesso para registrar quem acessou o sistema, em quais horários, com que dispositivo e por quanto tempo permaneceu conectado, com visualização em tempo real para administradores e moderadores.

---

## 1. 🧠 Brainstorming Técnico & Decisão Arquitetural

### Contexto
O Brilha Mais é uma aplicação PWA / Web (React + Tailwind) com backend duplo (FastAPI em contêiner e Vercel Serverless em produção). O rastreamento de tempo de permanência de um usuário em ambiente web enfrenta o desafio de fechamento abrupto de abas, suspensão de abas em segundo plano e navegação sem clique explícito no botão "Sair".

---

### Opções Avaliadas

#### 🟢 Opção A: Heartbeat Periódico (60s) + `navigator.sendBeacon` no Encerramento + Timeout no Backend (Recomendada)
- **Como funciona:**
  - No login: cria o registro da sessão (`id_sessao` UUID) com `login_at = now()`.
  - Durante o uso: um hook do React emite um ping leve (`POST /auth/session/ping`) a cada 60 segundos com o `id_sessao`, atualizando `ultimo_ping_at`.
  - Ao sair ou fechar a aba: o evento `pagehide` dispara `navigator.sendBeacon('/auth/session/end')`, gravando o logout instantâneo.
  - Se a aba for fechada sem envio do beacon (ex: queda de energia / crash), o backend computa a duração com base no `ultimo_ping_at`, marcando a sessão como `EXPIRADA_INATIVIDADE` após 3 minutos sem ping.
- **Vantagens:**
  - 100% compatível com a arquitetura serverless (Vercel) e contêineres Docker.
  - Precisão máxima no cálculo de tempo logado (margem máxima de 60 segundos se o navegador travar).
  - Custo de rede e banco desprezível (payload de ~80 bytes a cada 1 minuto).
  - Identifica quem está **Online Agora** em tempo real (`ultimo_ping_at > now() - interval '2 minutes'`).
- **Desvantagens:**
  - Requer implementar o hook no frontend e a rota de ping no backend.
- **Esforço:** Médio.

---

#### 🟡 Opção B: Rastreamento Passivo em Requisições de API (Sem Heartbeat)
- **Como funciona:**
  - Atualiza a data da última atividade em um interceptor HTTP do Axios a cada chamada de API comum do sistema.
- **Vantagens:**
  - Não faz requisições dedicadas de ping.
- **Desvantagens:**
  - Falha se o usuário passar 20 minutos lendo um relatório ou visualizando dados na tela sem clicar em botões: parecerá que ele deslogou 20 minutos antes.
  - Não detecta fechamento de aba.
- **Esforço:** Baixo.

---

#### 🔴 Opção C: Conexão Persistente via WebSockets
- **Como funciona:**
  - Mantém uma conexão socket bidirecional ativa contínua.
- **Vantagens:**
  - Desconexão detectada em milissegundos.
- **Desvantagens:**
  - **Incompatível com o backend serverless da Vercel** (que tem timeout estrito de funções e não sustenta conexões socket permanentes).
  - Alto consumo de recursos e dependência de infraestrutura externa (ex: Pusher / Redis pub/sub).
- **Esforço:** Alto.

---

### 💡 Decisão: Opção A (Abordagem Híbrida: Heartbeat + Beacon)
Garante compatibilidade total com o deploy Vercel + FastAPI Docker, com dados 100% confiáveis de duração de sessão e indicador de "Online Agora".

---

## 2. 🎼 Multi-Agent Orchestration Plan

### Papéis dos Agentes Especialistas:
1. `project-planner`: Estruturação dos entregáveis e governança do plano.
2. `database-architect`: Criação da tabela `tb_sessao_acesso`, índices para alta performance de consulta e funções de expiração automática.
3. `backend-specialist`: Criação dos endpoints em `backend_python` e `frontend_react/api` (`/auth/session/ping`, `/auth/session/end`, `/auditoria/sessoes`).
4. `security-auditor`: Garantia de RBAC (acesso restrito aos perfis `MODERADOR` e `ADMINISTRADOR`), proteção dos dados da conta do Márcio e mascaramento de IP.
5. `frontend-specialist`: Criação do hook `useSessionHeartbeat`, integração no `authStore.ts` e construção do componente `ControleAcessoManager.tsx` na tela de Configurações (`SettingsScreen.tsx`).
6. `test-engineer`: Validação e testes automatizados de ponta a ponta do ciclo de vida da sessão.

---

## 3. Estrutura de Tarefas Detalhada

### Fase 1: Banco de Dados (`database-architect`)
- [ ] Criar a tabela `tb_sessao_acesso`:
  ```sql
  CREATE TABLE IF NOT EXISTS tb_sessao_acesso (
      id_sessao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      matricula VARCHAR(30) NOT NULL,
      nome_completo VARCHAR(150),
      cargo VARCHAR(100),
      role VARCHAR(50),
      ip_address VARCHAR(45),
      user_agent TEXT,
      dispositivo VARCHAR(50), -- 'Desktop', 'Mobile', 'Tablet'
      navegador VARCHAR(50),   -- 'Chrome', 'Edge', 'Safari', etc.
      login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      ultimo_ping_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      logout_at TIMESTAMP WITH TIME ZONE,
      duracao_segundos INTEGER DEFAULT 0,
      status VARCHAR(30) DEFAULT 'ATIVA' -- 'ATIVA', 'ENCERRADA_USUARIO', 'EXPIRADA_INATIVIDADE'
  );
  CREATE INDEX IF NOT EXISTS idx_sessao_matricula ON tb_sessao_acesso(matricula);
  CREATE INDEX IF NOT EXISTS idx_sessao_login_at ON tb_sessao_acesso(login_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sessao_status ON tb_sessao_acesso(status);
  ```

### Fase 2: Backend — Rotas e Lógica de Sessão (`backend-specialist` & `security-auditor`)
- [ ] **Modificar `routes/auth.py` (Local e Vercel):**
  - No sucesso de login, registrar sessão em `tb_sessao_acesso` com IP, User-Agent e parse básico de dispositivo/navegador.
  - Retornar `idSessao` no payload de resposta de autenticação.
- [ ] **Criar rotas de ciclo de vida em `routes/auth.py`:**
  - `POST /api/v1/auth/session/ping`: Atualiza `ultimo_ping_at = now()` e recalcula `duracao_segundos`.
  - `POST /api/v1/auth/session/end`: Recebe `idSessao`, marca `logout_at = now()` e status `'ENCERRADA_USUARIO'`.
- [ ] **Criar rotas de auditoria em `routes/auditoria.py`:**
  - `GET /api/v1/auditoria/sessoes`:
    - Permissão estrita: `MODERADOR` ou `ADMINISTRADOR`.
    - Resumo analítico: total de sessões hoje/mês, usuários online agora (`ultimo_ping_at > now() - interval '2 minutes'`), tempo médio de sessão.
    - Lista paginada com filtros por matrícula/nome, intervalo de datas e status.

### Fase 3: Frontend — Hook e Encerramento (`frontend-specialist`)
- [ ] **Atualizar `authStore.ts`:**
  - Guardar `idSessao` persistido na sessão ativa.
  - No `logout()`, disparar `/auth/session/end` antes de limpar o token.
- [ ] **Criar hook `useSessionHeartbeat.ts`:**
  - Disparar ping a cada 60 segundos enquanto o usuário estiver autenticado.
  - Adicionar listener para `pagehide` / `beforeunload` com `navigator.sendBeacon` para encerramento transparente.

### Fase 4: Frontend — Interface de Controle de Acesso (`frontend-specialist`)
- [ ] **Criar `ControleAcessoManager.tsx`:**
  - 4 Bento Cards no topo:
    1. **Usuários Online Agora** (indicador visual pulsante verde).
    2. **Total de Acessos** (no período filtrado).
    3. **Tempo Médio Conectado** (ex: `1h 15m`).
    4. **Colaboradores Distintos** (alcance único).
  - Barra de controle: busca por texto, filtro de período (Hoje, Últimos 7 dias, Mês Atual) e filtro por status.
  - Tabela completa de sessões:
    - Colaborador (Nome, Matrícula, Cargo, Badge de Perfil).
    - Início do Acesso (Data e Hora formatada).
    - Último Sinal / Fim (Data e Hora).
    - Tempo Conectado (duração amigável: `1h 45m 22s`).
    - Dispositivo & Navegador.
    - Status com badge estilizado (`Ativo / Online`, `Finalizado`, `Expirado`).
- [ ] **Integrar em `SettingsScreen.tsx`:**
  - Adicionar aba `"ACESSO"` (Controle de Acessos) com ícone de escudo/relógio.
  - Apenas exibida para usuários Moderadores e Administradores.

### Fase 5: Testes e Validação (`test-engineer`)
- [ ] Validar script de criação e encerramento de sessão.
- [ ] Validar contagem de tempo de permanência com múltiplos usuários.
- [ ] Validar permissões e restrição RBAC.
- [ ] Executar build de produção (`npm.cmd run build`).

---

## 4. Critérios de Sucesso
1. Qualquer login realizado gera imediatamente uma sessão com data/hora e identificação de dispositivo.
2. A interface exibe em tempo real quem está online agora e há quanto tempo está logado.
3. Sessões encerradas pelo usuário ou por fechamento de aba têm a duração exata gravada.
4. Administradores e Moderadores conseguem filtrar históricos de acessos por colaborador e data.
5. Zero impacto na performance do sistema e compatibilidade com deploy Vercel e Docker.
