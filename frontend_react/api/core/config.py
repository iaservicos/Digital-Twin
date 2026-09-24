import os
from dotenv import load_dotenv

# Carrega variáveis de ambiente do .env da raiz se existir
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'))

POSTGRES_HOST = os.getenv("POSTGRES_HOST", "aws-1-us-east-1.pooler.supabase.com")
# Usa a porta 6543 (PgBouncer Transaction Pooler) ou 5432
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_DB = os.getenv("POSTGRES_DB", "postgres")
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres.eychznasujcjfdupizfm")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "Br@sil#$%2026")
POSTGRES_SCHEMA = os.getenv("POSTGRES_SCHEMA", "public")

JWT_SECRET = os.getenv("JWT_SECRET", "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970")
JWT_ALGORITHM = "HS384"
JWT_EXPIRATION_SECONDS = 86400  # 24 horas

ADMIN_MATRICULA = os.getenv("ADMIN_MATRICULA", "ADMIN")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@Positivo2026")
