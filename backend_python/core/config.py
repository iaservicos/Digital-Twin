import os
from dotenv import load_dotenv

# Carrega variáveis de ambiente do .env da raiz do projeto ou cwd
for env_candidate in [
    os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env')),
    os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env')),
]:
    if os.path.exists(env_candidate):
        load_dotenv(dotenv_path=env_candidate)
        break
load_dotenv()

POSTGRES_HOST = os.getenv("POSTGRES_HOST", "").strip()
# Usa a porta 6543 (PgBouncer Transaction Pooler recomendado para Serverless) ou 5432
POSTGRES_PORT = int(str(os.getenv("POSTGRES_PORT", "6543")).strip())
POSTGRES_DB = os.getenv("POSTGRES_DB", "postgres").strip()
POSTGRES_USER = os.getenv("POSTGRES_USER", "").strip()
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "").strip()
POSTGRES_SCHEMA = os.getenv("POSTGRES_SCHEMA", "public").strip()

JWT_SECRET = os.getenv("JWT_SECRET", "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970")
JWT_ALGORITHM = "HS384"
JWT_EXPIRATION_SECONDS = 86400  # 24 horas

ADMIN_MATRICULA = os.getenv("ADMIN_MATRICULA", "ADMIN")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
