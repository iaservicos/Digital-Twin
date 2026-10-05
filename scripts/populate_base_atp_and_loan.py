"""
Script de Mapeamento e Atualização de Base ATP e Empréstimos por Centro de Custo.
"""
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from backend_python.core.database import get_db_connection

# Mapeamento oficial de Centro de Custo para Código Base ATP
cc_to_base_atp = {
    '1145920': '2791040', # SP Barueri / Capital
    '1147963': '2791040', # SP Interior / Litoral
    '1147985': '2791006', # MG Belo Horizonte
    '1147928': '2791008', # DF Brasília
    '1147913': '2791001', # PR Curitiba Base 1
    '1147912': '2791001', # PR Curitiba Base 2
    '1147926': '2791002', # SC São José / Floripa
    '1147924': '2791003', # RS Porto Alegre
    '1147916': '2791007', # RJ Rio de Janeiro
    '1147925': '2791009', # BA Salvador
    '1147921': '2791010', # PE Recife
    '1147922': '2791010', # PE/AL Recife
    '1147923': '2791014', # CE Fortaleza
    '1147919': '2791013', # PB João Pessoa
    '1147918': '2791015', # RN Natal
    '1146002': '2791023', # MT Cuiabá
    '1147917': '2791016', # AM Manaus
    '1147914': '2791024', # RO/AC Porto Velho
    '1145102': '2791012', # TO Palmas
    '1146000': '2791009', # BA Projetos
    '1146001': '2791009', # BA Projetos
    '1145340': '2791001'  # PR Projetos
}

def run():
    print("--- ATUALIZANDO CODIGO_BASE_ATP DOS TÉCNICOS POR CENTRO DE CUSTO ---")
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for cc, base_atp in cc_to_base_atp.items():
                cur.execute("""
                    UPDATE tb_tecnico
                    SET codigo_base_atp = %s
                    WHERE centro_custo = %s;
                """, (base_atp, cc))
                print(f"CC {cc} -> Base ATP {base_atp} ({cur.rowcount} técnicos atualizados)")

            # Casos pontuais com CC nulo
            cur.execute("""
                UPDATE tb_tecnico SET codigo_base_atp = '2791040', centro_custo = '1145920'
                WHERE upper(nome_completo) IN ('RODRIGO MARAVIGLIA OCCHINI', 'RODRIGO PINHEIRO DE AZEVEDO');
                
                UPDATE tb_tecnico SET codigo_base_atp = '2791003', centro_custo = '1147924'
                WHERE upper(nome_completo) = 'THIAGO VAZ DE OLIVEIRA';
            """)
            print("Técnicos com CC nulo atualizados!")

            # Configuração de André Antonio Meninghin Alves como EMPRESTADO
            cur.execute("""
                UPDATE tb_tecnico
                SET status_colaborador = 'Emprestado',
                    id_supervisor = (SELECT id_supervisor FROM tb_supervisor WHERE nome_completo ILIKE '%Nina Carla%' LIMIT 1),
                    id_supervisor_emprestimo = (SELECT id_supervisor FROM tb_supervisor WHERE nome_completo ILIKE '%Robson Luiz Da Silva Leal%' LIMIT 1),
                    codigo_base_atp_emprestimo = '2791007'
                WHERE upper(nome_completo) = 'ANDRE ANTONIO MENINGHIN ALVES';
            """)
            print("André Antonio Meninghin Alves configurado como EMPRESTADO!")

            # Sincronização do booleano ativo
            cur.execute("""
                UPDATE tb_tecnico
                SET ativo = true
                WHERE status_colaborador IN ('Ativo', 'Férias', 'Emprestado');

                UPDATE tb_tecnico
                SET ativo = false
                WHERE status_colaborador IN ('Inativo', 'Afastado');
            """)
            print("Booleano ativo sincronizado com status_colaborador!")
            conn.commit()

if __name__ == '__main__':
    run()
