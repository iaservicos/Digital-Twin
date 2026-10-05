-- =========================================================================
-- FLYWAY V80: AJUSTES ESTRUTURAIS EM TB_TECNICO
-- Adiciona colunas para Base ATP, Empréstimo de Técnico e Constraint de Status
-- =========================================================================

-- 1. Adicionando colunas de Base ATP e Empréstimo
ALTER TABLE tb_tecnico ADD COLUMN IF NOT EXISTS codigo_base_atp VARCHAR(50);
ALTER TABLE tb_tecnico ADD COLUMN IF NOT EXISTS id_supervisor_emprestimo INTEGER REFERENCES tb_supervisor(id_supervisor);
ALTER TABLE tb_tecnico ADD COLUMN IF NOT EXISTS codigo_base_atp_emprestimo VARCHAR(50);

-- 2. Normalizando os status para TitleCase
UPDATE tb_tecnico
SET status_colaborador = 'Ativo'
WHERE UPPER(status_colaborador) = 'ATIVO';

UPDATE tb_tecnico
SET status_colaborador = 'Inativo'
WHERE UPPER(status_colaborador) = 'INATIVO' OR status_colaborador IS NULL;

UPDATE tb_tecnico
SET status_colaborador = 'Férias'
WHERE UPPER(status_colaborador) IN ('FÉRIAS', 'FERIAS');

UPDATE tb_tecnico
SET status_colaborador = 'Afastado'
WHERE UPPER(status_colaborador) = 'AFASTADO';

UPDATE tb_tecnico
SET status_colaborador = 'Emprestado'
WHERE UPPER(status_colaborador) = 'EMPRESTADO';

-- 3. Atualizando a constraint oficial de status do colaborador
ALTER TABLE tb_tecnico DROP CONSTRAINT IF EXISTS chk_tb_tecnico_status_colaborador;
ALTER TABLE tb_tecnico ADD CONSTRAINT chk_tb_tecnico_status_colaborador 
    CHECK (status_colaborador IN ('Ativo', 'Inativo', 'Férias', 'Afastado', 'Emprestado'));
