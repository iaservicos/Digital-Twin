-- =============================================================================
-- V63__Restore_Reincidentes_Columns_And_Cleanup_Legacy.sql
-- Restaura colunas essenciais do Databricks na tabela 'reincidentes'
-- Remove tabelas legadas não utilizadas (tb_reincidencia, tb_reincidencia_encerrados)
-- =============================================================================

SET default_transaction_read_only = off;

-- 1. Restaurar colunas do Databricks na tabela reincidentes
ALTER TABLE reincidentes
    ADD COLUMN IF NOT EXISTS defeito_rrc VARCHAR(255),
    ADD COLUMN IF NOT EXISTS texto_encerrado_rrc TEXT,
    ADD COLUMN IF NOT EXISTS texto_abertura_rrc TEXT,
    ADD COLUMN IF NOT EXISTS texto_abertura_anterior TEXT,
    ADD COLUMN IF NOT EXISTS ocorrencia_chamado_rrc VARCHAR(255),
    ADD COLUMN IF NOT EXISTS aplicado_peca_rrc VARCHAR(255),
    ADD COLUMN IF NOT EXISTS trocou_plm_anterior VARCHAR(255),
    ADD COLUMN IF NOT EXISTS trocou_plm_rrc VARCHAR(255),
    ADD COLUMN IF NOT EXISTS encerramento_anterior TIMESTAMP,
    ADD COLUMN IF NOT EXISTS encerramento_rrc TIMESTAMP,
    ADD COLUMN IF NOT EXISTS abertura_anterior TIMESTAMP,
    ADD COLUMN IF NOT EXISTS abertura_rrc TIMESTAMP,
    ADD COLUMN IF NOT EXISTS meses_rrc BIGINT,
    ADD COLUMN IF NOT EXISTS classificacao VARCHAR(255),
    ADD COLUMN IF NOT EXISTS material_descricao_rrc VARCHAR(255),
    ADD COLUMN IF NOT EXISTS serie VARCHAR(255),
    ADD COLUMN IF NOT EXISTS segmento_rrc VARCHAR(255);

-- 2. Limpeza de tabelas legadas que não são referenciadas no sistema
DROP TABLE IF EXISTS tb_reincidencia CASCADE;
DROP TABLE IF EXISTS tb_reincidencia_encerrados CASCADE;
