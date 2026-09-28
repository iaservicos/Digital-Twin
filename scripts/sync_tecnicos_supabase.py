"""
scripts/sync_tecnicos_supabase.py
Sincronizacao, enriquecimento e consolidacao da base de Tecnicos, Supervisores,
Coordenadores e Bases ATP no banco Supabase PostgreSQL a partir do CSV.

Regras Estritas:
1. NUNCA excluir nenhum registro (DELETE e proibido).
2. Tecnicos no CSV que nao estejam no banco sao cadastrados (INSERT).
3. Tecnicos no banco ausentes no CSV tem status definido como inativo (ativo=False, status_colaborador='INATIVO').
4. Enriquecer campos existentes e novos (14 novas colunas em tb_tecnico).
5. Vincular supervisores e bases ATP com seguranca.
"""

import os
import sys
import csv
import re
import unicodedata
import psycopg2
from dotenv import load_dotenv

# Garantir path raiz
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
load_dotenv('.env')

from backend_python.core import config
from backend_python.core.security import hash_password

def normalize_text(text):
    if not text:
        return ''
    text = unicodedata.normalize('NFKD', str(text)).encode('ascii', 'ignore').decode('utf-8')
    return re.sub(r'\s+', ' ', text).strip().upper()

def clean_digits(text):
    if not text:
        return ''
    return re.sub(r'\D', '', str(text))

def clean_str(val):
    if val is None:
        return None
    s = str(val).strip()
    if s.lower() in ('null', '', 'none', 'undefined'):
        return None
    return s

def clean_bool(val, default=True):
    s = clean_str(val)
    if s is None:
        return default
    return s.lower() in ('true', '1', 't', 'yes', 'sim', 'verdadeiro')

def clean_int(val):
    s = clean_str(val)
    if not s:
        return None
    try:
        return int(s)
    except Exception:
        return None

def main():
    csv_file_path = os.path.abspath('Project_Docs/Tecnicos_supabase.csv')
    if not os.path.exists(csv_file_path):
        # Fallback to frontend_react/assets/Logo if not found
        alt_path = os.path.abspath('frontend_react/assets/Logo/Tecnicos_Supabase.csv')
        if os.path.exists(alt_path):
            csv_file_path = alt_path
        else:
            raise FileNotFoundError(f"Arquivo CSV nao encontrado em: {csv_file_path}")

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
        print(f"[*] Lendo arquivo CSV: {csv_file_path}")
        with open(csv_file_path, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f)
            csv_rows = list(reader)
        print(f"[+] Total de linhas no CSV: {len(csv_rows)}")

        # -------------------------------------------------------------
        # FASE 1: Sincronizar e Enriquecer Coordenadores
        # -------------------------------------------------------------
        print("\n--- FASE 1: Sincronizacao de Coordenadores ---")
        cur.execute("SELECT id_coordenador, nome_completo, email, matricula, cpf FROM tb_coordenador;")
        db_coords = cur.fetchall()
        db_coord_by_email = {(r[2] or '').strip().lower(): r for r in db_coords if r[2]}
        db_coord_by_name = {normalize_text(r[1]): r for r in db_coords if r[1]}

        coord_updates = 0
        coords_data = {}
        for r in csv_rows:
            c_name = clean_str(r.get('coordinator_name'))
            c_email = clean_str(r.get('coordinator_email'))
            c_mat = clean_str(r.get('matricula_coordenador'))
            c_cpf = clean_str(r.get('cpf_coordenador'))
            if c_name:
                norm_c = normalize_text(c_name)
                if norm_c not in coords_data:
                    coords_data[norm_c] = {'name': c_name, 'email': c_email, 'matricula': c_mat, 'cpf': c_cpf}
                else:
                    if c_mat and not coords_data[norm_c]['matricula']:
                        coords_data[norm_c]['matricula'] = c_mat
                    if c_cpf and not coords_data[norm_c]['cpf']:
                        coords_data[norm_c]['cpf'] = c_cpf

        for norm_name, c_info in coords_data.items():
            match = None
            if c_info['email'] and c_info['email'].lower() in db_coord_by_email:
                match = db_coord_by_email[c_info['email'].lower()]
            elif norm_name in db_coord_by_name:
                match = db_coord_by_name[norm_name]

            if match:
                id_coord = match[0]
                cur.execute("""
                    UPDATE tb_coordenador
                    SET matricula = COALESCE(%s, matricula),
                        cpf = COALESCE(%s, cpf)
                    WHERE id_coordenador = %s;
                """, (c_info['matricula'], c_info['cpf'], id_coord))
                coord_updates += 1
                print(f"  [+] Coordenador atualizado: ID {id_coord} - {match[1]} (Mat: {c_info['matricula']}, CPF: {c_info['cpf']})")

        # -------------------------------------------------------------
        # FASE 2: Sincronizar e Enriquecer Supervisores
        # -------------------------------------------------------------
        print("\n--- FASE 2: Sincronizacao de Supervisores ---")
        cur.execute("SELECT id_supervisor, nome_completo, email, matricula, cpf, id_coordenador FROM tb_supervisor;")
        db_sups = cur.fetchall()
        db_sup_by_email = {(r[2] or '').strip().lower(): r for r in db_sups if r[2]}
        db_sup_by_name = {normalize_text(r[1]): r for r in db_sups if r[1]}

        # Map coordinator by email/name to id_coordenador
        cur.execute("SELECT id_coordenador, nome_completo, email FROM tb_coordenador;")
        active_coords = cur.fetchall()
        coord_id_by_email = {(r[2] or '').strip().lower(): r[0] for r in active_coords if r[2]}
        coord_id_by_name = {normalize_text(r[1]): r[0] for r in active_coords if r[1]}

        sups_data = {}
        for r in csv_rows:
            s_name = clean_str(r.get('supervisor_name'))
            s_email = clean_str(r.get('supervisor_email'))
            s_mat = clean_str(r.get('matricula_supervisor'))
            s_cpf = clean_str(r.get('cpf_supervisor'))
            c_name = clean_str(r.get('coordinator_name'))
            c_email = clean_str(r.get('coordinator_email'))

            if s_name:
                norm_s = normalize_text(s_name)
                if norm_s not in sups_data:
                    sups_data[norm_s] = {
                        'name': s_name,
                        'email': s_email,
                        'matricula': s_mat,
                        'cpf': s_cpf,
                        'coord_name': c_name,
                        'coord_email': c_email
                    }
                else:
                    if s_mat and not sups_data[norm_s]['matricula']:
                        sups_data[norm_s]['matricula'] = s_mat
                    if s_cpf and not sups_data[norm_s]['cpf']:
                        sups_data[norm_s]['cpf'] = s_cpf
                    if s_email and not sups_data[norm_s]['email']:
                        sups_data[norm_s]['email'] = s_email

        sup_updates = 0
        sup_inserts = 0
        sup_id_mapping = {}  # norm_name -> id_supervisor

        for norm_name, s_info in sups_data.items():
            match = None
            if s_info['email'] and s_info['email'].lower() in db_sup_by_email:
                match = db_sup_by_email[s_info['email'].lower()]
            elif norm_name in db_sup_by_name:
                match = db_sup_by_name[norm_name]

            # Resolve id_coordenador
            id_coord = None
            if s_info['coord_email'] and s_info['coord_email'].lower() in coord_id_by_email:
                id_coord = coord_id_by_email[s_info['coord_email'].lower()]
            elif s_info['coord_name'] and normalize_text(s_info['coord_name']) in coord_id_by_name:
                id_coord = coord_id_by_name[normalize_text(s_info['coord_name'])]

            if match:
                id_sup = match[0]
                cur.execute("""
                    UPDATE tb_supervisor
                    SET matricula = COALESCE(%s, matricula),
                        cpf = COALESCE(%s, cpf),
                        email = COALESCE(%s, email),
                        id_coordenador = COALESCE(%s, id_coordenador)
                    WHERE id_supervisor = %s;
                """, (s_info['matricula'], s_info['cpf'], s_info['email'], id_coord, id_sup))
                sup_updates += 1
                sup_id_mapping[norm_name] = id_sup
                if s_info['email']:
                    sup_id_mapping[s_info['email'].lower()] = id_sup
                print(f"  [+] Supervisor atualizado: ID {id_sup} - {match[1]} (Mat: {s_info['matricula']}, CPF: {s_info['cpf']})")
            else:
                # Inserir novo supervisor (ex: Robson Leal)
                initial_pwd = s_info['matricula'] or '123456'
                hashed_pwd = hash_password(initial_pwd)
                parts = s_info['name'].split()
                p_nome = parts[0] if parts else ''
                s_nome = ' '.join(parts[1:]) if len(parts) > 1 else ''

                cur.execute("""
                    INSERT INTO tb_supervisor (
                        matricula, nome_completo, primeiro_nome, sobrenome, email, cpf,
                        id_coordenador, senha, role, ativo, is_primeiro_acesso, status_supervisor
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'ADMINISTRADOR', true, true, 'ATIVO')
                    RETURNING id_supervisor;
                """, (
                    s_info['matricula'], s_info['name'], p_nome, s_nome, s_info['email'], s_info['cpf'],
                    id_coord, hashed_pwd
                ))
                new_sup_id = cur.fetchone()[0]
                sup_inserts += 1
                sup_id_mapping[norm_name] = new_sup_id
                if s_info['email']:
                    sup_id_mapping[s_info['email'].lower()] = new_sup_id
                print(f"  [+] NOVO Supervisor inserido: ID {new_sup_id} - {s_info['name']} (Mat: {s_info['matricula']}, CPF: {s_info['cpf']})")

        # -------------------------------------------------------------
        # FASE 3: Mapeamento de Bases ATP
        # -------------------------------------------------------------
        print("\n--- FASE 3: Preparacao de Bases ATP ---")
        cur.execute("SELECT ct_codigo, nome_atp, cidade, uf FROM tb_base_atp;")
        db_bases = cur.fetchall()
        print(f"[+] Total de bases em tb_base_atp: {len(db_bases)}")

        def resolve_ct_codigo(raw_base):
            if not raw_base:
                return None
            nb = normalize_text(raw_base)
            if nb in ('NULL', '', 'NONE'):
                return None
            clean_b = nb.replace('BASE_', '').replace('BASE ', '').replace('_', ' ').strip()

            # Exact match by ct_codigo
            for ct, name, cid, uf in db_bases:
                if ct and nb == normalize_text(ct):
                    return ct
            # Exact match by nome_atp
            for ct, name, cid, uf in db_bases:
                if name and nb == normalize_text(name):
                    return ct
            # Match by city or cleaned name
            for ct, name, cid, uf in db_bases:
                n_name = normalize_text(name)
                n_cid = normalize_text(cid)
                if clean_b and (clean_b == n_name or clean_b == n_cid):
                    return ct
            # Partial match inside name
            for ct, name, cid, uf in db_bases:
                n_name = normalize_text(name)
                n_cid = normalize_text(cid)
                if clean_b and (clean_b in n_name or clean_b in n_cid):
                    return ct
            return None

        # -------------------------------------------------------------
        # FASE 4: Processamento dos Tecnicos do CSV (100 linhas)
        # -------------------------------------------------------------
        print("\n--- FASE 4: Sincronizacao e Enriquecimento de Tecnicos ---")
        cur.execute("SELECT id_tecnico, matricula, nome_completo, cpf, email, ativo FROM tb_tecnico;")
        db_tecs = cur.fetchall()
        db_tec_by_mat = {str(r[1]).strip().upper(): r for r in db_tecs if r[1] and str(r[1]).strip().lower() != 'null'}
        db_tec_by_cpf = {clean_digits(r[3]): r for r in db_tecs if r[3] and clean_digits(r[3])}
        db_tec_by_name = {normalize_text(r[2]): r for r in db_tecs if r[2]}

        processed_tecnico_ids = set()
        tec_updates = 0
        tec_inserts = 0
        base_links = 0

        for r in csv_rows:
            raw_id = clean_int(r.get('id'))
            name = clean_str(r.get('name'))
            if not name:
                continue

            mat = clean_str(r.get('matricula'))
            cpf = clean_str(r.get('cpf'))
            cpf_digits = clean_digits(cpf)
            rg = clean_str(r.get('rg'))
            orgao = clean_str(r.get('orgao_emissor'))
            email = clean_str(r.get('email'))
            phone = clean_str(r.get('phone'))
            region = clean_str(r.get('region'))
            contract_type = clean_str(r.get('technician_type')) or 'proprio'
            cargo = clean_str(r.get('tecnico_informatica')) or 'Tecnico de Campo'
            data_nasc = clean_str(r.get('data_nascimento'))
            endereco = clean_str(r.get('endereco_atual'))
            cidade_uf = clean_str(r.get('cidade_uf'))
            afastado = clean_bool(r.get('afastado'), default=False)
            inv_day = clean_str(r.get('inventory_day'))
            inv_time = clean_str(r.get('inventory_time'))
            databricks = clean_str(r.get('databricks_name'))
            logistics = clean_str(r.get('logistics_email'))
            base_str = clean_str(r.get('base'))
            is_active = clean_bool(r.get('active'), default=True)

            # Resolve supervisor ID
            s_name = clean_str(r.get('supervisor_name'))
            s_email = clean_str(r.get('supervisor_email'))
            id_supervisor = None
            if s_email and s_email.lower() in sup_id_mapping:
                id_supervisor = sup_id_mapping[s_email.lower()]
            elif s_name and normalize_text(s_name) in sup_id_mapping:
                id_supervisor = sup_id_mapping[normalize_text(s_name)]

            # Resolve base ATP
            ct_codigo = resolve_ct_codigo(base_str)

            # Split name into first and last
            parts = name.split()
            primeiro_nome = parts[0] if parts else ''
            sobrenome = ' '.join(parts[1:]) if len(parts) > 1 else ''

            # Match existing technician in DB
            match = None
            match_method = ''
            if mat and mat.upper() in db_tec_by_mat:
                match = db_tec_by_mat[mat.upper()]
                match_method = f'matricula ({mat})'
            elif cpf_digits and cpf_digits in db_tec_by_cpf:
                match = db_tec_by_cpf[cpf_digits]
                match_method = f'cpf ({cpf})'
            elif normalize_text(name) in db_tec_by_name:
                match = db_tec_by_name[normalize_text(name)]
                match_method = f'nome ({name})'

            if match:
                id_tecnico = match[0]
                processed_tecnico_ids.add(id_tecnico)

                # UPDATE tb_tecnico
                cur.execute("""
                    UPDATE tb_tecnico
                    SET id_externo_supabase = COALESCE(%s, id_externo_supabase),
                        nome_completo = %s,
                        primeiro_nome = COALESCE(%s, primeiro_nome),
                        sobrenome = COALESCE(%s, sobrenome),
                        matricula = COALESCE(%s, matricula),
                        cpf = COALESCE(%s, cpf),
                        rg = COALESCE(%s, rg),
                        orgao_emissor = COALESCE(%s, orgao_emissor),
                        email = COALESCE(%s, email),
                        celular_corporativo = COALESCE(%s, celular_corporativo),
                        cargo = COALESCE(%s, cargo),
                        tipo_contrato = COALESCE(%s, tipo_contrato),
                        regiao = COALESCE(%s, regiao),
                        data_nascimento = COALESCE(%s::date, data_nascimento),
                        endereco_atual = COALESCE(%s, endereco_atual),
                        cidade_uf = COALESCE(%s, cidade_uf),
                        afastado = %s,
                        dia_inventario = COALESCE(%s, dia_inventario),
                        horario_inventario = COALESCE(%s::time, horario_inventario),
                        nome_databricks = COALESCE(%s, nome_databricks),
                        email_logistica = COALESCE(%s, email_logistica),
                        nome_base_origem = COALESCE(%s, nome_base_origem),
                        id_supervisor = COALESCE(%s, id_supervisor),
                        ativo = %s,
                        status_colaborador = %s,
                        updated_at = now()
                    WHERE id_tecnico = %s;
                """, (
                    raw_id, name, primeiro_nome, sobrenome, mat, cpf, rg, orgao,
                    email, phone, cargo, contract_type, region, data_nasc, endereco, cidade_uf,
                    afastado, inv_day, inv_time, databricks, logistics, base_str,
                    id_supervisor, is_active, ('ATIVO' if is_active else 'INATIVO'), id_tecnico
                ))
                tec_updates += 1
            else:
                # INSERT new technician
                initial_pwd = mat or cpf_digits or '123456'
                hashed_pwd = hash_password(initial_pwd)

                cur.execute("""
                    INSERT INTO tb_tecnico (
                        id_externo_supabase, nome_completo, primeiro_nome, sobrenome,
                        matricula, cpf, rg, orgao_emissor, email, celular_corporativo,
                        cargo, tipo_contrato, regiao, data_nascimento, endereco_atual, cidade_uf,
                        afastado, dia_inventario, horario_inventario, nome_databricks, email_logistica,
                        nome_base_origem, id_supervisor, ativo, status_colaborador, role,
                        senha, is_primeiro_acesso, created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s::date, %s, %s,
                        %s, %s, %s::time, %s, %s,
                        %s, %s, %s, %s, 'PADRAO',
                        %s, true, now(), now()
                    )
                    RETURNING id_tecnico;
                """, (
                    raw_id, name, primeiro_nome, sobrenome,
                    mat, cpf, rg, orgao, email, phone,
                    cargo, contract_type, region, data_nasc, endereco, cidade_uf,
                    afastado, inv_day, inv_time, databricks, logistics,
                    base_str, id_supervisor, is_active, ('ATIVO' if is_active else 'INATIVO'),
                    hashed_pwd
                ))
                id_tecnico = cur.fetchone()[0]
                processed_tecnico_ids.add(id_tecnico)
                tec_inserts += 1

                # Update memory indexes
                if mat:
                    db_tec_by_mat[mat.upper()] = (id_tecnico, mat, name, cpf, email, is_active)
                if cpf_digits:
                    db_tec_by_cpf[cpf_digits] = (id_tecnico, mat, name, cpf, email, is_active)
                db_tec_by_name[normalize_text(name)] = (id_tecnico, mat, name, cpf, email, is_active)

            # Link with tb_tecnico_base if ct_codigo resolved
            if ct_codigo:
                cur.execute("""
                    INSERT INTO tb_tecnico_base (id_tecnico, ct_codigo)
                    VALUES (%s, %s)
                    ON CONFLICT (id_tecnico, ct_codigo) DO NOTHING;
                """, (id_tecnico, ct_codigo))
                base_links += 1

        print(f"[+] Tecnicos atualizados e enriquecidos: {tec_updates}")
        print(f"[+] Tecnicos novos cadastrados: {tec_inserts}")
        print(f"[+] Total de tecnicos do CSV ativos e validados: {len(processed_tecnico_ids)}")
        print(f"[+] Relacionamentos de base criados/validados: {base_links}")

        # -------------------------------------------------------------
        # FASE 5: Inativacao Segura dos Tecnicos Ausentes no CSV
        # -------------------------------------------------------------
        print("\n--- FASE 5: Inativacao dos Tecnicos Ausentes no CSV ---")
        if processed_tecnico_ids:
            cur.execute("""
                UPDATE tb_tecnico
                SET ativo = false,
                    status_colaborador = 'INATIVO',
                    updated_at = now()
                WHERE id_tecnico NOT IN %s
                  AND role != 'MODERADOR'
                  AND (matricula IS NULL OR matricula NOT IN ('72916', '72916-TEC', '72916-SUP', 'ADMIN'))
                  AND (ativo = true OR status_colaborador != 'INATIVO');
            """, (tuple(processed_tecnico_ids),))
            inactivated_count = cur.rowcount
            print(f"[+] Tecnicos inativados com sucesso: {inactivated_count} (ZERO exclusoes fisicas)")
        else:
            print("[!] ALERTA: Nenhum tecnico processado, abortando inativacao para proteger a base.")
            conn.rollback()
            return

        # -------------------------------------------------------------
        # FASE 6: Validacao de Consistencia e Commit
        # -------------------------------------------------------------
        print("\n--- FASE 6: Auditoria Final e Validacao ---")
        cur.execute("SELECT count(*) FROM tb_tecnico WHERE ativo = true;")
        total_active_tecs = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM tb_tecnico WHERE ativo = false;")
        total_inactive_tecs = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM tb_tecnico;")
        total_tecs = cur.fetchone()[0]

        cur.execute("SELECT count(*) FROM tb_supervisor;")
        total_sups = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM tb_coordenador;")
        total_coords = cur.fetchone()[0]

        print(f"[*] Resumo Pos-Migracao:")
        print(f"    • Total Tecnicos no Banco: {total_tecs}")
        print(f"    • Tecnicos Ativos: {total_active_tecs}")
        print(f"    • Tecnicos Inativos: {total_inactive_tecs}")
        print(f"    • Total Supervisores: {total_sups} (Atualizados: {sup_updates}, Novos: {sup_inserts})")
        print(f"    • Total Coordenadores: {total_coords} (Atualizados: {coord_updates})")

        conn.commit()
        print("\n[SUCCESS] Transacao consolidada (COMMIT) com sucesso no Supabase PostgreSQL!")

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Falha na sincronizacao, transacao cancelada (ROLLBACK): {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
