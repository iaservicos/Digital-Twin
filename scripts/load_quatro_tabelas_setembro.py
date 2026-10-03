"""
Script Oficial de Carga em Lote das 4 Tabelas de Regras de Cálculo do Brilha+:
1. chamados_sla (13.164 registros da BaseDL)
2. encerrados_rrc (5.999 registros do EncerradoRRC)
3. reincidencia (595 pares de Reincidencias com janela 90d)
4. pecas (7.725 registros de Consumo de Peças com flag de peças críticas)
Utiliza psycopg2.extras.execute_values para máxima performance sobre SSL/Pooler.
"""

import os
import sys
import time
import pandas as pd
from datetime import datetime

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from backend_python.core.database import get_db_connection
from psycopg2.extras import execute_values

def run_loader():
    t_start = time.time()
    print("=== INICIANDO CARGA OFICIAL DAS 4 TABELAS DE CÁLCULO ===", flush=True)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # -------------------------------------------------------------
            # 1. chamados_sla (de Posiview BaseDL.xlsx - 13.164 linhas)
            # -------------------------------------------------------------
            t0 = time.time()
            f_base = os.path.join(os.path.dirname(__file__), "..", "docs", "Planilhas Posiview", "setembro", "BaseDL.xlsx")
            print(f"\n1. Lendo {f_base}...", flush=True)
            df_base = pd.read_excel(f_base)
            print(f"   Lido em {time.time()-t0:.2f}s ({len(df_base)} linhas). Processando...", flush=True)

            sla_records = []
            for _, row in df_base.iterrows():
                ch = str(row.get('Chamado', '')).strip()
                if not ch or ch.lower() == 'nan':
                    continue
                ft = row.get('FT')
                if pd.isna(ft):
                    continue

                sla_st = str(row.get('SLA STATUS', row.get('SLA_status', 'DENTRO'))).strip().upper()
                sla_val = 'FORA' if 'FORA' in sla_st else 'DENTRO'

                sla_records.append((
                    ch,
                    str(row.get('CT', ''))[:30] if pd.notna(row.get('CT')) else None,
                    str(row.get('ATP', ''))[:150] if pd.notna(row.get('ATP')) else None,
                    pd.to_datetime(row.get('Abertura')) if pd.notna(row.get('Abertura')) else None,
                    pd.to_datetime(ft),
                    pd.to_datetime(row.get('Encerramento')) if pd.notna(row.get('Encerramento')) else None,
                    str(row.get('Segmento', 'PI-GOVERNO'))[:50],
                    str(row.get('Tipo', 'ATENDIMENTO ON SITE'))[:80],
                    str(row.get('Texto_abertura', '')) if pd.notna(row.get('Texto_abertura')) else None,
                    str(row.get('texto_breve', '')) if pd.notna(row.get('texto_breve')) else None,
                    str(row.get('Encdesc', ''))[:100] if pd.notna(row.get('Encdesc')) else None,
                    str(row.get('Texto_encerrado', '')) if pd.notna(row.get('Texto_encerrado')) else None,
                    str(row.get('Projeto', ''))[:50] if pd.notna(row.get('Projeto')) else None,
                    str(row.get('Codigo_cliente', row.get('Cliente_codigo', '')))[:50] if pd.notna(row.get('Codigo_cliente', row.get('Cliente_codigo'))) else None,
                    str(row.get('Cliente_nome', ''))[:200] if pd.notna(row.get('Cliente_nome')) else None,
                    str(row.get('Cliente_UF', ''))[:5] if pd.notna(row.get('Cliente_UF')) else None,
                    str(row.get('Cliente_cidade', ''))[:120] if pd.notna(row.get('Cliente_cidade')) else None,
                    str(row.get('Serie', ''))[:80] if pd.notna(row.get('Serie')) else None,
                    str(row.get('SKU', ''))[:80] if pd.notna(row.get('SKU')) else None,
                    str(row.get('Marca', ''))[:80] if pd.notna(row.get('Marca')) else None,
                    str(row.get('Equipamento', ''))[:80] if pd.notna(row.get('Equipamento')) else None,
                    str(row.get('Ocorrencia_chamado', ''))[:150] if pd.notna(row.get('Ocorrencia_chamado')) else None,
                    str(row.get('Classifica_chamado', ''))[:150] if pd.notna(row.get('Classifica_chamado')) else None,
                    str(row.get('Tecnico_nome', ''))[:150] if pd.notna(row.get('Tecnico_nome')) else None,
                    sla_val,
                    'PLANILHA_POSIVIEW'
                ))

            # Deduplicação por chamado
            seen_sla = set()
            dedup_sla = []
            for r in sla_records:
                if r[0] not in seen_sla:
                    seen_sla.add(r[0])
                    dedup_sla.append(r)

            print(f"   Inserindo {len(dedup_sla)} registros em chamados_sla...", flush=True)
            sql_sla = """
                INSERT INTO chamados_sla (
                    chamado, ct_codigo, atp_nome, abertura, ft, encerramento,
                    segmento, tipo, texto_abertura, texto_breve, encdesc, texto_encerrado,
                    projeto, cliente_codigo, cliente_nome, cliente_uf, cliente_cidade,
                    serie, sku, marca, equipamento, ocorrencia_chamado, classifica_chamado,
                    tecnico_nome, sla_status, fonte_carga
                ) VALUES %s
                ON CONFLICT (chamado) DO UPDATE SET
                    sla_status = EXCLUDED.sla_status,
                    tecnico_nome = EXCLUDED.tecnico_nome,
                    ct_codigo = EXCLUDED.ct_codigo,
                    ft = EXCLUDED.ft;
            """
            execute_values(cur, sql_sla, dedup_sla, page_size=2000)
            conn.commit()
            print(f"[OK] chamados_sla concluido em {time.time()-t0:.2f}s!", flush=True)

            # -------------------------------------------------------------
            # 2. encerrados_rrc (de EncerradoRRC.xlsx - 5.999 linhas)
            # -------------------------------------------------------------
            t1 = time.time()
            f_enc = os.path.join(os.path.dirname(__file__), "..", "docs", "Rone", "Setembro", "EncerradoRRC.xlsx")
            print(f"\n2. Lendo {f_enc}...", flush=True)
            df_enc = pd.read_excel(f_enc)
            print(f"   Lido em {time.time()-t1:.2f}s ({len(df_enc)} linhas). Processando...", flush=True)

            enc_records = []
            for _, row in df_enc.iterrows():
                ch = str(row.get('Chamado', '')).strip()
                if not ch or ch.lower() == 'nan':
                    continue
                enc = row.get('Encerramento', row.get('FT'))
                if pd.isna(enc):
                    continue

                enc_records.append((
                    ch,
                    pd.to_datetime(row.get('Abertura')) if pd.notna(row.get('Abertura')) else None,
                    pd.to_datetime(row.get('FT')) if pd.notna(row.get('FT')) else None,
                    pd.to_datetime(enc),
                    str(row.get('Encerramento_desc', 'ENCERRAMENTO'))[:100] if pd.notna(row.get('Encerramento_desc')) else 'ENCERRAMENTO',
                    str(row.get('Segmento', 'PI-GOVERNO'))[:50],
                    str(row.get('Tipo', 'ATENDIMENTO ON SITE'))[:80],
                    str(row.get('Projeto', ''))[:50] if pd.notna(row.get('Projeto')) else None,
                    str(row.get('Assistencia_codigo', ''))[:30] if pd.notna(row.get('Assistencia_codigo')) else None,
                    str(row.get('Assistencia_nome', ''))[:150] if pd.notna(row.get('Assistencia_nome')) else None,
                    str(row.get('Assistencia_UF', ''))[:5] if pd.notna(row.get('Assistencia_UF')) else None,
                    str(row.get('Assistencia_cidade', ''))[:120] if pd.notna(row.get('Assistencia_cidade')) else None,
                    str(row.get('Tecnico_nome', ''))[:150] if pd.notna(row.get('Tecnico_nome')) else None,
                    str(row.get('Serie', ''))[:80] if pd.notna(row.get('Serie')) else None,
                    str(row.get('SKU', ''))[:80] if pd.notna(row.get('SKU')) else None,
                    str(row.get('Descricao_material', ''))[:200] if pd.notna(row.get('Descricao_material')) else None,
                    str(row.get('Equipamento', ''))[:80] if pd.notna(row.get('Equipamento')) else None,
                    str(row.get('Ocorrencia_chamado', ''))[:150] if pd.notna(row.get('Ocorrencia_chamado')) else None,
                    str(row.get('Reincidente', ''))[:20] if pd.notna(row.get('Reincidente')) else None,
                    str(row.get('ATP Resumida', ''))[:50] if pd.notna(row.get('ATP Resumida')) else None,
                    'PLANILHA_RONE'
                ))

            seen_enc = set()
            dedup_enc = []
            for r in enc_records:
                if r[0] not in seen_enc:
                    seen_enc.add(r[0])
                    dedup_enc.append(r)

            print(f"   Inserindo {len(dedup_enc)} registros em encerrados_rrc...", flush=True)
            sql_enc = """
                INSERT INTO encerrados_rrc (
                    chamado, abertura, ft, encerramento, encerramento_desc,
                    segmento, tipo, projeto, assistencia_codigo, assistencia_nome,
                    assistencia_uf, assistencia_cidade, tecnico_nome,
                    serie, sku, descricao_material, equipamento,
                    ocorrencia_chamado, reincidente, atp_resumida, fonte_carga
                ) VALUES %s
                ON CONFLICT (chamado) DO UPDATE SET
                    encerramento = EXCLUDED.encerramento,
                    tecnico_nome = EXCLUDED.tecnico_nome,
                    assistencia_codigo = EXCLUDED.assistencia_codigo;
            """
            execute_values(cur, sql_enc, dedup_enc, page_size=2000)
            conn.commit()
            print(f"[OK] encerrados_rrc concluido em {time.time()-t1:.2f}s!", flush=True)

            # -------------------------------------------------------------
            # 3. reincidencia (de Reincidência SET- GOV-CORPv1 - 2026.xlsx - 595 linhas)
            # -------------------------------------------------------------
            t2 = time.time()
            f_reinc = os.path.join(os.path.dirname(__file__), "..", "docs", "Rone", "Setembro", "Reincidência SET- GOV-CORPv1 - 2026.xlsx")
            print(f"\n3. Lendo aba Reincidências de {f_reinc}...", flush=True)
            df_reinc = pd.read_excel(f_reinc, sheet_name="Reincidências")
            print(f"   Lido em {time.time()-t2:.2f}s ({len(df_reinc)} linhas). Processando...", flush=True)

            reinc_records = []
            for _, row in df_reinc.iterrows():
                ch_rrc = str(row.get('chamado_rrc', '')).strip()
                ch_ant = str(row.get('chamado_anterior', '')).strip()
                if not ch_rrc or not ch_ant or ch_rrc.lower() == 'nan' or ch_ant.lower() == 'nan':
                    continue

                enc_rrc = row.get('encerramento_rrc', row.get('ft_rrc'))
                if pd.isna(enc_rrc):
                    continue

                dias = row.get('Intervalo_dias')
                try:
                    dias_val = int(float(dias)) if pd.notna(dias) else None
                except Exception:
                    dias_val = None

                reinc_records.append((
                    ch_rrc,
                    ch_ant,
                    pd.to_datetime(row.get('abertura_rrc')) if pd.notna(row.get('abertura_rrc')) else None,
                    pd.to_datetime(row.get('ft_rrc')) if pd.notna(row.get('ft_rrc')) else None,
                    pd.to_datetime(enc_rrc),
                    pd.to_datetime(row.get('abertura_anterior')) if pd.notna(row.get('abertura_anterior')) else None,
                    pd.to_datetime(row.get('ft_anterior')) if pd.notna(row.get('ft_anterior')) else None,
                    pd.to_datetime(row.get('encerramento_anterior')) if pd.notna(row.get('encerramento_anterior')) else None,
                    dias_val,
                    str(row.get('tecnico_nome_anterior', ''))[:150] if pd.notna(row.get('tecnico_nome_anterior')) else None,
                    str(row.get('tecnico_nome_rrc', ''))[:150] if pd.notna(row.get('tecnico_nome_rrc')) else None,
                    str(row.get('ct_anterior', ''))[:30] if pd.notna(row.get('ct_anterior')) else None,
                    str(row.get('ct_rrc', ''))[:30] if pd.notna(row.get('ct_rrc')) else None,
                    str(row.get('projeto_anterior', ''))[:50] if pd.notna(row.get('projeto_anterior')) else None,
                    str(row.get('defeito_anterior', ''))[:150] if pd.notna(row.get('defeito_anterior')) else None,
                    str(row.get('defeito_rrc', ''))[:150] if pd.notna(row.get('defeito_rrc')) else None,
                    str(row.get('aplicado_peca_anterior', ''))[:50] if pd.notna(row.get('aplicado_peca_anterior')) else None,
                    str(row.get('aplicado_peca_rrc', ''))[:50] if pd.notna(row.get('aplicado_peca_rrc')) else None,
                    str(row.get('texto_encerrado_anterior', '')) if pd.notna(row.get('texto_encerrado_anterior')) else None,
                    str(row.get('texto_encerrado_rrc', '')) if pd.notna(row.get('texto_encerrado_rrc')) else None,
                    str(row.get('Mesmo_Motivo', ''))[:20] if pd.notna(row.get('Mesmo_Motivo')) else None,
                    str(row.get('Reincidência_Auditada', ''))[:20] if pd.notna(row.get('Reincidência_Auditada')) else None,
                    True if (dias_val is None or dias_val <= 90) else False,
                    'PLANILHA_RONE'
                ))

            seen_reinc = set()
            dedup_reinc = []
            for r in reinc_records:
                pair = (r[0], r[1])
                if pair not in seen_reinc:
                    seen_reinc.add(pair)
                    dedup_reinc.append(r)

            print(f"   Inserindo {len(dedup_reinc)} registros em reincidencia...", flush=True)
            sql_reinc = """
                INSERT INTO reincidencia (
                    chamado_rrc, chamado_anterior, abertura_rrc, ft_rrc, encerramento_rrc,
                    abertura_anterior, ft_anterior, encerramento_anterior, intervalo_dias,
                    tecnico_nome_anterior, tecnico_nome_rrc, ct_anterior, ct_rrc,
                    projeto_anterior, defeito_anterior, defeito_rrc,
                    aplicado_peca_anterior, aplicado_peca_rrc,
                    texto_encerrado_anterior, texto_encerrado_rrc,
                    mesmo_motivo, reincidencia_auditada, is_elegivel_regra_90d, fonte_carga
                ) VALUES %s
                ON CONFLICT (chamado_rrc, chamado_anterior) DO UPDATE SET
                    tecnico_nome_anterior = EXCLUDED.tecnico_nome_anterior,
                    ct_anterior = EXCLUDED.ct_anterior,
                    intervalo_dias = EXCLUDED.intervalo_dias,
                    encerramento_rrc = EXCLUDED.encerramento_rrc;
            """
            execute_values(cur, sql_reinc, dedup_reinc, page_size=2000)
            conn.commit()
            print(f"[OK] reincidencia concluido em {time.time()-t2:.2f}s!", flush=True)

            # -------------------------------------------------------------
            # 4. pecas (de docs/Rone/Setembro/BaseDL.xlsx - 7.725 linhas com peças)
            # -------------------------------------------------------------
            t3 = time.time()
            f_rone_base = os.path.join(os.path.dirname(__file__), "..", "docs", "Rone", "Setembro", "BaseDL.xlsx")
            print(f"\n4. Lendo {f_rone_base} para peças...", flush=True)
            df_rone_base = pd.read_excel(f_rone_base)
            print(f"   Lido em {time.time()-t3:.2f}s ({len(df_rone_base)} linhas). Processando...", flush=True)

            pecas_records = []
            for _, row in df_rone_base.iterrows():
                ch = str(row.get('Chamado', '')).strip()
                if not ch or ch.lower() == 'nan':
                    continue
                ft = row.get('FT')
                if pd.isna(ft):
                    continue

                subg = str(row.get('SubGrupo', row.get('grupo_mercadoria', ''))) if pd.notna(row.get('SubGrupo')) else None
                gdesc = str(row.get('grupo_mercadoria_desc', '')) if pd.notna(row.get('grupo_mercadoria_desc')) else None
                c_aplic_desc = str(row.get('Codigo_aplicado_desc', '')) if pd.notna(row.get('Codigo_aplicado_desc')) else None

                full_text = f"{subg or ''} {gdesc or ''} {c_aplic_desc or ''}".upper()
                is_crit = any(k in full_text for k in ['PLM', 'PLACA', 'SSD', 'HD', 'HDD', 'TELA', 'LCD'])

                pecas_records.append((
                    ch,
                    str(row.get('CT', ''))[:30] if pd.notna(row.get('CT')) else None,
                    str(row.get('ATP', ''))[:150] if pd.notna(row.get('ATP')) else None,
                    pd.to_datetime(ft),
                    str(row.get('Tecnico_nome', ''))[:150] if pd.notna(row.get('Tecnico_nome')) else None,
                    subg[:80] if subg else None,
                    str(row.get('grupo_mercadoria', ''))[:80] if pd.notna(row.get('grupo_mercadoria')) else None,
                    gdesc[:150] if gdesc else None,
                    str(row.get('Codigo_solicitado', ''))[:50] if pd.notna(row.get('Codigo_solicitado')) else None,
                    str(row.get('Codigo_solicitado_desc', ''))[:200] if pd.notna(row.get('Codigo_solicitado_desc')) else None,
                    str(row.get('Codigo_aplicado', ''))[:50] if pd.notna(row.get('Codigo_aplicado')) else None,
                    c_aplic_desc[:200] if c_aplic_desc else None,
                    str(row.get('Acao', ''))[:100] if pd.notna(row.get('Acao')) else None,
                    str(row.get('Equipamento', ''))[:80] if pd.notna(row.get('Equipamento')) else None,
                    is_crit,
                    'PLANILHA_RONE'
                ))

            print(f"   Inserindo {len(pecas_records)} registros em pecas...", flush=True)
            sql_pecas = """
                INSERT INTO pecas (
                    chamado, ct_codigo, atp_nome, ft, tecnico_nome,
                    subgrupo, grupo_mercadoria, grupo_mercadoria_desc,
                    codigo_solicitado, codigo_solicitado_desc,
                    codigo_aplicado, codigo_aplicado_desc,
                    acao, tipo_equipamento, is_peca_critica, fonte_carga
                ) VALUES %s;
            """
            cur.execute("DELETE FROM pecas WHERE fonte_carga = 'PLANILHA_RONE';")
            execute_values(cur, sql_pecas, pecas_records, page_size=2000)
            conn.commit()
            print(f"[OK] pecas concluido em {time.time()-t3:.2f}s!", flush=True)

            # -------------------------------------------------------------
            # RESUMO CONSOLIDADO NO BANCO
            # -------------------------------------------------------------
            print("\n=== RESUMO DAS 4 TABELAS NO BANCO POSTGRESQL ===", flush=True)
            for t in ['chamados_sla', 'pecas', 'reincidencia', 'encerrados_rrc']:
                cur.execute(f"SELECT count(*) FROM {t};")
                print(f" - {t}: {cur.fetchone()[0]} linhas", flush=True)

    print(f"\n[SUCESSO] CARGA COMPLETA FINALIZADA COM SUCESSO EM {time.time()-t_start:.2f}s!", flush=True)

if __name__ == "__main__":
    run_loader()
