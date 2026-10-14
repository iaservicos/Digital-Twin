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
    from services.calculo_pontuacao import CalculoPontuacaoService
except ImportError:
    try:
        from api.services.calculo_pontuacao import CalculoPontuacaoService
    except ImportError:
        try:
            from backend_python.services.calculo_pontuacao import CalculoPontuacaoService
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
    except ImportError:
        try:
            from api.connectors.postgres_client import PostgreSQLClient
        except ImportError:
            from backend_python.connectors.postgres_client import PostgreSQLClient

    try:
        db_status = PostgreSQLClient().get_sync_status()
        if db_status and isinstance(db_status, dict) and "status" in db_status:
            return db_status
    except Exception as e:
        logger.warning(f"Erro ao consultar sync status no banco: {e}")

    return sync_status_tracker

@router.post("/sync/status/abort", response_model=Dict[str, Any])
def abort_sync_endpoint(body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Endpoint chamado para abortar status zumbi no PostgreSQL quando ocorre falha."""
    err_msg = body.get("error", "Sincronização abortada.") if body else "Sincronização abortada."
    try:
        from connectors.postgres_client import PostgreSQLClient
    except ImportError:
        try:
            from api.connectors.postgres_client import PostgreSQLClient
        except ImportError:
            from backend_python.connectors.postgres_client import PostgreSQLClient

    try:
        PostgreSQLClient().abort_sync_status(err_msg)
    except Exception as e:
        logger.warning(f"Erro ao abortar status no banco: {e}")

    return {"status": "success", "message": "Status abortado."}


# ==============================================================================
# ENDPOINTS ATÔMICOS POR ETAPA (SERVERLESS STEP-BY-STEP - ZERO TIMEOUT 504)
# ==============================================================================

@router.post("/sync/step/chamados", response_model=Dict[str, Any])
def sync_step_chamados_endpoint(body: Optional[SyncRequest] = None) -> Dict[str, Any]:
    """Etapa 1: Extrai e grava a tabela de chamados (~8s)."""
    if ETLService is None:
        raise HTTPException(
            status_code=503,
            detail="A sincronização direta do Databricks foi desacoplada da Vercel para otimização de performance. O pipeline é privado e deve ser executado exclusivamente através do microserviço DataIngest no Render."
        )
    try:
        req_inicio = body.data_inicio if body else None
        req_fim = body.data_fim if body else None
        req_limit = body.limit_per_table if body else None
        etl = ETLService()
        res = etl.sync_step_chamados(req_inicio, req_fim, req_limit)
        return {"status": "success", "step": "chamados", "summary": res}
    except Exception as e:
        logger.error(f"Erro na etapa de chamados: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro em chamados: {str(e)}")


@router.post("/sync/step/reincidentes", response_model=Dict[str, Any])
def sync_step_reincidentes_endpoint(body: Optional[SyncRequest] = None) -> Dict[str, Any]:
    """Etapa 2: Extrai e grava a tabela de reincidentes (~4s)."""
    if ETLService is None:
        raise HTTPException(
            status_code=503,
            detail="A sincronização direta do Databricks foi desacoplada da Vercel para otimização de performance. O pipeline é privado e deve ser executado exclusivamente através do microserviço DataIngest no Render."
        )
    try:
        req_inicio = body.data_inicio if body else None
        req_fim = body.data_fim if body else None
        req_limit = body.limit_per_table if body else None
        etl = ETLService()
        res = etl.sync_step_reincidentes(req_inicio, req_fim, req_limit)
        return {"status": "success", "step": "reincidentes", "summary": res}
    except Exception as e:
        logger.error(f"Erro na etapa de reincidentes: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro em reincidentes: {str(e)}")


@router.post("/sync/step/pecas", response_model=Dict[str, Any])
def sync_step_pecas_endpoint(body: Optional[SyncRequest] = None) -> Dict[str, Any]:
    """Etapa 3: Extrai e grava a tabela de peças com filtro do período (~10s)."""
    if ETLService is None:
        raise HTTPException(
            status_code=503,
            detail="A sincronização direta do Databricks foi desacoplada da Vercel para otimização de performance. O pipeline é privado e deve ser executado exclusivamente através do microserviço DataIngest no Render."
        )
    try:
        req_inicio = body.data_inicio if body else None
        req_fim = body.data_fim if body else None
        req_limit = body.limit_per_table if body else None
        etl = ETLService()
        res = etl.sync_step_pecas(req_inicio, req_fim, req_limit)
        return {"status": "success", "step": "pecas", "summary": res}
    except Exception as e:
        logger.error(f"Erro na etapa de peças: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro em peças: {str(e)}")


@router.post("/sync/step/consolidar", response_model=Dict[str, Any])
def sync_step_consolidar_endpoint(body: Optional[SyncRequest] = None) -> Dict[str, Any]:
    """Etapa 4: Carga operacional em tb_chamado/tb_encerrados_rrc e recálculo dos KPIs (~12s)."""
    if ETLService is None:
        raise HTTPException(
            status_code=503,
            detail="A sincronização direta do Databricks foi desacoplada da Vercel para otimização de performance. O pipeline é privado e deve ser executado exclusivamente através do microserviço DataIngest no Render."
        )
    try:
        req_inicio = body.data_inicio if body else None
        req_fim = body.data_fim if body else None
        etl = ETLService()
        res = etl.sync_step_consolidar(req_inicio, req_fim)
        return {"status": "success", "step": "consolidar", "summary": res}
    except Exception as e:
        logger.error(f"Erro na etapa de consolidação: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro em consolidação: {str(e)}")


# ==============================================================================
# SINCRONIZAÇÃO SOB DEMANDA (POR PERÍODO)
# ==============================================================================

@router.post("/sync", response_model=Dict[str, Any])
def trigger_sync(
    body: Optional[SyncRequest] = None,
    data_inicio: Optional[str] = Query(default=None, description="Data inicial YYYY-MM-DD"),
    data_fim: Optional[str] = Query(default=None, description="Data final YYYY-MM-DD"),
    limit_per_table: Optional[int] = Query(default=None)
) -> Dict[str, Any]:
    """Executa a sincronização sob demanda do Databricks/PostgreSQL garantindo persistência de status no banco."""
    if ETLService is None:
        raise HTTPException(
            status_code=503,
            detail="A sincronização direta do Databricks foi desacoplada da Vercel para otimização de performance. Execute o disparo através do microserviço DataIngest no Render."
        )
    try:
        req_inicio = body.data_inicio if body and body.data_inicio else data_inicio
        req_fim = body.data_fim if body and body.data_fim else data_fim
        req_limit = body.limit_per_table if body and body.limit_per_table else limit_per_table

        etl = ETLService()
        results = etl.sync_all_tables(
            data_inicio=req_inicio, 
            data_fim=req_fim, 
            limit_per_table=req_limit
        )

        return {
            "status": "success",
            "message": "Sincronização por período concluída com sucesso.",
            "summary": results,
            "periodo": {
                "data_inicio": req_inicio,
                "data_fim": req_fim
            },
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }
    except Exception as e:
        logger.error(f"Erro ao executar sincronização sob demanda: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# ==============================================================================
# ROTINA DIÁRIA INCREMENTAL (ATUALIZAR CAMPANHA)
# ==============================================================================

@router.post("/sync/campanha/incremental", response_model=Dict[str, Any])
def trigger_sync_campanha_incremental() -> Dict[str, Any]:
    """
    Rotina DIÁRIA: Sincronização incremental dos chamados e peças recentes da campanha ativa.
    Ao final da ingestão, recalcula automaticamente os KPIs e pontuações da campanha.
    """
    if ETLService is None:
        raise HTTPException(
            status_code=503,
            detail="A sincronização direta do Databricks foi desacoplada da Vercel para otimização de performance. Execute o disparo através do microserviço DataIngest no Render."
        )
    try:
        etl = ETLService()
        results = etl.sync_campanha_incremental()
        return {
            "status": "success",
            "tipo": "DIARIA_INCREMENTAL",
            "message": "Rotina diária de atualização da campanha concluída com sucesso.",
            "summary": results,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }
    except Exception as e:
        logger.error(f"Erro ao executar atualização incremental diária: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao iniciar rotina diária: {str(e)}")


# ==============================================================================
# ROTINA SEMANAL COMPLETA (SINCRONIZAR)
# ==============================================================================

@router.post("/sync/campanha/completa", response_model=Dict[str, Any])
def trigger_sync_campanha_completa() -> Dict[str, Any]:
    """
    Rotina SEMANAL: Reingestão completa de todo o período da campanha ativa no Postgres.
    Sobrescreve e atualiza toda a base da campanha e recalcula todas as pontuações de ponta a ponta.
    """
    if ETLService is None:
        raise HTTPException(
            status_code=503,
            detail="A sincronização direta do Databricks foi desacoplada da Vercel para otimização de performance. Execute o disparo através do microserviço DataIngest no Render."
        )
    try:
        etl = ETLService()
        results = etl.sync_campanha_completa()
        return {
            "status": "success",
            "tipo": "SEMANAL_COMPLETA",
            "message": "Rotina semanal de sincronização completa da campanha concluída com sucesso.",
            "summary": results,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }
    except Exception as e:
        logger.error(f"Erro ao executar sincronização completa semanal: {e}", exc_info=True)
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
    """Endpoint de upload de planilhas. Desacoplado da Vercel para o DataIngest no Render."""
    raise HTTPException(
        status_code=503,
        detail="O processamento de planilhas foi desacoplado da Vercel para alta performance. O upload deve ser executado exclusivamente através do microserviço DataIngest no Render."
    )


@router.get("/ingestion/progress/{task_id}", response_model=Dict[str, Any])
def get_ingestion_progress(task_id: str) -> Dict[str, Any]:
    """Polling do progresso de processamento da planilha."""
    if task_id not in task_progress:
        raise HTTPException(status_code=404, detail="Task ID não encontrado.")
    return task_progress[task_id]
