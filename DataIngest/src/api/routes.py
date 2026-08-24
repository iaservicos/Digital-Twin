from src.api.security import verify_api_key
from fastapi import Depends
"""
Rotas e endpoints da API REST utilizando FastAPI.
Define rotas GET para consulta ao Databricks, status em tempo real e POST /api/v1/sync com filtro por bimestre.
"""

import logging
import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, HTTPException, BackgroundTasks
from pydantic import BaseModel
from src.services.etl_service import ETLService, sync_status_tracker
from src.connectors.databricks_client import DatabricksClient
from src.services.calculo_pontuacao import CalculoPontuacaoService
from src.connectors.postgres_client import PostgreSQLClient
import polars as pl

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["DataIngest API"], dependencies=[Depends(verify_api_key)])


class SyncRequest(BaseModel):
    data_inicio: Optional[str] = None
    data_fim: Optional[str] = None
    limit_per_table: Optional[int] = None


@router.get("/sync/status", response_model=Dict[str, Any], tags=["Sincronização"])
def get_sync_status() -> Dict[str, Any]:
    """
    Retorna o progresso em tempo real (0 a 100%), tempo estimado restante e estado das tabelas operacionais.
    """
    return sync_status_tracker


@router.post("/sync", response_model=Dict[str, Any], tags=["Sincronização"])
def trigger_sync(
    body: Optional[SyncRequest] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    data_inicio: Optional[str] = Query(default=None, description="Data inicial no formato YYYY-MM-DD"),
    data_fim: Optional[str] = Query(default=None, description="Data final no formato YYYY-MM-DD"),
    limit_per_table: Optional[int] = Query(default=None, description="Limite opcional de registros por tabela")
) -> Dict[str, Any]:
    """
    Dispara a sincronização sob demanda do Databricks SQL Warehouse para o PostgreSQL.
    Aceita filtro temporal por data_inicio e data_fim (ex: Bimestre Jul-Ago: 2026-07-01 a 2026-08-31).
    A execução roda em segundo plano (BackgroundTask) para liberar o cliente imediatamente.
    """
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
            "message": "Sincronização do Databricks iniciada em segundo plano.",
            "periodo": {
                "data_inicio": req_inicio,
                "data_fim": req_fim
            },
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }
    except Exception as e:
        logger.error(f"Erro ao disparar sincronização sob demanda: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Erro interno ao disparar sincronização: {str(e)}"
        )


@router.get("/chamados", response_model=Dict[str, Any], tags=["Chamados"])
def get_chamados(
    data_inicio: str = Query(
        default="2026-07-01T00:00:00.000+00:00",
        description="Filtro temporal inicial (ISO-8601 com fuso horário)"
    ),
    data_fim: str = Query(
        default="2026-08-01T00:00:00.000+00:00",
        description="Filtro temporal final (ISO-8601 com fuso horário)"
    ),
    tipo: str = Query(
        default="ATENDIMENTO ON SITE",
        description="Tipo do atendimento"
    ),
    limit: int = Query(
        default=10,
        ge=1,
        le=5000,
        description="Limite máximo de registros a retornar"
    ),
    persist_to_postgres: bool = Query(
        default=False,
        description="Se true, salva os resultados retornados também no banco PostgreSQL"
    )
) -> Dict[str, Any]:
    """
    Retorna os chamados filtrados do Databricks (datalake_prod.indicadores_servicos.chamados).
    """
    start_time = time.time()
    
    clean_tipo = tipo.replace("'", "''")
    clean_data_inicio = data_inicio.replace("'", "''")
    clean_data_fim = data_fim.replace("'", "''")

    query = f"""
    SELECT 
        chamado,
        assistencia_centro_trabalho,
        assistencia_razao_social,
        tecnico_nome,
        ft,
        tipo_equipamento,
        projeto,
        sla_status,
        descricao_material,
        texto_encerrado,
        gp_desc,
        gp_segmento
    FROM 
        chamados
    WHERE tecnico_nome IS NOT NULL
      AND tipo_equipamento IS NOT NULL
      AND assistencia_centro_trabalho IS NOT NULL
      AND tipo = '{clean_tipo}'
      AND ft >= '{clean_data_inicio}'
      AND ft <  '{clean_data_fim}'
    LIMIT {limit};
    """

    try:
        databricks_client = DatabricksClient()
        records: List[Dict[str, Any]] = []

        for batch in databricks_client.fetch_arrow_batches(query, batch_size=limit):
            df = pl.from_arrow(batch)
            records.extend(df.to_dicts())
            if len(records) >= limit:
                records = records[:limit]
                break

        if persist_to_postgres and records:
            etl_service = ETLService()
            df_to_save = pl.DataFrame(records)
            etl_service.postgres.write_polars_df(
                df=df_to_save,
                table_name="chamados",
                conflict_column="chamado"
            )

        elapsed_seconds = round(time.time() - start_time, 3)

        return {
            "status": "success",
            "count": len(records),
            "elapsed_seconds": elapsed_seconds,
            "data": records
        }

    except Exception as e:
        logger.error(f"Erro ao consultar chamados no Databricks: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Erro interno ao consultar Databricks: {str(e)}"
        )


@router.get("/reincidentes", response_model=Dict[str, Any], tags=["Reincidentes"])
def get_reincidentes(
    data_inicio: str = Query(
        default="2026-07-01T00:00:00.000+00:00",
        description="Filtro temporal inicial na coluna ft_rrc (ISO-8601 com fuso horário)"
    ),
    data_fim: str = Query(
        default="2026-08-01T00:00:00.000+00:00",
        description="Filtro temporal final na coluna ft_rrc (ISO-8601 com fuso horário)"
    ),
    limit: int = Query(
        default=10,
        ge=1,
        le=5000,
        description="Limite máximo de registros a retornar"
    )
) -> Dict[str, Any]:
    """
    Retorna os indicadores de chamados reincidentes do Databricks (tabela reincidentes).
    """
    start_time = time.time()
    clean_data_inicio = data_inicio.replace("'", "''")
    clean_data_fim = data_fim.replace("'", "''")

    query = f"""
    SELECT 
        chamado_anterior,
        chamado_rrc,
        tecnico_nome_anterior,
        tecnico_nome_rrc,
        ft_anterior,
        ft_rrc 
    FROM 
        reincidentes
    WHERE tecnico_nome_anterior IS NOT NULL
      AND ft_rrc >= '{clean_data_inicio}'
      AND ft_rrc <  '{clean_data_fim}'
    LIMIT {limit};
    """

    try:
        databricks_client = DatabricksClient()
        records: List[Dict[str, Any]] = []

        for batch in databricks_client.fetch_arrow_batches(query, batch_size=limit):
            df = pl.from_arrow(batch)
            records.extend(df.to_dicts())
            if len(records) >= limit:
                records = records[:limit]
                break

        elapsed_seconds = round(time.time() - start_time, 3)

        return {
            "status": "success",
            "count": len(records),
            "elapsed_seconds": elapsed_seconds,
            "data": records
        }

    except Exception as e:
        logger.error(f"Erro ao consultar reincidentes no Databricks: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Erro interno ao consultar Databricks: {str(e)}"
        )


@router.get("/pecas", response_model=Dict[str, Any], tags=["Peças"])
def get_pecas(
    data_inicio: str = Query(
        default="2026-07-01T00:00:00.000+00:00",
        description="Filtro temporal inicial na coluna ft (ISO-8601 com fuso horário)"
    ),
    data_fim: str = Query(
        default="2026-08-01T00:00:00.000+00:00",
        description="Filtro temporal final na coluna ft (ISO-8601 com fuso horário)"
    ),
    limit: int = Query(
        default=10,
        ge=1,
        le=5000,
        description="Limite máximo de registros a retornar"
    )
) -> Dict[str, Any]:
    """
    Retorna os dados de peças utilizadas do Databricks (tabela pecas).
    """
    start_time = time.time()
    clean_data_inicio = data_inicio.replace("'", "''")
    clean_data_fim = data_fim.replace("'", "''")

    query = f"""
    SELECT
        chamado,
        tipo_equipamento,
        tecnico_nome,
        ft,
        cod_aplic_desc,
        status_peca,
        grupo_mercadoria_desc,
        qtd,
        tipo_posicionado,
        segmento
    FROM 
        pecas
    WHERE
        ft >= '{clean_data_inicio}' 
    AND ft <  '{clean_data_fim}'
    LIMIT {limit};
    """

    try:
        databricks_client = DatabricksClient()
        records: List[Dict[str, Any]] = []

        for batch in databricks_client.fetch_arrow_batches(query, batch_size=limit):
            df = pl.from_arrow(batch)
            records.extend(df.to_dicts())
            if len(records) >= limit:
                records = records[:limit]
                break

        elapsed_seconds = round(time.time() - start_time, 3)

        return {
            "status": "success",
            "count": len(records),
            "elapsed_seconds": elapsed_seconds,
            "data": records
        }

    except Exception as e:
        logger.error(f"Erro ao consultar peças no Databricks: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Erro interno ao consultar Databricks: {str(e)}"
        )


@router.get("/calculo/tecnico/{id_tecnico}", response_model=Dict[str, Any], tags=["Cálculo"])
def recalcular_tecnico(
    id_tecnico: int,
    mes: int = Query(default=8, description="Mês de apuração"),
    ano: int = Query(default=2026, description="Ano de apuração")
) -> Dict[str, Any]:
    """
    Aciona o motor Polars para calcular a nota oficial de um único técnico em tempo real e salvar no banco.
    """
    try:
        calc_service = CalculoPontuacaoService()
        result = calc_service.calcular_pontuacao_tecnico(id_tecnico=id_tecnico, mes=mes, ano=ano)
        return {
            "status": "success",
            "data": result
        }
    except Exception as e:
        logger.error(f"Erro ao recalcular técnico {id_tecnico}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Erro interno no motor de cálculo: {str(e)}"
        )

@router.post("/calculo/geral", response_model=Dict[str, Any], tags=["Cálculo"])
def recalcular_geral(
    mes: int = Query(default=8, description="Mês de apuração"),
    ano: int = Query(default=2026, description="Ano de apuração")
) -> Dict[str, Any]:
    """
    Aciona o motor Polars para calcular a nota oficial de TODOS os 361 técnicos em lote com paridade total.
    """
    try:
        calc_service = CalculoPontuacaoService()
        result = calc_service.calcular_pontuacao_geral(mes=mes, ano=ano)
        return {
            "status": "success",
            "resultado": result
        }
    except Exception as e:
        logger.error(f"Erro ao recalcular geral: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Erro interno no motor de cálculo: {str(e)}"
        )