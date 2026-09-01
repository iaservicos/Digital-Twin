"""
Cliente de carregamento e persistência para o banco de dados PostgreSQL.
Utiliza psycopg v3 com suporte a inserção otimizada via COPY FROM STDIN e staging upsert.
"""

import logging
import io
import polars as pl
import psycopg
from src.config import settings

logger = logging.getLogger(__name__)


class PostgreSQLClient:
    def __init__(self) -> None:
        self.conn_info = (
            f"host={settings.POSTGRES_HOST} "
            f"port={settings.POSTGRES_PORT} "
            f"dbname={settings.POSTGRES_DB} "
            f"user={settings.POSTGRES_USER} "
            f"password={settings.POSTGRES_PASSWORD} "
            f"sslmode=require"
        )
        self.schema = settings.POSTGRES_SCHEMA

    def _get_connection(self):
        """Abre uma conexão com o PostgreSQL."""
        conn = psycopg.connect(self.conn_info, autocommit=True)
        with conn.cursor() as cur:
            cur.execute("SET default_transaction_read_only = off;")
        return conn

    def execute_query(self, query: str) -> None:
        """
        Executa uma query DML arbitrária (DELETE, UPDATE, INSERT) no banco de dados
        e efetua o commit automático.
        """
        with self._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query)
                conn.commit()

    def write_polars_df(
        self, 
        df: pl.DataFrame, 
        table_name: str, 
        conflict_column: str = None
    ) -> int:
        """
        Escreve um Polars DataFrame na tabela de destino no PostgreSQL utilizando COPY em staging table
        e inserção com ON CONFLICT. Se a tabela não existir no banco, cria automaticamente.
        """
        if df.is_empty():
            logger.info(f"DataFrame vazio para '{table_name}'. Nenhum registro gravado.")
            return 0

        target_table = f"{self.schema}.{table_name}"
        rows_count = len(df)

        # Tratar tipos de data/datetime para string ISO no Polars para evitar erros no COPY CSV
        formatted_df = df
        for col, dtype in zip(df.columns, df.dtypes):
            if dtype == pl.Datetime:
                formatted_df = formatted_df.with_columns(pl.col(col).dt.to_string("%Y-%m-%d %H:%M:%S").alias(col))
            elif dtype == pl.Date:
                formatted_df = formatted_df.with_columns(pl.col(col).dt.to_string("%Y-%m-%d").alias(col))

        columns_list = [f'"{c}"' for c in formatted_df.columns]
        columns_formatted = ", ".join(columns_list)

        with self._get_connection() as conn:
            with conn.cursor() as cur:
                # 1. Verificar se a tabela de destino existe; se não, criar dinamicamente
                cur.execute("""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables 
                        WHERE table_schema = %s AND table_name = %s
                    );
                """, (self.schema, table_name))
                table_exists = cur.fetchone()[0]

                if not table_exists:
                    logger.info(f"Tabela '{target_table}' não encontrada. Criando dinamicamente...")
                    col_defs = []
                    for col, dtype in zip(df.columns, df.dtypes):
                        pg_type = "TEXT"
                        if dtype in (pl.Int64, pl.UInt64):
                            pg_type = "BIGINT"
                        elif dtype in (pl.Int32, pl.Int16, pl.Int8, pl.UInt32, pl.UInt16, pl.UInt8):
                            pg_type = "INT"
                        elif dtype in (pl.Float64, pl.Float32):
                            pg_type = "DOUBLE PRECISION"
                        elif dtype == pl.Boolean:
                            pg_type = "BOOLEAN"
                        elif dtype == pl.Datetime:
                            pg_type = "TIMESTAMP"
                        elif dtype == pl.Date:
                            pg_type = "DATE"

                        pk_clause = " PRIMARY KEY" if conflict_column and col == conflict_column else ""
                        col_defs.append(f'"{col}" {pg_type}{pk_clause}')

                    create_table_sql = f"CREATE TABLE IF NOT EXISTS {target_table} ({', '.join(col_defs)});"
                    cur.execute(create_table_sql)
                    conn.commit()

                buffer = io.BytesIO()
                formatted_df.write_csv(buffer)
                buffer.seek(0)

                if not conflict_column:
                    # Carregamento direto ultra-rápido via COPY sem necessidade de tabela temporária
                    copy_query = f"COPY {target_table} ({columns_formatted}) FROM STDIN WITH (FORMAT csv, HEADER true, NULL '')"
                    with cur.copy(copy_query) as copy:
                        while data := buffer.read(65536):
                            copy.write(data)
                    conn.commit()
                else:
                    # 2. Criar tabela temporária de staging idêntica à de destino para upsert
                    temp_table = f"temp_staging_{table_name}"
                    cur.execute(f"CREATE TEMP TABLE IF NOT EXISTS {temp_table} (LIKE {target_table} INCLUDING DEFAULTS);")
                    cur.execute(f"TRUNCATE TABLE {temp_table};")

                    copy_query = f"COPY {temp_table} ({columns_formatted}) FROM STDIN WITH (FORMAT csv, HEADER true, NULL '')"
                    with cur.copy(copy_query) as copy:
                        while data := buffer.read(65536):
                            copy.write(data)

                    # Transferência com ON CONFLICT
                    non_conflict_cols = [c for c in formatted_df.columns if c != conflict_column]
                    update_assignments = ", ".join([f'"{c}" = EXCLUDED."{c}"' for c in non_conflict_cols])
                    
                    merge_sql = f"""
                        INSERT INTO {target_table} ({columns_formatted})
                        SELECT {columns_formatted} FROM {temp_table}
                        ON CONFLICT ("{conflict_column}") DO UPDATE SET {update_assignments};
                    """
                    cur.execute(merge_sql)
                    conn.commit()

        logger.info(f"Gravados/Atualizados {rows_count} registros com sucesso na tabela '{target_table}'.")
        return rows_count


# Alias para retrocompatibilidade
PostgresClient = PostgreSQLClient
