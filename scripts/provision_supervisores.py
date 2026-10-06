import sys
import logging

sys.path.insert(0, '.')
from backend_python.core.database import get_db_cursor
from backend_python.core.security import hash_password, SENHA_PADRAO_SISTEMA

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def provision_supervisores():
    senha_hash = hash_password(SENHA_PADRAO_SISTEMA)
    
    with get_db_cursor(commit=True) as cur:
        # 1. Garantia estrita de proteção da conta do Márcio (72916)
        logger.info("Verificando proteção da conta do Márcio (72916)...")
        cur.execute("SELECT matricula, role FROM tb_supervisor WHERE matricula LIKE '72916%';")
        sup_marcio = cur.fetchall()
        cur.execute("SELECT matricula, perfil_acesso FROM tb_usuario WHERE matricula = '72916';")
        usr_marcio = cur.fetchall()
        logger.info(f"Contas do Márcio encontradas: sup={sup_marcio}, usr={usr_marcio}")

        # 2. Atualizar Robson Leal (id_supervisor = 16)
        # Robson estava com matricula '58868' (que pertencia a Alessandro Detrano).
        # A matrícula oficial de Robson é '75942'.
        logger.info("Atualizando Robson Luiz Da Silva Leal para matrícula 75942...")
        cur.execute("""
            UPDATE tb_supervisor
            SET matricula = '75942',
                email = 'robson.leal@positivo.com.br',
                senha = %s,
                role = 'ADMINISTRADOR',
                is_primeiro_acesso = true,
                ativo = true
            WHERE id_supervisor = 16;
        """, (senha_hash,))

        # Se existir em tb_usuario com 58868 e nome Robson, atualizar para 75942
        cur.execute("""
            UPDATE tb_usuario
            SET matricula = '75942',
                email = 'robson.leal@positivo.com.br',
                senha_hash = %s,
                perfil_acesso = 'ADMINISTRADOR'::enum_perfil_acesso,
                nivel_organizacional = 'SUPERVISOR'::enum_nivel_organizacional,
                is_primeiro_acesso = true,
                ativo = true
            WHERE id_usuario = 10 OR (matricula = '58868' AND nome_completo ILIKE '%%Robson%%');
        """, (senha_hash,))

        # Se não existir em tb_usuario com 75942, inserir
        cur.execute("""
            INSERT INTO tb_usuario (matricula, senha_hash, nome_completo, primeiro_nome, sobrenome, email, perfil_acesso, nivel_organizacional, ativo, is_primeiro_acesso)
            VALUES ('75942', %s, 'Robson Luiz Da Silva Leal', 'Robson', 'Luiz Da Silva Leal', 'robson.leal@positivo.com.br', 'ADMINISTRADOR', 'SUPERVISOR', true, true)
            ON CONFLICT (matricula) DO UPDATE SET
                senha_hash = EXCLUDED.senha_hash,
                perfil_acesso = 'ADMINISTRADOR',
                nivel_organizacional = 'SUPERVISOR',
                ativo = true,
                is_primeiro_acesso = true;
        """, (senha_hash,))

        # 3. Atualizar Alessandro Detrano Da Silva (id_supervisor = 6) com matricula 58868
        logger.info("Atualizando Alessandro Detrano Da Silva (id_supervisor = 6) para matrícula 58868 (inativo)...")
        cur.execute("""
            UPDATE tb_supervisor
            SET matricula = '58868',
                email = 'adsilva@positivo.com.br',
                ativo = false
            WHERE id_supervisor = 6;
        """)

        # 4. Mapeamento dos outros supervisores de tb_supervisor
        # Mapeando matrículas reais identificadas
        supervisores_updates = [
            (30, '54601', 'Danilo Morais', 'Danilo', 'Morais de Azevedo', 'danilo.morais@positivo.com.br'),
            (33, '53053', 'Anne Luglio', 'Anne', 'Francielle Sales Luglio', 'anne.luglio@positivo.com.br'),
            (34, '58167', 'Luciano Oliveira', 'Luciano', 'Almeida de Oliveira', 'luciano.sup@positivo.com.br'),
            (35, '59746', 'Jorge Henrique', 'Jorge', 'Henrique Fernandes Nunes', 'jorge.henrique@positivo.com.br'),
            (10, '74260-SUP', 'Thiago Cardoso da Silva', 'Thiago', 'Cardoso da Silva', 'tcardoso@positivo.com.br'),
            (12, '74780-SUP', 'Cristiane Aparecida De Almeida', 'Cristiane', 'Aparecida De Almeida', 'cristiane.almeida@positivo.com.br'),
            (9, 'SANTANNA-SUP', "Antonio Carlos Sant'anna", 'Antonio Carlos', "Sant'anna", 'antonio.santanna@positivo.com.br'),
            (31, 'JOSE.EDUARDO', 'José Eduardo', 'José', 'Eduardo', 'jose.eduardo@positivo.com.br'),
            (32, 'LEONARDO.SUP', 'Leonardo', 'Leonardo', 'Supervisor', 'leonardo.sup@positivo.com.br'),
        ]

        for id_sup, mat, nome, p_nome, u_nome, email in supervisores_updates:
            logger.info(f"Provisionando supervisor ID {id_sup} ({nome}) com matrícula {mat}...")
            # Atualizar tb_supervisor se matricula estiver nula
            cur.execute("""
                UPDATE tb_supervisor
                SET matricula = COALESCE(matricula, %s),
                    email = COALESCE(email, %s),
                    senha = COALESCE(senha, %s),
                    role = COALESCE(role, 'ADMINISTRADOR'),
                    is_primeiro_acesso = COALESCE(is_primeiro_acesso, true),
                    ativo = COALESCE(ativo, true)
                WHERE id_supervisor = %s;
            """, (mat, email, senha_hash, id_sup))

            # Inserir/Atualizar em tb_usuario
            cur.execute("""
                INSERT INTO tb_usuario (matricula, senha_hash, nome_completo, primeiro_nome, sobrenome, email, perfil_acesso, nivel_organizacional, ativo, is_primeiro_acesso)
                VALUES (%s, %s, %s, %s, %u_nome, %s, 'ADMINISTRADOR', 'SUPERVISOR', true, true)
                ON CONFLICT (matricula) DO UPDATE SET
                    senha_hash = COALESCE(tb_usuario.senha_hash, EXCLUDED.senha_hash),
                    perfil_acesso = 'ADMINISTRADOR',
                    nivel_organizacional = 'SUPERVISOR',
                    ativo = true;
            """.replace("%u_nome", "%s"), (mat, senha_hash, nome, p_nome, u_nome, email))

        # 5. Garantir que todos os supervisores de tb_supervisor possuam id_usuario vinculado
        logger.info("Sincronizando id_usuario em tb_supervisor a partir de tb_usuario...")
        cur.execute("""
            UPDATE tb_supervisor s
            SET id_usuario = u.id_usuario
            FROM tb_usuario u
            WHERE (TRIM(s.matricula) = u.matricula OR (s.email IS NOT NULL AND LOWER(s.email) = LOWER(u.email)))
              AND (s.id_usuario IS NULL OR s.id_usuario <> u.id_usuario);
        """)

        # 6. Garantia adicional: atualizar senhas nulas em tb_supervisor para senha padrão
        cur.execute("""
            UPDATE tb_supervisor
            SET senha = %s,
                is_primeiro_acesso = true
            WHERE senha IS NULL;
        """, (senha_hash,))

        logger.info("Provisionamento concluído com sucesso!")

if __name__ == "__main__":
    provision_supervisores()
