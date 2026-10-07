import sys, os
sys.path.insert(0, os.path.abspath('.'))

from backend_python.core.database import get_db_cursor

with get_db_cursor() as cur:
    cur.execute("""
        SELECT 
            table_name,
            pg_size_pretty(pg_total_relation_size('"' || table_schema || '"."' || table_name || '"')) AS tamanho_total,
            pg_total_relation_size('"' || table_schema || '"."' || table_name || '"') as bytes
        FROM information_schema.tables
        WHERE table_schema = 'public' 
          AND table_name IN ('chamados', 'tb_chamado', 'pecas', 'reincidentes', 'tb_encerrados_rrc', 'tb_apuracao_mensal')
        ORDER BY bytes DESC;
    """)
    rows = cur.fetchall()
    total_bytes = sum(r['bytes'] for r in rows)
    print("=== TAMANHO DAS TABELAS NO BANCO POSTGRESQL ===")
    for r in rows:
        print(f"- {r['table_name']}: {r['tamanho_total']}")
    print(f"\nEspaço total dessas tabelas: {total_bytes / (1024*1024):.2f} MB")
