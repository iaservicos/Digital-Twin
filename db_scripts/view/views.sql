-- =================================================================================
-- PROJETO BRILHA MAIS - CRIAÇÃO DE VIEWS (VISTAS)
-- Execute este script para salvar as consultas matemáticas no PostgreSQL.
-- =================================================================================

-- ---------------------------------------------------------------------------------
-- VIEW 1: VISÃO GERAL DE CHAMADOS POR TÉCNICO
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_chamados_por_tecnico AS
SELECT 
    t.nome_completo AS "Técnico",
    b.nome_atp AS "Base",
    COUNT(c.numero_chamado) AS "Total de Chamados",
    MIN(c.data_abertura) AS "Primeiro Chamado",
    MAX(c.data_abertura) AS "Último Chamado"
FROM tb_tecnico t
JOIN tb_chamado c ON t.id_tecnico = c.id_tecnico
JOIN tb_base_atp b ON t.ct_base = b.ct_codigo
GROUP BY t.nome_completo, b.nome_atp;

-- ---------------------------------------------------------------------------------
-- VIEW 2: CÁLCULO DE SLA POR TÉCNICO
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_sla_por_tecnico AS
SELECT 
    t.nome_completo AS "Técnico",
    COUNT(c.numero_chamado) AS "Total Atendidos",
    SUM(CASE WHEN c.status_sla = 'DENTRO' THEN 1 ELSE 0 END) AS "Dentro do Prazo",
    SUM(CASE WHEN c.status_sla = 'FORA' THEN 1 ELSE 0 END) AS "Fora do Prazo",
    ROUND(
        SUM(CASE WHEN c.status_sla = 'DENTRO' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(c.numero_chamado), 0)
    , 2) AS "% SLA Atingido"
FROM tb_tecnico t
JOIN tb_chamado c ON t.id_tecnico = c.id_tecnico
GROUP BY t.nome_completo;

-- ---------------------------------------------------------------------------------
-- VIEW 3: ANÁLISE DE REINCIDÊNCIA
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_reincidencia_por_tecnico AS
SELECT 
    t.nome_completo AS "Técnico",
    COUNT(DISTINCT c.numero_chamado) AS "Total de Chamados Atendidos",
    COUNT(r.id_reincidencia) AS "Qtd Reincidências",
    ROUND(
        COUNT(r.id_reincidencia) * 100.0 / NULLIF(COUNT(DISTINCT c.numero_chamado), 0)
    , 2) AS "% Reincidência"
FROM tb_tecnico t
JOIN tb_chamado c ON t.id_tecnico = c.id_tecnico
LEFT JOIN tb_reincidencia r ON c.numero_chamado = r.chamado_novo 
GROUP BY t.nome_completo;

-- ---------------------------------------------------------------------------------
-- VIEW 4: EFICIÊNCIA DE PEÇAS
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_eficiencia_pecas AS
SELECT 
    t.nome_completo AS "Técnico",
    c.numero_chamado AS "OS",
    c.equipamento AS "Equipamento",
    p.grupo_mercadoria AS "Grupo da Peça",
    p.descricao_peca AS "Peça Utilizada",
    p.quantidade AS "Qtd"
FROM tb_tecnico t
JOIN tb_chamado c ON t.id_tecnico = c.id_tecnico
JOIN tb_consumo_peca p ON c.numero_chamado = p.numero_chamado
WHERE p.grupo_mercadoria IN ('HDD', 'SSD', 'PLM', 'LCD');

-- ---------------------------------------------------------------------------------
-- VIEW 5: SIMULAÇÃO DO RANKING MENSAL
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_ranking_mensal AS
SELECT 
    RANK() OVER (ORDER BY a.pontuacao_total DESC) AS "Posição",
    t.nome_completo AS "Técnico",
    a.pontuacao_total AS "Nota Final",
    a.atingimento_sla * 100 AS "% SLA",
    a.pontos_sla AS "Pts SLA",
    a.status_elegibilidade AS "Elegível?",
    a.motivo_inelegibilidade AS "Motivo Inelegibilidade",
    a.mes_ano AS "Mês de Referência"
FROM tb_apuracao_mensal a
JOIN tb_tecnico t ON a.id_tecnico = t.id_tecnico;