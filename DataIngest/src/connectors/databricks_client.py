"""
Cliente de conexão e consulta para Databricks SQL Warehouse / Cluster.
Utiliza a biblioteca oficial databricks-sql-connector com leitura otimizada por streaming via PyArrow.
"""

import logging
from typing import Generator, Any
import pyarrow as pa
from databricks import sql
from src.config import settings

logger = logging.getLogger(__name__)


class DatabricksClient:
    def __init__(self) -> None:
        self.server_hostname = settings.DATABRICKS_SERVER_HOSTNAME
        self.http_path = settings.DATABRICKS_HTTP_PATH
        self.access_token = settings.DATABRICKS_ACCESS_TOKEN
        self.catalog = settings.DATABRICKS_CATALOG
        self.schema = settings.DATABRICKS_SCHEMA

    def _get_connection(self) -> Any:
        """Cria e retorna uma nova conexão com o Databricks SQL Warehouse."""
        logger.info("Estabelecendo conexão com Databricks SQL Warehouse...")
        return sql.connect(
            server_hostname=self.server_hostname,
            http_path=self.http_path,
            access_token=self.access_token,
            catalog=self.catalog,
            schema=self.schema
        )

    def fetch_arrow_batches(
        self, query: str, batch_size: int = settings.BATCH_SIZE
    ) -> Generator[pa.RecordBatch, None, None]:
        """
        Executa uma consulta SQL no Databricks e retorna um gerador de PyArrow RecordBatches.
        Garante baixo consumo de memória ao ler dados em lotes (streaming).
        """
        logger.info(f"Executando query no Databricks (Lote: {batch_size} registros)...")
        with self._get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                
                # Fetch PyArrow RecordBatches
                while True:
                    batch = cursor.fetchmany_arrow(batch_size)
                    if not batch or len(batch) == 0:
                        break
                    logger.debug(f"Lote extraído com {len(batch)} registros do Databricks.")
                    yield batch
