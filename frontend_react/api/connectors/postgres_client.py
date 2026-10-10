"""
Cliente de persistência PostgreSQL resiliente para execução no Vercel Serverless e local.
Compatível com psycopg e psycopg2 com pooler Supabase.
"""

import os
import re
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
        
        # Sanitização defensiva: valida se o schema é um identificador SQL válido (ex: 'public').
        # Rejeita qualquer token, hash longo ou lixo acidental e força 'public'.
        raw_schema = (POSTGRES_SCHEMA or os.getenv("POSTGRES_SCHEMA", "public")).strip()
        if raw_schema and len(raw_schema) <= 32 and re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", raw_schema):
            self.schema = raw_schema
        else:
            self.schema = "public"

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
        Persiste um lote de tuplas diretamente na tabela de destino com inserção/upsert nativo em lote,
        sem DDL (sem tabelas staging) para total compatibilidade com o pooler PgBouncer do Supabase.
        """
        if not rows or len(rows) == 0:
            return 0

        safe_schema = self.schema
        target_table_escaped = f'"{safe_schema}"."{table_name}"'
        rows_count = len(rows)

        cols_str = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))

        if conflict_column and conflict_column in columns:
            update_cols = [c for c in columns if c != conflict_column]
            update_stmt = ", ".join([f"{col} = EXCLUDED.{col}" for col in update_cols])
            insert_sql = f"""
                INSERT INTO {target_table_escaped} ({cols_str})
                VALUES ({placeholders})
                ON CONFLICT ({conflict_column}) DO UPDATE SET {update_stmt};
            """
        else:
            insert_sql = f"INSERT INTO {target_table_escaped} ({cols_str}) VALUES ({placeholders});"

        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.executemany(insert_sql, rows)

            if hasattr(conn, 'commit') and not getattr(conn, 'autocommit', False):
                conn.commit()
            return rows_count
        finally:
            conn.close()

    def get_sync_status(self) -> dict:
        """Lê o status da sincronização persistido no PostgreSQL (compartilhado entre múltiplos containers Serverless)."""
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT status, progresso, etapa, tabela_atual, total_linhas, tempo_segundos, 
                           estimated_seconds_remaining, erro, detalhes, updated_at
                    FROM public.tb_sync_status
                    WHERE id_sync = 1;
                """)
                row = cur.fetchone()
                if not row:
                    return {
                        "status": "idle",
                        "progress": 0,
                        "step": "Pronto para iniciar",
                        "current_table": None,
                        "tables": {
                            "chamados": {"status": "pending", "rows": 0, "seconds": 0},
                            "reincidentes": {"status": "pending", "rows": 0, "seconds": 0},
                            "pecas": {"status": "pending", "rows": 0, "seconds": 0}
                        },
                        "estimated_seconds_remaining": 0,
                        "elapsed_seconds": 0,
                        "total_rows": 0,
                        "error": None
                    }

                detalhes = row[8] if isinstance(row[8], dict) else {}
                tables_info = detalhes.get("tables", {
                    "chamados": {"status": "pending", "rows": 0, "seconds": 0},
                    "reincidentes": {"status": "pending", "rows": 0, "seconds": 0},
                    "pecas": {"status": "pending", "rows": 0, "seconds": 0}
                })
                periodo_info = detalhes.get("periodo", {"data_inicio": None, "data_fim": None})

                return {
                    "status": row[0],
                    "progress": row[1],
                    "step": row[2],
                    "current_table": row[3],
                    "tables": tables_info,
                    "estimated_seconds_remaining": row[6] or 0,
                    "elapsed_seconds": float(row[5] or 0),
                    "total_rows": row[4] or 0,
                    "error": row[7],
                    "periodo": periodo_info,
                    "updated_at": str(row[9]) if row[9] else None
                }
        except Exception as e:
            logger.warning(f"Erro ao ler status de sync do banco: {e}")
            return None
        finally:
            conn.close()

    def save_sync_status(self, tracker: dict) -> None:
        """Persiste o tracker de sincronização no PostgreSQL para sincronização multi-container."""
        import json
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                detalhes_json = json.dumps({
                    "tables": tracker.get("tables", {}),
                    "periodo": tracker.get("periodo", {})
                })
                cur.execute("""
                    INSERT INTO public.tb_sync_status (
                        id_sync, status, progresso, etapa, tabela_atual, total_linhas,
                        tempo_segundos, estimated_seconds_remaining, erro, detalhes, updated_at
                    ) VALUES (
                        1, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, CURRENT_TIMESTAMP
                    )
                    ON CONFLICT (id_sync) DO UPDATE SET
                        status = EXCLUDED.status,
                        progresso = EXCLUDED.progresso,
                        etapa = EXCLUDED.etapa,
                        tabela_atual = EXCLUDED.tabela_atual,
                        total_linhas = EXCLUDED.total_linhas,
                        tempo_segundos = EXCLUDED.tempo_segundos,
                        estimated_seconds_remaining = EXCLUDED.estimated_seconds_remaining,
                        erro = EXCLUDED.erro,
                        detalhes = EXCLUDED.detalhes,
                        updated_at = CURRENT_TIMESTAMP;
                """, (
                    tracker.get("status", "idle"),
                    tracker.get("progress", 0),
                    tracker.get("step", ""),
                    tracker.get("current_table"),
                    tracker.get("total_rows", 0),
                    tracker.get("elapsed_seconds", 0),
                    tracker.get("estimated_seconds_remaining", 0),
                    tracker.get("error"),
                    detalhes_json
                ))
            if hasattr(conn, 'commit') and not getattr(conn, 'autocommit', False):
                conn.commit()
        except Exception as e:
            logger.warning(f"Erro ao persistir status de sync no banco: {e}")
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

