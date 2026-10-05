import sys
import os
import time

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from backend_python.core.database import get_db_connection

def apply_v80():
    sql_file = os.path.join(os.path.dirname(__file__), "..", "database", "migrations", "V80__Add_Base_Atp_Emprestimo_Tb_Tecnico.sql")
    with open(sql_file, "r", encoding="utf-8") as f:
        sql_content = f.read()

    print("Iniciando aplicação da migração V80 (Transacional)...")
    start_time = time.time()

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # 1. Executar o DDL e atualizações
            cur.execute(sql_content)
            elapsed_ms = int((time.time() - start_time) * 1000)

            # 2. Obter próximo rank no flyway_schema_history
            cur.execute("SELECT COALESCE(MAX(installed_rank), 0) + 1 FROM flyway_schema_history;")
            row_rank = cur.fetchone()
            next_rank = row_rank[0] if row_rank else 71

            # 3. Registrar na tabela flyway_schema_history se ainda não registrada
            cur.execute("SELECT 1 FROM flyway_schema_history WHERE version = '80';")
            already_registered = cur.fetchone()

            if not already_registered:
                cur.execute("""
                    INSERT INTO flyway_schema_history (
                        installed_rank, version, description, type, script,
                        installed_by, installed_on, execution_time, success
                    ) VALUES (
                        %s, '80', 'Add Base Atp Emprestimo Tb Tecnico', 'SQL', 'V80__Add_Base_Atp_Emprestimo_Tb_Tecnico.sql',
                        'postgres.eychznasujcjfdupizfm', CURRENT_TIMESTAMP, %s, TRUE
                    )
                """, (next_rank, elapsed_ms))
                print(f"Migração V80 registrada em flyway_schema_history com rank {next_rank}.")
            else:
                print("Migração V80 já estava registrada em flyway_schema_history.")

            conn.commit()
            print(f"Migração V80 aplicada com SUCESSO em {elapsed_ms}ms!")

            # 4. Verificação pós-migração
            print("\n--- VERIFICAÇÃO PÓS-MIGRAÇÃO ---")
            cur.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'tb_tecnico' AND column_name IN ('codigo_base_atp', 'id_supervisor_emprestimo', 'codigo_base_atp_emprestimo');
            """)
            print("Colunas presentes em tb_tecnico:", cur.fetchall())

            cur.execute("""
                SELECT conname, pg_get_constraintdef(c.oid)
                FROM pg_constraint c
                JOIN pg_class cl ON cl.oid = c.conrelid
                WHERE cl.relname = 'tb_tecnico' AND c.conname = 'chk_tb_tecnico_status_colaborador';
            """)
            print("Definição da constraint de status:", cur.fetchone())

if __name__ == "__main__":
    apply_v80()
