"""
Serviço de Ingestão de Planilhas (Excel/CSV) - Digital Twin / Brilha+.
Processa assincronamente as 4 planilhas operacionais:
1. BaseDL (tb_chamado & chamados)
2. Parts (tb_consumo_peca & pecas)
3. Reincidencia (tb_reincidencia & reincidentes)
4. EncerradosRRC (tb_reincidencia_encerrados)
Acompanha o progresso em tempo real e aciona o motor analítico pós-processamento.
"""

import io
import os
import time
import logging
import unicodedata
from datetime import datetime
from typing import Dict, Any, List, Optional
import pandas as pd
import psycopg
from psycopg.rows import dict_row

from src.connectors.postgres_client import PostgreSQLClient
from src.services.calculo_pontuacao import CalculoPontuacaoService

logger = logging.getLogger(__name__)

# Rastreador global de progresso para tarefas de upload
task_progress: Dict[str, Dict[str, Any]] = {}


def normalize_column_name(col: Any) -> str:
    """Normaliza o nome da coluna removendo acentos, espaços extras e forçando minúsculo."""
    s = unicodedata.normalize('NFKD', str(col)).encode('ASCII', 'ignore').decode('utf-8')
    return s.strip().lower().replace(' ', '_')


class SpreadsheetIngestService:
    def __init__(self, postgres_client: Optional[PostgreSQLClient] = None) -> None:
        self.pg_client = postgres_client or PostgreSQLClient()

    def get_progress(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Retorna o estado atual da tarefa de importação."""
        return task_progress.get(task_id)

    def _auto_recalcular(self) -> None:
        """Dispara o recálculo analítico dos KPIs de forma silenciosa e resiliente."""
        try:
            logger.info("Iniciando auto-recálculo pós-ingestão de planilha...")
            calc_service = CalculoPontuacaoService(postgres_client=self.pg_client)
            calc_service.calcular_campanha_ativa()
            logger.info("Auto-recálculo concluído com sucesso!")
        except Exception as e:
            logger.warning(f"Aviso no auto-recálculo da campanha: {e}")

    # =========================================================================
    # 1. PROCESSAMENTO BASE DL (tb_chamado)
    # =========================================================================
    def process_base_dl(self, task_id: str, file_contents: bytes) -> None:
        """
        Processa a planilha principal Base DL e popula tb_chamado (e chamados).
        """
        try:
            task_progress[task_id] = {
                "status": "processing", 
                "progress": 5, 
                "message": "Lendo planilha Base DL...",
                "timestamp": datetime.utcnow().isoformat()
            }

            try:
                df = pd.read_excel(io.BytesIO(file_contents), sheet_name=0)
            except Exception:
                df = pd.read_csv(io.BytesIO(file_contents), sep=None, engine='python')

            # Mapeamento flexível de colunas (case-insensitive)
            col_map = {normalize_column_name(c): c for c in df.columns}
            
            required_cols = {
                'chamado': 'Chamado',
                'projeto': 'Projeto',
                'ft': 'FT',
                'sla_status': 'SLA_status',
                'equipamento': 'Equipamento',
                'material_descricao': 'Material_descricao',
                'comercial': 'Comercial',
                'assistencia_centro_trabalho': 'Assistencia_centro_trabalho',
                'assistencia_nome': 'Assistencia_nome',
                'tecnico_nome': 'Tecnico_nome',
                'texto_encerrado': 'Texto_encerrado',
                'reincidente': 'Reincidente',
                'classifica_chamado': 'Classifica_chamado'
            }

            missing = [req_key for req_key in required_cols if req_key not in col_map]
            if missing:
                # Tenta variações aceitas
                if 'assistencia_razao_social' in col_map and 'assistencia_nome' in missing:
                    col_map['assistencia_nome'] = col_map['assistencia_razao_social']
                    missing.remove('assistencia_nome')
                if 'tipo_equipamento' in col_map and 'equipamento' in missing:
                    col_map['equipamento'] = col_map['tipo_equipamento']
                    missing.remove('equipamento')
                if 'descricao_material' in col_map and 'material_descricao' in missing:
                    col_map['material_descricao'] = col_map['descricao_material']
                    missing.remove('material_descricao')

            if missing:
                missing_labels = [required_cols[k] for k in missing]
                raise KeyError(
                    f"Colunas obrigatórias não encontradas na Base DL: {missing_labels}. "
                    f"Colunas lidas: {list(df.columns)}"
                )

            # Extração padronizada
            clean_df = pd.DataFrame()
            for key in required_cols:
                original_col = col_map[key]
                clean_df[key] = df[original_col]

            # Colunas adicionais opcionais para compatibilidade total com Databricks / chamados
            if 'segmento' in col_map:
                clean_df['gp_segmento'] = df[col_map['segmento']]
            elif 'gp_segmento' in col_map:
                clean_df['gp_segmento'] = df[col_map['gp_segmento']]
            else:
                clean_df['gp_segmento'] = None

            if 'tipo' in col_map:
                clean_df['tipo'] = df[col_map['tipo']]
            else:
                clean_df['tipo'] = None

            if 'ocorrencia_chamado' in col_map:
                clean_df['ocorrencia_chamado'] = df[col_map['ocorrencia_chamado']]
            else:
                clean_df['ocorrencia_chamado'] = None

            clean_df = clean_df.dropna(subset=['chamado', 'tecnico_nome'])
            total_rows = len(clean_df)

            if total_rows == 0:
                task_progress[task_id] = {
                    "status": "completed", 
                    "progress": 100, 
                    "message": "Aviso: Planilha vazia ou sem linhas válidas com Chamado e Técnico.",
                    "total_rows": 0
                }
                return

            with self.pg_client._get_connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    task_progress[task_id] = {
                        "status": "processing", 
                        "progress": 15, 
                        "message": "Buscando técnicos cadastrados...",
                        "total_rows": total_rows
                    }

                    # 1. Mapa de Técnicos
                    cur.execute("SELECT id_tecnico, UPPER(TRIM(nome_completo)) AS nome FROM tb_tecnico")
                    tec_map = {r['nome']: r['id_tecnico'] for r in cur.fetchall()}

                    # 2. Bases ATP já cadastradas (preservação estrita dos cadastros oficiais)
                    task_progress[task_id] = {
                        "status": "processing", 
                        "progress": 20, 
                        "message": "Preparando sincronização de chamados...",
                        "total_rows": total_rows
                    }

                    # 3. Preparar Lotes de Chamados (tb_chamado e espelho chamados para paridade)
                    chamados_insert = []
                    chamados_mirror_insert = []
                    for _, row in clean_df.iterrows():
                        try:
                            ch_num = int(row['chamado'])
                        except Exception:
                            continue

                        ch_str = str(ch_num)
                        nome_tec = str(row['tecnico_nome']).strip().upper()
                        id_tec = tec_map.get(nome_tec)

                        # Tratamento de Data FT
                        val_ft = row.get('ft')
                        data_ft = None
                        if pd.notna(val_ft) and str(val_ft).strip():
                            try:
                                parsed = pd.to_datetime(val_ft, dayfirst=False) if not isinstance(val_ft, datetime) else val_ft
                                if pd.notna(parsed):
                                    data_ft = parsed
                            except Exception:
                                pass

                        # Inferência resiliente de SLA_status com fallback para Classifica_chamado
                        val_sla_raw = str(row.get('sla_status')).strip().lower() if pd.notna(row.get('sla_status')) else ''
                        val_classifica = str(row.get('classifica_chamado')).strip().upper() if pd.notna(row.get('classifica_chamado')) else ''

                        if val_sla_raw in ('dentro', 'fora'):
                            final_sla = val_sla_raw
                        elif val_classifica == 'DENTRO DO SLA':
                            final_sla = 'dentro'
                        elif val_classifica != '':
                            final_sla = 'fora'
                        else:
                            final_sla = None

                        chamados_insert.append((
                            ch_num,
                            str(row.get('projeto'))[:255] if pd.notna(row.get('projeto')) else None,
                            data_ft,
                            final_sla,
                            str(row.get('equipamento'))[:255] if pd.notna(row.get('equipamento')) else None,
                            str(row.get('material_descricao'))[:255] if pd.notna(row.get('material_descricao')) else None,
                            str(row.get('comercial'))[:255] if pd.notna(row.get('comercial')) else None,
                            str(row.get('assistencia_centro_trabalho'))[:255] if pd.notna(row.get('assistencia_centro_trabalho')) else None,
                            str(row.get('assistencia_nome'))[:255] if pd.notna(row.get('assistencia_nome')) else None,
                            str(row.get('tecnico_nome'))[:255] if pd.notna(row.get('tecnico_nome')) else None,
                            str(row.get('texto_encerrado')) if pd.notna(row.get('texto_encerrado')) else None,
                            str(row.get('reincidente'))[:255] if pd.notna(row.get('reincidente')) else None,
                            str(row.get('classifica_chamado'))[:255] if pd.notna(row.get('classifica_chamado')) else None,
                            id_tec
                        ))

                        chamados_mirror_insert.append((
                            ch_str,
                            str(row.get('equipamento'))[:255] if pd.notna(row.get('equipamento')) else None,
                            str(row.get('projeto'))[:255] if pd.notna(row.get('projeto')) else None,
                            data_ft,
                            str(row.get('gp_segmento'))[:255] if pd.notna(row.get('gp_segmento')) else None,
                            str(row.get('tipo'))[:255] if pd.notna(row.get('tipo')) else None,
                            str(row.get('texto_encerrado')) if pd.notna(row.get('texto_encerrado')) else None,
                            str(row.get('ocorrencia_chamado'))[:255] if pd.notna(row.get('ocorrencia_chamado')) else None,
                            str(row.get('assistencia_centro_trabalho'))[:255] if pd.notna(row.get('assistencia_centro_trabalho')) else None,
                            str(row.get('assistencia_nome'))[:255] if pd.notna(row.get('assistencia_nome')) else None,
                            str(row.get('tecnico_nome'))[:255] if pd.notna(row.get('tecnico_nome')) else None,
                            str(row.get('material_descricao'))[:255] if pd.notna(row.get('material_descricao')) else None,
                            final_sla
                        ))

                    # 4. Inserção em Lotes (1000 por vez)
                    upsert_query = """
                        INSERT INTO tb_chamado (
                            chamado, projeto, ft, sla_status, equipamento, material_descricao, comercial,
                            assistencia_centro_trabalho, assistencia_nome, tecnico_nome, texto_encerrado,
                            reincidente, classifica_chamado, id_tecnico
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (chamado) DO UPDATE SET
                            projeto = EXCLUDED.projeto,
                            ft = EXCLUDED.ft,
                            sla_status = EXCLUDED.sla_status,
                            equipamento = EXCLUDED.equipamento,
                            material_descricao = EXCLUDED.material_descricao,
                            comercial = EXCLUDED.comercial,
                            assistencia_centro_trabalho = EXCLUDED.assistencia_centro_trabalho,
                            assistencia_nome = EXCLUDED.assistencia_nome,
                            tecnico_nome = EXCLUDED.tecnico_nome,
                            texto_encerrado = EXCLUDED.texto_encerrado,
                            reincidente = EXCLUDED.reincidente,
                            classifica_chamado = EXCLUDED.classifica_chamado,
                            id_tecnico = EXCLUDED.id_tecnico;
                    """

                    upsert_mirror_query = """
                        INSERT INTO chamados (
                            chamado, tipo_equipamento, projeto, ft, gp_segmento, tipo,
                            texto_encerrado, ocorrencia_chamado, assistencia_centro_trabalho,
                            assistencia_razao_social, tecnico_nome, descricao_material, sla_status
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (chamado) DO UPDATE SET
                            tipo_equipamento = EXCLUDED.tipo_equipamento,
                            projeto = EXCLUDED.projeto,
                            ft = EXCLUDED.ft,
                            gp_segmento = COALESCE(EXCLUDED.gp_segmento, chamados.gp_segmento),
                            tipo = COALESCE(EXCLUDED.tipo, chamados.tipo),
                            texto_encerrado = EXCLUDED.texto_encerrado,
                            ocorrencia_chamado = EXCLUDED.ocorrencia_chamado,
                            assistencia_centro_trabalho = EXCLUDED.assistencia_centro_trabalho,
                            assistencia_razao_social = EXCLUDED.assistencia_razao_social,
                            tecnico_nome = EXCLUDED.tecnico_nome,
                            descricao_material = EXCLUDED.descricao_material,
                            sla_status = EXCLUDED.sla_status;
                    """

                    for i in range(0, len(chamados_insert), 1000):
                        chunk = chamados_insert[i:i + 1000]
                        chunk_mirror = chamados_mirror_insert[i:i + 1000]
                        cur.executemany(upsert_query, chunk)
                        cur.executemany(upsert_mirror_query, chunk_mirror)
                        conn.commit()

                        pct = 20 + int(((i + len(chunk)) / len(chamados_insert)) * 75)
                        task_progress[task_id] = {
                            "status": "processing",
                            "progress": min(95, pct),
                            "message": f"Gravando chamados: {min(i + 1000, len(chamados_insert))}/{len(chamados_insert)}...",
                            "total_rows": total_rows
                        }

            task_progress[task_id] = {
                "status": "completed",
                "progress": 100,
                "message": f"Sucesso! {len(chamados_insert)} chamados da Base DL foram processados e sincronizados com total paridade.",
                "total_rows": total_rows
            }

            # Aciona o motor de cálculo da campanha em background
            self._auto_recalcular()

        except Exception as e:
            logger.error(f"Erro no processamento da Base DL ({task_id}): {e}", exc_info=True)
            task_progress[task_id] = {
                "status": "error",
                "progress": 0,
                "message": f"Erro: {str(e)}"
            }

    # =========================================================================
    # 2. PROCESSAMENTO CONSUMO DE PEÇAS (tb_consumo_peca & pecas)
    # =========================================================================
    def process_parts(self, task_id: str, file_contents: bytes) -> None:
        """
        Processa a planilha de consumo de peças e popula tb_consumo_peca / pecas.
        """
        try:
            task_progress[task_id] = {
                "status": "processing", 
                "progress": 5, 
                "message": "Lendo planilha de Peças...",
                "timestamp": datetime.utcnow().isoformat()
            }

            try:
                df = pd.read_excel(io.BytesIO(file_contents))
            except Exception:
                df = pd.read_csv(io.BytesIO(file_contents), sep=None, engine='python')

            df.columns = [normalize_column_name(c) for c in df.columns]

            colunas_esperadas = ['chamado', 'ct', 'atp', 'ft', 'segmento', 'projeto', 'equipamento', 'sintoma', 'tecnico_nome', 'subgrupo', 'acao']
            faltantes = [c for c in colunas_esperadas if c not in df.columns]
            if faltantes:
                # Tenta equivalências
                if 'descricao_material' in df.columns and 'subgrupo' in faltantes:
                    df['subgrupo'] = df['descricao_material']
                    faltantes.remove('subgrupo')
                if 'cod_aplic_desc' in df.columns and 'subgrupo' in faltantes:
                    df['subgrupo'] = df['cod_aplic_desc']
                    faltantes.remove('subgrupo')
                if 'assistencia_centro_trabalho' in df.columns and 'ct' in faltantes:
                    df['ct'] = df['assistencia_centro_trabalho']
                    faltantes.remove('ct')
                if 'assistencia_nome' in df.columns and 'atp' in faltantes:
                    df['atp'] = df['assistencia_nome']
                    faltantes.remove('atp')

            if faltantes:
                raise KeyError(f"Colunas obrigatórias não encontradas na planilha de Peças: {faltantes}. Colunas lidas: {list(df.columns)}")

            df = df.dropna(subset=['chamado'])
            total_rows = len(df)

            with self.pg_client._get_connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    task_progress[task_id] = {
                        "status": "processing", 
                        "progress": 15, 
                        "message": "Buscando histórico de peças e técnicos...",
                        "total_rows": total_rows
                    }

                    # Proteção contra duplicidade
                    cur.execute("SELECT chamado, COALESCE(subgrupo, '') AS subgrupo FROM tb_consumo_peca")
                    pecas_existentes = {(str(r['chamado']), str(r['subgrupo'])) for r in cur.fetchall()}

                    # Técnicos para desempate
                    cur.execute("""
                        SELECT t.id_tecnico, UPPER(TRIM(t.nome_completo)) AS nome, t.matricula, tb.ct_codigo
                        FROM tb_tecnico t
                        LEFT JOIN tb_tecnico_base tb ON t.id_tecnico = tb.id_tecnico
                    """)
                    tec_rows = cur.fetchall()
                    tec_dict: Dict[str, List[Dict[str, Any]]] = {}
                    for r in tec_rows:
                        n = r['nome']
                        if n not in tec_dict:
                            tec_dict[n] = []
                        tec_dict[n].append(r)

                    pecas_insert = []
                    pecas_mirror_insert = []
                    alertas_moderador = []

                    for _, row in df.iterrows():
                        chamado_num = str(row['chamado']).strip()
                        sub = str(row.get('subgrupo', ''))[:255] if pd.notna(row.get('subgrupo')) else ''

                        if (chamado_num, sub) not in pecas_existentes:
                            tecnico_planilha = str(row.get('tecnico_nome', '')).strip().upper()
                            matricula_planilha = str(row.get('matricula', '')).strip() if 'matricula' in row else ''
                            ct_planilha = str(row.get('ct', '')).strip()

                            # Desempate de técnicos
                            matches = [t for k, t_list in tec_dict.items() if k.startswith(tecnico_planilha) for t in t_list] if tecnico_planilha else []

                            if len(matches) > 1 and matricula_planilha:
                                m_filter = [m for m in matches if m.get('matricula') == matricula_planilha]
                                if m_filter:
                                    matches = m_filter

                            if len(matches) > 1 and ct_planilha:
                                c_filter = [m for m in matches if m.get('ct_codigo') == ct_planilha]
                                if c_filter:
                                    matches = c_filter

                            nome_salvar = matches[0]['nome'] if len(matches) == 1 else tecnico_planilha

                            pecas_existentes.add((chamado_num, sub))

                            # Converte data FT
                            val_ft = row.get('ft')
                            ft_date = None
                            if pd.notna(val_ft) and str(val_ft).strip():
                                try:
                                    parsed = pd.to_datetime(val_ft, dayfirst=False) if not isinstance(val_ft, datetime) else val_ft
                                    if pd.notna(parsed):
                                        ft_date = parsed
                                except Exception:
                                    pass

                            pecas_insert.append((
                                chamado_num,
                                str(row.get('ct', ''))[:255] if pd.notna(row.get('ct')) else None,
                                str(row.get('atp', ''))[:255] if pd.notna(row.get('atp')) else None,
                                ft_date,
                                str(row.get('segmento', ''))[:255] if pd.notna(row.get('segmento')) else None,
                                str(row.get('projeto', ''))[:255] if pd.notna(row.get('projeto')) else None,
                                str(row.get('equipamento', ''))[:255] if pd.notna(row.get('equipamento')) else None,
                                str(row.get('sintoma', '')) if pd.notna(row.get('sintoma')) else None,
                                nome_salvar[:255] if nome_salvar else None,
                                sub if sub != '' else None,
                                str(row.get('acao', ''))[:255] if pd.notna(row.get('acao')) else None
                            ))

                            # Espelho para tabela pecas (Databricks compatibility)
                            try:
                                ch_bigint = int(chamado_num)
                            except Exception:
                                ch_bigint = None

                            if ch_bigint:
                                pecas_mirror_insert.append((
                                    ch_bigint,
                                    ft_date,
                                    nome_salvar[:255] if nome_salvar else None,
                                    sub if sub != '' else None,
                                    str(row.get('equipamento', ''))[:255] if pd.notna(row.get('equipamento')) else None,
                                    str(row.get('acao', ''))[:255] if pd.notna(row.get('acao')) else None
                                ))

                    # Inserção em lotes na tb_consumo_peca
                    insert_sql = """
                        INSERT INTO tb_consumo_peca (
                            chamado, ct, atp, ft, segmento, projeto, equipamento, sintoma, tecnico_nome, subgrupo, acao
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """
                    for i in range(0, len(pecas_insert), 1000):
                        chunk = pecas_insert[i:i + 1000]
                        cur.executemany(insert_sql, chunk)
                        conn.commit()

                        pct = 20 + int(((i + len(chunk)) / max(1, len(pecas_insert))) * 75)
                        task_progress[task_id] = {
                            "status": "processing",
                            "progress": min(95, pct),
                            "message": f"Gravando peças: {min(i + 1000, len(pecas_insert))}/{len(pecas_insert)}...",
                            "total_rows": total_rows
                        }

                    # Inserção espelho na tabela pecas
                    if pecas_mirror_insert:
                        mirror_sql = """
                            INSERT INTO pecas (chamado, ft, tecnico_nome, cod_aplic_desc, tipo_equipamento, acao)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            ON CONFLICT DO NOTHING
                        """
                        for i in range(0, len(pecas_mirror_insert), 1000):
                            cur.executemany(mirror_sql, pecas_mirror_insert[i:i + 1000])
                            conn.commit()

            msg = f"Sucesso! {len(pecas_insert)} registros de consumo de peças foram importados."
            task_progress[task_id] = {
                "status": "completed",
                "progress": 100,
                "message": msg,
                "total_rows": total_rows
            }

            self._auto_recalcular()

        except Exception as e:
            logger.error(f"Erro no processamento de Peças ({task_id}): {e}", exc_info=True)
            task_progress[task_id] = {
                "status": "error",
                "progress": 0,
                "message": f"Erro: {str(e)}"
            }

    # =========================================================================
    # 3. PROCESSAMENTO REINCIDÊNCIA (tb_reincidencia & reincidentes)
    # =========================================================================
    def process_reincidencia(self, task_id: str, file_contents: bytes) -> None:
        """
        Processa a planilha de reincidências (RRC) com as 26 colunas.
        """
        try:
            task_progress[task_id] = {
                "status": "processing", 
                "progress": 5, 
                "message": "Lendo planilha de Reincidência...",
                "timestamp": datetime.utcnow().isoformat()
            }

            try:
                df = pd.read_excel(io.BytesIO(file_contents))
            except Exception:
                df = pd.read_csv(io.BytesIO(file_contents), sep=None, engine='python')

            df.columns = df.columns.str.strip().str.lower()

            possiveis_rrc = ['chamado_rrc', 'chamado_novo', 'chamado novo', 'chamado']
            col_rrc = next((col for col in possiveis_rrc if col in df.columns), None)

            if not col_rrc:
                raise KeyError("A planilha não contém a coluna 'chamado_rrc' ou equivalente.")

            df = df.dropna(subset=[col_rrc])
            total_rows = len(df)

            with self.pg_client._get_connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    task_progress[task_id] = {
                        "status": "processing", 
                        "progress": 15, 
                        "message": "Removendo registros antigos dos chamados RRC...",
                        "total_rows": total_rows
                    }

                    # Limpar chamados RRC desta planilha
                    chamados_rrc_list = []
                    for c in df[col_rrc].dropna():
                        try:
                            chamados_rrc_list.append(int(c))
                        except Exception:
                            pass

                    for i in range(0, len(chamados_rrc_list), 1000):
                        chunk_ids = tuple(chamados_rrc_list[i:i + 1000])
                        if chunk_ids:
                            cur.execute("DELETE FROM tb_reincidencia WHERE chamado_rrc IN %s", (chunk_ids,))
                            cur.execute("DELETE FROM reincidentes WHERE chamado_rrc IN %s", (chunk_ids,))
                    conn.commit()

                    reinc_insert = []
                    reinc_mirror = []

                    for _, row in df.iterrows():
                        try:
                            ch_rrc = int(row[col_rrc])
                        except Exception:
                            continue

                        def get_date(col_name: str) -> Optional[datetime]:
                            val = row.get(col_name)
                            if pd.notna(val) and str(val).strip():
                                try:
                                    parsed = pd.to_datetime(val, dayfirst=False) if not isinstance(val, datetime) else val
                                    return parsed if pd.notna(parsed) else None
                                except Exception:
                                    return None
                            return None

                        try:
                            intervalo = int(row.get('intervalo_dias')) if pd.notna(row.get('intervalo_dias')) else None
                        except Exception:
                            intervalo = None

                        try:
                            ch_ant = int(row.get('chamado_anterior')) if pd.notna(row.get('chamado_anterior')) else None
                        except Exception:
                            ch_ant = None

                        ft_ant = get_date('ft_anterior')
                        ft_rrc = get_date('ft_rrc')
                        enc_rrc = get_date('encerramento_rrc')

                        reinc_insert.append((
                            ch_ant,
                            ft_ant,
                            intervalo,
                            ch_rrc,
                            ft_rrc,
                            enc_rrc,
                            str(row.get('classificacao', ''))[:150] if pd.notna(row.get('classificacao')) else None,
                            str(row.get('defeito_anterior', ''))[:255] if pd.notna(row.get('defeito_anterior')) else None,
                            str(row.get('aplicado_peca_anterior', ''))[:255] if pd.notna(row.get('aplicado_peca_anterior')) else None,
                            str(row.get('segmento_rrc', ''))[:100] if pd.notna(row.get('segmento_rrc')) else None,
                            str(row.get('ct_rrc', ''))[:100] if pd.notna(row.get('ct_rrc')) else None,
                            str(row.get('ct_anterior', ''))[:100] if pd.notna(row.get('ct_anterior')) else None,
                            str(row.get('material_descricao_rrc', ''))[:255] if pd.notna(row.get('material_descricao_rrc')) else None,
                            str(row.get('equipamento', ''))[:150] if pd.notna(row.get('equipamento')) else None,
                            str(row.get('projeto_anterior', ''))[:150] if pd.notna(row.get('projeto_anterior')) else None,
                            str(row.get('tecnico_nome_rrc', ''))[:150] if pd.notna(row.get('tecnico_nome_rrc')) else None,
                            str(row.get('tecnico_nome_anterior', ''))[:150] if pd.notna(row.get('tecnico_nome_anterior')) else None,
                            str(row.get('texto_encerrado_rrc', '')) if pd.notna(row.get('texto_encerrado_rrc')) else None,
                            str(row.get('motivo_class', ''))[:150] if pd.notna(row.get('motivo_class')) else None,
                            str(row.get('sub_class', ''))[:150] if pd.notna(row.get('sub_class')) else None,
                            str(row.get('mesmo_motivo', ''))[:150] if pd.notna(row.get('mesmo_motivo')) else None,
                            str(row.get('peca', ''))[:150] if pd.notna(row.get('peca')) else None,
                            str(row.get('porque_nao_evitamos', '')) if pd.notna(row.get('porque_nao_evitamos')) else None
                        ))

                        reinc_mirror.append((
                            ch_rrc,
                            ch_ant,
                            ft_rrc,
                            ft_ant,
                            str(row.get('ct_anterior', ''))[:100] if pd.notna(row.get('ct_anterior')) else None,
                            str(row.get('ct_rrc', ''))[:100] if pd.notna(row.get('ct_rrc')) else None,
                            str(row.get('tecnico_nome_anterior', ''))[:150] if pd.notna(row.get('tecnico_nome_anterior')) else None,
                            str(row.get('tecnico_nome_rrc', ''))[:150] if pd.notna(row.get('tecnico_nome_rrc')) else None,
                            str(row.get('projeto_anterior', ''))[:150] if pd.notna(row.get('projeto_anterior')) else None,
                            str(row.get('aplicado_peca_anterior', ''))[:255] if pd.notna(row.get('aplicado_peca_anterior')) else None,
                            str(row.get('defeito_anterior', ''))[:255] if pd.notna(row.get('defeito_anterior')) else None,
                            str(row.get('classificacao', ''))[:150] if pd.notna(row.get('classificacao')) else None,
                            str(row.get('material_descricao_rrc', ''))[:255] if pd.notna(row.get('material_descricao_rrc')) else None,
                            str(row.get('segmento_rrc', ''))[:100] if pd.notna(row.get('segmento_rrc')) else None
                        ))

                    insert_sql = """
                        INSERT INTO tb_reincidencia (
                            chamado_anterior, ft_anterior, intervalo_dias, chamado_rrc, ft_rrc, encerramento_rrc, classificacao,
                            defeito_anterior, aplicado_peca_anterior, segmento_rrc, ct_rrc, ct_anterior,
                            material_descricao_rrc, equipamento, projeto_anterior, tecnico_nome_rrc,
                            tecnico_nome_anterior, texto_encerrado_rrc, motivo_class, sub_class,
                            mesmo_motivo, peca, porque_nao_evitamos
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """
                    for i in range(0, len(reinc_insert), 1000):
                        chunk = reinc_insert[i:i + 1000]
                        cur.executemany(insert_sql, chunk)
                        conn.commit()

                        pct = 20 + int(((i + len(chunk)) / max(1, len(reinc_insert))) * 75)
                        task_progress[task_id] = {
                            "status": "processing",
                            "progress": min(95, pct),
                            "message": f"Gravando reincidências: {min(i + 1000, len(reinc_insert))}/{len(reinc_insert)}...",
                            "total_rows": total_rows
                        }

                    # Inserção na tabela reincidentes (Databricks compatibility)
                    mirror_sql = """
                        INSERT INTO reincidentes (
                            chamado_rrc, chamado_anterior, ft_rrc, ft_anterior, ct_anterior, ct_rrc,
                            tecnico_nome_anterior, tecnico_nome_rrc, projeto_anterior, aplicado_peca_anterior,
                            defeito_anterior, classificacao, material_descricao_rrc, segmento_rrc
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """
                    for i in range(0, len(reinc_mirror), 1000):
                        cur.executemany(mirror_sql, reinc_mirror[i:i + 1000])
                        conn.commit()

            task_progress[task_id] = {
                "status": "completed",
                "progress": 100,
                "message": f"Sucesso! {len(reinc_insert)} registros de reincidência foram processados com sucesso.",
                "total_rows": total_rows
            }

            self._auto_recalcular()

        except Exception as e:
            logger.error(f"Erro no processamento de Reincidência ({task_id}): {e}", exc_info=True)
            task_progress[task_id] = {
                "status": "error",
                "progress": 0,
                "message": f"Erro: {str(e)}"
            }

    # =========================================================================
    # 4. PROCESSAMENTO ENCERRADOS RRC (tb_reincidencia_encerrados)
    # =========================================================================
    def process_encerrados_rrc(self, task_id: str, file_contents: bytes) -> None:
        """
        Processa a planilha de chamados encerrados para cálculo divisor de reincidência.
        """
        try:
            task_progress[task_id] = {
                "status": "processing", 
                "progress": 5, 
                "message": "Lendo planilha de Encerrados RRC...",
                "timestamp": datetime.utcnow().isoformat()
            }

            try:
                df = pd.read_excel(io.BytesIO(file_contents))
            except Exception:
                df = pd.read_csv(io.BytesIO(file_contents), sep=None, engine='python')

            df.columns = [normalize_column_name(c) for c in df.columns]

            if any('chamado_rrc' in c or 'chamado_anterior' in c for c in df.columns):
                raise ValueError("Atenção: Você anexou a planilha de Reincidências no campo de Encerrados RRC!")

            colunas_esperadas = ['chamado', 'segmento', 'projeto', 'assistencia_codigo', 'assistencia_nome', 'ft', 'tecnico_nome', 'texto_encerrado']
            faltantes = [c for c in colunas_esperadas if c not in df.columns]
            if faltantes:
                raise KeyError(f"Colunas obrigatórias não encontradas na planilha de Encerrados: {faltantes}. Colunas lidas: {list(df.columns)}")

            df = df.dropna(subset=['chamado'])
            total_rows = len(df)

            with self.pg_client._get_connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    task_progress[task_id] = {
                        "status": "processing", 
                        "progress": 15, 
                        "message": "Atualizando chamados encerrados...",
                        "total_rows": total_rows
                    }

                    chamados_list = [str(c).strip() for c in df['chamado'].dropna()]
                    for i in range(0, len(chamados_list), 1000):
                        chunk_ids = tuple(chamados_list[i:i + 1000])
                        if chunk_ids:
                            cur.execute("DELETE FROM tb_reincidencia_encerrados WHERE chamado IN %s", (chunk_ids,))
                    conn.commit()

                    enc_insert = []
                    for _, row in df.iterrows():
                        val_ft = row.get('ft')
                        ft_date = None
                        if pd.notna(val_ft) and str(val_ft).strip():
                            try:
                                parsed = pd.to_datetime(val_ft, dayfirst=False) if not isinstance(val_ft, datetime) else val_ft
                                if pd.notna(parsed):
                                    ft_date = parsed
                            except Exception:
                                pass

                        enc_insert.append((
                            str(row['chamado']).strip(),
                            str(row.get('segmento', ''))[:150] if pd.notna(row.get('segmento')) else None,
                            str(row.get('projeto', ''))[:150] if pd.notna(row.get('projeto')) else None,
                            str(row.get('assistencia_codigo', ''))[:100] if pd.notna(row.get('assistencia_codigo')) else None,
                            str(row.get('assistencia_nome', ''))[:255] if pd.notna(row.get('assistencia_nome')) else None,
                            ft_date,
                            str(row.get('tecnico_nome', ''))[:255] if pd.notna(row.get('tecnico_nome')) else None,
                            str(row.get('texto_encerrado', '')) if pd.notna(row.get('texto_encerrado')) else None
                        ))

                    insert_sql = """
                        INSERT INTO tb_reincidencia_encerrados (
                            chamado, segmento, projeto, assistencia_codigo, assistencia_nome, ft, tecnico_nome, texto_encerrado
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (chamado) DO NOTHING
                    """
                    for i in range(0, len(enc_insert), 1000):
                        chunk = enc_insert[i:i + 1000]
                        cur.executemany(insert_sql, chunk)
                        conn.commit()

                        pct = 20 + int(((i + len(chunk)) / max(1, len(enc_insert))) * 75)
                        task_progress[task_id] = {
                            "status": "processing",
                            "progress": min(95, pct),
                            "message": f"Gravando encerrados: {min(i + 1000, len(enc_insert))}/{len(enc_insert)}...",
                            "total_rows": total_rows
                        }

            task_progress[task_id] = {
                "status": "completed",
                "progress": 100,
                "message": f"Sucesso! {len(enc_insert)} chamados encerrados foram importados.",
                "total_rows": total_rows
            }

            self._auto_recalcular()

        except Exception as e:
            logger.error(f"Erro no processamento de Encerrados RRC ({task_id}): {e}", exc_info=True)
            task_progress[task_id] = {
                "status": "error",
                "progress": 0,
                "message": f"Erro: {str(e)}"
            }
