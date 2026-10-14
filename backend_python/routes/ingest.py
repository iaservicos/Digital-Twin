"""
Rotas oficiais de Ingestão e Sincronização para o Python Serverless no Vercel e Backend local.
Atende:
  - Rotinas de Sincronização Databricks (Incremental Diária, Completa Semanal, Por Período)
  - Recálculo de Indicadores e Pontuações da Campanha Ativa
  - Ingestão e Processamento de Planilhas (BaseDL, Parts, Reincidencia, EncerradosRRC)
"""

import logging
import time
import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, HTTPException, BackgroundTasks, UploadFile, File, Depends, Header
from pydantic import BaseModel

# Tracker de estado padrão caso o serviço de ETL esteja offloaded
sync_status_tracker: Dict[str, Any] = {"status": "idle", "progress": 0, "step": "Pronto para iniciar"}
ETLService = None
SpreadsheetIngestService = None
task_progress: Dict[str, Any] = {}

try:
    from backend_python.services.calculo_pontuacao import CalculoPontuacaoService
except ImportError:
    try:
        from services.calculo_pontuacao import CalculoPontuacaoService
    except ImportError:
        CalculoPontuacaoService = None

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Ingestão & Sincronização"])


class SyncRequest(BaseModel):
    data_inicio: Optional[str] = None
    data_fim: Optional[str] = None
    limit_per_table: Optional[int] = None


# ==============================================================================
# STATUS DA SINCRONIZAÇÃO EM TEMPO REAL
# ==============================================================================

@router.get("/sync/status", response_model=Dict[str, Any])
def get_sync_status() -> Dict[str, Any]:
    """Retorna o progresso em tempo real, priorizando a tabela persistida no PostgreSQL."""
    try:
        from connectors.postgres_client import PostgreSQLClient
        client = PostgreSQLClient()
        if hasattr(client, 'get_sync_status'):
            db_status = client.get_sync_status()
            if db_status and isinstance(db_status, dict) and "status" in db_status:
                return db_status
    except Exception as e:
        logger.warning(f"Erro ao consultar sync status no banco: {e}")

    return sync_status_tracker


# ==============================================================================
# SINCRONIZAÇÃO SOB DEMANDA (POR PERÍODO)
# ==============================================================================

@router.post("/sync", response_model=Dict[str, Any])
def trigger_sync(
    body: Optional[SyncRequest] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    data_inicio: Optional[str] = Query(default=None, description="Data inicial YYYY-MM-DD"),
    data_fim: Optional[str] = Query(default=None, description="Data final YYYY-MM-DD"),
    limit_per_table: Optional[int] = Query(default=None)
) -> Dict[str, Any]:
    """Dispara a sincronização sob demanda do Databricks/PostgreSQL."""
    try:
        req_inicio = body.data_inicio if body and body.data_inicio else data_inicio
        req_fim = body.data_fim if body and body.data_fim else data_fim
        req_limit = body.limit_per_table if body and body.limit_per_table else limit_per_table

        def run_async_sync():
            etl = ETLService()
            etl.sync_all_tables(
                data_inicio=req_inicio, 
                data_fim=req_fim, 
                limit_per_table=req_limit
            )

        background_tasks.add_task(run_async_sync)
        return {
            "status": "success",
            "message": "Sincronização iniciada em segundo plano.",
            "periodo": {
                "data_inicio": req_inicio,
                "data_fim": req_fim
            },
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }
    except Exception as e:
        logger.error(f"Erro ao disparar sincronização sob demanda: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# ==============================================================================
# ROTINA DIÁRIA INCREMENTAL (ATUALIZAR CAMPANHA)
# ==============================================================================

@router.post("/sync/campanha/incremental", response_model=Dict[str, Any])
def trigger_sync_campanha_incremental(
    background_tasks: BackgroundTasks = BackgroundTasks()
) -> Dict[str, Any]:
    """
    Rotina DIÁRIA: Sincronização incremental dos chamados e peças recentes da campanha ativa.
    Ao final da ingestão, recalcula automaticamente os KPIs e pontuações da campanha.
    """
    try:
        def run_async_incremental():
            try:
                etl = ETLService()
                etl.sync_campanha_incremental()
            except Exception as ex:
                logger.error(f"Falha na rotina incremental assíncrona: {ex}", exc_info=True)
                sync_status_tracker.update({
                    "status": "failed",
                    "error": str(ex),
                    "step": f"Falha na execução: {str(ex)}"
                })

        background_tasks.add_task(run_async_incremental)
        return {
            "status": "success",
            "tipo": "DIARIA_INCREMENTAL",
            "message": "Rotina diária de atualização da campanha iniciada em segundo plano.",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }
    except Exception as e:
        logger.error(f"Erro ao disparar atualização incremental diária: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao iniciar rotina diária: {str(e)}")


# ==============================================================================
# ROTINA SEMANAL COMPLETA (SINCRONIZAR)
# ==============================================================================

@router.post("/sync/campanha/completa", response_model=Dict[str, Any])
def trigger_sync_campanha_completa(
    background_tasks: BackgroundTasks = BackgroundTasks()
) -> Dict[str, Any]:
    """
    Rotina SEMANAL: Reingestão completa de todo o período da campanha ativa no Postgres.
    Sobrescreve e atualiza toda a base da campanha e recalcula todas as pontuações de ponta a ponta.
    """
    try:
        def run_async_completa():
            try:
                etl = ETLService()
                etl.sync_campanha_completa()
            except Exception as ex:
                logger.error(f"Falha na rotina completa assíncrona: {ex}", exc_info=True)
                sync_status_tracker.update({
                    "status": "failed",
                    "error": str(ex),
                    "step": f"Falha na execução: {str(ex)}"
                })

        background_tasks.add_task(run_async_completa)
        return {
            "status": "success",
            "tipo": "SEMANAL_COMPLETA",
            "message": "Rotina semanal de sincronização completa da campanha iniciada em segundo plano.",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }
    except Exception as e:
        logger.error(f"Erro ao disparar sincronização completa semanal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao iniciar rotina semanal: {str(e)}")


# ==============================================================================
# RECÁLCULO OFICIAL DA CAMPANHA ATIVA
# ==============================================================================

@router.post("/calculo/campanha", response_model=Dict[str, Any])
def recalcular_campanha_ativa() -> Dict[str, Any]:
    """Recalcula a apuração analítica de todos os meses da campanha ativa."""
    try:
        calc = CalculoPontuacaoService()
        res = calc.calcular_campanha_ativa()
        return res
    except Exception as e:
        logger.error(f"Erro ao recalcular campanha ativa: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao recalcular campanha: {str(e)}")


# ==============================================================================
# UPLOAD E PROCESSAMENTO DE PLANILHAS (EXCEL / CSV)
# ==============================================================================

@router.post("/ingestion/upload", response_model=Dict[str, Any])
async def upload_planilha(
    type: str = Query(..., description="Tipo da planilha: BaseDL | Parts | Reincidencia | EncerradosRRC"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    file: UploadFile = File(...),
) -> Dict[str, Any]:
    """Endpoint de upload de planilhas. Desacoplado para o DataIngest no Render."""
    raise HTTPException(
        status_code=503,
        detail="O processamento de planilhas foi desacoplado para alta performance. O upload deve ser executado exclusivamente através do microserviço DataIngest no Render."
    )


@router.get("/ingestion/progress/{task_id}", response_model=Dict[str, Any])
def get_ingestion_progress(task_id: str) -> Dict[str, Any]:
    """Polling do progresso de processamento da planilha."""
    if task_id not in task_progress:
        raise HTTPException(status_code=404, detail="Task ID não encontrado.")
    return task_progress[task_id]
