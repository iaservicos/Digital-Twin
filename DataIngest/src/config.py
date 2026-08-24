"""
Módulo de configuração centralizado utilizando Pydantic Settings v2.
Carrega e valida variáveis de ambiente do arquivo .env.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # API Security Configs
    DATA_INGEST_API_KEY: str = Field(
        default="pos-data-token-2026", 
        description="Chave secreta de autenticação para a API REST DataIngest"
    )

    # Databricks Configs
    DATABRICKS_SERVER_HOSTNAME: str = Field(..., description="Hostname do Databricks workspace")
    DATABRICKS_HTTP_PATH: str = Field(..., description="HTTP Path do SQL Warehouse ou Cluster")
    DATABRICKS_ACCESS_TOKEN: str = Field(..., description="Personal Access Token (PAT) do Databricks")
    DATABRICKS_CATALOG: str = Field(default="hive_metastore", description="Catálogo de dados padrão")
    DATABRICKS_SCHEMA: str = Field(default="default", description="Schema do Databricks")

    # PostgreSQL Configs
    POSTGRES_HOST: str = Field(default="localhost", description="Host do PostgreSQL")
    POSTGRES_PORT: int = Field(default=5432, description="Porta do PostgreSQL")
    POSTGRES_DB: str = Field(..., description="Nome do banco de dados PostgreSQL")
    POSTGRES_USER: str = Field(..., description="Usuário do PostgreSQL")
    POSTGRES_PASSWORD: str = Field(..., description="Senha do PostgreSQL")
    POSTGRES_SCHEMA: str = Field(default="public", description="Schema destino no PostgreSQL")

    # Pipeline Configs
    BATCH_SIZE: int = Field(default=10000, description="Tamanho do lote de inserção")
    SCHEDULE_TIME: str = Field(default="06:00", description="Horário de execução agendada HH:MM")
    LOG_LEVEL: str = Field(default="INFO", description="Nível de log (DEBUG, INFO, WARNING, ERROR)")

    @property
    def postgres_connection_string(self) -> str:
        """Retorna a URL de conexão para o PostgreSQL."""
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()
