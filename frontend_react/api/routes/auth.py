import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
try:
    from core import config
    from core.database import get_db_cursor
    from core.security import verify_password, hash_password, create_access_token, get_current_user
except ImportError:
    from api.core import config
    from api.core.database import get_db_cursor
    from api.core.security import verify_password, hash_password, create_access_token, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Autenticação"])

# Modelos Pydantic
class AuthRequest(BaseModel):
    matricula: str
    senha: str

class AuthResponse(BaseModel):
    accessToken: str
    refreshToken: str
    primeiroAcesso: bool
    nome: str
    cargo: Optional[str] = None
    localEquipe: Optional[str] = None
    role: Optional[str] = "PADRAO"

class ChangePasswordRequest(BaseModel):
    novaSenha: str

class VerificarTecnicoRequest(BaseModel):
    nome: str
    estado: str

class VincularMatriculaRequest(BaseModel):
    id: int
    matricula: str

def resolver_cidade_regiao(ct_bases: Optional[List[str]]) -> str:
    """Resolve o nome da cidade/UF a partir dos centros de trabalho (ct_bases)."""
    if not ct_bases:
        return ""
    try:
        with get_db_cursor() as cur:
            cur.execute("""
                SELECT cidade, uf, nome_atp 
                FROM tb_base_atp 
                WHERE ct_codigo = ANY(%s) 
                LIMIT 1;
            """, (ct_bases,))
            base = cur.fetchone()
            if base:
                cidade = (base.get("cidade") or "").strip()
                uf = (base.get("uf") or "").strip()
                if cidade and uf:
                    return f"{cidade}/{uf}"
                elif cidade:
                    return cidade
                elif base.get("nome_atp"):
                    return base["nome_atp"].strip()
    except Exception as e:
        logger.warning(f"Erro ao resolver cidade da base: {e}")
    return ",".join(ct_bases)

@router.post("/auth/login", response_model=AuthResponse)
def login(request: AuthRequest):
    matricula = (request.matricula or "").strip()
    senha = (request.senha or "").strip()

    if not matricula or not senha:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Matrícula e senha são obrigatórios."
        )

    with get_db_cursor(commit=True) as cur:
        # Fallback de Admin Master
        if config.ADMIN_MATRICULA.upper() == matricula.upper():
            cur.execute("SELECT * FROM tb_supervisor WHERE UPPER(matricula) = %s LIMIT 1;", (config.ADMIN_MATRICULA.upper(),))
            admin = cur.fetchone()
            if not admin:
                cur.execute("""
                    INSERT INTO tb_supervisor (matricula, nome_completo, senha, role, ativo, is_primeiro_acesso)
                    VALUES (%s, %s, %s, %s, true, false);
                """, (config.ADMIN_MATRICULA.upper(), "Administrador Master", hash_password(config.ADMIN_PASSWORD), "MODERADOR"))

        # 1. Busca por Técnico
        cur.execute("""
            SELECT t.id_tecnico, t.matricula, t.nome_completo, t.cargo, t.role, t.senha, t.is_primeiro_acesso, t.ativo,
                   COALESCE((SELECT ARRAY_AGG(tb.ct_codigo) FROM tb_tecnico_base tb WHERE tb.id_tecnico = t.id_tecnico), '{}') AS ct_bases
            FROM tb_tecnico t
            WHERE UPPER(t.matricula) = %s
            LIMIT 1;
        """, (matricula.upper(),))
        tecnico = cur.fetchone()

        if tecnico:
            if not tecnico.get("ativo", True):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário inativo no sistema.")
            
            senha_hash = tecnico.get("senha")
            if not senha_hash or not verify_password(senha, senha_hash):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Matrícula ou senha inválidos.")

            ct_bases = tecnico.get("ct_bases") or []
            local_equipe = resolver_cidade_regiao(ct_bases)

            claims = {
                "sub": tecnico["matricula"],
                "id": tecnico["id_tecnico"],
                "nome": tecnico["nome_completo"],
                "cargo": tecnico.get("cargo") or "Técnico de Campo",
                "role": tecnico.get("role") or "PADRAO",
                "localEquipe": local_equipe
            }

            token = create_access_token(claims)
            return AuthResponse(
                accessToken=token,
                refreshToken=token,
                primeiroAcesso=bool(tecnico.get("is_primeiro_acesso")),
                nome=tecnico["nome_completo"],
                cargo=tecnico.get("cargo"),
                localEquipe=local_equipe,
                role=tecnico.get("role")
            )

        # 2. Busca por Supervisor
        cur.execute("""
            SELECT id_supervisor, matricula, nome_completo, role, senha, is_primeiro_acesso, ativo
            FROM tb_supervisor
            WHERE UPPER(matricula) = %s
            LIMIT 1;
        """, (matricula.upper(),))
        supervisor = cur.fetchone()

        if supervisor:
            if not supervisor.get("ativo", True):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Supervisor inativo no sistema.")

            senha_hash = supervisor.get("senha")
            if not senha_hash or not verify_password(senha, senha_hash):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Matrícula ou senha inválidos.")

            claims = {
                "sub": supervisor["matricula"],
                "id": supervisor["id_supervisor"],
                "nome": supervisor["nome_completo"],
                "cargo": "Supervisor de Campo",
                "role": supervisor.get("role") or "SUPERVISOR",
                "localEquipe": "Base Central"
            }

            token = create_access_token(claims)
            return AuthResponse(
                accessToken=token,
                refreshToken=token,
                primeiroAcesso=bool(supervisor.get("is_primeiro_acesso")),
                nome=supervisor["nome_completo"],
                cargo="Supervisor de Campo",
                localEquipe="Base Central",
                role=supervisor.get("role")
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Matrícula ou senha inválidos."
    )

@router.post("/auth/change-password")
def change_password(request: ChangePasswordRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    nova_senha = (request.novaSenha or "").strip()
    if len(nova_senha) < 4:
        raise HTTPException(status_code=400, detail="A nova senha deve ter no mínimo 4 caracteres.")

    matricula = current_user.get("sub")
    if not matricula:
        raise HTTPException(status_code=400, detail="Identificação do usuário não encontrada no token.")

    senha_hash = hash_password(nova_senha)
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            UPDATE tb_tecnico
            SET senha = %s, is_primeiro_acesso = false
            WHERE UPPER(matricula) = %s;
        """, (senha_hash, matricula.upper()))
        if cur.rowcount > 0:
            return {"message": "Senha alterada com sucesso."}

        cur.execute("""
            UPDATE tb_supervisor
            SET senha = %s, is_primeiro_acesso = false
            WHERE UPPER(matricula) = %s;
        """, (senha_hash, matricula.upper()))
        if cur.rowcount > 0:
            return {"message": "Senha alterada com sucesso."}

    raise HTTPException(status_code=404, detail="Usuário não localizado para alteração de senha.")

@router.post("/auth/verificar-tecnico")
def verificar_tecnico(request: VerificarTecnicoRequest):
    nome = (request.nome or "").strip()
    uf = (request.estado or "").strip()

    with get_db_cursor() as cur:
        # Busca técnico por nome aproximado e UF da base vinculada
        cur.execute("""
            SELECT t.id_tecnico, t.nome_completo,
                   COALESCE((SELECT ARRAY_AGG(tb2.ct_codigo) FROM tb_tecnico_base tb2 WHERE tb2.id_tecnico = t.id_tecnico), '{}') AS ct_bases
            FROM tb_tecnico t
            JOIN tb_tecnico_base tb ON tb.id_tecnico = t.id_tecnico
            JOIN tb_base_atp b ON b.ct_codigo = tb.ct_codigo
            WHERE UPPER(t.nome_completo) LIKE UPPER(%s)
              AND UPPER(b.uf) = UPPER(%s)
            LIMIT 1;
        """, (f"%{nome}%", uf))
        tecnico = cur.fetchone()

        if not tecnico:
            # Fallback sem UF
            cur.execute("""
                SELECT t.id_tecnico, t.nome_completo,
                       COALESCE((SELECT ARRAY_AGG(tb2.ct_codigo) FROM tb_tecnico_base tb2 WHERE tb2.id_tecnico = t.id_tecnico), '{}') AS ct_bases
                FROM tb_tecnico t
                WHERE UPPER(t.nome_completo) LIKE UPPER(%s)
                LIMIT 1;
            """, (f"%{nome}%",))
            tecnico = cur.fetchone()

        if not tecnico:
            raise HTTPException(status_code=404, detail="Nenhum técnico localizado com os dados informados.")

        ct_bases = tecnico.get("ct_bases") or []
        return {
            "id": tecnico["id_tecnico"],
            "nomeCompleto": tecnico["nome_completo"],
            "ctBase": ",".join(ct_bases)
        }

@router.post("/auth/vincular-matricula", response_model=AuthResponse)
def vincular_matricula(request: VincularMatriculaRequest):
    mat = request.matricula.strip()
    senha_hash = hash_password(mat)

    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            UPDATE tb_tecnico
            SET matricula = %s, senha = %s, is_primeiro_acesso = true
            WHERE id_tecnico = %s;
        """, (mat, senha_hash, request.id))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Técnico não encontrado.")

    # Efetua login automático após vinculação
    return login(AuthRequest(matricula=mat, senha=mat))
