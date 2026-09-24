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

# Connection pool singleton
_pool = None

def get_connection_pool():
    global _pool
    if _pool is None or _pool.closed:
        try:
            _pool = pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=10,
                host=config.POSTGRES_HOST,
                port=config.POSTGRES_PORT,
                dbname=config.POSTGRES_DB,
                user=config.POSTGRES_USER,
                password=config.POSTGRES_PASSWORD,
                sslmode="require",
                connect_timeout=10
            )
            logger.info("Pool de conexões PostgreSQL/Supabase inicializado com sucesso.")
        except Exception as e:
            logger.error(f"Erro ao inicializar o pool de conexões: {e}")
            raise
    return _pool

@contextmanager
def get_db_connection():
    """Obtém uma conexão do pool e devolve ao finalizar."""
    p = get_connection_pool()
    conn = p.getconn()
    try:
        yield conn
    finally:
        p.putconn(conn)

@contextmanager
def get_db_cursor(commit: bool = False):
    """Context manager para executar queries retornando resultados como dicionário (RealDictCursor)."""
    with get_db_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            yield cursor
            if commit:
                conn.commit()
        except Exception as e:
            if commit:
                conn.rollback()
            raise e
        finally:
            cursor.close()
