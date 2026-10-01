-- =========================================================================
-- FLYWAY V78: DESACOPLAMENTO RBAC (tb_usuario), AUDITORIA HÍBRIDA E LIMPEZA
-- =========================================================================

-- 1. Criação dos tipos enumerados para controle de acesso
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_perfil_acesso') THEN
        CREATE TYPE enum_perfil_acesso AS ENUM ('PADRAO', 'ADMINISTRADOR', 'MODERADOR');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_nivel_organizacional') THEN
        CREATE TYPE enum_nivel_organizacional AS ENUM ('TECNICO', 'SUPERVISOR', 'GERENTE', 'TI');
    END IF;
END $$;

-- 2. Criação da tabela unificada de autenticação e usuários
CREATE TABLE IF NOT EXISTS tb_usuario (
    id_usuario SERIAL PRIMARY KEY,
    matricula VARCHAR(30) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    nome_completo VARCHAR(150) NOT NULL,
    primeiro_nome VARCHAR(60),
    sobrenome VARCHAR(90),
    email VARCHAR(120),
    perfil_acesso enum_perfil_acesso NOT NULL DEFAULT 'PADRAO',
    nivel_organizacional enum_nivel_organizacional NOT NULL DEFAULT 'TECNICO',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    is_primeiro_acesso BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuario_matricula ON tb_usuario(matricula);
CREATE INDEX IF NOT EXISTS idx_usuario_perfil ON tb_usuario(perfil_acesso, nivel_organizacional);

-- 3. Vincular id_usuario em tb_tecnico e tb_supervisor
ALTER TABLE tb_tecnico ADD COLUMN IF NOT EXISTS id_usuario INTEGER REFERENCES tb_usuario(id_usuario);
ALTER TABLE tb_supervisor ADD COLUMN IF NOT EXISTS id_usuario INTEGER REFERENCES tb_usuario(id_usuario);

-- 4. Migração e sincronização de usuários existentes para tb_usuario:
-- 4.1 Inserir supervisores que possuem matrícula válida
INSERT INTO tb_usuario (matricula, senha_hash, nome_completo, primeiro_nome, sobrenome, email, perfil_acesso, nivel_organizacional, ativo, is_primeiro_acesso)
SELECT 
    TRIM(s.matricula),
    COALESCE(s.senha, '$2b$10$UE2lBW/xzn9KyUU2Bsp1m.bFS53RiWeGboDRHvNbioYfMzC4KzcOG'),
    s.nome_completo,
    s.primeiro_nome,
    s.sobrenome,
    s.email,
    'ADMINISTRADOR'::enum_perfil_acesso,
    'SUPERVISOR'::enum_nivel_organizacional,
    COALESCE(s.ativo, TRUE),
    COALESCE(s.is_primeiro_acesso, TRUE)
FROM tb_supervisor s
WHERE s.matricula IS NOT NULL AND TRIM(s.matricula) <> ''
ON CONFLICT (matricula) DO UPDATE SET
    perfil_acesso = EXCLUDED.perfil_acesso,
    nivel_organizacional = EXCLUDED.nivel_organizacional;

-- 4.2 Inserir técnicos de tb_tecnico
INSERT INTO tb_usuario (matricula, senha_hash, nome_completo, primeiro_nome, sobrenome, email, perfil_acesso, nivel_organizacional, ativo, is_primeiro_acesso)
SELECT 
    TRIM(t.matricula),
    COALESCE(t.senha, '$2b$10$UE2lBW/xzn9KyUU2Bsp1m.bFS53RiWeGboDRHvNbioYfMzC4KzcOG'),
    t.nome_completo,
    t.primeiro_nome,
    t.sobrenome,
    t.email,
    CASE 
        WHEN t.matricula = '72916' THEN 'MODERADOR'::enum_perfil_acesso
        WHEN UPPER(COALESCE(t.role, '')) = 'MODERADOR' THEN 'MODERADOR'::enum_perfil_acesso
        WHEN UPPER(COALESCE(t.role, '')) = 'ADMINISTRADOR' THEN 'ADMINISTRADOR'::enum_perfil_acesso
        ELSE 'PADRAO'::enum_perfil_acesso
    END,
    CASE 
        WHEN t.matricula = '72916' THEN 'TI'::enum_nivel_organizacional
        ELSE 'TECNICO'::enum_nivel_organizacional
    END,
    COALESCE(t.ativo, TRUE),
    COALESCE(t.is_primeiro_acesso, TRUE)
FROM tb_tecnico t
WHERE t.matricula IS NOT NULL AND TRIM(t.matricula) <> ''
ON CONFLICT (matricula) DO UPDATE SET
    perfil_acesso = CASE WHEN tb_usuario.matricula = '72916' THEN 'MODERADOR'::enum_perfil_acesso ELSE tb_usuario.perfil_acesso END,
    nivel_organizacional = CASE WHEN tb_usuario.matricula = '72916' THEN 'TI'::enum_nivel_organizacional ELSE tb_usuario.nivel_organizacional END;

-- 4.3 Atualizar os vínculos de FK (id_usuario) em tb_tecnico e tb_supervisor
UPDATE tb_tecnico t
SET id_usuario = u.id_usuario
FROM tb_usuario u
WHERE TRIM(t.matricula) = u.matricula AND (t.id_usuario IS NULL OR t.id_usuario <> u.id_usuario);

UPDATE tb_supervisor s
SET id_usuario = u.id_usuario
FROM tb_usuario u
WHERE s.matricula IS NOT NULL AND TRIM(s.matricula) = u.matricula AND (s.id_usuario IS NULL OR s.id_usuario <> u.id_usuario);

-- 4.4 Garantia estrita de proteção da conta do Márcio (72916)
UPDATE tb_usuario
SET perfil_acesso = 'MODERADOR',
    nivel_organizacional = 'TI',
    ativo = TRUE,
    is_primeiro_acesso = FALSE
WHERE matricula = '72916';

-- 5. Exclusão definitiva de tabelas e views legadas/obsoletas
DROP TABLE IF EXISTS tb_nps CASCADE;
DROP VIEW IF EXISTS tb_reincidencia_encerrados CASCADE;
DROP VIEW IF EXISTS reincidencia_encerrados CASCADE;

-- 6. Limpeza de colunas de NPS em tb_apuracao_mensal
ALTER TABLE tb_apuracao_mensal DROP COLUMN IF EXISTS pontos_nps;
ALTER TABLE tb_apuracao_mensal DROP COLUMN IF EXISTS atingimento_nps;

-- 7. Adicionar colunas de auditoria de ingestão híbrida em tb_apuracao_mensal
ALTER TABLE tb_apuracao_mensal ADD COLUMN IF NOT EXISTS fonte_rrc_denominador VARCHAR(50) DEFAULT 'DATABRICKS_CHAMADOS';
ALTER TABLE tb_apuracao_mensal ADD COLUMN IF NOT EXISTS fonte_reincidencia VARCHAR(50) DEFAULT 'DATABRICKS_REINCIDENTES';
ALTER TABLE tb_apuracao_mensal ADD COLUMN IF NOT EXISTS fonte_pecas VARCHAR(50) DEFAULT 'DATABRICKS_PECAS';
ALTER TABLE tb_apuracao_mensal ADD COLUMN IF NOT EXISTS data_sincronizacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
