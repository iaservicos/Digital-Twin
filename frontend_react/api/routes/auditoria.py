import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel
try:
    from core.database import get_db_cursor
    from core.security import get_current_user
except ImportError:
    from api.core.database import get_db_cursor
    from api.core.security import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Auditoria & Controle de Acessos"])

def check_moderador_permission(current_user: Dict[str, Any]):
    """Garante que apenas usuários com perfil MODERADOR (ou conta do Márcio) tenham acesso aos logs de auditoria."""
    user_role = (current_user.get("role") or "").upper()
    user_cargo = (current_user.get("cargo") or "").upper()
    sub = str(current_user.get("sub") or "").strip()
    
    if user_role != "MODERADOR" and "MODERADOR" not in user_cargo and sub != "72916":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito exclusivamente ao perfil Moderador."
        )

@router.get("/auditoria/sessoes")
def list_sessoes_acesso(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    busca: Optional[str] = Query(None),
    statusFiltro: Optional[str] = Query(None),
    dataInicio: Optional[str] = Query(None),
    dataFim: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    check_moderador_permission(current_user)

    with get_db_cursor(commit=True) as cur:
        # 1. Expiração automática de sessões inativas (mais de 3 minutos sem ping)
        cur.execute("""
            UPDATE tb_sessao_acesso
            SET logout_at = ultimo_ping_at,
                duracao_segundos = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (ultimo_ping_at - login_at)))::integer),
                status = 'EXPIRADA_INATIVIDADE'
            WHERE status = 'ATIVA' AND ultimo_ping_at < CURRENT_TIMESTAMP - interval '3 minutes';
        """)

        # 2. Resumo Analítico Geral (KPIs do Topo)
        cur.execute("""
            SELECT 
                COUNT(*) FILTER (WHERE status = 'ATIVA' AND ultimo_ping_at >= CURRENT_TIMESTAMP - interval '2 minutes') AS usuarios_online,
                COUNT(*) AS total_acessos,
                COUNT(DISTINCT matricula) AS usuarios_unicos,
                COALESCE(ROUND(AVG(duracao_segundos)), 0) AS tempo_medio_segundos
            FROM tb_sessao_acesso;
        """)
        kpi_row = cur.fetchone() or {}

        # 3. Montagem da query paginada com filtros
        where_clauses = ["1=1"]
        params: List[Any] = []

        if busca and busca.strip():
            b = f"%{busca.strip()}%"
            where_clauses.append("(matricula ILIKE %s OR nome_completo ILIKE %s OR cargo ILIKE %s)")
            params.extend([b, b, b])

        if statusFiltro and statusFiltro.strip() and statusFiltro.upper() != "TODOS":
            sf = statusFiltro.strip().upper()
            if sf == "ONLINE":
                where_clauses.append("(status = 'ATIVA' AND ultimo_ping_at >= CURRENT_TIMESTAMP - interval '2 minutes')")
            elif sf == "ENCERRADA":
                where_clauses.append("status = 'ENCERRADA_USUARIO'")
            elif sf == "EXPIRADA":
                where_clauses.append("status = 'EXPIRADA_INATIVIDADE'")
            else:
                where_clauses.append("status = %s")
                params.append(sf)

        if dataInicio and dataInicio.strip():
            where_clauses.append("login_at >= %s::date")
            params.append(dataInicio.strip())

        if dataFim and dataFim.strip():
            where_clauses.append("login_at <= (%s::date + interval '1 day')")
            params.append(dataFim.strip())

        where_sql = " AND ".join(where_clauses)

        # Contagem total de itens filtrados
        cur.execute(f"SELECT COUNT(*) FROM tb_sessao_acesso WHERE {where_sql};", tuple(params))
        total_items = cur.fetchone()["count"]

        # Busca paginada
        offset = (page - 1) * pageSize
        query_sql = f"""
            SELECT id_sessao, matricula, nome_completo, cargo, role,
                   ip_address, user_agent, dispositivo, navegador,
                   login_at, ultimo_ping_at, logout_at, duracao_segundos, status
            FROM tb_sessao_acesso
            WHERE {where_sql}
            ORDER BY login_at DESC
            LIMIT %s OFFSET %s;
        """
        cur.execute(query_sql, tuple(params + [pageSize, offset]))
        rows = cur.fetchall()

        sessoes = []
        for r in rows:
            st_amigavel = "Online" if (r["status"] == "ATIVA") else ("Finalizada" if r["status"] == "ENCERRADA_USUARIO" else "Inativa")
            sessoes.append({
                "idSessao": str(r["id_sessao"]),
                "matricula": r["matricula"],
                "nomeCompleto": r["nome_completo"] or r["matricula"],
                "cargo": r["cargo"] or "Colaborador",
                "role": r["role"] or "PADRAO",
                "ipAddress": r["ip_address"] or "-",
                "dispositivo": r["dispositivo"] or "Desktop",
                "navegador": r["navegador"] or "Navegador Web",
                "loginAt": r["login_at"].isoformat() if r.get("login_at") else None,
                "ultimoPingAt": r["ultimo_ping_at"].isoformat() if r.get("ultimo_ping_at") else None,
                "logoutAt": r["logout_at"].isoformat() if r.get("logout_at") else None,
                "duracaoSegundos": r["duracao_segundos"] or 0,
                "status": st_amigavel,
                "statusRaw": r["status"]
            })

        return {
            "kpis": {
                "usuariosOnlineAgora": kpi_row.get("usuarios_online", 0),
                "totalAcessos": kpi_row.get("total_acessos", 0),
                "usuariosUnicos": kpi_row.get("usuarios_unicos", 0),
                "tempoMedioSegundos": kpi_row.get("tempo_medio_segundos", 0)
            },
            "pagination": {
                "page": page,
                "pageSize": pageSize,
                "totalItems": total_items,
                "totalPages": (total_items + pageSize - 1) // pageSize if total_items > 0 else 1
            },
            "sessoes": sessoes
        }
