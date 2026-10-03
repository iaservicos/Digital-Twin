import sys
import os
import time

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from backend_python.core.database import get_db_connection

def apply_v79():
    sql_file = os.path.join(os.path.dirname(__file__), "..", "database", "migrations", "V79__Create_Quatro_Tabelas_Regras_Calculo.sql")
    with open(sql_file, "r", encoding="utf-8") as f:
        sql_content = f.read()

    print("Iniciando aplicação da migração V79 (Transacional)...")
    start_time = time.time()

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # 1. Executar o DDL
            cur.execute(sql_content)
            elapsed_ms = int((time.time() - start_time) * 1000)

            # 2. Obter próximo rank no flyway_schema_history
            cur.execute("SELECT COALESCE(MAX(installed_rank), 0) + 1 FROM flyway_schema_history;")
            row_rank = cur.fetchone()
            next_rank = row_rank[0] if row_rank else 79

            # 3. Registrar na tabela flyway_schema_history
            cur.execute("""
                INSERT INTO flyway_schema_history (
                    installed_rank, version, description, type, script,
                    installed_by, installed_on, execution_time, success
                ) VALUES (
                    %s, '79', 'Create Quatro Tabelas Regras Calculo', 'SQL', 'V79__Create_Quatro_Tabelas_Regras_Calculo.sql',
                    'postgres.eychznasujcjfdupizfm', CURRENT_TIMESTAMP, %s, TRUE
                )
            """, (next_rank, elapsed_ms))

            conn.commit()
            print(f"Migração V79 aplicada com SUCESSO em {elapsed_ms}ms! Registrada em flyway_schema_history com rank {next_rank}.")

            # 4. Verificação de Integridade
            print("\n--- VERIFICAÇÃO PÓS-MIGRAÇÃO ---")
            for t in ['chamados_sla', 'pecas', 'reincidencia', 'encerrados_rrc']:
                cur.execute(f"SELECT COUNT(*) FROM information_schema.columns WHERE table_name = '{t}';")
                count_cols = cur.fetchone()[0]
                print(f" - Tabela '{t}': {count_cols} colunas")

            # Checagem de frotas
            cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'tb_frota_%';")
            print(f" - Tabelas de frotas ativas: {cur.fetchone()[0]} (intactas)")

            # Checagem de moderador Márcio
            cur.execute("SELECT id_usuario, matricula, nome_completo, perfil_acesso FROM tb_usuario WHERE matricula = '72916';")
            print(" - Conta Márcio (72916):", cur.fetchone())

if __name__ == "__main__":
    apply_v79()
