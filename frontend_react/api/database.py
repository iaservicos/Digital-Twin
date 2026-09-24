import logging
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
try:
    from core import config
except ImportError:
    try:
        from api.core import config
    except ImportError:
        import config

logger = logging.getLogger(__name__)

_conn = None

def _create_connection():
    """Cria uma nova conexão com o PostgreSQL/Supabase com fallback de resiliência."""
    host = config.POSTGRES_HOST
    # Se na Vercel o host estiver configurado como localhost ou postgres, usa o Supabase
    if host in ["localhost", "127.0.0.1", "postgres", None, ""]:
        host = "aws-1-us-east-1.pooler.supabase.com"

    port = config.POSTGRES_PORT or 5432
    user = config.POSTGRES_USER
    if user in ["postgres", None, ""]:
        user = "postgres.eychznasujcjfdupizfm"

    password = config.POSTGRES_PASSWORD
    if password in ["sua_senha_postgres_aqui", None, ""]:
        password = "Br@sil#$%2026"

    dbname = config.POSTGRES_DB or "postgres"

    try:
        return psycopg2.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=user,
            password=password,
            sslmode="require",
            connect_timeout=8
        )
    except Exception as err:
        logger.warning(f"Falha ao conectar no host {host}:{port} ({err}). Tentando fallback Supabase porta 6543...")
        return psycopg2.connect(
            host="aws-1-us-east-1.pooler.supabase.com",
            port=6543,
            dbname="postgres",
            user="postgres.eychznasujcjfdupizfm",
            password="Br@sil#$%2026",
            sslmode="require",
            connect_timeout=8
        )

@contextmanager
def get_db_cursor(commit: bool = False):
    """Context manager resiliente para serverless, com auto-reconexão se a conexão cair."""
    global _conn
    if _conn is None or _conn.closed:
        _conn = _create_connection()
    else:
        try:
            with _conn.cursor() as test_cur:
                test_cur.execute("SELECT 1;")
        except Exception:
            try:
                _conn.close()
            except Exception:
                pass
            _conn = _create_connection()

    cursor = _conn.cursor(cursor_factory=RealDictCursor)
    try:
        yield cursor
        if commit:
            _conn.commit()
    except Exception as e:
        if commit and not _conn.closed:
            _conn.rollback()
        raise e
    finally:
        cursor.close()
