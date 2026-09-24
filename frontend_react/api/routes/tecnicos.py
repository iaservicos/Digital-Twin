import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from backend_python.core.database import get_db_cursor
from backend_python.core.security import hash_password, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Técnicos & Equipes"])

class TecnicoCreateRequest(BaseModel):
    matricula: str
    nomeCompleto: str
    cargo: Optional[str] = "Técnico de Campo"
    idSupervisor: Optional[int] = None
    role: Optional[str] = "PADRAO"
    cpf: Optional[str] = None
    email: Optional[str] = None
    ctBases: Optional[List[str]] = []

class TecnicoUpdateRequest(BaseModel):
    nomeCompleto: Optional[str] = None
    cargo: Optional[str] = None
    idSupervisor: Optional[int] = None
    role: Optional[str] = None
    ativo: Optional[bool] = None
    email: Optional[str] = None
    ctBases: Optional[List[str]] = None

@router.get("/tecnicos")
def list_tecnicos(idSupervisor: Optional[int] = Query(None)):
    with get_db_cursor() as cur:
        sql = """
            SELECT t.id_tecnico, t.matricula, t.nome_completo, t.cargo, t.role, t.ativo,
                   t.id_supervisor, t.email, t.cpf, t.is_primeiro_acesso,
                   COALESCE((SELECT ARRAY_AGG(tb.ct_codigo) FROM tb_tecnico_base tb WHERE tb.id_tecnico = t.id_tecnico), '{}') AS ct_bases
            FROM tb_tecnico t
        """
        params = []
        if idSupervisor:
            sql += " WHERE t.id_supervisor = %s"
            params.append(idSupervisor)
        
        sql += " ORDER BY t.nome_completo ASC;"
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()

        return [
            {
                "idTecnico": r["id_tecnico"],
                "matricula": r["matricula"],
                "nomeCompleto": r["nome_completo"],
                "cargo": r.get("cargo"),
                "role": r.get("role"),
                "ativo": r.get("ativo", True),
                "idSupervisor": r.get("id_supervisor"),
                "email": r.get("email"),
                "cpf": r.get("cpf"),
                "isPrimeiroAcesso": r.get("is_primeiro_acesso"),
                "ctBases": r.get("ct_bases") or []
            }
            for r in rows
        ]

@router.post("/tecnicos")
def create_tecnico(request: TecnicoCreateRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    mat = request.matricula.strip()
    senha_hash = hash_password(mat)

    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            INSERT INTO tb_tecnico (matricula, nome_completo, cargo, id_supervisor, role, cpf, email, senha, ativo, is_primeiro_acesso)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, true, true)
            RETURNING id_tecnico;
        """, (mat, request.nomeCompleto.strip(), request.cargo, request.idSupervisor, request.role, request.cpf, request.email, senha_hash))
        novo = cur.fetchone()
        id_tec = novo["id_tecnico"]

        if request.ctBases:
            for ct in request.ctBases:
                cur.execute("INSERT INTO tb_tecnico_base (id_tecnico, ct_codigo) VALUES (%s, %s);", (id_tec, ct))

        return {"idTecnico": id_tec, "message": "Técnico cadastrado com sucesso."}

@router.put("/tecnicos/{id_tecnico}")
def update_tecnico(id_tecnico: int, request: TecnicoUpdateRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_db_cursor(commit=True) as cur:
        updates = []
        params = []
        if request.nomeCompleto is not None:
            updates.append("nome_completo = %s")
            params.append(request.nomeCompleto.strip())
        if request.cargo is not None:
            updates.append("cargo = %s")
            params.append(request.cargo)
        if request.idSupervisor is not None:
            updates.append("id_supervisor = %s")
            params.append(request.idSupervisor)
        if request.role is not None:
            updates.append("role = %s")
            params.append(request.role)
        if request.ativo is not None:
            updates.append("ativo = %s")
            params.append(request.ativo)
        if request.email is not None:
            updates.append("email = %s")
            params.append(request.email)

        if updates:
            sql = f"UPDATE tb_tecnico SET {', '.join(updates)} WHERE id_tecnico = %s;"
            params.append(id_tecnico)
            cur.execute(sql, tuple(params))

        if request.ctBases is not None:
            cur.execute("DELETE FROM tb_tecnico_base WHERE id_tecnico = %s;", (id_tecnico,))
            for ct in request.ctBases:
                cur.execute("INSERT INTO tb_tecnico_base (id_tecnico, ct_codigo) VALUES (%s, %s);", (id_tecnico, ct))

        return {"message": "Técnico atualizado com sucesso."}

@router.delete("/tecnicos/{id_tecnico}")
def delete_tecnico(id_tecnico: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM tb_tecnico_base WHERE id_tecnico = %s;", (id_tecnico,))
        cur.execute("DELETE FROM tb_tecnico WHERE id_tecnico = %s;", (id_tecnico,))
        return {"message": "Técnico removido com sucesso."}

@router.put("/tecnicos/{id_tecnico}/reset-senha")
def reset_senha(id_tecnico: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT matricula FROM tb_tecnico WHERE id_tecnico = %s;", (id_tecnico,))
        t = cur.fetchone()
        if not t:
            raise HTTPException(status_code=404, detail="Técnico não encontrado.")
        
        senha_hash = hash_password(t["matricula"])
        cur.execute("UPDATE tb_tecnico SET senha = %s, is_primeiro_acesso = true WHERE id_tecnico = %s;", (senha_hash, id_tecnico))
        return {"message": "Senha resetada para a matrícula com sucesso."}

@router.get("/supervisores")
def list_supervisores():
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id_supervisor, matricula, nome_completo, email, celular_corporativo, ativo, role
            FROM tb_supervisor
            WHERE ativo = true
            ORDER BY nome_completo ASC;
        """)
        rows = cur.fetchall()
        return [
            {
                "idSupervisor": r["id_supervisor"],
                "matricula": r["matricula"],
                "nomeCompleto": r["nome_completo"],
                "email": r.get("email"),
                "celularCorporativo": r.get("celular_corporativo"),
                "role": r.get("role")
            }
            for r in rows
        ]

@router.get("/bases")
def list_bases(idSupervisor: Optional[int] = Query(None)):
    with get_db_cursor() as cur:
        sql = """
            SELECT b.id_base, b.ct_codigo, b.nome_atp, b.cidade, b.uf, b.id_supervisor, b.atp_resumidas
            FROM tb_base_atp b
        """
        params = []
        if idSupervisor:
            sql += " WHERE b.id_supervisor = %s"
            params.append(idSupervisor)
        sql += " ORDER BY b.cidade ASC, b.nome_atp ASC;"
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
        return [
            {
                "idBase": r["id_base"],
                "ctCodigo": r["ct_codigo"],
                "nomeAtp": r["nome_atp"],
                "cidade": r.get("cidade"),
                "uf": r.get("uf"),
                "idSupervisor": r.get("id_supervisor"),
                "atpResumidas": r.get("atp_resumidas")
            }
            for r in rows
        ]
