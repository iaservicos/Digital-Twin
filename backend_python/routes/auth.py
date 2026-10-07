import logging
from typing import Optional, List, Dict, Any, Tuple
from fastapi import APIRouter, HTTPException, Depends, status, Request
from pydantic import BaseModel
from backend_python.core import config
from backend_python.core.database import get_db_cursor
from backend_python.core.security import verify_password, hash_password, create_access_token, get_current_user, validate_password_complexity

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
    idSessao: Optional[str] = None

class SessionPingRequest(BaseModel):
    idSessao: str

def parse_client_device_and_browser(ua: str) -> Tuple[str, str]:
    if not ua:
        return "Desktop", "Desconhecido"
    ua_lower = ua.lower()
    dispositivo = "Desktop"
    if "mobile" in ua_lower or "android" in ua_lower or "iphone" in ua_lower:
        dispositivo = "Mobile"
    elif "tablet" in ua_lower or "ipad" in ua_lower:
        dispositivo = "Tablet"

    navegador = "Outro"
    if "edg/" in ua_lower or "edge/" in ua_lower:
        navegador = "Microsoft Edge"
    elif "chrome/" in ua_lower or "crios/" in ua_lower:
        navegador = "Google Chrome"
    elif "safari/" in ua_lower and "chrome" not in ua_lower:
        navegador = "Apple Safari"
    elif "firefox/" in ua_lower or "fxios/" in ua_lower:
        navegador = "Mozilla Firefox"
    elif "opera" in ua_lower or "opr/" in ua_lower:
        navegador = "Opera"
    return dispositivo, navegador

class ChangePasswordRequest(BaseModel):
    novaSenha: str
    matricula: Optional[str] = None

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
def login(request: AuthRequest, request_http: Request):
    matricula = (request.matricula or "").strip()
    senha = (request.senha or "").strip()

    if not matricula or not senha:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Matrícula e senha são obrigatórios."
        )

    # Identificação do cliente para auditoria de acesso
    ip = request_http.headers.get("x-forwarded-for")
    if ip:
        ip = ip.split(",")[0].strip()
    else:
        ip = request_http.headers.get("x-real-ip") or (request_http.client.host if request_http.client else "127.0.0.1")
    ua = request_http.headers.get("user-agent", "")
    disp, nav = parse_client_device_and_browser(ua)

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

        def registrar_sessao(mat: str, nome: str, cargo: str, role: str) -> Optional[str]:
            try:
                cur.execute("""
                    INSERT INTO tb_sessao_acesso (
                        matricula, nome_completo, cargo, role, ip_address, user_agent, dispositivo, navegador,
                        login_at, ultimo_ping_at, status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ATIVA')
                    RETURNING id_sessao;
                """, (mat, nome, cargo, role, ip, ua, disp, nav))
                row = cur.fetchone()
                return str(row["id_sessao"]) if row else None
            except Exception as e:
                logger.warning(f"Erro ao registrar sessão de acesso para {mat}: {e}")
                return None

        # 1. Busca por Técnico
        cur.execute("""
            SELECT t.id_tecnico, t.matricula, t.nome_completo, t.cargo, t.role, t.senha, t.is_primeiro_acesso, t.ativo,
                   COALESCE((SELECT ARRAY_AGG(tb.ct_codigo) FROM tb_tecnico_base tb WHERE tb.id_tecnico = t.id_tecnico), '{}') AS ct_bases
            FROM tb_tecnico t
            WHERE UPPER(t.matricula) = %s OR UPPER(COALESCE(t.email, '')) = %s
            LIMIT 1;
        """, (matricula.upper(), matricula.upper()))
        tecnico = cur.fetchone()

        if tecnico:
            if not tecnico.get("ativo", True):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário inativo no sistema.")
            
            senha_hash = tecnico.get("senha")
            if not senha_hash or not verify_password(senha, senha_hash):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Matrícula ou senha inválidos.")

            ct_bases = tecnico.get("ct_bases") or []
            local_equipe = resolver_cidade_regiao(ct_bases)
            user_cargo = tecnico.get("cargo") or "Técnico de Campo"
            user_role = tecnico.get("role") or "PADRAO"

            claims = {
                "sub": tecnico["matricula"],
                "id": tecnico["id_tecnico"],
                "nome": tecnico["nome_completo"],
                "cargo": user_cargo,
                "role": user_role,
                "localEquipe": local_equipe
            }

            token = create_access_token(claims)
            id_sessao = registrar_sessao(tecnico["matricula"], tecnico["nome_completo"], user_cargo, user_role)

            return AuthResponse(
                accessToken=token,
                refreshToken=token,
                primeiroAcesso=bool(tecnico.get("is_primeiro_acesso")),
                nome=tecnico["nome_completo"],
                cargo=user_cargo,
                localEquipe=local_equipe,
                role=user_role,
                idSessao=id_sessao
            )

        # 2. Busca por Supervisor
        cur.execute("""
            SELECT id_supervisor, matricula, nome_completo, role, senha, is_primeiro_acesso, ativo
            FROM tb_supervisor
            WHERE UPPER(matricula) = %s OR UPPER(COALESCE(email, '')) = %s
            LIMIT 1;
        """, (matricula.upper(), matricula.upper()))
        supervisor = cur.fetchone()

        if supervisor:
            if not supervisor.get("ativo", True):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Supervisor inativo no sistema.")

            senha_hash = supervisor.get("senha")
            if not senha_hash or not verify_password(senha, senha_hash):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Matrícula ou senha inválidos.")

            user_cargo = "Supervisor de Campo"
            user_role = supervisor.get("role") or "SUPERVISOR"

            claims = {
                "sub": supervisor["matricula"],
                "id": supervisor["id_supervisor"],
                "nome": supervisor["nome_completo"],
                "cargo": user_cargo,
                "role": user_role,
                "localEquipe": "Base Central"
            }

            token = create_access_token(claims)
            id_sessao = registrar_sessao(supervisor["matricula"], supervisor["nome_completo"], user_cargo, user_role)

            return AuthResponse(
                accessToken=token,
                refreshToken=token,
                primeiroAcesso=bool(supervisor.get("is_primeiro_acesso")),
                nome=supervisor["nome_completo"],
                cargo=user_cargo,
                localEquipe="Base Central",
                role=user_role,
                idSessao=id_sessao
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Matrícula ou senha inválidos."
    )

@router.post("/auth/session/ping")
def session_ping(body: SessionPingRequest):
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            UPDATE tb_sessao_acesso
            SET ultimo_ping_at = CURRENT_TIMESTAMP,
                duracao_segundos = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - login_at)))::integer),
                status = 'ATIVA'
            WHERE id_sessao = %s::uuid AND status = 'ATIVA'
            RETURNING id_sessao;
        """, (body.idSessao,))
        row = cur.fetchone()
        if not row:
            return {"ok": False, "message": "Sessão não encontrada ou já finalizada."}
        return {"ok": True}

@router.post("/auth/session/end")
async def session_end(request_http: Request):
    id_sessao = None
    try:
        body_bytes = await request_http.body()
        if body_bytes:
            import json
            try:
                data = json.loads(body_bytes.decode("utf-8"))
                id_sessao = data.get("idSessao")
            except Exception:
                id_sessao = body_bytes.decode("utf-8").strip()
    except Exception:
        pass

    if not id_sessao:
        return {"ok": False, "message": "idSessao ausente"}

    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            UPDATE tb_sessao_acesso
            SET logout_at = CURRENT_TIMESTAMP,
                ultimo_ping_at = CURRENT_TIMESTAMP,
                duracao_segundos = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - login_at)))::integer),
                status = 'ENCERRADA_USUARIO'
            WHERE id_sessao = %s::uuid AND status = 'ATIVA'
            RETURNING id_sessao, duracao_segundos;
        """, (id_sessao,))
        row = cur.fetchone()
        return {"ok": True, "duracao": row["duracao_segundos"] if row else 0}

@router.post("/auth/change-password")
def change_password(request: ChangePasswordRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    nova_senha = (request.novaSenha or "").strip()
    validate_password_complexity(nova_senha)

    matricula = (request.matricula or current_user.get("sub") or "").strip()
    if not matricula:
        raise HTTPException(status_code=400, detail="Identificação do usuário não encontrada no token.")

    senha_hash = hash_password(nova_senha)
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            UPDATE tb_tecnico
            SET senha = %s, is_primeiro_acesso = false
            WHERE UPPER(matricula) = %s OR UPPER(COALESCE(email, '')) = %s;
        """, (senha_hash, matricula.upper(), matricula.upper()))
        if cur.rowcount > 0:
            return {"message": "Senha alterada com sucesso."}

        cur.execute("""
            UPDATE tb_supervisor
            SET senha = %s, is_primeiro_acesso = false
            WHERE UPPER(matricula) = %s OR UPPER(COALESCE(email, '')) = %s;
        """, (senha_hash, matricula.upper(), matricula.upper()))
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
