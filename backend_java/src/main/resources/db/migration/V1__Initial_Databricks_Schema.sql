-- =============================================================================
-- V1__Initial_Databricks_Schema.sql
-- Migration Consolidada - "Databricks é a Nossa Verdade"
-- Recriação do Banco de Dados como Espelho 1-para-1 do Databricks SQL Warehouse
-- Mantendo 100% Intactas as Tabelas de Cadastro (tb_tecnico, tb_supervisor, tb_base_atp)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELA ESPELHO DATABRICKS: chamados (114 Colunas)
-- -----------------------------------------------------------------------------
CREATE TABLE chamados (
    chamado VARCHAR(255) PRIMARY KEY,
    abertura_id INT,
    login VARCHAR(255),
    abertura TIMESTAMP,
    abertura_bi DATE,
    preos TIMESTAMP,
    serie VARCHAR(255),
    serie_fabricante VARCHAR(255),
    material VARCHAR(255),
    tipo_equipamento VARCHAR(255),
    projeto VARCHAR(255),
    ft TIMESTAMP,
    ft_data_real TIMESTAMP,
    encerramento TIMESTAMP,
    encerrado_bi DATE,
    encerramento_bi DATE,
    aging_lab_dias INT,
    aging VARCHAR(255),
    gp_codigo VARCHAR(255),
    gp_cod_aux VARCHAR(255),
    gp_desc VARCHAR(255),
    gp_segmento VARCHAR(255),
    segmento VARCHAR(255),
    situacao VARCHAR(255),
    tipo VARCHAR(255),
    enc VARCHAR(255),
    encdesc VARCHAR(255),
    texto_abertura TEXT,
    texto_encerrado TEXT,
    texto_breve TEXT,
    defeito_cod VARCHAR(255),
    defeito VARCHAR(255),
    hass VARCHAR(255),
    idade_parque VARCHAR(255),
    codigo_cliente VARCHAR(255),
    cliente_nome VARCHAR(255),
    cliente_email VARCHAR(255),
    cliente_uf VARCHAR(50),
    cliente_cidade VARCHAR(255),
    cliente_cpf_cnpj VARCHAR(255),
    ordem_producao VARCHAR(255),
    data_ativacao VARCHAR(255),
    doa VARCHAR(255),
    data_inicio_garantia VARCHAR(255),
    os_atendimento_data_hora TIMESTAMP,
    tempo_falha_dias BIGINT,
    tempo_falha_meses BIGINT,
    num_ordem VARCHAR(255),
    op_data TIMESTAMP,
    ocorrencia_chamado VARCHAR(255),
    assistencia_codigo INT,
    tempo_garantia_meses INT,
    escritorio_vendas VARCHAR(255),
    modal VARCHAR(255),
    codigo_postagem_envio VARCHAR(255),
    data_postagem_envio TIMESTAMP,
    data_entrega_envio TIMESTAMP,
    status_envio VARCHAR(255),
    codigo_postagem_retorno VARCHAR(255),
    data_postagem_retorno TIMESTAMP,
    data_entrega_retorno TIMESTAMP,
    status_retorno VARCHAR(255),
    tempo_ida_envio BIGINT,
    idade_parque_falha BIGINT,
    pendencia VARCHAR(255),
    assistencia_centro_trabalho VARCHAR(255),
    assistencia_razao_social VARCHAR(255),
    detentor_nome VARCHAR(255),
    detentor_email VARCHAR(255),
    detentor_celular VARCHAR(255),
    detentor_contato VARCHAR(255),
    detentor_cep VARCHAR(255),
    detentor_uf VARCHAR(50),
    detentor_cidade VARCHAR(255),
    detentor_bairro VARCHAR(255),
    detentor_logradouro VARCHAR(255),
    detentor_cnpj VARCHAR(255),
    detentor_complemento VARCHAR(255),
    tecnico_nome VARCHAR(255),
    os_cliente VARCHAR(255),
    assistencia_cep VARCHAR(255),
    assistencia_cep_aux BIGINT,
    descricao_material VARCHAR(255),
    sla_data_limite TIMESTAMP,
    sla_tipo_calculo VARCHAR(255),
    sla_cliente BIGINT,
    sla_ini_exp VARCHAR(255),
    sla_fim_exp VARCHAR(255),
    sla_status VARCHAR(255),
    sla_tat INT,
    pp BIGINT,
    bkp BIGINT,
    ta VARCHAR(255),
    tipo_cliente VARCHAR(255),
    canais_de_vendas VARCHAR(255),
    ts_tempo_servico VARCHAR(255),
    status_assist VARCHAR(255),
    distribuidora VARCHAR(255),
    modal_de_envio VARCHAR(255),
    modal_de_retorno VARCHAR(255),
    recebimento_envio TIMESTAMP,
    varejo VARCHAR(255),
    prioritario VARCHAR(255),
    teve_anexo VARCHAR(255),
    status_chamado VARCHAR(255),
    meio_contato VARCHAR(255),
    eticket_numero VARCHAR(255),
    dias_lab BIGINT,
    dias_cli BIGINT,
    ultima_posicao VARCHAR(255),
    ultima_posicao_data TIMESTAMP,
    ordem VARCHAR(255),
    grupo_materiais VARCHAR(255),
    tempo_servico BIGINT,
    tipo_idf VARCHAR(255),
    ultima_atualizacao_chamado TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 2. TABELA ESPELHO DATABRICKS: reincidentes (49 Colunas)
-- -----------------------------------------------------------------------------
CREATE TABLE reincidentes (
    id SERIAL PRIMARY KEY,
    chamado_anterior VARCHAR(255),
    chamado_rrc VARCHAR(255),
    serie VARCHAR(255),
    segmento_rrc VARCHAR(255),
    material_rrc VARCHAR(255),
    material_descricao_rrc VARCHAR(255),
    projeto_rrc VARCHAR(255),
    projeto_anterior VARCHAR(255),
    tipo_rrc VARCHAR(255),
    tipo_anterior VARCHAR(255),
    encdesc_rrc VARCHAR(255),
    encdesc_anterio VARCHAR(255),
    abertura_rrc TIMESTAMP,
    abertura_anterior TIMESTAMP,
    ft_rrc TIMESTAMP,
    ft_anterior TIMESTAMP,
    encerramento_rrc TIMESTAMP,
    encerramento_rrc_bi DATE,
    encerramento_anterior TIMESTAMP,
    meses_rrc BIGINT,
    ct_rrc VARCHAR(255),
    ct_anterior VARCHAR(255),
    aplicado_peca_rrc VARCHAR(255),
    ocorrencia_chamado_anterior VARCHAR(255),
    tecnico_nome_rrc VARCHAR(255),
    tecnico_nome_anterior VARCHAR(255),
    aplicado_peca_anterior VARCHAR(255),
    defeito_rrc VARCHAR(255),
    defeito_anterior VARCHAR(255),
    ocorrencia_chamado_rrc VARCHAR(255),
    texto_abertura_rrc TEXT,
    texto_encerrado_rrc TEXT,
    texto_abertura_anterior TEXT,
    texto_encerrado_anterior TEXT,
    escritorio_vendas VARCHAR(255),
    cliente_codigo_rrc VARCHAR(255),
    cliente_nome_rrc VARCHAR(255),
    cliente_uf_rrc VARCHAR(50),
    cliente_cidade_rrc VARCHAR(255),
    cliente_codigo_anterior VARCHAR(255),
    cliente_nome_anterior VARCHAR(255),
    cliente_uf_anterior VARCHAR(50),
    cliente_cidade_anterior VARCHAR(255),
    trocou_plm_rrc VARCHAR(255),
    trocou_plm_anterior VARCHAR(255),
    prioritario VARCHAR(255),
    sla_cliente BIGINT,
    classificacao VARCHAR(255),
    plm_passou_ctr VARCHAR(255)
);

-- -----------------------------------------------------------------------------
-- 3. TABELA ESPELHO DATABRICKS: pecas (52 Colunas)
-- -----------------------------------------------------------------------------
CREATE TABLE pecas (
    id SERIAL PRIMARY KEY,
    abertura_id INT,
    chamado VARCHAR(255),
    serie VARCHAR(255),
    sku VARCHAR(255),
    tipo_equipamento VARCHAR(255),
    data_posic TIMESTAMP,
    abertura TIMESTAMP,
    ft TIMESTAMP,
    encerrado TIMESTAMP,
    encerrado_bi DATE,
    acao VARCHAR(255),
    rmdf VARCHAR(255),
    codigo_solicitado VARCHAR(255),
    cod_solic_desc VARCHAR(255),
    causa VARCHAR(255),
    cod_aplic VARCHAR(255),
    cod_aplic_desc VARCHAR(255),
    serial_ant VARCHAR(255),
    serial_nov VARCHAR(255),
    remessa VARCHAR(255),
    nf VARCHAR(255),
    data_expedicao TIMESTAMP,
    data_entrega TIMESTAMP,
    data_recebimento TIMESTAMP,
    data_recusa TIMESTAMP,
    situacao VARCHAR(255),
    tipo VARCHAR(255),
    enc VARCHAR(255),
    encdesc VARCHAR(255),
    meses_ate_falha BIGINT,
    idade_parque_falha BIGINT,
    ordem_producao VARCHAR(255),
    segmento VARCHAR(255),
    detentor_cep VARCHAR(255),
    detentor_uf VARCHAR(50),
    detentor_cidade VARCHAR(255),
    detentor_bairro VARCHAR(255),
    detentor_logradouro VARCHAR(255),
    lote VARCHAR(255),
    codigo_cliente VARCHAR(255),
    cliente_nome VARCHAR(255),
    cliente_uf VARCHAR(50),
    cliente_cidade VARCHAR(255),
    tecnico_nome VARCHAR(255),
    data_ativacao VARCHAR(255),
    qtd INT,
    grupo_mercadoria VARCHAR(255),
    grupo_mercadoria_desc VARCHAR(255),
    tipo_posicionado VARCHAR(255),
    status_peca VARCHAR(255),
    serial_ant_ctr_status VARCHAR(255),
    serial_ant_falha VARCHAR(255)
);

-- -----------------------------------------------------------------------------
-- 4. TABELA AUXILIAR: reincidencia_encerrados
-- -----------------------------------------------------------------------------
CREATE TABLE reincidencia_encerrados (
    chamado VARCHAR(255) PRIMARY KEY,
    segmento VARCHAR(150),
    projeto VARCHAR(150),
    assistencia_codigo VARCHAR(100),
    assistencia_nome VARCHAR(255),
    ft TIMESTAMP,
    tecnico_nome VARCHAR(255),
    texto_encerrado TEXT
);

-- -----------------------------------------------------------------------------
-- 5. TABELAS ADMINISTRATIVAS E DE CADASTRO (PRESERVADAS 100% DO ORIGINAL)
-- -----------------------------------------------------------------------------

CREATE TABLE tb_supervisor (
    id_supervisor SERIAL PRIMARY KEY,
    matricula VARCHAR(100) UNIQUE,
    nome_completo VARCHAR(255) NOT NULL,
    primeiro_nome VARCHAR(100),
    sobrenome VARCHAR(150),
    senha VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    id_coordenador INT,
    role VARCHAR(50) DEFAULT 'ADMINISTRADOR',
    ativo BOOLEAN DEFAULT TRUE,
    is_primeiro_acesso BOOLEAN DEFAULT TRUE
);

CREATE TABLE tb_base_atp (
    id_base SERIAL PRIMARY KEY,
    ct_codigo VARCHAR(50) UNIQUE NOT NULL,
    nome_atp VARCHAR(255) NOT NULL,
    tipo_atp VARCHAR(100),
    cidade VARCHAR(100),
    uf VARCHAR(50),
    regiao VARCHAR(100),
    supervisor VARCHAR(100),
    responsavel VARCHAR(100),
    id_supervisor INT REFERENCES tb_supervisor(id_supervisor) ON DELETE SET NULL
);

CREATE TABLE tb_tecnico (
    id_tecnico SERIAL PRIMARY KEY,
    matricula VARCHAR(100) UNIQUE,
    cpf VARCHAR(20) UNIQUE,
    nome_completo VARCHAR(255) NOT NULL,
    primeiro_nome VARCHAR(100),
    sobrenome VARCHAR(150),
    cargo VARCHAR(100) DEFAULT 'Técnico On-site',
    id_supervisor INT REFERENCES tb_supervisor(id_supervisor) ON DELETE SET NULL,
    id_base INT REFERENCES tb_base_atp(id_base) ON DELETE SET NULL,
    senha VARCHAR(255),
    ativo BOOLEAN DEFAULT TRUE,
    is_primeiro_acesso BOOLEAN DEFAULT TRUE,
    role VARCHAR(50) DEFAULT 'PADRAO',
    pontuacao_total NUMERIC(10,2) DEFAULT 0.00
);

CREATE TABLE tb_tecnico_base (
    id_tecnico INT REFERENCES tb_tecnico(id_tecnico) ON DELETE CASCADE,
    ct_codigo VARCHAR(50) NOT NULL,
    PRIMARY KEY (id_tecnico, ct_codigo)
);

CREATE TABLE tb_campanha (
    id_campanha SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    data_inicio DATE,
    data_fim DATE,
    duracao_meses INT DEFAULT 2,
    status VARCHAR(50) DEFAULT 'ATIVA'
);

CREATE TABLE tb_usuario (
    id_usuario SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'MODERADOR'
);

CREATE TABLE tb_foto_perfil (
    id_foto SERIAL PRIMARY KEY,
    id_tecnico INT UNIQUE REFERENCES tb_tecnico(id_tecnico) ON DELETE CASCADE,
    dados_imagem BYTEA,
    tipo_mime VARCHAR(100)
);

-- -----------------------------------------------------------------------------
-- 6. ÍNDICES DE PERFORMANCE
-- -----------------------------------------------------------------------------
CREATE INDEX idx_chamados_ft ON chamados(ft);
CREATE INDEX idx_chamados_tecnico ON chamados(tecnico_nome);
CREATE INDEX idx_chamados_ct ON chamados(assistencia_centro_trabalho);
CREATE INDEX idx_chamados_sla ON chamados(sla_status);

CREATE INDEX idx_reincidentes_chamado_rrc ON reincidentes(chamado_rrc);
CREATE INDEX idx_reincidentes_ft_rrc ON reincidentes(ft_rrc);
CREATE INDEX idx_reincidentes_tecnico_rrc ON reincidentes(tecnico_nome_rrc);

CREATE INDEX idx_pecas_chamado ON pecas(chamado);
CREATE INDEX idx_pecas_ft ON pecas(ft);
CREATE INDEX idx_pecas_tecnico ON pecas(tecnico_nome);
