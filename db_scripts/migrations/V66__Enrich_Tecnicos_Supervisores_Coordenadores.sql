-- Migration: V66__Enrich_Tecnicos_Supervisores_Coordenadores.sql
-- Description: Adiciona novos campos de enriquecimento para Tecnicos, Supervisores e Coordenadores a partir da integracao Supabase.

-- 1. Expansao da tabela de Coordenadores
ALTER TABLE tb_coordenador 
  ADD COLUMN IF NOT EXISTS matricula VARCHAR(50),
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20);

-- 2. Expansao da tabela de Supervisores
ALTER TABLE tb_supervisor 
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20);

-- 3. Expansao da tabela de Tecnicos
ALTER TABLE tb_tecnico 
  ADD COLUMN IF NOT EXISTS id_externo_supabase INTEGER,
  ADD COLUMN IF NOT EXISTS regiao VARCHAR(10),
  ADD COLUMN IF NOT EXISTS orgao_emissor VARCHAR(50),
  ADD COLUMN IF NOT EXISTS endereco_atual TEXT,
  ADD COLUMN IF NOT EXISTS cidade_uf VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tipo_contrato VARCHAR(50) DEFAULT 'proprio',
  ADD COLUMN IF NOT EXISTS nome_databricks VARCHAR(150),
  ADD COLUMN IF NOT EXISTS email_logistica VARCHAR(150),
  ADD COLUMN IF NOT EXISTS dia_inventario VARCHAR(20),
  ADD COLUMN IF NOT EXISTS horario_inventario TIME,
  ADD COLUMN IF NOT EXISTS nome_base_origem VARCHAR(100),
  ADD COLUMN IF NOT EXISTS afastado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 4. Criacao de indices para performance de buscas operacionais
CREATE INDEX IF NOT EXISTS idx_tecnico_cpf ON tb_tecnico(cpf);
CREATE INDEX IF NOT EXISTS idx_tecnico_matricula ON tb_tecnico(matricula);
CREATE INDEX IF NOT EXISTS idx_tecnico_ativo ON tb_tecnico(ativo);
CREATE INDEX IF NOT EXISTS idx_tecnico_nome_databricks ON tb_tecnico(nome_databricks);
