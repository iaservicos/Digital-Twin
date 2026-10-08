-- V81__Populate_Pecas_Subgrupo.sql
-- Classificação e padronização da coluna subgrupo na tabela pecas

ALTER TABLE pecas ADD COLUMN IF NOT EXISTS subgrupo VARCHAR(80);

UPDATE pecas 
SET subgrupo = CASE 
    WHEN UPPER(COALESCE(cod_aplic_desc, grupo_mercadoria_desc, '')) ~* '(PLM|PLACA M|MOTHERBOARD)' THEN 'Placa Mãe'
    WHEN UPPER(COALESCE(cod_aplic_desc, grupo_mercadoria_desc, '')) ~* '(MEMORIA|MEMÓRIA|\bDDR\b|\bRAM\b)' THEN 'Memória'
    WHEN UPPER(COALESCE(cod_aplic_desc, grupo_mercadoria_desc, '')) ~* '\bSSD\b' THEN 'SSD'
    WHEN UPPER(COALESCE(cod_aplic_desc, grupo_mercadoria_desc, '')) ~* '(HARD DISK|\bHD\b|\bHDD\b)' THEN 'HD'
    WHEN UPPER(COALESCE(cod_aplic_desc, grupo_mercadoria_desc, '')) ~* '(LCD|TELA|DISPLAY|PAINEL)' THEN 'Tela / LCD'
    WHEN UPPER(COALESCE(cod_aplic_desc, grupo_mercadoria_desc, '')) ~* 'BATER' THEN 'Bateria'
    WHEN UPPER(COALESCE(cod_aplic_desc, grupo_mercadoria_desc, '')) ~* 'TECL' THEN 'Teclado'
    WHEN UPPER(COALESCE(cod_aplic_desc, grupo_mercadoria_desc, '')) ~* '(TAMPA|TRASEIR|FRONT|DECO|FRAME|CARC)' THEN 'Gabinete / Carcaça'
    WHEN UPPER(COALESCE(cod_aplic_desc, grupo_mercadoria_desc, '')) ~* '(FONTE|CARREG|ADAPTADOR AC)' THEN 'Fonte / Carregador'
    WHEN UPPER(COALESCE(cod_aplic_desc, grupo_mercadoria_desc, '')) ~* 'IMPR' THEN 'Impressora Térmica'
    WHEN UPPER(COALESCE(cod_aplic_desc, grupo_mercadoria_desc, '')) ~* 'PROCESSADOR' THEN 'Processador'
    ELSE COALESCE(grupo_mercadoria_desc, 'Outros')
END
WHERE subgrupo IS NULL OR subgrupo = '';

CREATE INDEX IF NOT EXISTS idx_pecas_chamado ON pecas (chamado);
CREATE INDEX IF NOT EXISTS idx_pecas_subgrupo ON pecas (subgrupo);
