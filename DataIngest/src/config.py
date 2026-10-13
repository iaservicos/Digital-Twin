"""
Módulo de configuração centralizado utilizando Pydantic Settings v2.
Carrega e valida variáveis de ambiente do arquivo .env com suporte nativo a Docker e Render.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, AliasChoices


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
    DATABRICKS_SERVER_HOSTNAME: str = Field(
        default="dbc-9b65f5c1-978c.cloud.databricks.com",
        validation_alias=AliasChoices('DATABRICKS_SERVER_HOSTNAME', 'DATABRICKS_HOST'),
        description="Hostname do Databricks workspace"
    )
    DATABRICKS_HTTP_PATH: str = Field(
        default="/sql/1.0/warehouses/d3fd04c34a6e5ff0",
        description="HTTP Path do SQL Warehouse ou Cluster"
    )
    DATABRICKS_ACCESS_TOKEN: str = Field(
        default="",
        validation_alias=AliasChoices('DATABRICKS_ACCESS_TOKEN', 'DATABRICKS_TOKEN', 'DATABRICKS_PAT'),
        description="Personal Access Token (PAT) do Databricks"
    )
    DATABRICKS_CATALOG: str = Field(default="datalake_prod", description="Catálogo de dados padrão")
    DATABRICKS_SCHEMA: str = Field(default="indicadores_servicos", description="Schema do Databricks")

    # PostgreSQL Configs (Mapeamento 1:1 com as variáveis do .env oficial)
    POSTGRES_HOST: str = Field(default="aws-1-us-east-1.pooler.supabase.com", description="Host do PostgreSQL")
    POSTGRES_PORT: int = Field(default=5432, description="Porta do PostgreSQL")
    POSTGRES_DB: str = Field(default="postgres", description="Nome do banco de dados PostgreSQL")
    POSTGRES_USER: str = Field(default="", description="Usuário do PostgreSQL")
    POSTGRES_PASSWORD: str = Field(default="", description="Senha do PostgreSQL")
    POSTGRES_SCHEMA: str = Field(default="public", description="Schema destino no PostgreSQL")

    # Pipeline Configs
    BATCH_SIZE: int = Field(default=50000, description="Tamanho do lote de inserção")
    SCHEDULE_TIME: str = Field(default="06:00", description="Horário de execução agendada HH:MM")
    LOG_LEVEL: str = Field(default="INFO", description="Nível de log (DEBUG, INFO, WARNING, ERROR)")


settings = Settings()
