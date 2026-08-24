"""
Entrypoint principal do projeto.
Permite a execução manual imediata (CLI), a inicialização do agendador automático diário (06:00 AM)
ou a inicialização da API REST HTTP.

Uso:
  Sincronização Completa de Todas as Tabelas:
    python run_sync.py --sync-all

  Execução Manual de Query Específica:
    python run_sync.py --manual --query "SELECT * FROM chamados LIMIT 100" --target chamados

  Início do Agendador Automático:
    python run_sync.py --scheduler

  Início do Servidor de API REST (FastAPI):
    python run_sync.py --api --host 0.0.0.0 --port 8000
"""

import argparse
import logging
import sys
from src.config import settings
from src.services.etl_service import ETLService
from src.scheduler import start_scheduler


def setup_logging() -> None:
    """Configura o sistema de log estruturado."""
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)]
    )


def start_api_server(host: str = "0.0.0.0", port: int = 8000) -> None:
    """Inicia o servidor Uvicorn para a aplicação FastAPI."""
    import uvicorn
    logger = logging.getLogger("run_sync")
    logger.info(f"Iniciando servidor de API REST em http://{host}:{port} ...")
    logger.info(f"Documentação Swagger UI disponível em http://localhost:{port}/docs")
    uvicorn.run("src.api.app:app", host=host, port=port, reload=False)


def main() -> None:
    setup_logging()
    logger = logging.getLogger("run_sync")

    parser = argparse.ArgumentParser(
        description="Pipeline ETL & API REST: Databricks -> PostgreSQL"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--sync-all",
        action="store_true",
        help="Executa a sincronização completa das 3 tabelas (chamados, reincidentes, pecas)"
    )
    group.add_argument(
        "--manual",
        action="store_true",
        help="Executa a sincronização de uma query específica (Modo Manual)"
    )
    group.add_argument(
        "--scheduler",
        action="store_true",
        help="Inicia o serviço de agendador automático (Cron diário 06:00 AM)"
    )
    group.add_argument(
        "--api",
        action="store_true",
        help="Inicia o servidor de API REST HTTP (FastAPI)"
    )

    # Parâmetros adicionais para --manual ou --sync-all
    parser.add_argument(
        "--query",
        type=str,
        default=None,
        help="Query SQL para extração no Databricks (apenas para modo --manual)"
    )
    parser.add_argument(
        "--target",
        type=str,
        default=None,
        help="Nome da tabela de destino no PostgreSQL (apenas para modo --manual)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limite de registros por tabela para testes"
    )

    # Parâmetros adicionais para --api
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host para escuta da API REST (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Porta para escuta da API REST (default: 8000)"
    )

    args = parser.parse_args()

    if args.sync_all:
        logger.info("=== Sincronização Completa Selecionada (chamados, reincidentes, pecas) ===")
        etl = ETLService()
        results = etl.sync_all_tables(limit_per_table=args.limit)
        print("\n--- Resultado da Sincronização ---")
        for tbl, res in results.items():
            print(f"{tbl}: {res}")
    elif args.manual:
        logger.info("=== Modo de Execução Manual Selecionado ===")
        if not args.query or not args.target:
            logger.error("No modo --manual, informe obrigatoriamente --query e --target.")
            sys.exit(1)
        etl = ETLService()
        result = etl.run_pipeline(query=args.query, target_table=args.target)
        print("\n--- Resultado da Execução ---")
        print(result)
        if result["status"] == "FAILED":
            sys.exit(1)
    elif args.scheduler:
        logger.info("=== Modo Agendador Automático Selecionado ===")
        start_scheduler()
    elif args.api:
        logger.info("=== Modo Servidor de API REST Selecionado ===")
        start_api_server(host=args.host, port=args.port)


if __name__ == "__main__":
    main()
