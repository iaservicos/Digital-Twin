# 🏗️ Plano Mestre de Arquitetura: Deduplicação e Reuso no Dashboard Brilha+

## 1. Visão Geral e Diagnóstico da Redundância
Atualmente, o projeto possui uma carga severa de duplicação de código entre as telas do Técnico e do Supervisor, além de repetições nos modais de detalhamento e rotas de backend:

1. **Dashboards Gêmeos (`DashboardBentoDesktop.tsx` e `AdminDashboardBento.tsx`):**
   - Ambos somam **2.182 linhas** de código JSX e lógica.
   - Compartilham exatamente os mesmos 6 Bento Cards (`SLA total`, `Campanha ativa`, `Chamados encerrados`, `Perdas - Falha técnica`, `Reincidências`, `Consumo de peças`).
   - Qualquer melhoria visual (ex: calibração do gauge de SLA em REM) precisa ser feita e replicada manualmente em 2 arquivos gigantes.
2. **Duplicação de Requisições e Estados:**
   - Efeitos para buscar `sla-segmentos`, `perdas-semanais`, `reincidentes-semanais` e `pecas-distribuicao` estão repetidos integralmente em ambos os dashboards.
3. **Modais de Chamados Redundantes (~146 KB):**
   - 5 modais (`ModalChamadosPecas`, `ModalChamadosPerdas`, `ModalChamadosReincidentes`, `ModalChamadosSlaPerdidos`, `ModalChamadosSemTecnico`) repetem a mesma carcaça de modal, filtros de busca, paginação, loading e tabela.
4. **Backend Python Duplicado:**
   - Rotas em `backend_python/routes/` estão espelhadas em `frontend_react/api/routes/` para acomodar o deploy no Vercel, gerando manutenção em dobro no backend.

---

## 2. Estratégia de Execução em Fases

### 🔹 Fase 1: Componentização Modular dos 6 Bento Cards (Frontend)
Extrair cada um dos 6 cards para componentes isolados, autocontidos e reutilizáveis na pasta:  
`frontend_react/src/components/dashboard/cards/`

| Card | Componente Proposto | Responsabilidade |
| :--- | :--- | :--- |
| **Card 1** | `SlaTotalCard.tsx` | Gauge radial SVG em REM, tabs `Total \| Gov \| Corp`, meta oficial e status. |
| **Card 2** | `CampanhaAtivaCard.tsx` | Status de elegibilidade, barra de progresso, meta e contadores. |
| **Card 3** | `ChamadosEncerradosCard.tsx` | Calendário semanal/mensal de atendimentos, total e último atendimento. |
| **Card 4** | `PerdasFalhaTecnicaCard.tsx` | Gráfico de barras semanais de perdas técnicas e impacto. |
| **Card 5** | `ReincidenciasCard.tsx` | Evolução semanal e taxa de chamados reincidentes. |
| **Card 6** | `ConsumoPecasCard.tsx` | Distribuição percentual de peças por categoria (Placas, Telas, Baterias, etc.). |

> **Ganho Imediato:** `DashboardBentoDesktop.tsx` e `AdminDashboardBento.tsx` encolhem de ~1.100 linhas para **~200 linhas cada**. Uma alteração feita em qualquer Card reflete instantaneamente nos dois dashboards!

---

### 🔹 Fase 2: Hook Unificado de Dados dos Cards (`useDashboardCardsData.ts`)
Criar o hook unificado em `frontend_react/src/hooks/useDashboardCardsData.ts`:
- **Parâmetros:** `{ targetTecnicoId?: number, idSupervisor?: number, selectedMonth?: string }`
- **Retorno:** `{ slaSegmentos, perdasChart, reincidentesChart, pecasData, loading, refresh }`
- Centraliza todas as chamadas aos endpoints (`/sla-segmentos`, `/perdas-semanais`, `/reincidentes-semanais`, `/pecas-distribuicao`), eliminando `useEffect`s duplicados nos componentes.

---

### 🔹 Fase 3: Template Base de Modal de Chamados (`BaseChamadosModal.tsx`)
Criar o componente genérico em `frontend_react/src/components/dashboard/modals/BaseChamadosModal.tsx`:
- Centraliza:
  - Header padrão (título, ícone temático, pílula de contagem e botão `X`).
  - Barra de busca com debounce e filtros de período.
  - Estrutura de paginação (página atual, itens por página, botões anterior/próximo).
  - Estados de carregamento (`skeleton`) e lista vazia.
- Os 5 modais específicos passam a ter apenas **~60 linhas** cada um, focando exclusivamente nas colunas e regras de negócio específicas daquele KPI.

---

### 🔹 Fase 4: Deduplicação e Sincronização do Backend Python
- Alinhar `frontend_react/api/index.py` para consumir diretamente os módulos de `backend_python.routes`, ou unificar a fonte da verdade para que alterações no FastAPI não precisem ser copiadas manualmente entre pastas.

---

### 🔹 Fase 5: Centralização de Utilitários e Formatação
- Mover funções comuns como `toTitleCase`, formatadores de datas e moeda para `frontend_react/src/utils/formatters.ts`.
- Padronizar os tokens de design e medidas em **REM** em todos os novos componentes criados.

---

## 3. Matriz de Impacto e Métricas de Sucesso

| Métrica | Antes | Depois | Melhoria |
| :--- | :--- | :--- | :--- |
| **Linhas no Dashboard Bento** | 2.182 linhas | ~450 linhas (somadas) | **-79% de código** |
| **Ponto único de manutenção** | 2 locais para cada card | 1 componente único por card | **100% reutilizável** |
| **Código em Modais** | ~146 KB (5 modais) | ~40 KB (com BaseModal) | **-72% de redundância** |
| **Aderência às Regras** | Unidades mistas | **100% em REM** | **Acessibilidade total** |

---

## 4. Ordem de Execução Recomendada
1. **Passo 1:** Criar a pasta `components/dashboard/cards/` e extrair o `SlaTotalCard.tsx` (Card 1) para validar o padrão de desacoplamento.
2. **Passo 2:** Extrair os Cards 2 a 6 progressivamente.
3. **Passo 3:** Substituir a implementação em `DashboardBentoDesktop.tsx` e `AdminDashboardBento.tsx` consumindo os novos cards.
4. **Passo 4:** Criar o hook `useDashboardCardsData.ts` para unificar o ciclo de vida dos dados.
5. **Passo 5:** Criar `BaseChamadosModal.tsx` e refatorar os modais.
6. **Passo 6:** Validar via `npm run build` e testes interativos no navegador.
