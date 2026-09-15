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
                            ch_raw = row['chamado']
                            if pd.isna(ch_raw):
                                continue
                            ch_num = int(float(ch_raw))
                            ch_str = str(ch_num)
                        except Exception:
                            continue

                        # Tratamento de Técnico (Normalização de Nulos e 'Não Definido')
                        nome_tec_raw = str(row.get('tecnico_nome')).strip() if pd.notna(row.get('tecnico_nome')) else ''
                        if not nome_tec_raw or nome_tec_raw.upper() in ('NONE', 'NAN', 'NÃO DEFINIDO', 'NAO DEFINIDO', 'SEM TÉCNICO', 'SEM TECNICO'):
                            nome_tec_final = 'NÃO DEFINIDO'
                            id_tec = None
                        else:
                            nome_tec_final = nome_tec_raw.upper()
                            id_tec = tec_map.get(nome_tec_final)

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

                        # Tratamento de SLA_status estrito (sem inferência por classifica_chamado)
                        # Por diretriz da gestão, classifica_chamado é restrita ao KPI 2 (Perdas de Gestão)
                        val_sla_raw = str(row.get('sla_status')).strip().lower() if pd.notna(row.get('sla_status')) else ''
                        if val_sla_raw in ('dentro', 'fora'):
                            final_sla = val_sla_raw
                        elif 'dentro' in val_sla_raw:
                            final_sla = 'dentro'
                        elif 'fora' in val_sla_raw:
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
                            nome_tec_final if nome_tec_final else None,
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

            def clean_chamado_val(val) -> Optional[int]:
                if pd.isna(val):
                    return None
                try:
                    return int(float(str(val).strip()))
                except (ValueError, OverflowError):
                    return None

            df['clean_chamado'] = df['chamado'].apply(clean_chamado_val)
            df = df.dropna(subset=['clean_chamado'])
            df['clean_chamado'] = df['clean_chamado'].astype('int64')
            total_rows = len(df)

            with self.pg_client._get_connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    task_progress[task_id] = {
                        "status": "processing", 
                        "progress": 15, 
                        "message": "Buscando histórico de peças e técnicos...",
                        "total_rows": total_rows
                    }

                    # Limpar chamados já existentes nesta planilha para atualização consistente
                    chamados_list = list(df['clean_chamado'].unique())
                    for i in range(0, len(chamados_list), 1000):
                        chunk_ids = chamados_list[i:i + 1000]
                        if chunk_ids:
                            cur.execute("DELETE FROM tb_consumo_peca WHERE chamado = ANY(%s)", (chunk_ids,))
                    conn.commit()

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

                    def get_date(val) -> Optional[datetime]:
                        if pd.notna(val) and str(val).strip():
                            try:
                                parsed = pd.to_datetime(val, dayfirst=False) if not isinstance(val, datetime) else val
                                return parsed if pd.notna(parsed) else None
                            except Exception:
                                return None
                        return None

                    def get_str(val, max_len: Optional[int] = None) -> Optional[str]:
                        if pd.notna(val) and str(val).strip():
                            s = str(val).strip()
                            return s[:max_len] if max_len else s
                        return None

                    def get_numeric(val) -> Optional[float]:
                        if pd.notna(val):
                            try:
                                return float(val)
                            except Exception:
                                return None
                        return None

                    pecas_insert = []
                    pecas_mirror_insert = []

                    for _, row in df.iterrows():
                        chamado_num = int(row['clean_chamado'])
                        sub = get_str(row.get('subgrupo'), 150) or ''

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
                        ft_date = get_date(row.get('ft'))

                        pecas_insert.append((
                            chamado_num,
                            get_str(row.get('ct'), 100),
                            get_str(row.get('atp'), 255),
                            get_date(row.get('abertura')),
                            ft_date,
                            get_date(row.get('encerramento')),
                            get_str(row.get('segmento'), 150),
                            get_str(row.get('tipo'), 150),
                            get_str(row.get('texto_abertura')),
                            get_str(row.get('texto_breve')),
                            get_str(row.get('encdesc'), 150),
                            get_str(row.get('texto_encerrado')),
                            get_str(row.get('projeto'), 150),
                            get_str(row.get('cliente_codigo'), 100),
                            get_str(row.get('cliente_nome'), 255),
                            get_str(row.get('escritorio_vendas'), 100),
                            get_str(row.get('cliente_uf'), 10),
                            get_str(row.get('cliente_cidade'), 150),
                            get_str(row.get('detentor_nome'), 255),
                            get_str(row.get('detentor_cep'), 50),
                            get_str(row.get('detentor_uf'), 10),
                            get_str(row.get('detentor_cidade'), 150),
                            get_str(row.get('detentor_bairro'), 150),
                            get_str(row.get('detentor_logradouro'), 255),
                            get_str(row.get('serie'), 150),
                            get_str(row.get('sku'), 100),
                            get_str(row.get('marca'), 150),
                            get_str(row.get('equipamento'), 150),
                            get_str(row.get('barebone'), 150),
                            get_str(row.get('utiliza_peca'), 100),
                            get_str(row.get('utiliza_peca_eng'), 100),
                            get_str(row.get('hass'), 50),
                            get_str(row.get('sintoma')),
                            get_str(row.get('ocorrencia_chamado'), 255),
                            get_numeric(row.get('tempo_falha_meses')),
                            nome_salvar[:255] if nome_salvar else None,
                            get_str(row.get('grupo_economico'), 150),
                            get_str(row.get('os_cliente'), 100),
                            get_numeric(row.get('idade_parque')),
                            get_numeric(row.get('idade_parque_falha')),
                            get_str(row.get('sintoma_eng')),
                            get_str(row.get('divisao_eng'), 150),
                            get_str(row.get('varejo'), 50),
                            sub if sub != '' else None,
                            get_str(row.get('codigo_solicitado'), 100),
                            get_str(row.get('codigo_solicitado_desc')),
                            get_str(row.get('codigo_aplicado'), 100),
                            get_str(row.get('codigo_aplicado_desc')),
                            get_str(row.get('causa'), 255),
                            get_str(row.get('acao'), 255),
                            get_str(row.get('serial_ant'), 150),
                            get_str(row.get('serial_nov'), 150),
                            get_date(row.get('data_inicio_garantia')),
                            get_date(row.get('data_ativacao')),
                            get_str(row.get('grupo_mercadoria'), 100),
                            get_str(row.get('grupo_mercadoria_desc'), 150),
                            get_str(row.get('tipo_posicionado'), 100),
                            get_str(row.get('peca_control'), 50),
                            get_str(row.get('status_chamado'), 100)
                        ))

                        # Espelho para tabela pecas (Databricks compatibility)
                        pecas_mirror_insert.append((
                            str(chamado_num),
                            ft_date,
                            nome_salvar[:255] if nome_salvar else None,
                            get_str(row.get('codigo_aplicado_desc')),
                            get_str(row.get('equipamento'), 255),
                            get_str(row.get('acao'), 255),
                            get_str(row.get('codigo_solicitado_desc')),
                            get_str(row.get('grupo_mercadoria'), 100),
                            get_str(row.get('grupo_mercadoria_desc'), 150)
                        ))

                    # Inserção em lotes na tb_consumo_peca
                    insert_sql = """
                        INSERT INTO tb_consumo_peca (
                            chamado, ct, atp, abertura, ft, encerramento, segmento, tipo,
                            texto_abertura, texto_breve, encdesc, texto_encerrado, projeto,
                            cliente_codigo, cliente_nome, escritorio_vendas, cliente_uf, cliente_cidade,
                            detentor_nome, detentor_cep, detentor_uf, detentor_cidade, detentor_bairro, detentor_logradouro,
                            serie, sku, marca, equipamento, barebone, utiliza_peca, utiliza_peca_eng, hass,
                            sintoma, ocorrencia_chamado, tempo_falha_meses, tecnico_nome, grupo_economico, os_cliente,
                            idade_parque, idade_parque_falha, sintoma_eng, divisao_eng, varejo, subgrupo,
                            codigo_solicitado, codigo_solicitado_desc, codigo_aplicado, codigo_aplicado_desc,
                            causa, acao, serial_ant, serial_nov, data_inicio_garantia, data_ativacao,
                            grupo_mercadoria, grupo_mercadoria_desc, tipo_posicionado, peca_control, status_chamado
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s
                        )
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
                            INSERT INTO pecas (
                                chamado, ft, tecnico_nome, cod_aplic_desc, tipo_equipamento, acao,
                                cod_solic_desc, grupo_mercadoria, grupo_mercadoria_desc
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                            chamados_rrc_list.append(str(int(float(c))))
                        except Exception:
                            val_str = str(c).strip()
                            if val_str:
                                chamados_rrc_list.append(val_str)

                    for i in range(0, len(chamados_rrc_list), 1000):
                        chunk_ids = chamados_rrc_list[i:i + 1000]
                        if chunk_ids:
                            cur.execute("DELETE FROM reincidentes WHERE chamado_rrc = ANY(%s)", (chunk_ids,))
                    conn.commit()

                    reinc_rows = []

                    def get_date(val) -> Optional[datetime]:
                        if pd.notna(val) and str(val).strip():
                            try:
                                parsed = pd.to_datetime(val, dayfirst=False) if not isinstance(val, datetime) else val
                                return parsed if pd.notna(parsed) else None
                            except Exception:
                                return None
                        return None

                    def get_str(val, max_len: Optional[int] = None) -> Optional[str]:
                        if pd.notna(val) and str(val).strip():
                            s = str(val).strip()
                            return s[:max_len] if max_len else s
                        return None

                    def get_int(val) -> Optional[int]:
                        if pd.notna(val):
                            try:
                                return int(float(val))
                            except Exception:
                                return None
                        return None

                    for _, row in df.iterrows():
                        try:
                            ch_rrc = str(int(float(row[col_rrc])))
                        except Exception:
                            continue

                        try:
                            ch_ant = str(int(float(row.get('chamado_anterior')))) if pd.notna(row.get('chamado_anterior')) else None
                        except Exception:
                            ch_ant = None

                        reinc_rows.append((
                            ch_ant,
                            get_date(row.get('abertura_anterior')),
                            get_date(row.get('ft_anterior')),
                            get_date(row.get('encerramento_anterior')),
                            ch_rrc,
                            get_date(row.get('abertura_rrc')),
                            get_date(row.get('ft_rrc')),
                            get_str(row.get('tipo_rrc'), 150),
                            get_str(row.get('tipo_anterior'), 150),
                            get_str(row.get('serie'), 255),
                            get_date(row.get('encerramento_rrc')),
                            get_int(row.get('meses_rrc')),
                            get_str(row.get('classificacao'), 150),
                            get_str(row.get('defeito_rrc'), 255),
                            get_str(row.get('defeito_anterior'), 255),
                            get_str(row.get('aplicado_peca_rrc'), 255),
                            get_str(row.get('aplicado_peca_anterior'), 255),
                            get_str(row.get('encdesc_rrc'), 255),
                            get_str(row.get('encdesc_anterio'), 255),
                            get_str(row.get('segmento_rrc'), 150),
                            get_str(row.get('ct_rrc'), 100),
                            get_str(row.get('ct_anterior'), 100),
                            get_str(row.get('material_rrc'), 150),
                            get_str(row.get('material_descricao_rrc'), 255),
                            get_str(row.get('equipamento'), 150),
                            get_str(row.get('barebone'), 150),
                            get_str(row.get('marca'), 150),
                            get_str(row.get('ocorrencia_chamado_rrc'), 255),
                            get_str(row.get('ocorrencia_chamado_anterior'), 255),
                            get_str(row.get('projeto_anterior'), 150),
                            get_str(row.get('cliente_nome_rrc'), 255),
                            get_str(row.get('cliente_uf_rrc'), 10),
                            get_str(row.get('cliente_cidade_rrc'), 150),
                            get_str(row.get('tecnico_nome_rrc'), 150),
                            get_str(row.get('texto_abertura_rrc')),
                            get_str(row.get('texto_encerrado_rrc')),
                            get_str(row.get('tecnico_nome_anterior'), 150),
                            get_str(row.get('texto_abertura_anterior')),
                            get_str(row.get('texto_encerrado_anterior')),
                            get_str(row.get('prioritario'), 50)
                        ))

                    insert_sql = """
                        INSERT INTO reincidentes (
                            chamado_anterior, abertura_anterior, ft_anterior, encerramento_anterior,
                            chamado_rrc, abertura_rrc, ft_rrc, tipo_rrc, tipo_anterior, serie,
                            encerramento_rrc, meses_rrc, classificacao, defeito_rrc, defeito_anterior,
                            aplicado_peca_rrc, aplicado_peca_anterior, encdesc_rrc, encdesc_anterio,
                            segmento_rrc, ct_rrc, ct_anterior, material_rrc, material_descricao_rrc,
                            equipamento, barebone, marca, ocorrencia_chamado_rrc, ocorrencia_chamado_anterior,
                            projeto_anterior, cliente_nome_rrc, cliente_uf_rrc, cliente_cidade_rrc,
                            tecnico_nome_rrc, texto_abertura_rrc, texto_encerrado_rrc,
                            tecnico_nome_anterior, texto_abertura_anterior, texto_encerrado_anterior, prioritario
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                        )
                    """
                    for i in range(0, len(reinc_rows), 1000):
                        chunk = reinc_rows[i:i + 1000]
                        cur.executemany(insert_sql, chunk)
                        conn.commit()

                        pct = 20 + int(((i + len(chunk)) / max(1, len(reinc_rows))) * 75)
                        task_progress[task_id] = {
                            "status": "processing",
                            "progress": min(95, pct),
                            "message": f"Gravando reincidências: {min(i + 1000, len(reinc_rows))}/{len(reinc_rows)}...",
                            "total_rows": total_rows
                        }

            task_progress[task_id] = {
                "status": "completed",
                "progress": 100,
                "message": f"Sucesso! {len(reinc_rows)} registros de reincidência foram processados com sucesso.",
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
    # 4. PROCESSAMENTO ENCERRADOS RRC (tb_encerrados_rrc)
    # =========================================================================
    def process_encerrados_rrc(self, task_id: str, file_contents: bytes) -> None:
        """
        Processa a planilha oficial de chamados encerrados que contabilizam reincidência.
        Persiste todas as 29 colunas na tabela tb_encerrados_rrc.
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

                    chamados_list = []
                    for c in df['chamado'].dropna():
                        try:
                            chamados_list.append(str(int(float(c))))
                        except Exception:
                            val_str = str(c).strip()
                            if val_str:
                                chamados_list.append(val_str)

                    for i in range(0, len(chamados_list), 1000):
                        chunk_ids = chamados_list[i:i + 1000]
                        if chunk_ids:
                            cur.execute("DELETE FROM tb_encerrados_rrc WHERE chamado = ANY(%s)", (chunk_ids,))
                    conn.commit()

                    def get_date(val) -> Optional[datetime]:
                        if pd.notna(val) and str(val).strip():
                            try:
                                parsed = pd.to_datetime(val, dayfirst=False) if not isinstance(val, datetime) else val
                                return parsed if pd.notna(parsed) else None
                            except Exception:
                                return None
                        return None

                    def get_str(val, max_len: Optional[int] = None) -> Optional[str]:
                        if pd.notna(val) and str(val).strip():
                            s = str(val).strip()
                            return s[:max_len] if max_len else s
                        return None

                    enc_insert = []
                    for _, row in df.iterrows():
                        try:
                            ch_str = str(int(float(row['chamado'])))
                        except Exception:
                            ch_str = str(row['chamado']).strip()

                        enc_insert.append((
                            ch_str,
                            get_date(row.get('abertura')),
                            get_str(row.get('serie'), 255),
                            get_str(row.get('sku'), 100),
                            get_str(row.get('descricao_material'), 255),
                            get_str(row.get('equipamento'), 150),
                            get_str(row.get('barebone'), 150),
                            get_str(row.get('marca'), 150),
                            get_str(row.get('segmento'), 150),
                            get_str(row.get('tipo'), 150),
                            get_str(row.get('projeto'), 150),
                            get_str(row.get('assistencia_codigo'), 100),
                            get_str(row.get('assistencia_nome'), 255),
                            get_str(row.get('assistencia_tipo'), 100),
                            get_str(row.get('assistencia_uf'), 10),
                            get_str(row.get('assistencia_cidade'), 150),
                            get_date(row.get('ft')),
                            get_date(row.get('encerramento')),
                            get_str(row.get('encerramento_desc'), 255),
                            get_str(row.get('cliente_codigo'), 100),
                            get_str(row.get('cliente_nome'), 255),
                            get_str(row.get('cliente_uf'), 10),
                            get_str(row.get('cliente_cidade'), 150),
                            get_str(row.get('tecnico_nome'), 255),
                            get_str(row.get('texto_abertura')),
                            get_str(row.get('texto_encerrado')),
                            get_str(row.get('ocorrencia_chamado'), 255),
                            get_str(row.get('reincidente'), 50),
                            get_str(row.get('prioritario'), 50)
                        ))

                    insert_sql = """
                        INSERT INTO tb_encerrados_rrc (
                            chamado, abertura, serie, sku, descricao_material, equipamento, barebone, marca,
                            segmento, tipo, projeto, assistencia_codigo, assistencia_nome, assistencia_tipo,
                            assistencia_uf, assistencia_cidade, ft, encerramento, encerramento_desc,
                            cliente_codigo, cliente_nome, cliente_uf, cliente_cidade, tecnico_nome,
                            texto_abertura, texto_encerrado, ocorrencia_chamado, reincidente, prioritario
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s
                        )
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
