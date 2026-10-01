import sys
import os
import time

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from backend_python.core.database import get_db_connection

def apply_migration():
    sql_file = os.path.join(os.path.dirname(__file__), "..", "database", "migrations", "V78__Evolucao_Schema_Brilha_Mais.sql")
    with open(sql_file, "r", encoding="utf-8") as f:
        sql_content = f.read()

    print("Iniciando aplicação da migração V78 (Transacional)...")
    start_time = time.time()
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # 1. Executar o DDL
            cur.execute(sql_content)
            
            elapsed_ms = int((time.time() - start_time) * 1000)
            
            # 2. Obter o próximo installed_rank em flyway_schema_history
            cur.execute("SELECT COALESCE(MAX(installed_rank), 0) + 1 FROM flyway_schema_history;")
            row_rank = cur.fetchone()
            next_rank = row_rank[0] if row_rank else 78
            
            # 3. Registrar na tabela flyway_schema_history
            cur.execute("""
                INSERT INTO flyway_schema_history (
                    installed_rank, version, description, type, script, 
                    installed_by, installed_on, execution_time, success
                ) VALUES (
                    %s, '78', 'Evolucao Schema Brilha Mais', 'SQL', 'V78__Evolucao_Schema_Brilha_Mais.sql',
                    'postgres.eychznasujcjfdupizfm', CURRENT_TIMESTAMP, %s, TRUE
                )
            """, (next_rank, elapsed_ms))
            
            conn.commit()
            print(f"Migração V78 aplicada com SUCESSO em {elapsed_ms}ms! Registrada em flyway_schema_history com rank {next_rank}.")
            
            # 4. Verificação de integridade pós-migração
            print("\n--- VERIFICAÇÃO PÓS-MIGRAÇÃO ---")
            cur.execute("SELECT COUNT(*) FROM tb_usuario;")
            print("Total de usuários cadastrados em tb_usuario:", cur.fetchone()[0])
            
            cur.execute("SELECT id_usuario, matricula, nome_completo, perfil_acesso, nivel_organizacional, ativo FROM tb_usuario WHERE matricula = '72916';")
            marcio = cur.fetchone()
            print("Conta do Márcio em tb_usuario:", marcio)
            
            cur.execute("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tb_nps');")
            print("Tabela tb_nps ainda existe?", cur.fetchone()[0])
            
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'tb_apuracao_mensal' AND column_name LIKE '%fonte%';")
            print("Colunas de auditoria adicionadas em tb_apuracao_mensal:", [r[0] for r in cur.fetchall()])

if __name__ == "__main__":
    apply_migration()
