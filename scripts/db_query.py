import psycopg2
from urllib.parse import urlparse, unquote

url = "postgresql://postgres.eychznasujcjfdupizfm:Br%40sil%23%24%252026@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
parsed = urlparse(url)

try:
    conn = psycopg2.connect(
        dbname=parsed.path[1:],
        user=unquote(parsed.username),
        password=unquote(parsed.password),
        host=parsed.hostname,
        port=parsed.port,
        sslmode='require'
    )
    cursor = conn.cursor()
    cursor.execute("SELECT id_tecnico, matricula, nome_completo, ativo, ct_base FROM tb_tecnico WHERE nome_completo ILIKE '%jairo eduardo%';")
    print("TB_TECNICO:", cursor.fetchall())
    
    cursor.execute("SELECT t.id_tecnico, a.id_apuracao, a.mes_ano, a.pontuacao_total FROM tb_apuracao_mensal a JOIN tb_tecnico t ON a.id_tecnico = t.id_tecnico WHERE t.nome_completo ILIKE '%jairo eduardo%';")
    print("TB_APURACAO_MENSAL:", cursor.fetchall())
except Exception as e:
    print(f"Error: {e}")
