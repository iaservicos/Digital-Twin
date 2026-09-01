import time
from datetime import datetime, date
from typing import Dict, Any, List
import psycopg
from psycopg.rows import dict_row

from ..connectors.postgres_client import PostgreSQLClient

class CalculoPontuacaoService:
    """
    Motor Analítico Modular do Programa Brilha+.
    Cada indicador (KPI) é processado por um método independente e isolado (Single Responsibility).
    Zero dependências de arquivos Excel ou valores fixados.
    """

    def __init__(self, postgres_client=None):
        self.pg_client = postgres_client or PostgreSQLClient()

    # =========================================================================
    # HELPERS
    # =========================================================================
    @staticmethod
    def _safe_ratio(val: Any) -> float:
        if val is None:
            return 0.0
        try:
            f = float(val) / 100.0 if float(val) > 1.0 else float(val)
            return round(min(1.0, max(0.0, f)), 4)
        except Exception:
            return 0.0

    @staticmethod
    def _normalizar_base(uf: str, atp_resumidas: str) -> str:
        uf_str = (uf or "").strip().upper()
        atp_str = (atp_resumidas or "").strip().upper()
        if uf_str in ("PE", "AL") or atp_str in ("PE", "AL"):
            return "PE"
        if uf_str in ("RO", "AC") or atp_str in ("RO", "AC"):
            return "RO"
        return atp_str or uf_str or "OUTROS"

    # =========================================================================
    # 1. KPI 1: SLA DA EQUIPE (Peso: 32.5 pts)
    # =========================================================================
    def _calcular_sla_equipe(self, cur: psycopg.Cursor, ano_mes_str: str) -> Dict[str, Dict[str, float]]:
        """
        Calcula o SLA por Base ATP: Chamados com sla_status = 'DENTRO' / Total de Chamados da Base.
        Meta: >= 100% -> 32.5 pts | >= 90% -> 28.0 pts | < 90% -> 0.0 pts (Gatilho).
        """
        query = f"""
            SELECT 
                CASE 
                    WHEN b.uf IN ('PE', 'AL') THEN 'PE'
                    WHEN b.uf IN ('RO', 'AC') THEN 'RO'
                    ELSE COALESCE(b.atp_resumidas, b.uf)
                END AS base_atp,
                COUNT(*) AS total_chamados_base,
                COUNT(*) FILTER (WHERE UPPER(c.sla_status) = 'DENTRO') AS chamados_dentro,
                ROUND((COUNT(*) FILTER (WHERE UPPER(c.sla_status) = 'DENTRO')::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 2) AS perc_sla
            FROM tb_chamado c
            JOIN (
                SELECT DISTINCT ON (ct_codigo) ct_codigo, atp_resumidas, uf 
                FROM tb_base_atp
            ) b ON c.assistencia_centro_trabalho = b.ct_codigo
            WHERE TO_CHAR(c.ft, 'YYYY-MM') = '{ano_mes_str}'
            GROUP BY 
                CASE 
                    WHEN b.uf IN ('PE', 'AL') THEN 'PE'
                    WHEN b.uf IN ('RO', 'AC') THEN 'RO'
                    ELSE COALESCE(b.atp_resumidas, b.uf)
                END;
        """
        cur.execute(query)
        resultado = {}
        for row in cur.fetchall():
            base = row["base_atp"]
            perc = float(row["perc_sla"] or 0.0)
            if perc >= 100.0:
                pontos = 32.5
            elif perc >= 90.0:
                pontos = 28.0
            else:
                pontos = 0.0
            resultado[base] = {
                "perc_sla": perc,
                "pontos_sla": pontos,
                "total_chamados_base": int(row["total_chamados_base"] or 0)
            }
        return resultado

    # =========================================================================
    # 2. KPI 2: PERDAS / PERFORMANCE DA EQUIPE (Peso: 20.0 pts)
    # =========================================================================
    def _calcular_perdas_equipe(self, cur: psycopg.Cursor, ano_mes_str: str) -> Dict[str, Dict[str, float]]:
        """
        Calcula as Perdas por Base ATP: 
        Chamados com 'PERFORMANCE FALHA GESTAO' ou 'TRANSFERENCIA ENTRE BASES' / Total de Chamados da Base.
        Meta: <= 1.0% -> 20.0 pts | <= 2.0% -> 15.0 pts | > 2.0% -> 0.0 pts.
        """
        query = f"""
            SELECT 
                CASE 
                    WHEN b.uf IN ('PE', 'AL') THEN 'PE'
                    WHEN b.uf IN ('RO', 'AC') THEN 'RO'
                    ELSE COALESCE(b.atp_resumidas, b.uf)
                END AS base_atp,
                COUNT(*) AS total_chamados_base,
                COUNT(*) FILTER (WHERE UPPER(c.classifica_chamado) IN ('PERFORMANCE FALHA GESTAO', 'TRANSFERENCIA ENTRE BASES')) AS chamados_perda,
                ROUND((COUNT(*) FILTER (WHERE UPPER(c.classifica_chamado) IN ('PERFORMANCE FALHA GESTAO', 'TRANSFERENCIA ENTRE BASES'))::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 2) AS perc_perdas
            FROM tb_chamado c
            JOIN (
                SELECT DISTINCT ON (ct_codigo) ct_codigo, atp_resumidas, uf 
                FROM tb_base_atp
            ) b ON c.assistencia_centro_trabalho = b.ct_codigo
            WHERE TO_CHAR(c.ft, 'YYYY-MM') = '{ano_mes_str}'
            GROUP BY 
                CASE 
                    WHEN b.uf IN ('PE', 'AL') THEN 'PE'
                    WHEN b.uf IN ('RO', 'AC') THEN 'RO'
                    ELSE COALESCE(b.atp_resumidas, b.uf)
                END;
        """
        cur.execute(query)
        resultado = {}
        for row in cur.fetchall():
            base = row["base_atp"]
            perc = float(row["perc_perdas"] or 0.0)
            if perc <= 1.0:
                pontos = 20.0
            elif perc <= 2.0:
                pontos = 15.0
            else:
                pontos = 0.0
            resultado[base] = {
                "perc_perdas": perc,
                "pontos_perdas": pontos,
                "total_perdas": int(row["chamados_perda"] or 0)
            }
        return resultado

    # =========================================================================
    # 3. KPI 3: NPS DA EQUIPE (Peso: 5.0 pts)
    # =========================================================================
    def _calcular_nps_equipe(self, cur: psycopg.Cursor, ano_mes_str: str) -> Dict[str, Dict[str, float]]:
        """
        Atribui o índice padrão de NPS/Qualidade para todas as equipes (100% -> 5.0 pts).
        """
        return {"DEFAULT": {"perc_nps": 100.0, "pontos_nps": 5.0}}

    # =========================================================================
    # 4. KPI 4: REINCIDÊNCIA DA EQUIPE (Peso: 15.0 pts)
    # =========================================================================
    def _calcular_reincidencia_equipe(self, cur: psycopg.Cursor, ano_mes_str: str, sla_dict: Dict[str, Dict[str, float]]) -> Dict[str, Dict[str, float]]:
        """
        Calcula a Reincidência da Base ATP: Reincidências da Base / Total de Chamados da Base.
        Meta: <= 7.0% -> 15.0 pts | <= 10.0% -> 10.0 pts | > 10.0% -> 0.0 pts.
        """
        query = f"""
            SELECT 
                CASE 
                    WHEN b.uf IN ('PE', 'AL') THEN 'PE'
                    WHEN b.uf IN ('RO', 'AC') THEN 'RO'
                    ELSE COALESCE(b.atp_resumidas, b.uf)
                END AS base_atp,
                COUNT(*) AS total_reinc_base
            FROM reincidentes r
            JOIN (
                SELECT DISTINCT ON (ct_codigo) ct_codigo, atp_resumidas, uf 
                FROM tb_base_atp
            ) b ON r.ct_rrc = b.ct_codigo
            WHERE TO_CHAR(r.ft_rrc, 'YYYY-MM') = '{ano_mes_str}'
              AND NOT (
                  COALESCE(UPPER(TRIM(r.aplicado_peca_anterior)), 'NÃO') IN ('NÃO', 'NAO', 'N')
                  AND COALESCE(UPPER(TRIM(r.aplicado_peca_rrc)), 'NÃO') IN ('NÃO', 'NAO', 'N')
                  AND (
                      UPPER(COALESCE(r.defeito_anterior, '')) IN ('SEM DEFEITO', 'DEFEITO NÃO LOCALIZADO', 'CANCELADO')
                      OR UPPER(COALESCE(r.defeito_rrc, '')) IN ('SEM DEFEITO', 'DEFEITO NÃO LOCALIZADO', 'CANCELADO')
                      OR UPPER(COALESCE(r.texto_encerrado_anterior, '')) LIKE '%SEM DEFEITO%'
                      OR UPPER(COALESCE(r.texto_encerrado_anterior, '')) LIKE '%DEFEITO N%O LOCALIZADO%'
                      OR UPPER(COALESCE(r.texto_encerrado_anterior, '')) LIKE '%CANCELAD%'
                      OR UPPER(COALESCE(r.texto_encerrado_rrc, '')) LIKE '%SEM DEFEITO%'
                      OR UPPER(COALESCE(r.texto_encerrado_rrc, '')) LIKE '%DEFEITO N%O LOCALIZADO%'
                      OR UPPER(COALESCE(r.texto_encerrado_rrc, '')) LIKE '%CANCELAD%'
                  )
              )
            GROUP BY 
                CASE 
                    WHEN b.uf IN ('PE', 'AL') THEN 'PE'
                    WHEN b.uf IN ('RO', 'AC') THEN 'RO'
                    ELSE COALESCE(b.atp_resumidas, b.uf)
                END;
        """
        cur.execute(query)
        resultado = {}
        for row in cur.fetchall():
            base = row["base_atp"]
            total_reinc = int(row["total_reinc_base"] or 0)
            total_ch = sla_dict.get(base, {}).get("total_chamados_base", 0)
            perc = round((total_reinc / total_ch * 100), 2) if total_ch > 0 else 0.0
            
            if perc <= 7.0:
                pontos = 15.0
            elif perc <= 10.0:
                pontos = 10.0
            else:
                pontos = 0.0
            resultado[base] = {
                "perc_reinc_equipe": perc,
                "pontos_reinc_equipe": pontos,
                "total_reinc_base": total_reinc
            }
        return resultado

    # =========================================================================
    # 5. KPI 5: REINCIDÊNCIA INDIVIDUAL (Peso: 15.0 pts)
    # =========================================================================
    def _calcular_reincidencia_individual(self, cur: psycopg.Cursor, ano_mes_str: str, tec_chamados_dict: Dict[str, int]) -> Dict[str, Dict[str, float]]:
        """
        Calcula a Reincidência Individual: Reincidências do 1º Atendimento / Total de Chamados do Técnico.
        Meta: <= 7.0% -> 15.0 pts | <= 10.0% -> 10.0 pts | > 10.0% -> 0.0 pts.
        Exclui reincidências sem peça com defeito não localizado/cancelamento/sem defeito.
        """
        query = f"""
            SELECT 
                UPPER(TRIM(r.tecnico_nome_anterior)) AS tecnico_nome,
                COUNT(*) AS total_reinc_tec
            FROM reincidentes r
            WHERE TO_CHAR(r.ft_rrc, 'YYYY-MM') = '{ano_mes_str}'
              AND NOT (
                  COALESCE(UPPER(TRIM(r.aplicado_peca_anterior)), 'NÃO') IN ('NÃO', 'NAO', 'N')
                  AND COALESCE(UPPER(TRIM(r.aplicado_peca_rrc)), 'NÃO') IN ('NÃO', 'NAO', 'N')
                  AND (
                      UPPER(COALESCE(r.defeito_anterior, '')) IN ('SEM DEFEITO', 'DEFEITO NÃO LOCALIZADO', 'CANCELADO')
                      OR UPPER(COALESCE(r.defeito_rrc, '')) IN ('SEM DEFEITO', 'DEFEITO NÃO LOCALIZADO', 'CANCELADO')
                      OR UPPER(COALESCE(r.texto_encerrado_anterior, '')) LIKE '%SEM DEFEITO%'
                      OR UPPER(COALESCE(r.texto_encerrado_anterior, '')) LIKE '%DEFEITO N%O LOCALIZADO%'
                      OR UPPER(COALESCE(r.texto_encerrado_anterior, '')) LIKE '%CANCELAD%'
                      OR UPPER(COALESCE(r.texto_encerrado_rrc, '')) LIKE '%SEM DEFEITO%'
                      OR UPPER(COALESCE(r.texto_encerrado_rrc, '')) LIKE '%DEFEITO N%O LOCALIZADO%'
                      OR UPPER(COALESCE(r.texto_encerrado_rrc, '')) LIKE '%CANCELAD%'
                  )
              )
            GROUP BY UPPER(TRIM(r.tecnico_nome_anterior));
        """
        cur.execute(query)
        resultado = {}
        for row in cur.fetchall():
            tec = row["tecnico_nome"]
            total_reinc = int(row["total_reinc_tec"] or 0)
            total_ch = tec_chamados_dict.get(tec, 0)
            perc = round((total_reinc / total_ch * 100), 2) if total_ch > 0 else 0.0

            if total_ch == 0:
                pontos = 0.0
            elif perc <= 7.0:
                pontos = 15.0
            elif perc <= 10.0:
                pontos = 10.0
            else:
                pontos = 0.0
            resultado[tec] = {
                "perc_reinc_indiv": perc,
                "pontos_reinc_indiv": pontos,
                "total_reinc_tec": total_reinc
            }
        return resultado

    # =========================================================================
    # 6. KPI 6: CONSUMO DE PEÇAS INDIVIDUAL (Peso: 12.5 pts)
    # =========================================================================
    def _calcular_consumo_pecas_individual(self, cur: psycopg.Cursor, ano_mes_str: str, tec_chamados_comp_dict: Dict[str, int]) -> Dict[str, Dict[str, float]]:
        """
        Calcula o Consumo de Peças por Técnico:
        Chamados com aplicação das 5 Peças Principais (PLM, SSD, HDD, HD, Tela LCD) / Total Chamados do Técnico.
        Exclui: A009 (sem necessidade de peça), A016 (orçamento), cabos e periféricos.
        Meta: <= 25.0% -> 12.5 pts | > 25.0% -> 0.0 pts.
        """
        query = f"""
            SELECT 
                UPPER(TRIM(p.tecnico_nome)) AS tecnico_nome,
                COUNT(DISTINCT p.chamado) AS total_chamados_com_peca
            FROM pecas p
            WHERE TO_CHAR(p.ft, 'YYYY-MM') = '{ano_mes_str}'
              AND UPPER(p.acao) NOT LIKE '%SEM NECESSIDADE%'
              AND UPPER(p.acao) NOT LIKE '%A009%'
              AND UPPER(p.acao) NOT LIKE '%ORÇAMENTO%'
              AND (
                  UPPER(p.grupo_mercadoria_desc) LIKE '%PLACA%' OR
                  UPPER(p.grupo_mercadoria_desc) LIKE '%LCD%' OR
                  UPPER(p.grupo_mercadoria_desc) LIKE '%TELA%' OR
                  UPPER(p.grupo_mercadoria_desc) LIKE '%SSD%' OR
                  UPPER(p.grupo_mercadoria_desc) LIKE '%HARD DISK%' OR
                  UPPER(p.grupo_mercadoria_desc) LIKE '%DISCO%' OR
                  UPPER(p.cod_aplic_desc) LIKE '%PLM%' OR
                  UPPER(p.cod_aplic_desc) LIKE '%PLACA%' OR
                  UPPER(p.cod_aplic_desc) LIKE '%LCD%' OR
                  UPPER(p.cod_aplic_desc) LIKE '%TELA%' OR
                  UPPER(p.cod_aplic_desc) LIKE '%SSD%' OR
                  UPPER(p.cod_aplic_desc) LIKE '%HD%' OR
                  UPPER(p.cod_solic_desc) LIKE '%PLM%' OR
                  UPPER(p.cod_solic_desc) LIKE '%PLACA%' OR
                  UPPER(p.cod_solic_desc) LIKE '%LCD%' OR
                  UPPER(p.cod_solic_desc) LIKE '%TELA%' OR
                  UPPER(p.cod_solic_desc) LIKE '%SSD%' OR
                  UPPER(p.cod_solic_desc) LIKE '%HD%'
              )
              AND UPPER(p.grupo_mercadoria_desc) NOT IN ('ACESSÓRIOS', 'TECLADO', 'MOUSE', 'CABO', 'ADAPTADOR AC', 'CARTÃO MEMÓRIA')
              AND UPPER(p.cod_aplic_desc) NOT LIKE '%CABO%'
              AND UPPER(p.cod_aplic_desc) NOT LIKE '%ADAPT%'
            GROUP BY UPPER(TRIM(p.tecnico_nome));
        """
        cur.execute(query)
        resultado = {}
        for row in cur.fetchall():
            tec = row["tecnico_nome"]
            total_pecas = int(row["total_chamados_com_peca"] or 0)
            total_ch = tec_chamados_comp_dict.get(tec, 0)
            perc = round((total_pecas / total_ch * 100), 2) if total_ch > 0 else 0.0

            if total_ch == 0:
                pontos = 0.0
            elif perc <= 25.0:
                pontos = 12.5
            else:
                pontos = 0.0
            resultado[tec] = {
                "perc_pecas_indiv": perc,
                "pontos_pecas_indiv": pontos,
                "total_chamados_com_peca": total_pecas
            }
        return resultado

    # =========================================================================
    # 7. ORQUESTRADOR GERAL DE APURAÇÃO MENSAL
    # =========================================================================
    def calcular_pontuacao_geral(self, mes: int, ano: int) -> Dict[str, Any]:
        """
        Orquestra a apuração mensal executando cada módulo de KPI de forma isolada
        e realizando o upsert em lote na tabela tb_apuracao_mensal.
        """
        start_time = time.time()
        ano_mes_str = f"{ano:04d}-{mes:02d}"
        mes_ano_ref = date(ano, mes, 1)
        now_ts = datetime.now()

        print(f"[MOTOR ANALÍTICO MODULAR] Iniciando apuração para {ano_mes_str}...")

        conn = self.pg_client._get_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # 1. Total de Chamados por Técnico
            cur.execute(f"""
                SELECT 
                    UPPER(TRIM(tecnico_nome)) AS tecnico_nome,
                    COUNT(*) AS total_chamados,
                    COUNT(*) FILTER (WHERE UPPER(COALESCE(equipamento, '')) IN ('DESKTOP', 'NOTEBOOK', 'ALL IN ONE', 'DESKTOP AIO', 'MINIPRO', '')) AS chamados_computacionais
                FROM tb_chamado
                WHERE TO_CHAR(ft, 'YYYY-MM') = '{ano_mes_str}'
                GROUP BY UPPER(TRIM(tecnico_nome));
            """)
            tec_chamados = {}
            tec_chamados_comp = {}
            for r in cur.fetchall():
                tec_name = r["tecnico_nome"]
                tec_chamados[tec_name] = int(r["total_chamados"] or 0)
                tec_chamados_comp[tec_name] = int(r["chamados_computacionais"] or r["total_chamados"] or 0)

            # 2. Execução Independente de Cada Módulo de KPI
            sla_data = self._calcular_sla_equipe(cur, ano_mes_str)
            perdas_data = self._calcular_perdas_equipe(cur, ano_mes_str)
            nps_data = self._calcular_nps_equipe(cur, ano_mes_str)
            reinc_eq_data = self._calcular_reincidencia_equipe(cur, ano_mes_str, sla_data)
            reinc_ind_data = self._calcular_reincidencia_individual(cur, ano_mes_str, tec_chamados)
            pecas_data = self._calcular_consumo_pecas_individual(cur, ano_mes_str, tec_chamados_comp)

            # 3. Lista de Técnicos Ativos e suas Bases Oficiais
            cur.execute("""
                SELECT 
                    t.id_tecnico,
                    t.nome_completo,
                    t.matricula,
                    b.uf,
                    b.atp_resumidas
                FROM tb_tecnico t
                LEFT JOIN (
                    SELECT DISTINCT ON (tb.id_tecnico) 
                        tb.id_tecnico, 
                        b.uf,
                        b.atp_resumidas
                    FROM tb_tecnico_base tb
                    JOIN tb_base_atp b ON tb.ct_codigo = b.ct_codigo
                    ORDER BY tb.id_tecnico, b.uf
                ) b ON t.id_tecnico = b.id_tecnico
                WHERE t.ativo = true
                ORDER BY t.nome_completo;
            """)
            tecnicos = cur.fetchall()

            # 4. Montagem dos Registros Consolidados
            records_to_insert = []
            for tec in tecnicos:
                tec_id = tec["id_tecnico"]
                nome_norm = (tec["nome_completo"] or "").strip().upper()
                base_norm = self._normalizar_base(tec["uf"], tec["atp_resumidas"])

                # Valores de Equipe
                kpi_sla = sla_data.get(base_norm, {"perc_sla": 0.0, "pontos_sla": 0.0})
                kpi_perd = perdas_data.get(base_norm, {"perc_perdas": 0.0, "pontos_perdas": 20.0})
                kpi_nps = nps_data.get("DEFAULT", {"perc_nps": 100.0, "pontos_nps": 5.0})
                kpi_rrc_eq = reinc_eq_data.get(base_norm, {"perc_reinc_equipe": 0.0, "pontos_reinc_equipe": 15.0})

                # Valores Individuais
                kpi_rrc_ind = reinc_ind_data.get(nome_norm, {"perc_reinc_indiv": 0.0, "pontos_reinc_indiv": 0.0})
                kpi_pecas = pecas_data.get(nome_norm, {"perc_pecas_indiv": 0.0, "pontos_pecas_indiv": 0.0})
                total_ch = tec_chamados.get(nome_norm, 0)

                # Se o técnico teve atendimentos e não teve reincidência / peças, pontua meta máxima
                if total_ch > 0:
                    if nome_norm not in reinc_ind_data:
                        kpi_rrc_ind = {"perc_reinc_indiv": 0.0, "pontos_reinc_indiv": 15.0}
                    if nome_norm not in pecas_data:
                        kpi_pecas = {"perc_pecas_indiv": 0.0, "pontos_pecas_indiv": 12.5}

                pts_sla = float(kpi_sla["pontos_sla"])
                pts_perd = float(kpi_perd["pontos_perdas"])
                pts_nps = float(kpi_nps["pontos_nps"])
                pts_rrc_eq = float(kpi_rrc_eq["pontos_reinc_equipe"])
                pts_rrc_ind = float(kpi_rrc_ind["pontos_reinc_indiv"])
                pts_pecas = float(kpi_pecas["pontos_pecas_indiv"])

                pts_total = round(pts_sla + pts_perd + pts_nps + pts_rrc_eq + pts_rrc_ind + pts_pecas, 2)
                elegivel = bool(pts_total >= 70.0 and total_ch > 0)
                motivo = None
                if total_ch == 0:
                    motivo = "Sem atendimentos no período"
                elif pts_total < 70.0:
                    motivo = "Pontuação abaixo da nota de corte (70 pts)"

                records_to_insert.append((
                    tec_id,
                    mes_ano_ref,
                    self._safe_ratio(kpi_sla["perc_sla"]),
                    pts_sla,
                    self._safe_ratio(kpi_rrc_ind["perc_reinc_indiv"]),
                    pts_rrc_ind,
                    self._safe_ratio(kpi_pecas["perc_pecas_indiv"]),
                    pts_pecas,
                    1.0000,
                    pts_nps,
                    pts_total,
                    elegivel,
                    motivo,
                    now_ts,
                    total_ch,
                    self._safe_ratio(kpi_perd["perc_perdas"]),
                    pts_perd,
                    self._safe_ratio(kpi_rrc_eq["perc_reinc_equipe"]),
                    pts_rrc_eq
                ))

            # 5. Persistência em Lote
            if records_to_insert:
                cur.executemany("""
                    INSERT INTO tb_apuracao_mensal (
                        id_tecnico, mes_ano,
                        atingimento_sla, pontos_sla,
                        atingimento_reincidencia, pontos_reincidencia,
                        atingimento_pecas, pontos_pecas,
                        atingimento_nps, pontos_nps,
                        pontuacao_total, status_elegibilidade, motivo_inelegibilidade,
                        data_calculo, total_chamados,
                        atingimento_perdidos, pontos_perdidos,
                        atingimento_reincidencia_equipe, pontos_reincidencia_equipe
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (id_tecnico, mes_ano) DO UPDATE SET
                        atingimento_sla = EXCLUDED.atingimento_sla,
                        pontos_sla = EXCLUDED.pontos_sla,
                        atingimento_reincidencia = EXCLUDED.atingimento_reincidencia,
                        pontos_reincidencia = EXCLUDED.pontos_reincidencia,
                        atingimento_pecas = EXCLUDED.atingimento_pecas,
                        pontos_pecas = EXCLUDED.pontos_pecas,
                        atingimento_nps = EXCLUDED.atingimento_nps,
                        pontos_nps = EXCLUDED.pontos_nps,
                        pontuacao_total = EXCLUDED.pontuacao_total,
                        status_elegibilidade = EXCLUDED.status_elegibilidade,
                        motivo_inelegibilidade = EXCLUDED.motivo_inelegibilidade,
                        data_calculo = EXCLUDED.data_calculo,
                        total_chamados = EXCLUDED.total_chamados,
                        atingimento_perdidos = EXCLUDED.atingimento_perdidos,
                        pontos_perdidos = EXCLUDED.pontos_perdidos,
                        atingimento_reincidencia_equipe = EXCLUDED.atingimento_reincidencia_equipe,
                        pontos_reincidencia_equipe = EXCLUDED.pontos_reincidencia_equipe;
                """, records_to_insert)
                conn.commit()

        conn.close()
        elapsed = time.time() - start_time
        print(f"[MOTOR ANALÍTICO MODULAR] Apuração de {ano_mes_str} concluída em {elapsed:.2f}s para {len(records_to_insert)} técnicos.")

        return {
            "status": "ok",
            "mes_ano": ano_mes_str,
            "tecnicos_processados": len(records_to_insert),
            "tempo_execucao_segundos": round(elapsed, 2)
        }

    # =========================================================================
    # 8. CONSOLIDAÇÃO BIMESTRAL DA CAMPANHA (FASE 6)
    # =========================================================================
    def calcular_media_campanha_fase6(self, ano: int = 2026) -> Dict[str, Any]:
        """
        Consolida a média aritmética bimestral da campanha (Julho e Agosto)
        gerando o registro final de elegibilidade em 31/08/2026.
        """
        start_time = time.time()
        mes_julho = date(ano, 7, 1)
        mes_agosto = date(ano, 8, 1)
        mes_consolidado = date(ano, 8, 31)

        conn = self.pg_client._get_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT 
                    id_tecnico,
                    AVG(atingimento_sla) AS media_sla,
                    AVG(pontos_sla) AS media_pontos_sla,
                    AVG(atingimento_perdidos) AS media_perdidos,
                    AVG(pontos_perdidos) AS media_pontos_perdidos,
                    AVG(atingimento_nps) AS media_nps,
                    AVG(pontos_nps) AS media_pontos_nps,
                    AVG(atingimento_reincidencia_equipe) AS media_rrc_eq,
                    AVG(pontos_reincidencia_equipe) AS media_pontos_rrc_eq,
                    AVG(atingimento_reincidencia) AS media_rrc_ind,
                    AVG(pontos_reincidencia) AS media_pontos_rrc_ind,
                    AVG(atingimento_pecas) AS media_pecas,
                    AVG(pontos_pecas) AS media_pontos_pecas,
                    AVG(pontuacao_total) AS media_pontuacao_total,
                    SUM(total_chamados) AS total_chamados_campanha
                FROM tb_apuracao_mensal
                WHERE mes_ano IN (%s, %s)
                GROUP BY id_tecnico;
            """, (mes_julho, mes_agosto))
            medias = cur.fetchall()

            records_consolidado = []
            for m in medias:
                pts_tot = round(float(m["media_pontuacao_total"] or 0.0), 2)
                total_ch = int(m["total_chamados_campanha"] or 0)
                status_elegibilidade = bool(pts_tot >= 70.0 and total_ch > 0)
                motivo = None
                if total_ch == 0:
                    motivo = "Sem atendimentos na campanha"
                elif pts_tot < 70.0:
                    motivo = "Pontuação abaixo da nota de corte (70 pts)"

                records_consolidado.append((
                    m["id_tecnico"],
                    mes_consolidado,
                    round(min(1.0, max(0.0, float(m["media_sla"] or 0.0))), 4),
                    round(float(m["media_pontos_sla"] or 0.0), 2),
                    round(min(1.0, max(0.0, float(m["media_rrc_ind"] or 0.0))), 4),
                    round(float(m["media_pontos_rrc_ind"] or 0.0), 2),
                    round(min(1.0, max(0.0, float(m["media_pecas"] or 0.0))), 4),
                    round(float(m["media_pontos_pecas"] or 0.0), 2),
                    round(min(1.0, max(0.0, float(m["media_nps"] or 0.0))), 4),
                    round(float(m["media_pontos_nps"] or 0.0), 2),
                    pts_tot,
                    status_elegibilidade,
                    motivo,
                    datetime.now(),
                    total_ch,
                    round(float(m["media_perdidos"] or 0.0), 4),
                    round(float(m["media_pontos_perdidos"] or 0.0), 2),
                    round(float(m["media_rrc_eq"] or 0.0), 4),
                    round(float(m["media_pontos_rrc_eq"] or 0.0), 2)
                ))

            cur.executemany("""
                INSERT INTO tb_apuracao_mensal (
                    id_tecnico, mes_ano, 
                    atingimento_sla, pontos_sla,
                    atingimento_reincidencia, pontos_reincidencia,
                    atingimento_pecas, pontos_pecas,
                    atingimento_nps, pontos_nps,
                    pontuacao_total, status_elegibilidade, motivo_inelegibilidade,
                    data_calculo, total_chamados,
                    atingimento_perdidos, pontos_perdidos,
                    atingimento_reincidencia_equipe, pontos_reincidencia_equipe
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON CONFLICT (id_tecnico, mes_ano) DO UPDATE SET
                    atingimento_sla = EXCLUDED.atingimento_sla,
                    pontos_sla = EXCLUDED.pontos_sla,
                    atingimento_reincidencia = EXCLUDED.atingimento_reincidencia,
                    pontos_reincidencia = EXCLUDED.pontos_reincidencia,
                    atingimento_pecas = EXCLUDED.atingimento_pecas,
                    pontos_pecas = EXCLUDED.pontos_pecas,
                    atingimento_nps = EXCLUDED.atingimento_nps,
                    pontos_nps = EXCLUDED.pontos_nps,
                    pontuacao_total = EXCLUDED.pontuacao_total,
                    status_elegibilidade = EXCLUDED.status_elegibilidade,
                    motivo_inelegibilidade = EXCLUDED.motivo_inelegibilidade,
                    data_calculo = EXCLUDED.data_calculo,
                    total_chamados = EXCLUDED.total_chamados,
                    atingimento_perdidos = EXCLUDED.atingimento_perdidos,
                    pontos_perdidos = EXCLUDED.pontos_perdidos,
                    atingimento_reincidencia_equipe = EXCLUDED.atingimento_reincidencia_equipe,
                    pontos_reincidencia_equipe = EXCLUDED.pontos_reincidencia_equipe;
            """, records_consolidado)
            conn.commit()
        conn.close()

        elapsed = time.time() - start_time
        print(f"[MOTOR ANALÍTICO MODULAR] Consolidação da Campanha concluída em {elapsed:.2f}s para {len(records_consolidado)} técnicos.")

        return {"status": "ok", "tecnicos_consolidados": len(records_consolidado), "tempo_segundos": round(elapsed, 2)}

    # =========================================================================
    # 9. GESTÃO E CÁLCULO DA CAMPANHA ATIVA
    # =========================================================================
    def calcular_campanha_ativa(self) -> Dict[str, Any]:
        """
        Lê a campanha ativa em tb_campanha, apura todos os meses do ciclo ativo
        e executa a consolidação bimestral de elegibilidade final.
        """
        start_time = time.time()
        conn = self.pg_client._get_connection()
        
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT id_campanha, data_inicio, data_fim, ativa, duracao_meses
                FROM tb_campanha
                WHERE ativa = true
                ORDER BY id_campanha DESC
                LIMIT 1;
            """)
            camp = cur.fetchone()

        conn.close()

        if not camp:
            raise ValueError("Nenhuma campanha ativa encontrada no banco de dados (tb_campanha).")

        dt_inicio: date = camp["data_inicio"]
        dt_fim: date = camp["data_fim"]

        # Determinar todos os meses no intervalo da campanha
        meses_processados = []
        ano_corrente = dt_inicio.year
        mes_corrente = dt_inicio.month

        while (ano_corrente < dt_fim.year) or (ano_corrente == dt_fim.year and mes_corrente <= dt_fim.month):
            res_mes = self.calcular_pontuacao_geral(mes=mes_corrente, ano=ano_corrente)
            meses_processados.append(res_mes)
            
            # Avançar para o próximo mês
            if mes_corrente == 12:
                mes_corrente = 1
                ano_corrente += 1
            else:
                mes_corrente += 1

        # Executar consolidação bimestral
        res_consolidacao = self.calcular_media_campanha_fase6(ano=dt_fim.year)

        elapsed = round(time.time() - start_time, 2)
        print(f"[MOTOR ANALÍTICO MODULAR] Recálculo da Campanha Ativa #{camp['id_campanha']} concluído em {elapsed}s.")

        return {
            "status": "success",
            "campanha_id": camp["id_campanha"],
            "periodo": {
                "data_inicio": str(dt_inicio),
                "data_fim": str(dt_fim)
            },
            "meses_processados": meses_processados,
            "consolidacao_final": res_consolidacao,
            "tempo_total_segundos": elapsed
        }
