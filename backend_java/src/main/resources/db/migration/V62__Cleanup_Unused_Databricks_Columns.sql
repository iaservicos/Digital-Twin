-- =============================================================================
-- V62__Cleanup_Unused_Databricks_Columns.sql
-- Limpeza definitiva de colunas não utilizadas nas tabelas chamados, reincidentes e pecas
-- Mantendo estritamente as colunas operacionais utilizadas pelo sistema Brilha+
-- =============================================================================

-- 1. Drop das Views que referenciam as tabelas
DROP VIEW IF EXISTS vw_apuracao_pontos CASCADE;
DROP VIEW IF EXISTS vw_indicadores_tecnico CASCADE;

-- 2. Limpeza na tabela chamados
ALTER TABLE chamados
    DROP COLUMN IF EXISTS abertura_id,
    DROP COLUMN IF EXISTS login,
    DROP COLUMN IF EXISTS abertura,
    DROP COLUMN IF EXISTS abertura_bi,
    DROP COLUMN IF EXISTS preos,
    DROP COLUMN IF EXISTS serie,
    DROP COLUMN IF EXISTS serie_fabricante,
    DROP COLUMN IF EXISTS material,
    DROP COLUMN IF EXISTS ft_data_real,
    DROP COLUMN IF EXISTS encerramento,
    DROP COLUMN IF EXISTS encerrado_bi,
    DROP COLUMN IF EXISTS encerramento_bi,
    DROP COLUMN IF EXISTS aging_lab_dias,
    DROP COLUMN IF EXISTS aging,
    DROP COLUMN IF EXISTS gp_codigo,
    DROP COLUMN IF EXISTS gp_cod_aux,
    DROP COLUMN IF EXISTS segmento,
    DROP COLUMN IF EXISTS situacao,
    DROP COLUMN IF EXISTS enc,
    DROP COLUMN IF EXISTS encdesc,
    DROP COLUMN IF EXISTS texto_abertura,
    DROP COLUMN IF EXISTS texto_breve,
    DROP COLUMN IF EXISTS defeito_cod,
    DROP COLUMN IF EXISTS defeito,
    DROP COLUMN IF EXISTS hass,
    DROP COLUMN IF EXISTS idade_parque,
    DROP COLUMN IF EXISTS codigo_cliente,
    DROP COLUMN IF EXISTS cliente_nome,
    DROP COLUMN IF EXISTS cliente_email,
    DROP COLUMN IF EXISTS cliente_uf,
    DROP COLUMN IF EXISTS cliente_cidade,
    DROP COLUMN IF EXISTS cliente_cpf_cnpj,
    DROP COLUMN IF EXISTS ordem_producao,
    DROP COLUMN IF EXISTS data_ativacao,
    DROP COLUMN IF EXISTS doa,
    DROP COLUMN IF EXISTS data_inicio_garantia,
    DROP COLUMN IF EXISTS os_atendimento_data_hora,
    DROP COLUMN IF EXISTS tempo_falha_dias,
    DROP COLUMN IF EXISTS tempo_falha_meses,
    DROP COLUMN IF EXISTS num_ordem,
    DROP COLUMN IF EXISTS op_data,
    DROP COLUMN IF EXISTS assistencia_codigo,
    DROP COLUMN IF EXISTS tempo_garantia_meses,
    DROP COLUMN IF EXISTS escritorio_vendas,
    DROP COLUMN IF EXISTS modal,
    DROP COLUMN IF EXISTS codigo_postagem_envio,
    DROP COLUMN IF EXISTS data_postagem_envio,
    DROP COLUMN IF EXISTS data_entrega_envio,
    DROP COLUMN IF EXISTS status_envio,
    DROP COLUMN IF EXISTS codigo_postagem_retorno,
    DROP COLUMN IF EXISTS data_postagem_retorno,
    DROP COLUMN IF EXISTS data_entrega_retorno,
    DROP COLUMN IF EXISTS status_retorno,
    DROP COLUMN IF EXISTS tempo_ida_envio,
    DROP COLUMN IF EXISTS idade_parque_falha,
    DROP COLUMN IF EXISTS pendencia,
    DROP COLUMN IF EXISTS detentor_nome,
    DROP COLUMN IF EXISTS detentor_email,
    DROP COLUMN IF EXISTS detentor_celular,
    DROP COLUMN IF EXISTS detentor_contato,
    DROP COLUMN IF EXISTS detentor_cep,
    DROP COLUMN IF EXISTS detentor_uf,
    DROP COLUMN IF EXISTS detentor_cidade,
    DROP COLUMN IF EXISTS detentor_bairro,
    DROP COLUMN IF EXISTS detentor_logradouro,
    DROP COLUMN IF EXISTS detentor_cnpj,
    DROP COLUMN IF EXISTS detentor_complemento,
    DROP COLUMN IF EXISTS os_cliente,
    DROP COLUMN IF EXISTS assistencia_cep,
    DROP COLUMN IF EXISTS assistencia_cep_aux,
    DROP COLUMN IF EXISTS sla_data_limite,
    DROP COLUMN IF EXISTS sla_tipo_calculo,
    DROP COLUMN IF EXISTS sla_cliente,
    DROP COLUMN IF EXISTS sla_ini_exp,
    DROP COLUMN IF EXISTS sla_fim_exp,
    DROP COLUMN IF EXISTS sla_tat,
    DROP COLUMN IF EXISTS "PP",
    DROP COLUMN IF EXISTS "BKP",
    DROP COLUMN IF EXISTS "TA",
    DROP COLUMN IF EXISTS tipo_cliente,
    DROP COLUMN IF EXISTS canais_de_vendas,
    DROP COLUMN IF EXISTS ts_tempo_servico,
    DROP COLUMN IF EXISTS status_assist,
    DROP COLUMN IF EXISTS distribuidora,
    DROP COLUMN IF EXISTS modal_de_envio,
    DROP COLUMN IF EXISTS modal_de_retorno,
    DROP COLUMN IF EXISTS recebimento_envio,
    DROP COLUMN IF EXISTS varejo,
    DROP COLUMN IF EXISTS prioritario,
    DROP COLUMN IF EXISTS teve_anexo,
    DROP COLUMN IF EXISTS status_chamado,
    DROP COLUMN IF EXISTS meio_contato,
    DROP COLUMN IF EXISTS eticket_numero,
    DROP COLUMN IF EXISTS dias_lab,
    DROP COLUMN IF EXISTS dias_cli,
    DROP COLUMN IF EXISTS ultima_posicao,
    DROP COLUMN IF EXISTS ultima_posicao_data,
    DROP COLUMN IF EXISTS ordem,
    DROP COLUMN IF EXISTS grupo_materiais,
    DROP COLUMN IF EXISTS tempo_servico,
    DROP COLUMN IF EXISTS tipo_idf,
    DROP COLUMN IF EXISTS ultima_atualizacao_chamado;

-- 3. Limpeza na tabela reincidentes
ALTER TABLE reincidentes
    DROP COLUMN IF EXISTS serie,
    DROP COLUMN IF EXISTS segmento_rrc,
    DROP COLUMN IF EXISTS material_rrc,
    DROP COLUMN IF EXISTS material_descricao_rrc,
    DROP COLUMN IF EXISTS tipo_rrc,
    DROP COLUMN IF EXISTS tipo_anterior,
    DROP COLUMN IF EXISTS encdesc_rrc,
    DROP COLUMN IF EXISTS encdesc_anterio,
    DROP COLUMN IF EXISTS abertura_rrc,
    DROP COLUMN IF EXISTS abertura_anterior,
    DROP COLUMN IF EXISTS encerramento_rrc,
    DROP COLUMN IF EXISTS encerramento_rrc_bi,
    DROP COLUMN IF EXISTS encerramento_anterior,
    DROP COLUMN IF EXISTS meses_rrc,
    DROP COLUMN IF EXISTS aplicado_peca_rrc,
    DROP COLUMN IF EXISTS defeito_rrc,
    DROP COLUMN IF EXISTS ocorrencia_chamado_rrc,
    DROP COLUMN IF EXISTS texto_abertura_rrc,
    DROP COLUMN IF EXISTS texto_encerrado_rrc,
    DROP COLUMN IF EXISTS texto_abertura_anterior,
    DROP COLUMN IF EXISTS escritorio_vendas,
    DROP COLUMN IF EXISTS cliente_codigo_rrc,
    DROP COLUMN IF EXISTS cliente_nome_rrc,
    DROP COLUMN IF EXISTS cliente_uf_rrc,
    DROP COLUMN IF EXISTS cliente_cidade_rrc,
    DROP COLUMN IF EXISTS cliente_codigo_anterior,
    DROP COLUMN IF EXISTS cliente_nome_anterior,
    DROP COLUMN IF EXISTS cliente_uf_anterior,
    DROP COLUMN IF EXISTS cliente_cidade_anterior,
    DROP COLUMN IF EXISTS trocou_plm_rrc,
    DROP COLUMN IF EXISTS trocou_plm_anterior,
    DROP COLUMN IF EXISTS prioritario,
    DROP COLUMN IF EXISTS sla_cliente,
    DROP COLUMN IF EXISTS classificacao,
    DROP COLUMN IF EXISTS plm_passou_ctr;

-- 4. Limpeza na tabela pecas
ALTER TABLE pecas
    DROP COLUMN IF EXISTS abertura_id,
    DROP COLUMN IF EXISTS serie,
    DROP COLUMN IF EXISTS "SKU",
    DROP COLUMN IF EXISTS data_posic,
    DROP COLUMN IF EXISTS abertura,
    DROP COLUMN IF EXISTS encerrado,
    DROP COLUMN IF EXISTS encerrado_bi,
    DROP COLUMN IF EXISTS "RMDF",
    DROP COLUMN IF EXISTS codigo_solicitado,
    DROP COLUMN IF EXISTS causa,
    DROP COLUMN IF EXISTS cod_aplic,
    DROP COLUMN IF EXISTS serial_ant,
    DROP COLUMN IF EXISTS serial_nov,
    DROP COLUMN IF EXISTS "Remessa",
    DROP COLUMN IF EXISTS "NF",
    DROP COLUMN IF EXISTS data_expedicao,
    DROP COLUMN IF EXISTS data_entrega,
    DROP COLUMN IF EXISTS data_recebimento,
    DROP COLUMN IF EXISTS data_recusa,
    DROP COLUMN IF EXISTS situacao,
    DROP COLUMN IF EXISTS tipo,
    DROP COLUMN IF EXISTS enc,
    DROP COLUMN IF EXISTS encdesc,
    DROP COLUMN IF EXISTS meses_ate_falha,
    DROP COLUMN IF EXISTS idade_parque_falha,
    DROP COLUMN IF EXISTS ordem_producao,
    DROP COLUMN IF EXISTS segmento,
    DROP COLUMN IF EXISTS detentor_cep,
    DROP COLUMN IF EXISTS detentor_uf,
    DROP COLUMN IF EXISTS detentor_cidade,
    DROP COLUMN IF EXISTS detentor_bairro,
    DROP COLUMN IF EXISTS detentor_logradouro,
    DROP COLUMN IF EXISTS lote,
    DROP COLUMN IF EXISTS codigo_cliente,
    DROP COLUMN IF EXISTS cliente_nome,
    DROP COLUMN IF EXISTS cliente_uf,
    DROP COLUMN IF EXISTS cliente_cidade,
    DROP COLUMN IF EXISTS data_ativacao,
    DROP COLUMN IF EXISTS qtd,
    DROP COLUMN IF EXISTS tipo_posicionado,
    DROP COLUMN IF EXISTS status_peca,
    DROP COLUMN IF EXISTS serial_ant_ctr_status,
    DROP COLUMN IF EXISTS serial_ant_falha;

-- 5. Recriação das Views com o Schema Limpo
CREATE OR REPLACE VIEW vw_indicadores_tecnico AS
SELECT 
    t.id_tecnico,
    t.nome_completo AS tecnico_nome,
    t.matricula,
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
    COUNT(DISTINCT p.chamado) AS total_pecas_consumidas

FROM tb_tecnico t
LEFT JOIN tb_supervisor s ON t.id_supervisor = s.id_supervisor
LEFT JOIN chamados c ON UPPER(TRIM(c.tecnico_nome)) LIKE UPPER(TRIM(t.nome_completo)) || '%'
LEFT JOIN reincidentes r ON UPPER(TRIM(r.tecnico_nome_rrc)) LIKE UPPER(TRIM(t.nome_completo)) || '%'
LEFT JOIN pecas p ON UPPER(TRIM(p.tecnico_nome)) LIKE UPPER(TRIM(t.nome_completo)) || '%'
GROUP BY t.id_tecnico, t.nome_completo, t.matricula, s.nome_completo;

CREATE OR REPLACE VIEW vw_apuracao_pontos AS
SELECT 
    id_tecnico,
    tecnico_nome,
    matricula,
    supervisor_nome,
    total_chamados,
    chamados_no_prazo,
    chamados_fora_prazo,
    percentual_sla,
    total_reincidencias,
    total_pecas_consumidas,
    ROUND((COALESCE(percentual_sla, 0.00) * 10), 2) AS pontos_calculados_sla
FROM vw_indicadores_tecnico;

-- 6. Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_chamados_ft ON chamados(ft);
CREATE INDEX IF NOT EXISTS idx_chamados_tecnico ON chamados(tecnico_nome);
CREATE INDEX IF NOT EXISTS idx_chamados_ct ON chamados(assistencia_centro_trabalho);
CREATE INDEX IF NOT EXISTS idx_reincidentes_ft_rrc ON reincidentes(ft_rrc);
CREATE INDEX IF NOT EXISTS idx_reincidentes_tecnico ON reincidentes(tecnico_nome_anterior);
CREATE INDEX IF NOT EXISTS idx_pecas_ft ON pecas(ft);
CREATE INDEX IF NOT EXISTS idx_pecas_tecnico ON pecas(tecnico_nome);
