"""
Cliente de conexão e consulta para Databricks SQL Warehouse para execução no Vercel e local.
"""

import os
import logging
from typing import Generator, Any

logger = logging.getLogger(__name__)


class DatabricksClient:
    def __init__(self) -> None:
        self.server_hostname = os.getenv("DATABRICKS_SERVER_HOSTNAME", "dbc-9b65f5c1-978c.cloud.databricks.com")
        self.http_path = os.getenv("DATABRICKS_HTTP_PATH", "/sql/1.0/warehouses/d3fd04c34a6e5ff0")
        self.access_token = os.getenv("DATABRICKS_ACCESS_TOKEN", "")
        self.catalog = os.getenv("DATABRICKS_CATALOG", "datalake_prod")
        self.schema = os.getenv("DATABRICKS_SCHEMA", "indicadores_servicos")
        self.batch_size = int(os.getenv("BATCH_SIZE", "10000"))

    def _get_connection(self) -> Any:
        """Cria e retorna uma nova conexão com o Databricks SQL Warehouse."""
        if not self.access_token:
            raise RuntimeError("DATABRICKS_ACCESS_TOKEN não configurado no ambiente.")
        try:
            from databricks import sql
            logger.info("Estabelecendo conexão com Databricks SQL Warehouse...")
            return sql.connect(
                server_hostname=self.server_hostname,
                http_path=self.http_path,
                access_token=self.access_token,
                catalog=self.catalog,
                schema=self.schema
            )
        except ImportError:
            raise RuntimeError("Biblioteca 'databricks-sql-connector' não instalada no ambiente.")

    def fetch_arrow_batches(self, query: str, batch_size: int = None):
        """Executa consulta SQL no Databricks e retorna gerador de RecordBatches."""
        size = batch_size or self.batch_size
        logger.info(f"Executando query no Databricks (Lote: {size} registros)...")
        with self._get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                while True:
                    batch = cursor.fetchmany_arrow(size)
                    if not batch or len(batch) == 0:
                        break
                    yield batch
