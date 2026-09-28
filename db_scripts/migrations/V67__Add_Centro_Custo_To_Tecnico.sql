-- Migration: V67__Add_Centro_Custo_To_Tecnico.sql
-- Description: Adiciona o campo centro_custo na tabela tb_tecnico a partir da planilha corporativa Tecnicos.xlsx

ALTER TABLE tb_tecnico 
  ADD COLUMN IF NOT EXISTS centro_custo VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_tecnico_centro_custo ON tb_tecnico(centro_custo);
