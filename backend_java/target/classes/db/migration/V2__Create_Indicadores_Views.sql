-- =============================================================================
-- V2__Create_Indicadores_Views.sql
-- Views Analíticas de Indicadores baseadas diretamente no Schema Databricks
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. VIEW ANALÍTICA DE INDICADORES POR TÉCNICO (SLA, Reincidência e Peças)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_indicadores_tecnico AS
SELECT 
    t.id_tecnico,
    t.nome_completo AS tecnico_nome,
    t.matricula,
    b.ct_codigo,
    b.nome_atp,
    s.nome_completo AS supervisor_nome,
    
    -- Métricas de Chamados & SLA
    COUNT(DISTINCT c.chamado) AS total_chamados,
    SUM(CASE WHEN LOWER(c.sla_status) LIKE '%dentro%' OR LOWER(c.sla_status) = 'no prazo' THEN 1 ELSE 0 END) AS chamados_no_prazo,
    SUM(CASE WHEN LOWER(c.sla_status) LIKE '%fora%' OR LOWER(c.sla_status) = 'fora do prazo' THEN 1 ELSE 0 END) AS chamados_fora_prazo,
    
    -- Porcentagem de SLA calculada nativamente
    ROUND(
        (SUM(CASE WHEN LOWER(c.sla_status) LIKE '%dentro%' OR LOWER(c.sla_status) = 'no prazo' THEN 1 ELSE 0 END)::NUMERIC / 
        NULLIF(COUNT(DISTINCT c.chamado), 0)::NUMERIC) * 100, 2
    ) AS percentual_sla,
    
    -- Reincidências
    COUNT(DISTINCT r.chamado_rrc) AS total_reincidencias,
    
    -- Peças Consumidas
    COUNT(DISTINCT p.id) AS total_pecas_consumidas

FROM tb_tecnico t
LEFT JOIN tb_base_atp b ON t.id_base = b.id_base
LEFT JOIN tb_supervisor s ON t.id_supervisor = s.id_supervisor
LEFT JOIN chamados c ON UPPER(TRIM(c.tecnico_nome)) = UPPER(TRIM(t.nome_completo))
LEFT JOIN reincidentes r ON UPPER(TRIM(r.tecnico_nome_rrc)) = UPPER(TRIM(t.nome_completo))
LEFT JOIN pecas p ON UPPER(TRIM(p.tecnico_nome)) = UPPER(TRIM(t.nome_completo))
GROUP BY t.id_tecnico, t.nome_completo, t.matricula, b.ct_codigo, b.nome_atp, s.nome_completo;

-- -----------------------------------------------------------------------------
-- 2. VIEW DE APURAÇÃO GERAL DE PONTOS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_apuracao_pontos AS
SELECT 
    id_tecnico,
    tecnico_nome,
    matricula,
    ct_codigo,
    nome_atp,
    supervisor_nome,
    total_chamados,
    chamados_no_prazo,
    chamados_fora_prazo,
    percentual_sla,
    total_reincidencias,
    total_pecas_consumidas,
    
    -- Regra inicial de pontuação de SLA (pode ser ajustada na camada de serviço)
    ROUND((COALESCE(percentual_sla, 0.00) * 10), 2) AS pontos_calculados_sla
FROM vw_indicadores_tecnico;
