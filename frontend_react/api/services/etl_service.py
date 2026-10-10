"""
Serviço principal de ETL (Extract, Transform, Load) de Alta Performance.
Conecta o extrator Databricks ao carregador PostgreSQL com streaming PyArrow/Polars,
projeção estrita de colunas, exclusão seletiva e rastreamento dinâmico de progresso.
"""

import logging
import time
try:
    import polars as pl
except ImportError:
    pl = None

try:
    from connectors.databricks_client import DatabricksClient
except ImportError:
    try:
        from api.connectors.databricks_client import DatabricksClient
    except ImportError:
        try:
            from backend_python.connectors.databricks_client import DatabricksClient
        except ImportError:
            from src.connectors.databricks_client import DatabricksClient

try:
    from connectors.postgres_client import PostgreSQLClient
except ImportError:
    try:
        from api.connectors.postgres_client import PostgreSQLClient
    except ImportError:
        try:
            from backend_python.connectors.postgres_client import PostgreSQLClient
        except ImportError:
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
        try:
            self.postgres.save_sync_status(sync_status_tracker)
        except Exception as e_save:
            logger.debug(f"Não foi possível persistir status intermediário: {e_save}")
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
            # Prioriza streaming leve e nativo em tuplas (zero dependência de polars/pyarrow)
            if hasattr(self.databricks, 'fetch_native_batches'):
                for columns, rows in self.databricks.fetch_native_batches(query):
                    total_batches += 1

                    # Otimização: para peças, pré-calcula subgrupo em memória para evitar UPDATE pós-carga no Postgres
                    if target_table == 'pecas' and 'subgrupo' not in columns:
                        idx_cod = columns.index('cod_aplic_desc') if 'cod_aplic_desc' in columns else -1
                        idx_grp = columns.index('grupo_mercadoria_desc') if 'grupo_mercadoria_desc' in columns else -1
                        augmented_rows = []
                        for r in rows:
                            cod_val = r[idx_cod] if idx_cod >= 0 else ''
                            grp_val = r[idx_grp] if idx_grp >= 0 else ''
                            augmented_rows.append(r + (self.classificar_subgrupo_peca(cod_val, grp_val),))
                        rows = augmented_rows
                        columns = list(columns) + ['subgrupo']

                    rows_inserted = self.postgres.write_tuples_batch(
                        columns=columns,
                        rows=rows,
                        table_name=target_table,
                        conflict_column=conflict_column
                    )
                    total_rows += rows_inserted
            else:
                # Fallback retrocompatível
                for arrow_batch in self.databricks.fetch_arrow_batches(query):
                    total_batches += 1
                    cols = arrow_batch.schema.names
                    rows = [tuple(r.get(c) for c in cols) for r in arrow_batch.to_pylist()]

                    if target_table == 'pecas' and 'subgrupo' not in cols:
                        idx_cod = cols.index('cod_aplic_desc') if 'cod_aplic_desc' in cols else -1
                        idx_grp = cols.index('grupo_mercadoria_desc') if 'grupo_mercadoria_desc' in cols else -1
                        augmented_rows = []
                        for r in rows:
                            cod_val = r[idx_cod] if idx_cod >= 0 else ''
                            grp_val = r[idx_grp] if idx_grp >= 0 else ''
                            augmented_rows.append(r + (self.classificar_subgrupo_peca(cod_val, grp_val),))
                        rows = augmented_rows
                        cols = list(cols) + ['subgrupo']

                    rows_inserted = self.postgres.write_tuples_batch(
                        columns=cols,
                        rows=rows,
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
            SELECT DISTINCT ON (c.chamado::bigint)
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
            ORDER BY c.chamado::bigint, c.ft DESC NULLS LAST
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

    def sincronizar_tb_encerrados_rrc(self, data_inicio: str = None, data_fim: str = None) -> int:
        """
        Transfere os chamados de encerramento da tabela bruta 'chamados' (Databricks)
        para a tabela 'tb_encerrados_rrc', alimentando o denominador oficial do RRC.
        """
        where_periodo = ""
        if data_inicio and data_fim:
            clean_inicio = data_inicio.replace("'", "''")
            clean_fim = data_fim.replace("'", "''")
            where_periodo = f"AND c.encerramento >= '{clean_inicio} 00:00:00' AND c.encerramento <= '{clean_fim} 23:59:59'"

        query_sync = f"""
            INSERT INTO tb_encerrados_rrc (
                chamado, serie, descricao_material, equipamento,
                segmento, tipo, projeto, assistencia_codigo,
                assistencia_nome, ft, encerramento,
                encerramento_desc, tecnico_nome, texto_encerrado,
                ocorrencia_chamado
            )
            SELECT DISTINCT ON (c.chamado)
                c.chamado,
                c.serie,
                c.descricao_material,
                c.tipo_equipamento,
                c.gp_segmento,
                c.tipo,
                c.projeto,
                c.assistencia_centro_trabalho,
                c.assistencia_razao_social,
                c.ft,
                c.encerramento,
                c.encdesc,
                c.tecnico_nome,
                c.texto_encerrado,
                c.ocorrencia_chamado
            FROM chamados c
            WHERE UPPER(COALESCE(c.encdesc, '')) = 'ENCERRAMENTO'
              AND UPPER(COALESCE(c.tipo, '')) = 'ATENDIMENTO ON SITE'
              AND UPPER(COALESCE(c.gp_segmento, '')) IN ('PI-GOVERNO', 'PI-CORPORA')
              AND c.encerramento IS NOT NULL
              AND UPPER(COALESCE(c.ocorrencia_chamado, '')) <> 'NÃO DEFINIDO'
              {where_periodo}
            ORDER BY c.chamado, c.encerramento DESC NULLS LAST
            ON CONFLICT (chamado) DO UPDATE SET
                serie = COALESCE(EXCLUDED.serie, tb_encerrados_rrc.serie),
                descricao_material = COALESCE(EXCLUDED.descricao_material, tb_encerrados_rrc.descricao_material),
                equipamento = COALESCE(EXCLUDED.equipamento, tb_encerrados_rrc.equipamento),
                segmento = COALESCE(EXCLUDED.segmento, tb_encerrados_rrc.segmento),
                tipo = COALESCE(EXCLUDED.tipo, tb_encerrados_rrc.tipo),
                projeto = COALESCE(EXCLUDED.projeto, tb_encerrados_rrc.projeto),
                assistencia_codigo = COALESCE(EXCLUDED.assistencia_codigo, tb_encerrados_rrc.assistencia_codigo),
                assistencia_nome = COALESCE(EXCLUDED.assistencia_nome, tb_encerrados_rrc.assistencia_nome),
                ft = COALESCE(EXCLUDED.ft, tb_encerrados_rrc.ft),
                encerramento = COALESCE(EXCLUDED.encerramento, tb_encerrados_rrc.encerramento),
                encerramento_desc = COALESCE(EXCLUDED.encerramento_desc, tb_encerrados_rrc.encerramento_desc),
                tecnico_nome = COALESCE(EXCLUDED.tecnico_nome, tb_encerrados_rrc.tecnico_nome),
                texto_encerrado = COALESCE(EXCLUDED.texto_encerrado, tb_encerrados_rrc.texto_encerrado),
                ocorrencia_chamado = COALESCE(EXCLUDED.ocorrencia_chamado, tb_encerrados_rrc.ocorrencia_chamado);
        """
        logger.info("Executando sincronização de chamados para tb_encerrados_rrc...")
        with self.postgres._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query_sync)
                affected = cur.rowcount
            conn.commit()
        logger.info(f"Sincronização de tb_encerrados_rrc concluída: {affected} registros atualizados.")
        return affected

    def recalcular_indicadores_campanha(self) -> dict:
        """
        Aciona o motor de cálculo modular para apurar os meses da campanha ativa
        e consolidar a média de elegibilidade na tabela tb_apuracao_mensal.
        """
        try:
            from services.calculo_pontuacao import CalculoPontuacaoService
        except ImportError:
            try:
                from api.services.calculo_pontuacao import CalculoPontuacaoService
            except ImportError:
                from src.services.calculo_pontuacao import CalculoPontuacaoService
        calc = CalculoPontuacaoService(postgres_client=self.postgres)
        
        logger.info("Recalculando apuração analítica da campanha ativa...")
        return calc.calcular_campanha_ativa()

    def get_campanha_ativa(self) -> dict:
        """
        Obtém a campanha oficial ativa no banco de dados PostgreSQL.
        """
        from datetime import date
        with self.postgres._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id_campanha, data_inicio, data_fim, duracao_meses, ativa
                    FROM public.tb_campanha 
                    WHERE ativa = true 
                    ORDER BY id_campanha DESC 
                    LIMIT 1;
                """)
                row = cur.fetchone()
                if not row:
                    today = date.today()
                    start = today.replace(day=1)
                    return {"id_campanha": None, "data_inicio": start.strftime("%Y-%m-%d"), "data_fim": today.strftime("%Y-%m-%d")}
                
                is_dict = isinstance(row, dict)
                return {
                    "id_campanha": row.get("id_campanha") if is_dict else row[0],
                    "data_inicio": str(row.get("data_inicio") if is_dict else row[1]),
                    "data_fim": str(row.get("data_fim") if is_dict else row[2]),
                }

    def sync_campanha_incremental(self, dias_retroativos: int = 3) -> dict:
        """
        Rotina DIÁRIA: Sincronização incremental dos chamados e peças recentes da campanha ativa.
        Calcula os últimos dias_retroativos (D-3 a hoje) dentro da campanha ativa e sincroniza,
        executando o recálculo automático de pontuações e KPIs ao final.
        """
        from datetime import date, timedelta
        camp = self.get_campanha_ativa()
        today = date.today()
        d_inicio_dt = today - timedelta(days=dias_retroativos)
        
        # Não voltar antes do início oficial da campanha
        try:
            camp_ini = date.fromisoformat(camp["data_inicio"])
            if d_inicio_dt < camp_ini:
                d_inicio_dt = camp_ini
        except Exception:
            pass
            
        data_inicio = d_inicio_dt.strftime("%Y-%m-%d")
        data_fim = today.strftime("%Y-%m-%d")
        
        logger.info(f"Iniciando rotina DIÁRIA incremental da campanha ativa ({data_inicio} até {data_fim})...")
        return self.sync_all_tables(data_inicio=data_inicio, data_fim=data_fim)

    def sync_campanha_completa(self) -> dict:
        """
        Rotina SEMANAL: Reingestão completa de todo o período da campanha ativa no Postgres.
        Sobrescreve e atualiza todos os chamados da campanha desde o início oficial até a data atual,
        e recalcula todo o período da campanha de ponta a ponta.
        """
        from datetime import date
        camp = self.get_campanha_ativa()
        today = date.today()
        data_inicio = camp["data_inicio"]
        
        try:
            camp_fim = date.fromisoformat(camp["data_fim"])
            data_fim = today.strftime("%Y-%m-%d") if today < camp_fim else camp["data_fim"]
        except Exception:
            data_fim = today.strftime("%Y-%m-%d")
            
        logger.info(f"Iniciando rotina SEMANAL completa da campanha ativa ({data_inicio} até {data_fim})...")
        return self.sync_all_tables(data_inicio=data_inicio, data_fim=data_fim)

    def resolve_periodo(self, data_inicio: str = None, data_fim: str = None) -> tuple:
        """Resolve as datas de início e fim com base na campanha ativa se não informadas."""
        from datetime import date, timedelta
        if data_inicio and data_fim:
            return data_inicio, data_fim
        camp = self.get_campanha_ativa()
        today = date.today()
        d_inicio_dt = today - timedelta(days=3)
        try:
            camp_ini = date.fromisoformat(camp["data_inicio"])
            if d_inicio_dt < camp_ini:
                d_inicio_dt = camp_ini
        except Exception:
            pass
        return d_inicio_dt.strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d")

    def sync_step_chamados(self, data_inicio: str = None, data_fim: str = None, limit_per_table: int = None) -> dict:
        """Etapa 1 atômica: Extrai e grava a tabela de chamados (~8s)."""
        data_inicio, data_fim = self.resolve_periodo(data_inicio, data_fim)
        clean_inicio = data_inicio.replace("'", "''")
        clean_fim = data_fim.replace("'", "''")
        date_clause_chamados = f" AND ((ft >= '{clean_inicio} 00:00:00' AND ft <= '{clean_fim} 23:59:59') OR (encerramento >= '{clean_inicio} 00:00:00' AND encerramento <= '{clean_fim} 23:59:59'))"
        limit_clause = f" LIMIT {limit_per_table}" if limit_per_table else ""

        self.update_progress(15, "Extraindo e gravando Chamados (1/4)...", "Chamados")
        self.postgres.execute_query(f"DELETE FROM public.chamados WHERE 1=1{date_clause_chamados};")

        cols_chamados = """
            chamado, assistencia_centro_trabalho, assistencia_razao_social, tecnico_nome,
            ft, tipo_equipamento, projeto, sla_status, descricao_material, texto_encerrado,
            gp_desc, gp_segmento, ocorrencia_chamado, tipo,
            encerramento, encdesc, serie, material
        """
        q_chamados = f"SELECT {cols_chamados} FROM chamados WHERE chamado IS NOT NULL{date_clause_chamados}{limit_clause};"
        res_chamados = self.run_pipeline(query=q_chamados, target_table="chamados", conflict_column="chamado")
        if res_chamados.get("status") == "FAILED":
            raise Exception(f"Falha na tabela chamados: {res_chamados.get('error')}")

        sync_status_tracker["tables"]["chamados"] = {
            "status": "success",
            "rows": res_chamados["total_rows"],
            "seconds": res_chamados["elapsed_seconds"]
        }
        self.update_progress(35, f"Chamados concluídos ({res_chamados['total_rows']:,} registros)", "Chamados")
        return res_chamados

    def sync_step_reincidentes(self, data_inicio: str = None, data_fim: str = None, limit_per_table: int = None) -> dict:
        """Etapa 2 atômica: Extrai e grava a tabela de reincidentes (~4s)."""
        data_inicio, data_fim = self.resolve_periodo(data_inicio, data_fim)
        clean_inicio = data_inicio.replace("'", "''")
        clean_fim = data_fim.replace("'", "''")
        date_clause_rrc_pg = f" AND ((encerramento_rrc >= '{clean_inicio} 00:00:00' AND encerramento_rrc <= '{clean_fim} 23:59:59') OR (ft_rrc >= '{clean_inicio} 00:00:00' AND ft_rrc <= '{clean_fim} 23:59:59'))"
        date_clause_rrc = f"{date_clause_rrc_pg} AND (DATEDIFF(abertura_rrc, encerramento_anterior) <= 90 OR encerramento_anterior IS NULL)"
        limit_clause = f" LIMIT {limit_per_table}" if limit_per_table else ""

        self.update_progress(45, "Extraindo e gravando Reincidências (2/4)...", "Reincidências")
        self.postgres.execute_query(f"DELETE FROM public.reincidentes WHERE 1=1{date_clause_rrc_pg};")

        cols_reinc = """
            chamado_rrc, chamado_anterior, ft_rrc, ft_anterior, ct_anterior, ct_rrc,
            tecnico_nome_anterior, tecnico_nome_rrc, projeto_anterior, projeto_rrc,
            aplicado_peca_anterior, defeito_anterior, texto_encerrado_anterior, ocorrencia_chamado_anterior,
            defeito_rrc, texto_encerrado_rrc, texto_abertura_rrc, texto_abertura_anterior, ocorrencia_chamado_rrc,
            aplicado_peca_rrc, trocou_plm_anterior, trocou_plm_rrc, encerramento_anterior, encerramento_rrc,
            abertura_anterior, abertura_rrc, meses_rrc, classificacao, material_descricao_rrc, serie, segmento_rrc
        """
        q_reincidentes = f"SELECT {cols_reinc} FROM reincidentes WHERE chamado_rrc IS NOT NULL{date_clause_rrc}{limit_clause};"
        res_reincidentes = self.run_pipeline(query=q_reincidentes, target_table="reincidentes")
        if res_reincidentes.get("status") == "FAILED":
            raise Exception(f"Falha na tabela reincidentes: {res_reincidentes.get('error')}")

        sync_status_tracker["tables"]["reincidentes"] = {
            "status": "success",
            "rows": res_reincidentes["total_rows"],
            "seconds": res_reincidentes["elapsed_seconds"]
        }
        self.update_progress(65, f"Reincidências concluídas ({res_reincidentes['total_rows']:,} registros)", "Reincidências")
        return res_reincidentes

    @staticmethod
    def classificar_subgrupo_peca(cod_desc: str, grp_desc: str) -> str:
        """Classifica o subgrupo da peça em milissegundos via regex compilado em memória."""
        import re
        val = f"{cod_desc or ''} {grp_desc or ''}"
        if re.search(r'(PLM|PLACA M|MOTHERBOARD)', val, re.I): return 'Placa Mãe'
        if re.search(r'(MEMORIA|MEMÓRIA|\bDDR\b|\bRAM\b)', val, re.I): return 'Memória'
        if re.search(r'\bSSD\b', val, re.I): return 'SSD'
        if re.search(r'(HARD DISK|\bHD\b|\bHDD\b)', val, re.I): return 'HD'
        if re.search(r'(LCD|TELA|DISPLAY|PAINEL)', val, re.I): return 'Tela / LCD'
        if re.search(r'BATER', val, re.I): return 'Bateria'
        if re.search(r'TECL', val, re.I): return 'Teclado'
        if re.search(r'(TAMPA|TRASEIR|FRONT|DECO|FRAME|CARC)', val, re.I): return 'Gabinete / Carcaça'
        if re.search(r'(FONTE|CARREG|ADAPTADOR AC)', val, re.I): return 'Fonte / Carregador'
        if re.search(r'IMPR', val, re.I): return 'Impressora Térmica'
        if re.search(r'PROCESSADOR', val, re.I): return 'Processador'
        return grp_desc or 'Outros'

    def sync_step_pecas(self, data_inicio: str = None, data_fim: str = None, limit_per_table: int = None) -> dict:
        """Etapa 3 atômica: Extrai e grava a tabela de peças com filtro cirúrgico e alta performance (~12s)."""
        data_inicio, data_fim = self.resolve_periodo(data_inicio, data_fim)
        clean_inicio = data_inicio.replace("'", "''")
        clean_fim = data_fim.replace("'", "''")
        date_clause_ft = f" AND ft >= '{clean_inicio} 00:00:00' AND ft <= '{clean_fim} 23:59:59'"
        date_clause_rrc_pg = f" AND ((encerramento_rrc >= '{clean_inicio} 00:00:00' AND encerramento_rrc <= '{clean_fim} 23:59:59') OR (ft_rrc >= '{clean_inicio} 00:00:00' AND ft_rrc <= '{clean_fim} 23:59:59'))"
        limit_clause = f" LIMIT {limit_per_table}" if limit_per_table else ""

        self.update_progress(75, "Extraindo e gravando Peças (3/4)...", "Peças")

        # 1. DELETE ultra-rápido indexado por ft (~1s)
        self.postgres.execute_query(f"DELETE FROM public.pecas WHERE ft >= '{clean_inicio} 00:00:00' AND ft <= '{clean_fim} 23:59:59';")
        # 2. DELETE indexado por chamados de reincidentes (~0.5s)
        self.postgres.execute_query(f"""
            DELETE FROM public.pecas 
            WHERE chamado IN (
                SELECT chamado_anterior 
                FROM public.reincidentes 
                WHERE chamado_anterior IS NOT NULL 
                  AND UPPER(aplicado_peca_anterior) = 'SIM'
                  {date_clause_rrc_pg}
            );
        """)

        cols_pecas = """
            chamado, ft, tecnico_nome, grupo_mercadoria_desc, grupo_mercadoria,
            cod_solic_desc, cod_aplic_desc, tipo_equipamento, acao
        """
        reinc_pecas_clause = f"OR chamado IN (SELECT chamado_anterior FROM reincidentes WHERE chamado_anterior IS NOT NULL AND (UPPER(COALESCE(aplicado_peca_anterior, '')) = 'SIM'){date_clause_rrc_pg})"
        where_pecas = f"WHERE chamado IS NOT NULL AND ( (1=1{date_clause_ft}) {reinc_pecas_clause} )"

        q_pecas = f"SELECT {cols_pecas} FROM pecas {where_pecas}{limit_clause};"
        res_pecas = self.run_pipeline(query=q_pecas, target_table="pecas")
        if res_pecas.get("status") == "FAILED":
            raise Exception(f"Falha na tabela pecas: {res_pecas.get('error')}")

        sync_status_tracker["tables"]["pecas"] = {
            "status": "success",
            "rows": res_pecas["total_rows"],
            "seconds": res_pecas["elapsed_seconds"]
        }

        self.update_progress(88, f"Peças concluídas ({res_pecas['total_rows']:,} registros)", "Peças")
        return res_pecas

    def sync_step_consolidar(self, data_inicio: str = None, data_fim: str = None) -> dict:
        """Etapa 4 atômica: Cargas operacionais tb_chamado/tb_encerrados_rrc e recálculo dos KPIs (~12s)."""
        data_inicio, data_fim = self.resolve_periodo(data_inicio, data_fim)
        self.update_progress(90, "Atualizando base operacional de chamados...", "Processamento")
        novos_tb = self.sincronizar_tb_chamados()

        self.update_progress(93, "Atualizando base de Encerrados RRC...", "Processamento")
        novos_enc = self.sincronizar_tb_encerrados_rrc(data_inicio, data_fim)

        self.update_progress(96, "Recalculando apuração analítica da campanha...", "Cálculo Analítico")
        self.recalcular_indicadores_campanha()

        self.update_progress(100, "Sincronização concluída com sucesso! Todos os indicadores foram atualizados.", None)
        sync_status_tracker["status"] = "success"
        try:
            self.postgres.save_sync_status(sync_status_tracker)
        except Exception:
            pass

        return {
            "status": "SUCCESS",
            "novos_tb_chamados": novos_tb,
            "novos_encerrados_rrc": novos_enc
        }

    def sync_all_tables(
        self, 
        data_inicio: str = None, 
        data_fim: str = None, 
        limit_per_table: int = None
    ) -> dict:
        """
        Sincroniza as 3 tabelas operacionais do Databricks para o PostgreSQL filtradas por período
        executando os passos atômicos sequencialmente.
        """
        global sync_status_tracker
        start_all_time = time.time()
        
        # Validação preventiva de credenciais do Databricks antes de iniciar
        if not self.databricks.access_token:
            err_msg = (
                "DATABRICKS_ACCESS_TOKEN não configurado no ambiente Vercel. "
                "Cadastre a variável nas Environment Variables do projeto (escopo Production) e acione o Redeploy."
            )
            sync_status_tracker.update({
                "status": "failed",
                "error": err_msg,
                "step": "Falha de credenciais Databricks"
            })
            logger.error(err_msg)
            raise RuntimeError(err_msg)

        data_inicio, data_fim = self.resolve_periodo(data_inicio, data_fim)

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
        try:
            self.postgres.save_sync_status(sync_status_tracker)
        except Exception:
            pass

        results = {}
        try:
            results["chamados"] = self.sync_step_chamados(data_inicio, data_fim, limit_per_table)
            results["reincidentes"] = self.sync_step_reincidentes(data_inicio, data_fim, limit_per_table)
            results["pecas"] = self.sync_step_pecas(data_inicio, data_fim, limit_per_table)
            results["consolidacao"] = self.sync_step_consolidar(data_inicio, data_fim)
            return results
        except Exception as e:
            total_elapsed = round(time.time() - start_all_time, 2)
            err_msg = str(e)
            logger.error(f"Erro durante a sincronização: {err_msg}")
            
            sync_status_tracker.update({
                "status": "failed",
                "progress": 0,
                "step": f"Falha na sincronização: {err_msg}",
                "estimated_seconds_remaining": 0,
                "elapsed_seconds": total_elapsed,
                "error": err_msg
            })
            try:
                self.postgres.save_sync_status(sync_status_tracker)
            except Exception:
                pass
            raise e
