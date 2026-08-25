"""
Serviço principal de ETL (Extract, Transform, Load) de Alta Performance.
Conecta o extrator Databricks ao carregador PostgreSQL com streaming PyArrow/Polars,
projeção estrita de colunas, exclusão seletiva e rastreamento dinâmico de progresso.
"""

import logging
import time
import polars as pl
from src.connectors.databricks_client import DatabricksClient
from src.connectors.postgres_client import PostgreSQLClient

logger = logging.getLogger(__name__)

# Tracker de Estado Global em Tempo Real para Acompanhamento do Frontend
sync_status_tracker = {
    "status": "idle",  # "idle" | "processing" | "success" | "failed"
    "progress": 0,
    "step": "Pronto para iniciar",
    "current_table": None,
    "tables": {
        "chamados": {"status": "pending", "rows": 0, "seconds": 0},
        "reincidentes": {"status": "pending", "rows": 0, "seconds": 0},
        "pecas": {"status": "pending", "rows": 0, "seconds": 0}
    },
    "estimated_seconds_remaining": 0,
    "elapsed_seconds": 0,
    "total_rows": 0,
    "error": None,
    "periodo": {"data_inicio": None, "data_fim": None},
    "start_timestamp": None
}


class ETLService:
    def __init__(self) -> None:
        self.databricks = DatabricksClient()
        self.postgres = PostgreSQLClient()

    def update_progress(self, progress: int, step: str, current_table: str = None) -> None:
        """
        Atualiza o progresso % e recalcula dinamicamente o tempo restante estimado com base no tempo decorrido real.
        """
        global sync_status_tracker
        start_ts = sync_status_tracker.get("start_timestamp")
        
        elapsed = round(time.time() - start_ts, 1) if start_ts else 0
        remaining = 0
        
        if progress > 0 and progress < 100 and elapsed > 0:
            estimated_total = (elapsed / progress) * 100
            remaining = max(1, int(round(estimated_total - elapsed)))
        elif progress >= 100:
            remaining = 0

        sync_status_tracker.update({
            "progress": progress,
            "step": step,
            "current_table": current_table,
            "elapsed_seconds": elapsed,
            "estimated_seconds_remaining": remaining
        })
        logger.info(f"Progresso ETL: {progress}% - {step} (Decorrido: {elapsed}s, Restante: ~{remaining}s)")

    def run_pipeline(
        self, 
        query: str, 
        target_table: str, 
        conflict_column: str = None
    ) -> dict:
        """
        Executa a extração em lote e ingestão no PostgreSQL via streaming.
        """
        start_time = time.time()
        logger.info(f"Iniciando pipeline ETL para a tabela de destino '{target_table}'...")

        total_rows = 0
        total_batches = 0

        try:
            for arrow_batch in self.databricks.fetch_arrow_batches(query):
                total_batches += 1
                df = pl.from_arrow(arrow_batch)
                
                rows_inserted = self.postgres.write_polars_df(
                    df=df,
                    table_name=target_table,
                    conflict_column=conflict_column
                )
                total_rows += rows_inserted

            elapsed_time = round(time.time() - start_time, 2)
            summary = {
                "status": "SUCCESS",
                "target_table": target_table,
                "total_rows": total_rows,
                "total_batches": total_batches,
                "elapsed_seconds": elapsed_time
            }
            logger.info(f"Pipeline ETL concluído com sucesso: {summary}")
            return summary

        except Exception as e:
            elapsed_time = round(time.time() - start_time, 2)
            logger.error(f"Erro durante a execução do pipeline ETL ({target_table}): {e}", exc_info=True)
            return {
                "status": "FAILED",
                "target_table": target_table,
                "error": str(e),
                "elapsed_seconds": elapsed_time
            }


    def sincronizar_tb_chamados(self) -> int:
        """
        Transfere e atualiza os chamados da tabela bruta 'chamados' (Databricks)
        para a tabela operacional 'tb_chamado' vinculando aos técnicos cadastrados.
        Garante que todos os chamados recentes reflitam na base operacional.
        """
        query_sync = """
            INSERT INTO tb_chamado (
                chamado,
                id_tecnico,
                assistencia_centro_trabalho,
                ft,
                equipamento,
                projeto,
                sla_status,
                material_descricao,
                texto_encerrado,
                assistencia_nome,
                tecnico_nome
            )
            SELECT
                c.chamado::bigint,
                t.id_tecnico,
                c.assistencia_centro_trabalho,
                c.ft,
                c.tipo_equipamento,
                c.projeto,
                c.sla_status,
                c.descricao_material,
                c.texto_encerrado,
                c.assistencia_razao_social,
                t.nome_completo
            FROM chamados c
            JOIN tb_tecnico t ON UPPER(TRIM(c.tecnico_nome)) = UPPER(TRIM(t.nome_completo))
            WHERE c.chamado ~ '^[0-9]+$'
            ON CONFLICT (chamado) DO UPDATE SET
                id_tecnico = EXCLUDED.id_tecnico,
                assistencia_centro_trabalho = EXCLUDED.assistencia_centro_trabalho,
                ft = EXCLUDED.ft,
                equipamento = EXCLUDED.equipamento,
                projeto = EXCLUDED.projeto,
                sla_status = EXCLUDED.sla_status,
                material_descricao = EXCLUDED.material_descricao,
                texto_encerrado = EXCLUDED.texto_encerrado,
                assistencia_nome = EXCLUDED.assistencia_nome,
                tecnico_nome = EXCLUDED.tecnico_nome;
        """
        logger.info("Executando sincronização de chamados para tb_chamado...")
        with self.postgres._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query_sync)
                affected = cur.rowcount
            conn.commit()
        logger.info(f"Sincronização de tb_chamado concluída: {affected} registros atualizados.")
        return affected

    def recalcular_indicadores_campanha(self) -> dict:
        """
        Aciona o motor de cálculo Polars de alta performance para apurar Julho e Agosto
        e consolidar a média do bimestre na tabela tb_apuracao_mensal.
        """
        from src.services.calculo_pontuacao import CalculoPontuacaoService
        calc = CalculoPontuacaoService(postgres_client=self.postgres)
        
        logger.info("Recalculando apuração da campanha: Julho e Agosto de 2026...")
        res_jul = calc.calcular_pontuacao_geral(mes=7, ano=2026)
        res_ago = calc.calcular_pontuacao_geral(mes=8, ano=2026)
        res_cons = calc.calcular_media_campanha_fase6(ano=2026)
        
        return {
            "julho": res_jul,
            "agosto": res_ago,
            "consolidado": res_cons
        }

    def sync_all_tables(
        self, 
        data_inicio: str = None, 
        data_fim: str = None, 
        limit_per_table: int = None
    ) -> dict:
        """
        Sincroniza as 3 tabelas operacionais do Databricks para o PostgreSQL filtradas por período
        com projeção cirúrgica de colunas e alta performance.
        """
        global sync_status_tracker

        start_all_time = time.time()
        
        # Resetar o Tracker para o início do processamento com timestamp inicial
        sync_status_tracker.update({
            "status": "processing",
            "progress": 5,
            "step": "Conectando ao Databricks SQL Warehouse...",
            "current_table": "chamados",
            "tables": {
                "chamados": {"status": "processing", "rows": 0, "seconds": 0},
                "reincidentes": {"status": "pending", "rows": 0, "seconds": 0},
                "pecas": {"status": "pending", "rows": 0, "seconds": 0}
            },
            "estimated_seconds_remaining": 30,
            "elapsed_seconds": 0,
            "total_rows": 0,
            "error": None,
            "periodo": {"data_inicio": data_inicio, "data_fim": data_fim},
            "start_timestamp": start_all_time
        })

        limit_clause = f" LIMIT {limit_per_table}" if limit_per_table else ""
        
        date_clause_ft = ""
        date_clause_rrc = ""
        if data_inicio and data_fim:
            clean_inicio = data_inicio.replace("'", "''")
            clean_fim = data_fim.replace("'", "''")
            date_clause_ft = f" AND ft >= '{clean_inicio} 00:00:00' AND ft <= '{clean_fim} 23:59:59'"
            date_clause_rrc = f" AND ft_rrc >= '{clean_inicio} 00:00:00' AND ft_rrc <= '{clean_fim} 23:59:59'"

        results = {}

        try:
            # -----------------------------------------------------------------
            # Etapa 1: Sync chamados (SLA & Atendimentos)
            # -----------------------------------------------------------------
            self.update_progress(15, "Extraindo e gravando Chamados (1/3)...", "Chamados")

            if data_inicio and data_fim:
                logger.info(f"Removendo dados antigos de chamados do período {clean_inicio} a {clean_fim}...")
                self.postgres.execute_query(f"DELETE FROM public.chamados WHERE 1=1{date_clause_ft};")

            cols_chamados = """
                chamado, assistencia_centro_trabalho, assistencia_razao_social, tecnico_nome,
                ft, tipo_equipamento, projeto, sla_status, descricao_material, texto_encerrado,
                gp_desc, gp_segmento, ocorrencia_chamado, tipo
            """
            q_chamados = f"SELECT {cols_chamados} FROM chamados WHERE chamado IS NOT NULL{date_clause_ft}{limit_clause};"
            res_chamados = self.run_pipeline(query=q_chamados, target_table="chamados")
            results["chamados"] = res_chamados

            if res_chamados["status"] == "FAILED":
                raise Exception(f"Falha na tabela chamados: {res_chamados.get('error')}")

            sync_status_tracker["tables"]["chamados"] = {
                "status": "success", 
                "rows": res_chamados["total_rows"], 
                "seconds": res_chamados["elapsed_seconds"]
            }

            # -----------------------------------------------------------------
            # Etapa 2: Sync reincidentes (Voltas RRC)
            # -----------------------------------------------------------------
            self.update_progress(50, "Extraindo e gravando Reincidências (2/3)...", "Reincidências")
            sync_status_tracker["tables"]["reincidentes"]["status"] = "processing"

            if data_inicio and data_fim:
                logger.info(f"Removendo dados antigos de reincidentes do período {clean_inicio} a {clean_fim}...")
                self.postgres.execute_query(f"DELETE FROM public.reincidentes WHERE 1=1{date_clause_rrc};")

            cols_reinc = """
                chamado_rrc, chamado_anterior, ft_rrc, ft_anterior, ct_anterior, ct_rrc,
                tecnico_nome_anterior, tecnico_nome_rrc, projeto_anterior, projeto_rrc,
                aplicado_peca_anterior, defeito_anterior, texto_encerrado_anterior, ocorrencia_chamado_anterior
            """
            q_reincidentes = f"SELECT {cols_reinc} FROM reincidentes WHERE chamado_rrc IS NOT NULL{date_clause_rrc}{limit_clause};"
            res_reincidentes = self.run_pipeline(query=q_reincidentes, target_table="reincidentes")
            results["reincidentes"] = res_reincidentes

            if res_reincidentes["status"] == "FAILED":
                raise Exception(f"Falha na tabela reincidentes: {res_reincidentes.get('error')}")

            sync_status_tracker["tables"]["reincidentes"] = {
                "status": "success", 
                "rows": res_reincidentes["total_rows"], 
                "seconds": res_reincidentes["elapsed_seconds"]
            }

            # -----------------------------------------------------------------
            # Etapa 3: Sync pecas (Consumo de Peças)
            # -----------------------------------------------------------------
            self.update_progress(80, "Extraindo e gravando Peças (3/3)...", "Peças")
            sync_status_tracker["tables"]["pecas"]["status"] = "processing"

            if data_inicio and data_fim:
                logger.info(f"Removendo dados antigos de pecas do período {clean_inicio} a {clean_fim}...")
                self.postgres.execute_query(f"DELETE FROM public.pecas WHERE 1=1{date_clause_ft};")

            cols_pecas = """
                chamado, ft, tecnico_nome, grupo_mercadoria_desc, grupo_mercadoria,
                cod_solic_desc, cod_aplic_desc, tipo_equipamento, acao
            """
            q_pecas = f"SELECT {cols_pecas} FROM pecas WHERE chamado IS NOT NULL{date_clause_ft}{limit_clause};"
            res_pecas = self.run_pipeline(query=q_pecas, target_table="pecas")
            results["pecas"] = res_pecas

            if res_pecas["status"] == "FAILED":
                raise Exception(f"Falha na tabela pecas: {res_pecas.get('error')}")

            sync_status_tracker["tables"]["pecas"] = {
                "status": "success", 
                "rows": res_pecas["total_rows"], 
                "seconds": res_pecas["elapsed_seconds"]
            }


            # -----------------------------------------------------------------
            # Etapa 4: Carga Incremental Automática em tb_chamado (Prevenção)
            # -----------------------------------------------------------------
            self.update_progress(88, "Atualizando base operacional de chamados...", "Processamento")
            novos_tb = self.sincronizar_tb_chamados()

            # -----------------------------------------------------------------
            # Etapa 5: Recálculo Analítico Automático da Campanha (Prevenção)
            # -----------------------------------------------------------------
            self.update_progress(95, "Recalculando apuração oficial da campanha...", "Cálculo Polars")
            self.recalcular_indicadores_campanha()

            # -----------------------------------------------------------------
            # Conclusão com Sucesso
            # -----------------------------------------------------------------
            total_elapsed = round(time.time() - start_all_time, 2)
            total_rows_all = sum(res["total_rows"] for res in results.values())

            sync_status_tracker.update({
                "status": "success",
                "progress": 100,
                "step": "Sincronização concluída com sucesso! Todos os indicadores foram atualizados.",
                "current_table": None,
                "estimated_seconds_remaining": 0,
                "elapsed_seconds": total_elapsed,
                "total_rows": total_rows_all
            })

            return results

        except Exception as e:
            total_elapsed = round(time.time() - start_all_time, 2)
            err_msg = str(e)
            logger.error(f"Erro durante a sincronização completa: {err_msg}")
            
            sync_status_tracker.update({
                "status": "failed",
                "progress": 0,
                "step": f"Falha na sincronização: {err_msg}",
                "estimated_seconds_remaining": 0,
                "elapsed_seconds": total_elapsed,
                "error": err_msg
            })
            return results
