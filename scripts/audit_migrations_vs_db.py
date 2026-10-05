"""
Script de auditoria completa: Compara todas as migrações do repositório com o estado real do Supabase
"""
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from backend_python.core.database import get_db_connection

def audit():
    print("=" * 70)
    print("AUDITORIA: MIGRAÇÕES DO REPOSITÓRIO VS ESTADO DO BANCO DE DADOS")
    print("=" * 70)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # 1. Histórico Flyway
            cur.execute("""
                SELECT installed_rank, version, description, script, installed_on, success 
                FROM flyway_schema_history 
                ORDER BY installed_rank DESC 
                LIMIT 15;
            """)
            recent_flyway = cur.fetchall()
            print("\nÚLTIMAS MIGRAÇÕES REGISTRADAS EM flyway_schema_history:")
            for r in recent_flyway:
                print(f"  [Rank {r[0]}] V{r[1]} - {r[2]} ({r[3]}) -> Sucesso: {r[5]} em {r[4]}")

            # 2. Tabelas e Views Chave do Brilha+
            key_tables = [
                'tb_usuario',
                'tb_tecnico',
                'tb_supervisor',
                'tb_coordenador',
                'tb_base_atp',
                'tb_tecnico_base',
                'tb_campanha',
                'tb_apuracao_mensal',
                'chamados_sla',
                'pecas',
                'reincidencia',
                'encerrados_rrc',
                'tb_chamado'
            ]

            print("\nVERIFICAÇÃO DE TABELAS PRINCIPAIS:")
            for t in key_tables:
                cur.execute("""
                    SELECT COUNT(*) 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = %s;
                """, (t,))
                exists = cur.fetchone()[0] > 0
                if exists:
                    cur.execute(f"SELECT COUNT(*) FROM {t};")
                    count = cur.fetchone()[0]
                    cur.execute("""
                        SELECT COUNT(*) 
                        FROM information_schema.columns 
                        WHERE table_schema = 'public' AND table_name = %s;
                    """, (t,))
                    cols = cur.fetchone()[0]
                    print(f"  ✓ {t:22} | {cols:2} colunas | {count:6} registros")
                else:
                    print(f"  ✗ {t:22} | NÃO EXISTE")

            # 3. Colunas Críticas Adicionadas nas Migrações Recentes
            print("\nVERIFICAÇÃO DE COLUNAS ADICIONADAS RECENTEMENTE:")
            checks = [
                ('tb_tecnico', 'codigo_base_atp', 'VARCHAR'),
                ('tb_tecnico', 'id_supervisor_emprestimo', 'INTEGER'),
                ('tb_tecnico', 'codigo_base_atp_emprestimo', 'VARCHAR'),
                ('tb_tecnico', 'centro_custo', 'VARCHAR'),
                ('tb_tecnico', 'status_colaborador', 'VARCHAR'),
                ('tb_tecnico', 'id_usuario', 'INTEGER'),
                ('tb_supervisor', 'id_usuario', 'INTEGER'),
                ('tb_supervisor', 'id_coordenador', 'INTEGER'),
                ('tb_apuracao_mensal', 'fonte_rrc_denominador', 'VARCHAR'),
                ('tb_apuracao_mensal', 'fonte_reincidencia', 'VARCHAR'),
                ('tb_apuracao_mensal', 'fonte_pecas', 'VARCHAR'),
                ('tb_apuracao_mensal', 'data_sincronizacao', 'TIMESTAMP'),
                ('chamados_sla', 'sla_status', 'VARCHAR'),
                ('pecas', 'is_peca_critica', 'BOOLEAN'),
                ('reincidencia', 'is_elegivel_regra_90d', 'BOOLEAN'),
                ('encerrados_rrc', 'chamado', 'VARCHAR')
            ]

            for table, col, expected_type in checks:
                cur.execute("""
                    SELECT data_type 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = %s AND column_name = %s;
                """, (table, col))
                row = cur.fetchone()
                if row:
                    print(f"  ✓ {table}.{col:30} presente ({row[0]})")
                else:
                    print(f"  ✗ {table}.{col:30} AUSENTE!")

            # 4. Constraints de Status do Colaborador
            cur.execute("""
                SELECT conname, pg_get_constraintdef(c.oid)
                FROM pg_constraint c
                JOIN pg_class cl ON cl.oid = c.conrelid
                WHERE cl.relname = 'tb_tecnico' AND c.conname = 'chk_tb_tecnico_status_colaborador';
            """)
            con = cur.fetchone()
            print("\nCONSTRAINT DE STATUS EM tb_tecnico:")
            print(f"  {con[0] if con else 'N/A'}: {con[1] if con else 'NÃO ENCONTRADA'}")

if __name__ == '__main__':
    audit()
