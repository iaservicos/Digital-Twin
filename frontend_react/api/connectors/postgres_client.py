"""
Cliente de persistência PostgreSQL resiliente para execução no Vercel Serverless e local.
Compatível com psycopg e psycopg2 com pooler Supabase.
"""

import os
import logging
from contextlib import contextmanager

try:
    from core import config
    POSTGRES_HOST = config.POSTGRES_HOST
    POSTGRES_PORT = config.POSTGRES_PORT
    POSTGRES_DB = config.POSTGRES_DB
    POSTGRES_USER = config.POSTGRES_USER
    POSTGRES_PASSWORD = config.POSTGRES_PASSWORD
    POSTGRES_SCHEMA = config.POSTGRES_SCHEMA
except ImportError:
    try:
        from api.core import config
        POSTGRES_HOST = config.POSTGRES_HOST
        POSTGRES_PORT = config.POSTGRES_PORT
        POSTGRES_DB = config.POSTGRES_DB
        POSTGRES_USER = config.POSTGRES_USER
        POSTGRES_PASSWORD = config.POSTGRES_PASSWORD
        POSTGRES_SCHEMA = config.POSTGRES_SCHEMA
    except ImportError:
        try:
            from backend_python.core import config
            POSTGRES_HOST = config.POSTGRES_HOST
            POSTGRES_PORT = config.POSTGRES_PORT
            POSTGRES_DB = config.POSTGRES_DB
            POSTGRES_USER = config.POSTGRES_USER
            POSTGRES_PASSWORD = config.POSTGRES_PASSWORD
            POSTGRES_SCHEMA = config.POSTGRES_SCHEMA
        except ImportError:
            POSTGRES_HOST = os.getenv("POSTGRES_HOST", "").strip()
            POSTGRES_PORT = int(str(os.getenv("POSTGRES_PORT", "6543")).strip())
            POSTGRES_DB = os.getenv("POSTGRES_DB", "postgres").strip()
            POSTGRES_USER = os.getenv("POSTGRES_USER", "").strip()
            POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "").strip()
            POSTGRES_SCHEMA = os.getenv("POSTGRES_SCHEMA", "public").strip()

logger = logging.getLogger(__name__)


class PostgreSQLClient:
    def __init__(self) -> None:
        self.host = (POSTGRES_HOST or os.getenv("POSTGRES_HOST", "")).strip()
        self.port = int(str(POSTGRES_PORT or os.getenv("POSTGRES_PORT", "6543")).strip())
        self.dbname = (POSTGRES_DB or os.getenv("POSTGRES_DB", "postgres")).strip()
        self.user = (POSTGRES_USER or os.getenv("POSTGRES_USER", "")).strip()
        self.password = (POSTGRES_PASSWORD or os.getenv("POSTGRES_PASSWORD", "")).strip()
        self.schema = (POSTGRES_SCHEMA or os.getenv("POSTGRES_SCHEMA", "public")).strip()

    def _get_connection(self):
        """
        Abre conexão com fallback automático bidirecional (porta 6543 Transaction Pooler <-> 5432).
        Tenta psycopg e psycopg2 com timeout de 15s.
        """
        if not self.host or not self.user:
            raise RuntimeError("Configurações do banco de dados (POSTGRES_HOST, POSTGRES_USER) não configuradas nas variáveis de ambiente.")
        alt_port = 5432 if self.port == 6543 else 6543
        ports_to_try = [self.port, alt_port]

        last_error = None
        for p in ports_to_try:
            try:
                import psycopg
                conn_info = (
                    f"host={self.host} port={p} dbname={self.dbname} "
                    f"user={self.user} password={self.password} sslmode=require "
                    f"connect_timeout=15"
                )
                conn = psycopg.connect(conn_info, autocommit=True)
                with conn.cursor() as cur:
                    cur.execute("SET default_transaction_read_only = off;")
                logger.info(f"Conexão psycopg estabelecida com sucesso na porta {p}.")
                return conn
            except Exception as e_psy3:
                try:
                    import psycopg2
                    conn = psycopg2.connect(
                        host=self.host, port=p, dbname=self.dbname,
                        user=self.user, password=self.password, sslmode="require",
                        connect_timeout=15
                    )
                    logger.info(f"Conexão psycopg2 estabelecida com sucesso na porta {p}.")
                    return conn
                except Exception as e_psy2:
                    last_error = e_psy2
                    logger.warning(f"Falha ao conectar no host {self.host}:{p} ({e_psy2}). Tentando próxima porta...")

        logger.error(f"Falha em todas as portas {ports_to_try} para o host {self.host}: {last_error}")
        raise last_error

    def execute_query(self, query: str) -> None:
        """Executa query DML com commit automático."""
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(query)
            if hasattr(conn, 'commit') and not getattr(conn, 'autocommit', False):
                conn.commit()
        finally:
            conn.close()

    def write_tuples_batch(self, columns: list, rows: list, table_name: str, conflict_column: str = None) -> int:
        """
        Persiste um lote de tuplas diretamente na tabela de destino com staging upsert nativo,
        sem depender de Polars, PyArrow ou Pandas.
        """
        if not rows or len(rows) == 0:
            return 0

        target_table = f"{self.schema}.{table_name}"
        rows_count = len(rows)
        staging_table = f"{self.schema}._staging_{table_name}"

        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                # 1. Garante que staging seja limpa e vazia
                cur.execute(f"CREATE TABLE IF NOT EXISTS {staging_table} (LIKE {target_table} INCLUDING DEFAULTS);")
                cur.execute(f"TRUNCATE TABLE {staging_table};")

                # 2. Inserção em lotes
                cols_str = ", ".join(columns)
                placeholders = ", ".join(["%s"] * len(columns))
                insert_sql = f"INSERT INTO {staging_table} ({cols_str}) VALUES ({placeholders})"

                cur.executemany(insert_sql, rows)

                # 3. Merge/Upsert
                if conflict_column and conflict_column in columns:
                    update_cols = [c for c in columns if c != conflict_column]
                    update_stmt = ", ".join([f"{col} = EXCLUDED.{col}" for col in update_cols])
                    cur.execute(f"""
                        INSERT INTO {target_table} ({cols_str})
                        SELECT {cols_str} FROM {staging_table}
                        ON CONFLICT ({conflict_column}) DO UPDATE SET {update_stmt};
                    """)
                else:
                    cur.execute(f"""
                        INSERT INTO {target_table} ({cols_str})
                        SELECT {cols_str} FROM {staging_table};
                    """)

                cur.execute(f"DROP TABLE IF EXISTS {staging_table};")

            if hasattr(conn, 'commit') and not getattr(conn, 'autocommit', False):
                conn.commit()
            return rows_count
        finally:
            conn.close()

    def write_polars_df(self, df, table_name: str, conflict_column: str = None) -> int:
        """Persiste um DataFrame na tabela de destino (mantido para retrocompatibilidade)."""
        if df is None or len(df) == 0:
            return 0
        columns = list(df.columns)
        try:
            records = df.to_dicts()
            tuples = [tuple(r.get(c) for c in columns) for r in records]
        except Exception:
            tuples = [tuple(row) for row in df.iter_rows()]
        return self.write_tuples_batch(columns=columns, rows=tuples, table_name=table_name, conflict_column=conflict_column)

