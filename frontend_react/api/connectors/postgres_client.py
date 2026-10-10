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
            POSTGRES_HOST = os.getenv("POSTGRES_HOST", "aws-1-us-east-1.pooler.supabase.com")
            POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
            POSTGRES_DB = os.getenv("POSTGRES_DB", "postgres")
            POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")
            POSTGRES_SCHEMA = os.getenv("POSTGRES_SCHEMA", "public")

logger = logging.getLogger(__name__)


class PostgreSQLClient:
    def __init__(self) -> None:
        self.host = POSTGRES_HOST or "aws-1-us-east-1.pooler.supabase.com"
        self.port = POSTGRES_PORT or 5432
        self.dbname = POSTGRES_DB or "postgres"
        self.user = POSTGRES_USER or "postgres"
        self.password = POSTGRES_PASSWORD or ""
        self.schema = POSTGRES_SCHEMA or "public"

    def _get_connection(self):
        """Abre conexão com fallback de porta 5432/6543."""
        try:
            import psycopg
            conn_info = (
                f"host={self.host} port={self.port} dbname={self.dbname} "
                f"user={self.user} password={self.password} sslmode=require"
            )
            conn = psycopg.connect(conn_info, autocommit=True)
            with conn.cursor() as cur:
                cur.execute("SET default_transaction_read_only = off;")
            return conn
        except Exception:
            import psycopg2
            return psycopg2.connect(
                host=self.host, port=self.port, dbname=self.dbname,
                user=self.user, password=self.password, sslmode="require",
                connect_timeout=8
            )

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

    def write_polars_df(self, df, table_name: str, conflict_column: str = None) -> int:
        """Persiste um DataFrame na tabela de destino com staging upsert."""
        if df is None or len(df) == 0:
            return 0

        target_table = f"{self.schema}.{table_name}"
        rows_count = len(df)
        staging_table = f"{self.schema}._staging_{table_name}"

        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                # 1. Garante que staging seja limpa e vazia
                cur.execute(f"CREATE TABLE IF NOT EXISTS {staging_table} (LIKE {target_table} INCLUDING DEFAULTS);")
                cur.execute(f"TRUNCATE TABLE {staging_table};")

                # 2. Inserção em lotes
                columns = list(df.columns)
                cols_str = ", ".join(columns)
                placeholders = ", ".join(["%s"] * len(columns))

                insert_sql = f"INSERT INTO {staging_table} ({cols_str}) VALUES ({placeholders})"
                
                # Converte rows para tuplas
                try:
                    records = df.to_dicts()
                    tuples = [tuple(r.get(c) for c in columns) for r in records]
                except Exception:
                    tuples = [tuple(row) for row in df.iter_rows()]

                cur.executemany(insert_sql, tuples)

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
