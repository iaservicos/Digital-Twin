"""
scripts/sync_tecnicos_xlsx.py
Sincronizacao, enriquecimento e reativacao da base de Tecnicos e Supervisores
a partir da planilha corporativa docs/Tecnicos.xlsx.

Regras Estritas:
1. NUNCA excluir nenhum registro (DELETE e proibido).
2. Reativar os 81 tecnicos da planilha que estavam inativos (ativo=true, status_colaborador='ATIVO').
3. Atualizar os 81 tecnicos ja ativos com centro_custo, contatos e supervisor.
4. Inserir os 15 novos tecnicos ausentes (ativo=true, senha temporaria Bcrypt, primeiro acesso).
5. Manter os 19 tecnicos exclusivos do CSV Supabase ativos (uniao consolidada = 196 ativos).
6. Atualizar telefones corporativos dos supervisores e dados de Renato Sucupira.
"""

import os
import sys
import re
import unicodedata
import openpyxl
import psycopg2
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
load_dotenv('.env')

from backend_python.core import config
from backend_python.core.security import hash_password

def normalize_text(text):
    if not text:
        return ''
    text = unicodedata.normalize('NFKD', str(text)).encode('ascii', 'ignore').decode('utf-8')
    return re.sub(r'\s+', ' ', text).strip().upper()

def clean_str(val):
    if val is None:
        return None
    s = str(val).strip()
    if s.lower() in ('null', '', 'none', 'undefined', '-'):
        return None
    return s

def clean_phone(val):
    s = clean_str(val)
    if not s or s == '-':
        return None
    return s

def main():
    xlsx_file_path = os.path.abspath('docs/Tecnicos.xlsx')
    if not os.path.exists(xlsx_file_path):
        raise FileNotFoundError(f"Arquivo XLSX nao encontrado em: {xlsx_file_path}")

    print(f"[*] Conectando ao Supabase PostgreSQL: {config.POSTGRES_HOST}...")
    conn = psycopg2.connect(
        host=config.POSTGRES_HOST,
        port=config.POSTGRES_PORT,
        dbname=config.POSTGRES_DB,
        user=config.POSTGRES_USER,
        password=config.POSTGRES_PASSWORD,
        sslmode='require',
        connect_timeout=15
    )
    conn.autocommit = False
    cur = conn.cursor()

    try:
        print(f"[*] Lendo planilha XLSX: {xlsx_file_path}")
        wb = openpyxl.load_workbook(xlsx_file_path, data_only=True)
        sheet = wb['Planilha1']
        raw_rows = list(sheet.iter_rows(min_row=2, values_only=True))
        print(f"[+] Total de linhas na planilha: {len(raw_rows)}")

        # -------------------------------------------------------------
        # FASE 1: Atualizar e Enriquecer Supervisores
        # -------------------------------------------------------------
        print("\n--- FASE 1: Enriquecimento de Supervisores ---")
        cur.execute("SELECT id_supervisor, nome_completo, email, matricula, celular_corporativo FROM tb_supervisor;")
        db_sups = cur.fetchall()
        db_sup_by_name = {normalize_text(r[1]): r for r in db_sups if r[1]}
        db_sup_by_email = {(r[2] or '').strip().lower(): r for r in db_sups if r[2]}

        # Mapear dados de supervisores presentes na planilha
        sups_data = {}
        for r in raw_rows:
            if not any(r) or not r[0]:
                continue
            s_name = clean_str(r[5])
            s_mat = clean_str(r[6])
            s_phone = clean_phone(r[7])
            s_email = clean_str(r[8])
            if s_name:
                norm_s = normalize_text(s_name)
                if norm_s not in sups_data:
                    sups_data[norm_s] = {'name': s_name, 'mat': s_mat, 'phone': s_phone, 'email': s_email}
                else:
                    if s_phone and not sups_data[norm_s]['phone']:
                        sups_data[norm_s]['phone'] = s_phone
                    if s_mat and not sups_data[norm_s]['mat']:
                        sups_data[norm_s]['mat'] = s_mat
                    if s_email and not sups_data[norm_s]['email']:
                        sups_data[norm_s]['email'] = s_email

        sup_id_mapping = {}  # norm_name -> id_supervisor
        for norm_name, s_info in sups_data.items():
            match = None
            if norm_name in db_sup_by_name:
                match = db_sup_by_name[norm_name]
            elif s_info['email'] and s_info['email'].lower() in db_sup_by_email:
                match = db_sup_by_email[s_info['email'].lower()]
            else:
                # busca parcial (ex: Renato Sucupira)
                for db_norm, db_r in db_sup_by_name.items():
                    if norm_name[:12] in db_norm or db_norm[:12] in norm_name:
                        match = db_r
                        break

            if match:
                id_sup = match[0]
                sup_id_mapping[norm_name] = id_sup
                if s_info['email']:
                    sup_id_mapping[s_info['email'].lower()] = id_sup

                # Update supervisor celular_corporativo and matricula/email if missing
                cur.execute("""
                    UPDATE tb_supervisor
                    SET celular_corporativo = COALESCE(%s, celular_corporativo),
                        matricula = COALESCE(matricula, %s),
                        email = CASE WHEN email ILIKE 'PASILVA%%' AND %s IS NOT NULL THEN %s ELSE COALESCE(email, %s) END
                    WHERE id_supervisor = %s;
                """, (s_info['phone'], s_info['mat'], s_info['email'], s_info['email'], s_info['email'], id_sup))
                print(f"  [+] Supervisor atualizado: ID {id_sup} - {match[1]} (Mat: {s_info['mat']}, Tel: {s_info['phone']}, Email: {s_info['email']})")

        # -------------------------------------------------------------
        # FASE 2: Sincronizacao dos 177 Tecnicos da Planilha
        # -------------------------------------------------------------
        print("\n--- FASE 2: Sincronizacao, Reativacao e Carga de Tecnicos ---")
        cur.execute("SELECT id_tecnico, matricula, nome_completo, email, ativo FROM tb_tecnico;")
        db_tecs = cur.fetchall()
        db_tec_by_name = {normalize_text(r[2]): r for r in db_tecs if r[2]}
        db_tec_by_email = {(r[3] or '').strip().lower(): r for r in db_tecs if r[3]}

        tec_reactivated = 0
        tec_updated_active = 0
        tec_inserted = 0

        for r in raw_rows:
            if not any(r) or not r[0]:
                continue

            raw_name = str(r[0]).strip()
            norm_name = normalize_text(raw_name)
            cc_code = clean_str(r[1])
            phone = clean_phone(r[3])
            email = clean_str(r[4])
            s_name = clean_str(r[5])

            # Resolve supervisor ID
            id_sup = None
            if s_name:
                norm_s = normalize_text(s_name)
                id_sup = sup_id_mapping.get(norm_s)
                if not id_sup and clean_str(r[8]):
                    id_sup = sup_id_mapping.get(clean_str(r[8]).lower())

            # Match technician in DB
            match = None
            if norm_name in db_tec_by_name:
                match = db_tec_by_name[norm_name]
            elif email and email.lower() in db_tec_by_email:
                match = db_tec_by_email[email.lower()]

            if match:
                id_tecnico = match[0]
                was_active = match[4]

                cur.execute("""
                    UPDATE tb_tecnico
                    SET ativo = true,
                        status_colaborador = 'ATIVO',
                        centro_custo = COALESCE(%s, centro_custo),
                        celular_corporativo = COALESCE(%s, celular_corporativo),
                        email = COALESCE(%s, email),
                        id_supervisor = COALESCE(%s, id_supervisor),
                        updated_at = now()
                    WHERE id_tecnico = %s;
                """, (cc_code, phone, email, id_sup, id_tecnico))

                if was_active:
                    tec_updated_active += 1
                else:
                    tec_reactivated += 1
            else:
                # Inserir novo técnico
                parts = raw_name.split()
                p_nome = parts[0] if parts else ''
                s_nome = ' '.join(parts[1:]) if len(parts) > 1 else ''
                initial_pwd = 'Positivo@2026'
                hashed_pwd = hash_password(initial_pwd)

                cur.execute("""
                    INSERT INTO tb_tecnico (
                        nome_completo, primeiro_nome, sobrenome, email, celular_corporativo,
                        centro_custo, cargo, tipo_contrato, id_supervisor, ativo, status_colaborador,
                        role, senha, is_primeiro_acesso, created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s, 'Tecnico de Campo', 'proprio', %s, true, 'ATIVO',
                        'PADRAO', %s, true, now(), now()
                    )
                    RETURNING id_tecnico;
                """, (raw_name, p_nome, s_nome, email, phone, cc_code, id_sup, hashed_pwd))
                new_id = cur.fetchone()[0]
                tec_inserted += 1

                # Update in-memory dicts
                db_tec_by_name[norm_name] = (new_id, None, raw_name, email, True)
                if email:
                    db_tec_by_email[email.lower()] = (new_id, None, raw_name, email, True)

        print(f"[+] Tecnicos ja ativos atualizados com Centro de Custo/Contatos: {tec_updated_active}")
        print(f"[+] Tecnicos REATIVADOS no banco (ativo=true): {tec_reactivated}")
        print(f"[+] Novos Tecnicos CADASTRADOS (INSERT): {tec_inserted}")

        # -------------------------------------------------------------
        # FASE 3: Auditoria Final e Verificacao de Integridade
        # -------------------------------------------------------------
        print("\n--- FASE 3: Auditoria Final Pos-Carga ---")
        cur.execute("SELECT count(*) FROM tb_tecnico WHERE ativo = true;")
        total_active = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM tb_tecnico WHERE ativo = false;")
        total_inactive = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM tb_tecnico;")
        total_tecs = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM tb_tecnico WHERE centro_custo IS NOT NULL AND ativo = true;")
        total_with_cc = cur.fetchone()[0]

        print(f"[*] Metricas Consolidadas:")
        print(f"    • Total de Tecnicos no Banco: {total_tecs}")
        print(f"    • Total de Tecnicos ATIVOS: {total_active} (Meta: 196)")
        print(f"    • Total de Tecnicos INATIVOS: {total_inactive}")
        print(f"    • Tecnicos Ativos com Centro de Custo: {total_with_cc}")

        conn.commit()
        print("\n[SUCCESS] Transacao consolidada (COMMIT) com sucesso no Supabase PostgreSQL!")

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Falha na execucao, transacao cancelada (ROLLBACK): {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
