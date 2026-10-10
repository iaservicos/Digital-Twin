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
    """Cria uma nova conexão com o PostgreSQL/Supabase com fallback de resiliência (6543/5432)."""
    host = (config.POSTGRES_HOST or os.getenv("POSTGRES_HOST", "")).strip()
    port = int(str(config.POSTGRES_PORT or os.getenv("POSTGRES_PORT", "6543")).strip())
    user = (config.POSTGRES_USER or os.getenv("POSTGRES_USER", "")).strip()
    password = (config.POSTGRES_PASSWORD or os.getenv("POSTGRES_PASSWORD", "")).strip()
    dbname = (config.POSTGRES_DB or os.getenv("POSTGRES_DB", "postgres")).strip()

    if not host or not user:
        raise RuntimeError("POSTGRES_HOST e POSTGRES_USER devem ser configurados via variáveis de ambiente.")

    # Porta alternativa para fallback automático
    alt_port = 5432 if port == 6543 else 6543

    try:
        return psycopg2.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=user,
            password=password,
            sslmode="require",
            connect_timeout=15
        )
    except Exception as err:
        logger.warning(f"Falha ao conectar no host {host}:{port} ({err}). Tentando fallback Supabase porta {alt_port}...")
        return psycopg2.connect(
            host=host,
            port=alt_port,
            dbname=dbname,
            user=user,
            password=password,
            sslmode="require",
            connect_timeout=15
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
