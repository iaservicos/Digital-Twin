-- =============================================================================
-- V3__Initial_Admin_Data.sql
-- Carga Inicial Segura e Sanitizada: Administradores, Moderadores e Campanha
-- NOTA DE SEGURANÇA: Nenhum e-mail corporativo real ou PII é exposto no SQL.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. USUÁRIOS ADMINISTRADORES E MODERADORES DO SISTEMA (tb_usuario)
-- -----------------------------------------------------------------------------
INSERT INTO tb_usuario (nome, email, senha, role)
VALUES 
    ('Administrador Sistema', 'admin@system.local', '$2b$10$Jm6McUR9E9LmFtXoG74yVeHqtGCWMaePEnGxt7tmcJwPmOLUuVOP2', 'MODERADOR'),
    ('IA Services', 'iaservices@system.local', '$2b$10$Jm6McUR9E9LmFtXoG74yVeHqtGCWMaePEnGxt7tmcJwPmOLUuVOP2', 'MODERADOR')
ON CONFLICT (email) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. TÉCNICOS E MODERADORES (tb_tecnico) - PERFIS GENÉRICOS E SEGUROS
-- -----------------------------------------------------------------------------
INSERT INTO tb_tecnico (nome_completo, primeiro_nome, sobrenome, matricula, email, senha, role, ativo, is_primeiro_acesso)
VALUES (
    'Moderador Principal',
    'Moderador',
    'Principal',
    '72916',
    'moderador.72916@system.local',
    '$2b$10$Jm6McUR9E9LmFtXoG74yVeHqtGCWMaePEnGxt7tmcJwPmOLUuVOP2',
    'MODERADOR',
    true,
    true
)
ON CONFLICT (matricula) DO UPDATE SET 
role = 'MODERADOR';

INSERT INTO tb_tecnico (nome_completo, primeiro_nome, sobrenome, matricula, email, senha, role, ativo, is_primeiro_acesso)
VALUES (
    'IA Services',
    'IA',
    'Services',
    'iaservices',
    'iaservices@system.local',
    '$2b$10$Jm6McUR9E9LmFtXoG74yVeHqtGCWMaePEnGxt7tmcJwPmOLUuVOP2',
    'MODERADOR',
    true,
    true
)
ON CONFLICT (matricula) DO UPDATE SET 
role = 'MODERADOR';

-- -----------------------------------------------------------------------------
-- 3. ESTRUTURA DE SUPERVISORES (ESTRUTURA SEBURA DE IDS E ROLES)
-- -----------------------------------------------------------------------------
INSERT INTO tb_supervisor (id_supervisor, nome_completo, email, senha, role, ativo, is_primeiro_acesso) VALUES
(1, 'Supervisor Regional 01', 'supervisor01@system.local', '$2b$10$Jm6McUR9E9LmFtXoG74yVeHqtGCWMaePEnGxt7tmcJwPmOLUuVOP2', 'ADMINISTRADOR', true, true),
(2, 'Supervisor Regional 02', 'supervisor02@system.local', '$2b$10$Jm6McUR9E9LmFtXoG74yVeHqtGCWMaePEnGxt7tmcJwPmOLUuVOP2', 'ADMINISTRADOR', true, true),
(3, 'Supervisor Regional 03', 'supervisor03@system.local', '$2b$10$Jm6McUR9E9LmFtXoG74yVeHqtGCWMaePEnGxt7tmcJwPmOLUuVOP2', 'ADMINISTRADOR', true, true),
(4, 'Supervisor Regional 04', 'supervisor04@system.local', '$2b$10$Jm6McUR9E9LmFtXoG74yVeHqtGCWMaePEnGxt7tmcJwPmOLUuVOP2', 'ADMINISTRADOR', true, true),
(5, 'Supervisor Regional 05', 'supervisor05@system.local', '$2b$10$Jm6McUR9E9LmFtXoG74yVeHqtGCWMaePEnGxt7tmcJwPmOLUuVOP2', 'ADMINISTRADOR', true, true)
ON CONFLICT (id_supervisor) DO NOTHING;

-- Ajusta a sequência de IDs do supervisor
SELECT setval('tb_supervisor_id_supervisor_seq', COALESCE((SELECT MAX(id_supervisor) FROM tb_supervisor), 1));

-- -----------------------------------------------------------------------------
-- 4. CAMPANHA INICIAL DE INCENTIVO (BIMESTRAL)
-- -----------------------------------------------------------------------------
INSERT INTO tb_campanha (nome, descricao, data_inicio, data_fim, duracao_meses, status)
VALUES (
    'Campanha Brilha+ 2026 - Q3/Q4',
    'Acompanhamento e premiação por desempenho de SLA, Reincidência e Perdas.',
    '2026-07-01',
    '2026-12-31',
    6,
    'ATIVA'
);
