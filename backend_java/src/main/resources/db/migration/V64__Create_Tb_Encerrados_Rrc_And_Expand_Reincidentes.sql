-- =============================================================================
-- V64__Create_Tb_Encerrados_Rrc_And_Expand_Reincidentes.sql
-- 1. Cria a tabela oficial tb_encerrados_rrc com as 29 colunas da planilha
-- 2. Expande a tabela reincidentes para conter todas as 40 colunas da planilha
-- =============================================================================

SET default_transaction_read_only = off;

-- 1. Tabela Oficial de Encerrados RRC (29 colunas)
CREATE TABLE IF NOT EXISTS tb_encerrados_rrc (
    chamado VARCHAR(255) PRIMARY KEY,
    abertura TIMESTAMP,
    serie VARCHAR(255),
    sku VARCHAR(100),
    descricao_material VARCHAR(255),
    equipamento VARCHAR(150),
    barebone VARCHAR(150),
    marca VARCHAR(150),
    segmento VARCHAR(150),
    tipo VARCHAR(150),
    projeto VARCHAR(150),
    assistencia_codigo VARCHAR(100),
    assistencia_nome VARCHAR(255),
    assistencia_tipo VARCHAR(100),
    assistencia_uf VARCHAR(10),
    assistencia_cidade VARCHAR(150),
    ft TIMESTAMP,
    encerramento TIMESTAMP,
    encerramento_desc VARCHAR(255),
    cliente_codigo VARCHAR(100),
    cliente_nome VARCHAR(255),
    cliente_uf VARCHAR(10),
    cliente_cidade VARCHAR(150),
    tecnico_nome VARCHAR(255),
    texto_abertura TEXT,
    texto_encerrado TEXT,
    ocorrencia_chamado VARCHAR(255),
    reincidente VARCHAR(50),
    prioritario VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enc_rrc_assistencia ON tb_encerrados_rrc(assistencia_codigo);
CREATE INDEX IF NOT EXISTS idx_enc_rrc_tecnico ON tb_encerrados_rrc(tecnico_nome);
CREATE INDEX IF NOT EXISTS idx_enc_rrc_datas ON tb_encerrados_rrc(encerramento, ft);

-- Views de compatibilidade legada (remoção segura caso existam como view ou tabela)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'tb_reincidencia_encerrados') THEN
        DROP VIEW public.tb_reincidencia_encerrados CASCADE;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tb_reincidencia_encerrados') THEN
        DROP TABLE public.tb_reincidencia_encerrados CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'reincidencia_encerrados') THEN
        DROP VIEW public.reincidencia_encerrados CASCADE;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reincidencia_encerrados') THEN
        DROP TABLE public.reincidencia_encerrados CASCADE;
    END IF;
END $$;

CREATE OR REPLACE VIEW tb_reincidencia_encerrados AS SELECT * FROM tb_encerrados_rrc;
CREATE OR REPLACE VIEW reincidencia_encerrados AS SELECT * FROM tb_encerrados_rrc;

-- 2. Expansão de colunas na tabela reincidentes (totalizando 40 colunas operacionais)
ALTER TABLE reincidentes
    ADD COLUMN IF NOT EXISTS tipo_rrc VARCHAR(150),
    ADD COLUMN IF NOT EXISTS tipo_anterior VARCHAR(150),
    ADD COLUMN IF NOT EXISTS encdesc_rrc VARCHAR(255),
    ADD COLUMN IF NOT EXISTS encdesc_anterio VARCHAR(255),
    ADD COLUMN IF NOT EXISTS material_rrc VARCHAR(150),
    ADD COLUMN IF NOT EXISTS equipamento VARCHAR(150),
    ADD COLUMN IF NOT EXISTS barebone VARCHAR(150),
    ADD COLUMN IF NOT EXISTS marca VARCHAR(150),
    ADD COLUMN IF NOT EXISTS cliente_nome_rrc VARCHAR(255),
    ADD COLUMN IF NOT EXISTS cliente_uf_rrc VARCHAR(10),
    ADD COLUMN IF NOT EXISTS cliente_cidade_rrc VARCHAR(150),
    ADD COLUMN IF NOT EXISTS prioritario VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_reincidentes_enc_rrc ON reincidentes(encerramento_rrc);
CREATE INDEX IF NOT EXISTS idx_reincidentes_ft_rrc ON reincidentes(ft_rrc);
CREATE INDEX IF NOT EXISTS idx_reincidentes_ct_anterior ON reincidentes(ct_anterior);
CREATE INDEX IF NOT EXISTS idx_reincidentes_tec_ant ON reincidentes(tecnico_nome_anterior);
