import sys
import logging

sys.path.insert(0, '.')
from backend_python.core.database import get_db_cursor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_tb_sessao_acesso():
    logger.info("Criando tabela tb_sessao_acesso e índices...")
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tb_sessao_acesso (
                id_sessao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                matricula VARCHAR(30) NOT NULL,
                nome_completo VARCHAR(150),
                cargo VARCHAR(100),
                role VARCHAR(50),
                ip_address VARCHAR(45),
                user_agent TEXT,
                dispositivo VARCHAR(50),
                navegador VARCHAR(50),
                login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                ultimo_ping_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                logout_at TIMESTAMP WITH TIME ZONE,
                duracao_segundos INTEGER DEFAULT 0,
                status VARCHAR(30) DEFAULT 'ATIVA'
            );

            CREATE INDEX IF NOT EXISTS idx_sessao_matricula ON tb_sessao_acesso(matricula);
            CREATE INDEX IF NOT EXISTS idx_sessao_login_at ON tb_sessao_acesso(login_at DESC);
            CREATE INDEX IF NOT EXISTS idx_sessao_status ON tb_sessao_acesso(status);
            CREATE INDEX IF NOT EXISTS idx_sessao_ultimo_ping ON tb_sessao_acesso(ultimo_ping_at DESC);
        """)
        logger.info("Tabela tb_sessao_acesso criada com sucesso!")

        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tb_sessao_acesso';")
        cols = cur.fetchall()
        logger.info(f"Colunas criadas: {[c['column_name'] for c in cols]}")

if __name__ == "__main__":
    create_tb_sessao_acesso()
