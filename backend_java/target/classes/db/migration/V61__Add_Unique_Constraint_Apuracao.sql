ALTER TABLE tb_apuracao_mensal ADD CONSTRAINT unique_tecnico_mes UNIQUE (id_tecnico, mes_ano);
