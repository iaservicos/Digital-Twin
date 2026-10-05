"""
Script para semear técnicos de simulação para testes e validações locais.
"""
import os
import sys
from datetime import datetime, date

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from backend_python.core.database import get_db_cursor

SENHA_HASH = "$2b$10$0mN6O.tWZysPDH58O85aIu3UhwfZj8V51LcFNJglPoJyi0y.KBkpW"
BASE_RJ_CT = "8789471" # ICLIENT INFORMATICA - RIO DE JANEIRO

TECNICOS = [
    {
        "matricula": "72916-TEC03",
        "nome": "MARCIO DA SILVA EDUARDO (TEC 03)",
        "email": "marcioe.tec03@positivo.com.br",
        "pontos_total": 95.50,
        "elegivel": True,
        "motivo": None,
        "sla_pct": 0.9850, "sla_pts": 29.00,
        "perd_pct": 0.0020, "perd_pts": 21.00,
        "reinc_ind_pct": 0.0420, "reinc_ind_pts": 16.00,
        "reinc_eq_pct": 0.0510, "reinc_eq_pts": 16.00,
        "pecas_pct": 0.1800, "pecas_pts": 13.50,
        "total_chamados": 48
    },
    {
        "matricula": "72916-TEC02",
        "nome": "MARCIO DA SILVA EDUARDO (TEC 02)",
        "email": "marcioe.tec02@positivo.com.br",
        "pontos_total": 85.50,
        "elegivel": True,
        "motivo": None,
        "sla_pct": 0.9300, "sla_pts": 29.00,
        "perd_pct": 0.0080, "perd_pts": 21.00,
        "reinc_ind_pct": 0.0850, "reinc_ind_pts": 11.00,
        "reinc_eq_pct": 0.0850, "reinc_eq_pts": 11.00,
        "pecas_pct": 0.2200, "pecas_pts": 13.50,
        "total_chamados": 42
    },
    {
        "matricula": "72916-TEC01",
        "nome": "MARCIO DA SILVA EDUARDO (TEC 01)",
        "email": "marcioe.tec01@positivo.com.br",
        "pontos_total": 71.50,
        "elegivel": True,
        "motivo": None,
        "sla_pct": 1.0000, "sla_pts": 33.50,
        "perd_pct": 0.0180, "perd_pts": 16.00,
        "reinc_ind_pct": 0.0900, "reinc_ind_pts": 11.00,
        "reinc_eq_pct": 0.0950, "reinc_eq_pts": 11.00,
        "pecas_pct": 0.3200, "pecas_pts": 0.00,
        "total_chamados": 35
    },
    {
        "matricula": "72916-TEC",
        "nome": "MARCIO DA SILVA EDUARDO (TECNICO)",
        "email": "marcioe.tec@positivo.com.br",
        "pontos_total": 0.00,
        "elegivel": False,
        "motivo": "SLA de equipe abaixo do gatilho mínimo da campanha (82.0% < 90.0%)",
        "sla_pct": 0.8200, "sla_pts": 0.00,
        "perd_pct": 0.0280, "perd_pts": 0.00,
        "reinc_ind_pct": 0.1450, "reinc_ind_pts": 0.00,
        "reinc_eq_pct": 0.1200, "reinc_eq_pts": 0.00,
        "pecas_pct": 0.3800, "pecas_pts": 0.00,
        "total_chamados": 20
    }
]

def main():
    print("=== Iniciando Configuração dos 4 Usuários de Simulação ===")
    
    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT ct_codigo, cidade, uf, nome_atp FROM tb_base_atp WHERE ct_codigo = %s;", (BASE_RJ_CT,))
        base_rj = cur.fetchone()
        print(f"Base RJ encontrada: {dict(base_rj)}")
        
        tecnico_ids = {}

        for t in TECNICOS:
            mat = t["matricula"].upper()
            cur.execute("SELECT id_tecnico FROM tb_tecnico WHERE UPPER(matricula) = %s;", (mat,))
            row = cur.fetchone()
            
            if row:
                tid = row["id_tecnico"]
                cur.execute("""
                    UPDATE tb_tecnico
                    SET nome_completo = %s,
                        email = %s,
                        senha = %s,
                        cargo = 'Tecnico On-site',
                        role = 'PADRAO',
                        ativo = true,
                        fl_validado = true,
                        is_primeiro_acesso = false,
                        cidade_uf = 'RIO DE JANEIRO/RJ',
                        codigo_base_atp = %s,
                        status_colaborador = 'Ativo',
                        tipo_contrato = 'proprio'
                    WHERE id_tecnico = %s;
                """, (t["nome"], t["email"], SENHA_HASH, BASE_RJ_CT, tid))
                print(f"Técnico atualizado: {mat} (ID: {tid})")
            else:
                cur.execute("""
                    INSERT INTO tb_tecnico (
                        matricula, nome_completo, email, senha, cargo, role,
                        ativo, fl_validado, is_primeiro_acesso, cidade_uf, codigo_base_atp,
                        status_colaborador, tipo_contrato, primeiro_nome, sobrenome
                    ) VALUES (%s, %s, %s, %s, 'Tecnico On-site', 'PADRAO', true, true, false, 'RIO DE JANEIRO/RJ', %s, 'Ativo', 'proprio', 'MARCIO', 'DA SILVA EDUARDO')
                    RETURNING id_tecnico;
                """, (mat, t["nome"], t["email"], SENHA_HASH, BASE_RJ_CT))
                tid = cur.fetchone()["id_tecnico"]
                print(f"Técnico criado: {mat} (ID: {tid})")
                
            tecnico_ids[mat] = tid

            cur.execute("DELETE FROM tb_tecnico_base WHERE id_tecnico = %s;", (tid,))
            cur.execute("""
                INSERT INTO tb_tecnico_base (id_tecnico, ct_codigo)
                VALUES (%s, %s);
            """, (tid, BASE_RJ_CT))

            for dt_ref in [date(2026, 8, 1), date(2026, 8, 31), date(2026, 9, 1), date(2026, 9, 30)]:
                cur.execute("DELETE FROM tb_apuracao_mensal WHERE id_tecnico = %s AND mes_ano = %s;", (tid, dt_ref))
                cur.execute("""
                    INSERT INTO tb_apuracao_mensal (
                        id_tecnico, mes_ano, atingimento_sla, pontos_sla,
                        atingimento_reincidencia, pontos_reincidencia,
                        atingimento_reincidencia_equipe, pontos_reincidencia_equipe,
                        atingimento_pecas, pontos_pecas,
                        atingimento_perdidos, pontos_perdidos,
                        pontuacao_total, status_elegibilidade, motivo_inelegibilidade,
                        total_chamados, data_calculo, fonte_rrc_denominador,
                        fonte_reincidencia, fonte_pecas, data_sincronizacao
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s, %s,
                        %s, %s, 'DATABRICKS_CHAMADOS',
                        'DATABRICKS_REINCIDENTES', 'DATABRICKS_PECAS', NOW()
                    );
                """, (
                    tid, dt_ref, t["sla_pct"], t["sla_pts"],
                    t["reinc_ind_pct"], t["reinc_ind_pts"],
                    t["reinc_eq_pct"], t["reinc_eq_pts"],
                    t["pecas_pct"], t["pecas_pts"],
                    t["perd_pct"], t["perd_pts"],
                    t["pontos_total"], t["elegivel"], t["motivo"],
                    t["total_chamados"], datetime(2026, 10, 1, 0, 0, 0)
                ))
            print(f"Apurações criadas para {mat}")

    print("\n=== Configuração de simulação concluída com sucesso! ===")

if __name__ == "__main__":
    main()
