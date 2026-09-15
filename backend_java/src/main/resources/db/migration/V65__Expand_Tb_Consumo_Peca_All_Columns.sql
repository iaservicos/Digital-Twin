-- V65__Expand_Tb_Consumo_Peca_All_Columns.sql
-- Expansão integral da tabela tb_consumo_peca com todas as 59 colunas da planilha oficial Pecas.xlsx

ALTER TABLE tb_consumo_peca
    ADD COLUMN IF NOT EXISTS abertura TIMESTAMP,
    ADD COLUMN IF NOT EXISTS encerramento TIMESTAMP,
    ADD COLUMN IF NOT EXISTS tipo VARCHAR(150),
    ADD COLUMN IF NOT EXISTS texto_abertura TEXT,
    ADD COLUMN IF NOT EXISTS texto_breve TEXT,
    ADD COLUMN IF NOT EXISTS encdesc VARCHAR(150),
    ADD COLUMN IF NOT EXISTS texto_encerrado TEXT,
    ADD COLUMN IF NOT EXISTS cliente_codigo VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(255),
    ADD COLUMN IF NOT EXISTS escritorio_vendas VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cliente_uf VARCHAR(10),
    ADD COLUMN IF NOT EXISTS cliente_cidade VARCHAR(150),
    ADD COLUMN IF NOT EXISTS detentor_nome VARCHAR(255),
    ADD COLUMN IF NOT EXISTS detentor_cep VARCHAR(50),
    ADD COLUMN IF NOT EXISTS detentor_uf VARCHAR(10),
    ADD COLUMN IF NOT EXISTS detentor_cidade VARCHAR(150),
    ADD COLUMN IF NOT EXISTS detentor_bairro VARCHAR(150),
    ADD COLUMN IF NOT EXISTS detentor_logradouro VARCHAR(255),
    ADD COLUMN IF NOT EXISTS serie VARCHAR(150),
    ADD COLUMN IF NOT EXISTS sku VARCHAR(100),
    ADD COLUMN IF NOT EXISTS marca VARCHAR(150),
    ADD COLUMN IF NOT EXISTS barebone VARCHAR(150),
    ADD COLUMN IF NOT EXISTS utiliza_peca VARCHAR(100),
    ADD COLUMN IF NOT EXISTS utiliza_peca_eng VARCHAR(100),
    ADD COLUMN IF NOT EXISTS hass VARCHAR(50),
    ADD COLUMN IF NOT EXISTS ocorrencia_chamado VARCHAR(255),
    ADD COLUMN IF NOT EXISTS tempo_falha_meses NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS grupo_economico VARCHAR(150),
    ADD COLUMN IF NOT EXISTS os_cliente VARCHAR(100),
    ADD COLUMN IF NOT EXISTS idade_parque NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS idade_parque_falha NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS sintoma_eng TEXT,
    ADD COLUMN IF NOT EXISTS divisao_eng VARCHAR(150),
    ADD COLUMN IF NOT EXISTS varejo VARCHAR(50),
    ADD COLUMN IF NOT EXISTS codigo_solicitado VARCHAR(100),
    ADD COLUMN IF NOT EXISTS codigo_solicitado_desc TEXT,
    ADD COLUMN IF NOT EXISTS codigo_aplicado VARCHAR(100),
    ADD COLUMN IF NOT EXISTS codigo_aplicado_desc TEXT,
    ADD COLUMN IF NOT EXISTS causa VARCHAR(255),
    ADD COLUMN IF NOT EXISTS serial_ant VARCHAR(150),
    ADD COLUMN IF NOT EXISTS serial_nov VARCHAR(150),
    ADD COLUMN IF NOT EXISTS data_inicio_garantia TIMESTAMP,
    ADD COLUMN IF NOT EXISTS data_ativacao TIMESTAMP,
    ADD COLUMN IF NOT EXISTS grupo_mercadoria VARCHAR(100),
    ADD COLUMN IF NOT EXISTS grupo_mercadoria_desc VARCHAR(150),
    ADD COLUMN IF NOT EXISTS tipo_posicionado VARCHAR(100),
    ADD COLUMN IF NOT EXISTS peca_control VARCHAR(50),
    ADD COLUMN IF NOT EXISTS status_chamado VARCHAR(100),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Índices de busca e auditoria analítica
CREATE INDEX IF NOT EXISTS idx_consumo_peca_chamado ON tb_consumo_peca (chamado);
CREATE INDEX IF NOT EXISTS idx_consumo_peca_tecnico ON tb_consumo_peca (tecnico_nome);
CREATE INDEX IF NOT EXISTS idx_consumo_peca_ft ON tb_consumo_peca (ft);
CREATE INDEX IF NOT EXISTS idx_consumo_peca_subgrupo ON tb_consumo_peca (subgrupo);
