-- =========================================================================
-- FLYWAY V79: AS 4 TABELAS DE REGRAS DE CÁLCULO DO BRILHA+
-- 1. chamados_sla (Chamados elegíveis para SLA e Perdas)
-- 2. pecas (Consumo de peças com flag de peças críticas)
-- 3. reincidencia (Reincidências com chamado RRC e anterior, janela 90d)
-- 4. encerrados_rrc (Denominador oficial de chamados on-site da base)
-- =========================================================================

-- 1. TABELA: chamados_sla
CREATE TABLE IF NOT EXISTS chamados_sla (
    chamado VARCHAR(50) PRIMARY KEY,
    ct_codigo VARCHAR(30),
    atp_nome VARCHAR(150),
    abertura TIMESTAMP WITH TIME ZONE,
    ft TIMESTAMP WITH TIME ZONE NOT NULL,
    encerramento TIMESTAMP WITH TIME ZONE,
    segmento VARCHAR(50) NOT NULL,
    tipo VARCHAR(80) NOT NULL,
    texto_abertura TEXT,
    texto_breve TEXT,
    encdesc VARCHAR(100),
    texto_encerrado TEXT,
    projeto VARCHAR(50),
    cliente_codigo VARCHAR(50),
    cliente_nome VARCHAR(200),
    cliente_uf VARCHAR(5),
    cliente_cidade VARCHAR(120),
    serie VARCHAR(80),
    sku VARCHAR(80),
    marca VARCHAR(80),
    equipamento VARCHAR(80),
    ocorrencia_chamado VARCHAR(150),
    classifica_chamado VARCHAR(150),
    tecnico_nome VARCHAR(150),
    sla_status VARCHAR(20) NOT NULL, -- 'DENTRO' ou 'FORA'
    fonte_carga VARCHAR(30) DEFAULT 'DATABRICKS', -- 'DATABRICKS' ou 'PLANILHA'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chamados_sla_ft ON chamados_sla(ft);
CREATE INDEX IF NOT EXISTS idx_chamados_sla_tecnico ON chamados_sla(tecnico_nome);
CREATE INDEX IF NOT EXISTS idx_chamados_sla_ct ON chamados_sla(ct_codigo);
CREATE INDEX IF NOT EXISTS idx_chamados_sla_status ON chamados_sla(sla_status);
CREATE INDEX IF NOT EXISTS idx_chamados_sla_segmento ON chamados_sla(segmento, tipo);
CREATE INDEX IF NOT EXISTS idx_chamados_sla_ocorrencia ON chamados_sla(ocorrencia_chamado);

-- 2. TABELA: pecas (Atualização / Enriquecimento de colunas e índices)
ALTER TABLE pecas ADD COLUMN IF NOT EXISTS ct_codigo VARCHAR(30);
ALTER TABLE pecas ADD COLUMN IF NOT EXISTS atp_nome VARCHAR(150);
ALTER TABLE pecas ADD COLUMN IF NOT EXISTS subgrupo VARCHAR(80);
ALTER TABLE pecas ADD COLUMN IF NOT EXISTS codigo_solicitado VARCHAR(50);
ALTER TABLE pecas ADD COLUMN IF NOT EXISTS codigo_solicitado_desc VARCHAR(200);
ALTER TABLE pecas ADD COLUMN IF NOT EXISTS codigo_aplicado VARCHAR(50);
ALTER TABLE pecas ADD COLUMN IF NOT EXISTS codigo_aplicado_desc VARCHAR(200);
ALTER TABLE pecas ADD COLUMN IF NOT EXISTS is_peca_critica BOOLEAN DEFAULT FALSE;
ALTER TABLE pecas ADD COLUMN IF NOT EXISTS fonte_carga VARCHAR(30) DEFAULT 'DATABRICKS';
ALTER TABLE pecas ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Atualizar flag de peça crítica para registros já existentes
UPDATE pecas 
SET is_peca_critica = TRUE 
WHERE UPPER(COALESCE(subgrupo, grupo_mercadoria, grupo_mercadoria_desc, cod_aplic_desc, '')) ~* '(PLM|PLACA|SSD|HD|HDD|TELA|LCD)'
  AND (is_peca_critica IS FALSE OR is_peca_critica IS NULL);

CREATE INDEX IF NOT EXISTS idx_pecas_chamado ON pecas(chamado);
CREATE INDEX IF NOT EXISTS idx_pecas_ft ON pecas(ft);
CREATE INDEX IF NOT EXISTS idx_pecas_tecnico ON pecas(tecnico_nome);
CREATE INDEX IF NOT EXISTS idx_pecas_critica ON pecas(is_peca_critica);
CREATE INDEX IF NOT EXISTS idx_pecas_ct ON pecas(ct_codigo);

-- 3. TABELA: reincidencia (Reincidências & Janela 90d)
CREATE TABLE IF NOT EXISTS reincidencia (
    id_reincidencia SERIAL PRIMARY KEY,
    chamado_rrc VARCHAR(50) NOT NULL,
    chamado_anterior VARCHAR(50) NOT NULL,
    abertura_rrc TIMESTAMP WITH TIME ZONE,
    ft_rrc TIMESTAMP WITH TIME ZONE,
    encerramento_rrc TIMESTAMP WITH TIME ZONE NOT NULL,
    abertura_anterior TIMESTAMP WITH TIME ZONE,
    ft_anterior TIMESTAMP WITH TIME ZONE,
    encerramento_anterior TIMESTAMP WITH TIME ZONE,
    intervalo_dias INTEGER,
    tecnico_nome_anterior VARCHAR(150), -- Técnico responsável pelo 1º atendimento (recebe a falha individual)
    tecnico_nome_rrc VARCHAR(150),
    ct_anterior VARCHAR(30),           -- Base responsável (recebe a falha de equipe)
    ct_rrc VARCHAR(30),
    projeto_anterior VARCHAR(50),
    defeito_anterior VARCHAR(150),
    defeito_rrc VARCHAR(150),
    aplicado_peca_anterior VARCHAR(50),
    aplicado_peca_rrc VARCHAR(50),
    texto_encerrado_anterior TEXT,
    texto_encerrado_rrc TEXT,
    mesmo_motivo VARCHAR(20),
    reincidencia_auditada VARCHAR(20),
    is_elegivel_regra_90d BOOLEAN DEFAULT TRUE,
    fonte_carga VARCHAR(30) DEFAULT 'DATABRICKS',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_reincidencia_par UNIQUE (chamado_rrc, chamado_anterior)
);

CREATE INDEX IF NOT EXISTS idx_reincidencia_rrc ON reincidencia(chamado_rrc);
CREATE INDEX IF NOT EXISTS idx_reincidencia_ant ON reincidencia(chamado_anterior);
CREATE INDEX IF NOT EXISTS idx_reincidencia_tec_ant ON reincidencia(tecnico_nome_anterior);
CREATE INDEX IF NOT EXISTS idx_reincidencia_ct_ant ON reincidencia(ct_anterior);
CREATE INDEX IF NOT EXISTS idx_reincidencia_enc_rrc ON reincidencia(encerramento_rrc);

-- 4. TABELA: encerrados_rrc (Denominador Oficial de RRC)
CREATE TABLE IF NOT EXISTS encerrados_rrc (
    chamado VARCHAR(50) PRIMARY KEY,
    abertura TIMESTAMP WITH TIME ZONE,
    ft TIMESTAMP WITH TIME ZONE,
    encerramento TIMESTAMP WITH TIME ZONE NOT NULL,
    encerramento_desc VARCHAR(100),
    segmento VARCHAR(50) NOT NULL,
    tipo VARCHAR(80) NOT NULL,
    projeto VARCHAR(50),
    assistencia_codigo VARCHAR(30), -- CT / Base ATP
    assistencia_nome VARCHAR(150),
    assistencia_uf VARCHAR(5),
    assistencia_cidade VARCHAR(120),
    tecnico_nome VARCHAR(150),
    serie VARCHAR(80),
    sku VARCHAR(80),
    descricao_material VARCHAR(200),
    equipamento VARCHAR(80),
    ocorrencia_chamado VARCHAR(150),
    reincidente VARCHAR(20),
    atp_resumida VARCHAR(50),
    fonte_carga VARCHAR(30) DEFAULT 'DATABRICKS',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_encerrados_rrc_enc ON encerrados_rrc(encerramento);
CREATE INDEX IF NOT EXISTS idx_encerrados_rrc_ct ON encerrados_rrc(assistencia_codigo);
CREATE INDEX IF NOT EXISTS idx_encerrados_rrc_tecnico ON encerrados_rrc(tecnico_nome);
CREATE INDEX IF NOT EXISTS idx_encerrados_rrc_segmento ON encerrados_rrc(segmento, tipo);
