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
    cursor.execute("SELECT chamado, data_ft FROM tb_chamado WHERE id_tecnico = 184 ORDER BY data_ft DESC LIMIT 5;")
    print("CHAMADOS JAIRO:", cursor.fetchall())
    
    cursor.execute("SELECT id_campanha, data_inicio, data_fim, ativa FROM tb_campanha ORDER BY id_campanha DESC LIMIT 1;")
    print("CAMPANHA ATIVA:", cursor.fetchall())
except Exception as e:
    print(f"Error: {e}")
