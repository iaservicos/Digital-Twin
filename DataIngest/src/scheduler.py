"""
Módulo de agendamento automático de tarefas (Cron 06:00 AM).
Utiliza APScheduler em modo de bloqueio (BlockingScheduler).
"""

import logging
import sys
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from src.config import settings
from src.services.etl_service import ETLService

logger = logging.getLogger(__name__)


def job_function() -> None:
    """Função executada pelo agendador diariamente às 06:00 AM para sincronizar todas as tabelas."""
    logger.info("Agendador disparou a execução automática da carga Databricks (06:00 AM).")
    etl = ETLService()
    results = etl.sync_all_tables()
    logger.info(f"Resultado do job agendado de sincronização completa: {results}")


def start_scheduler() -> None:
    """Inicia o serviço de agendamento automático."""
    hour, minute = settings.SCHEDULE_TIME.split(":")
    logger.info(f"Iniciando serviço de agendamento diário configurado para as {settings.SCHEDULE_TIME}...")

    scheduler = BlockingScheduler()
    scheduler.add_job(
        job_function,
        CronTrigger(hour=int(hour), minute=int(minute)),
        id="daily_etl_job",
        replace_existing=True
    )

    try:
        logger.info("Agendador ativo. Pressione Ctrl+C para encerrar.")
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Serviço de agendamento encerrado.")
        sys.exit(0)
