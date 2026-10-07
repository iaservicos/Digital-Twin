import sys, os
sys.path.insert(0, os.path.abspath('.'))

from backend_python.core.database import get_db_cursor
from backend_python.core.security import hash_password, verify_password, SENHA_PADRAO_SISTEMA

def run_padronizacao():
    print("=== INICIANDO PADRONIZAÇÃO DE SENHAS DE PRIMEIRO ACESSO ===")
    print(f"Senha Padrão Oficial: {SENHA_PADRAO_SISTEMA}")
    
    # Gera o hash BCrypt para a senha padrão oficial "Brilha@123"
    novo_hash = hash_password(SENHA_PADRAO_SISTEMA)
    print(f"Hash BCrypt gerado com sucesso: {novo_hash[:15]}...")

    with get_db_cursor(commit=True) as cur:
        # 1. CRIAR TABELA DE BACKUP DE CONTINGÊNCIA
        print("\n1. Criando tabela de backup de contingência 'tb_backup_senhas_migracao'...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tb_backup_senhas_migracao (
                id_backup SERIAL PRIMARY KEY,
                origem VARCHAR(20),
                id_registro INT,
                matricula VARCHAR(50),
                senha_anterior TEXT,
                is_primeiro_acesso BOOLEAN,
                ativo BOOLEAN,
                backup_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Insere snapshot das credenciais atuais antes de modificar
        cur.execute("""
            INSERT INTO tb_backup_senhas_migracao (origem, id_registro, matricula, senha_anterior, is_primeiro_acesso, ativo)
            SELECT 'SUPERVISOR', id_supervisor, matricula, senha, is_primeiro_acesso, ativo
            FROM tb_supervisor
            WHERE is_primeiro_acesso = true AND ativo = true
              AND UPPER(matricula) NOT IN ('72916', '72916-SUP', 'ADMIN');
        """)
        cur.execute("""
            INSERT INTO tb_backup_senhas_migracao (origem, id_registro, matricula, senha_anterior, is_primeiro_acesso, ativo)
            SELECT 'TECNICO', id_tecnico, matricula, senha, is_primeiro_acesso, ativo
            FROM tb_tecnico
            WHERE is_primeiro_acesso = true AND ativo = true;
        """)
        print("Backup de contingência gravado com sucesso!")

        # 2. ATUALIZAR TB_SUPERVISOR
        print("\n2. Atualizando supervisores em 'tb_supervisor'...")
        cur.execute("""
            UPDATE tb_supervisor
            SET senha = %s,
                is_primeiro_acesso = true
            WHERE is_primeiro_acesso = true 
              AND ativo = true
              AND UPPER(matricula) NOT IN ('72916', '72916-SUP', 'ADMIN');
        """, (novo_hash,))
        sups_afetados = cur.rowcount
        print(f"Supervisores atualizados com a senha '{SENHA_PADRAO_SISTEMA}': {sups_afetados}")

        # 3. ATUALIZAR TB_TECNICO
        print("\n3. Atualizando técnicos ativos em 'tb_tecnico'...")
        cur.execute("""
            UPDATE tb_tecnico
            SET senha = %s,
                is_primeiro_acesso = true
            WHERE is_primeiro_acesso = true 
              AND ativo = true;
        """, (novo_hash,))
        tecs_afetados = cur.rowcount
        print(f"Técnicos ativos atualizados com a senha '{SENHA_PADRAO_SISTEMA}': {tecs_afetados}")

        # 4. SINCRONIZAR TB_USUARIO
        print("\n4. Sincronizando tabela auxiliar 'tb_usuario'...")
        cur.execute("""
            UPDATE tb_usuario
            SET senha_hash = %s,
                is_primeiro_acesso = true
            WHERE is_primeiro_acesso = true 
              AND ativo = true
              AND UPPER(matricula) NOT IN ('72916', '72916-SUP', 'ADMIN');
        """, (novo_hash,))
        usuarios_afetados = cur.rowcount
        print(f"Usuários sincronizados em 'tb_usuario': {usuarios_afetados}")

        # 5. VALIDAÇÃO DE SEGURANÇA: CONFERIR CONTA DO MÁRCIO
        cur.execute("""
            SELECT matricula, nome_completo, role, senha, is_primeiro_acesso 
            FROM tb_supervisor 
            WHERE UPPER(matricula) LIKE '%72916%' OR UPPER(matricula) = 'ADMIN';
        """)
        marcio_rows = cur.fetchall()
        print("\n5. Verificando integridade das contas do Márcio / Moderador:")
        for m in marcio_rows:
            is_definitiva = not m['is_primeiro_acesso']
            print(f"- Matrícula: {m['matricula']} | Nome: {m['nome_completo']} | Role: {m['role']} | PrimeiroAcesso: {m['is_primeiro_acesso']} (Protegido={is_definitiva})")

    print("\n=== PADRONIZAÇÃO CONCLUÍDA COM SUCESSO! ===")

if __name__ == '__main__':
    run_padronizacao()
