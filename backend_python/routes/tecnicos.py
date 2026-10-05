import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from backend_python.core.database import get_db_cursor
from backend_python.core.security import hash_password, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Técnicos & Equipes"])

def normalizar_status(raw: Optional[str]) -> str:
    if not raw:
        return "Ativo"
    u = raw.strip().upper()
    if u in ("FERIAS", "FÉRIAS"):
        return "Férias"
    if u == "AFASTADO":
        return "Afastado"
    if u == "EMPRESTADO":
        return "Emprestado"
    if u == "INATIVO":
        return "Inativo"
    return "Ativo"

class TecnicoCreateRequest(BaseModel):
    matricula: str
    nomeCompleto: Optional[str] = None
    primeiroNome: Optional[str] = None
    sobrenome: Optional[str] = None
    cargo: Optional[str] = "Tecnico de Campo"
    idSupervisor: Optional[int] = None
    role: Optional[str] = "PADRAO"
    cpf: Optional[str] = None
    email: Optional[str] = None
    senha: Optional[str] = None
    ativo: Optional[bool] = True
    statusColaborador: Optional[str] = "Ativo"
    centroCusto: Optional[str] = None
    codigoBaseAtp: Optional[str] = None
    idSupervisorEmprestimo: Optional[int] = None
    codigoBaseAtpEmprestimo: Optional[str] = None
    ctBases: Optional[List[str]] = []

class TecnicoUpdateRequest(BaseModel):
    nomeCompleto: Optional[str] = None
    primeiroNome: Optional[str] = None
    sobrenome: Optional[str] = None
    matricula: Optional[str] = None
    cargo: Optional[str] = None
    idSupervisor: Optional[int] = None
    role: Optional[str] = None
    ativo: Optional[bool] = None
    statusColaborador: Optional[str] = None
    centroCusto: Optional[str] = None
    codigoBaseAtp: Optional[str] = None
    idSupervisorEmprestimo: Optional[int] = None
    codigoBaseAtpEmprestimo: Optional[str] = None
    email: Optional[str] = None
    ctBases: Optional[List[str]] = None

class ResetSenhaRequest(BaseModel):
    novaSenha: Optional[str] = None

@router.get("/tecnicos")
def list_tecnicos(idSupervisor: Optional[int] = Query(None), apenasValidados: Optional[bool] = Query(False)):
    with get_db_cursor() as cur:
        sql = """
            SELECT t.id_tecnico, t.matricula, t.nome_completo, t.primeiro_nome, t.sobrenome,
                   t.cargo, t.role, t.ativo,
                   t.id_supervisor, s.nome_completo AS nome_supervisor,
                   t.email, t.cpf, t.is_primeiro_acesso,
                   t.celular_corporativo, t.regiao, t.tipo_contrato, t.afastado,
                   t.dia_inventario, t.horario_inventario, t.nome_databricks,
                   t.email_logistica, t.nome_base_origem, t.cidade_uf, t.status_colaborador,
                   t.centro_custo, t.codigo_base_atp,
                   t.id_supervisor_emprestimo, s_emp.nome_completo AS nome_supervisor_emprestimo,
                   t.codigo_base_atp_emprestimo, t.fl_validado,
                   COALESCE((SELECT ARRAY_AGG(tb.ct_codigo) FROM tb_tecnico_base tb WHERE tb.id_tecnico = t.id_tecnico), '{}') AS ct_bases
            FROM tb_tecnico t
            LEFT JOIN tb_supervisor s ON t.id_supervisor = s.id_supervisor
            LEFT JOIN tb_supervisor s_emp ON t.id_supervisor_emprestimo = s_emp.id_supervisor
        """
        conditions = []
        params = []
        if idSupervisor:
            conditions.append("t.id_supervisor = %s")
            params.append(idSupervisor)
        if apenasValidados:
            conditions.append("t.fl_validado = true")
        
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
        
        sql += " ORDER BY t.nome_completo ASC;"
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()

        return [
            {
                "idTecnico": r["id_tecnico"],
                "matricula": r["matricula"],
                "nomeCompleto": r["nome_completo"],
                "primeiroNome": r.get("primeiro_nome"),
                "sobrenome": r.get("sobrenome"),
                "cargo": r.get("cargo"),
                "role": r.get("role"),
                "ativo": r.get("ativo", True),
                "idSupervisor": r.get("id_supervisor"),
                "nomeSupervisor": r.get("nome_supervisor"),
                "email": r.get("email"),
                "cpf": r.get("cpf"),
                "celularCorporativo": r.get("celular_corporativo"),
                "regiao": r.get("regiao"),
                "tipoContrato": r.get("tipo_contrato"),
                "afastado": r.get("afastado", False),
                "diaInventario": r.get("dia_inventario"),
                "horarioInventario": str(r["horario_inventario"]) if r.get("horario_inventario") else None,
                "nomeDatabricks": r.get("nome_databricks"),
                "emailLogistica": r.get("email_logistica"),
                "nomeBaseOrigem": r.get("nome_base_origem"),
                "cidadeUf": r.get("cidade_uf"),
                "statusColaborador": r.get("status_colaborador") or ("Ativo" if r.get("ativo", True) else "Inativo"),
                "centroCusto": r.get("centro_custo"),
                "codigoBaseAtp": r.get("codigo_base_atp"),
                "idSupervisorEmprestimo": r.get("id_supervisor_emprestimo"),
                "nomeSupervisorEmprestimo": r.get("nome_supervisor_emprestimo"),
                "codigoBaseAtpEmprestimo": r.get("codigo_base_atp_emprestimo"),
                "isPrimeiroAcesso": r.get("is_primeiro_acesso"),
                "flValidado": bool(r.get("fl_validado")),
                "ctBases": r.get("ct_bases") or []
            }
            for r in rows
        ]

@router.post("/tecnicos")
def create_tecnico(request: TecnicoCreateRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    mat = request.matricula.strip()
    
    # Regra de Negócio: Supervisores e perfis não-moderadores só podem cadastrar perfil 'PADRAO' (técnico)
    user_role = current_user.get("role", "").upper()
    role_to_set = "PADRAO" if user_role != "MODERADOR" else (request.role or "PADRAO")
    
    # Tratamento consistente de primeiro nome, sobrenome e nome completo
    primeiro_nome = request.primeiroNome.strip() if request.primeiroNome else ""
    sobrenome = request.sobrenome.strip() if request.sobrenome else ""
    if request.nomeCompleto and not (primeiro_nome and sobrenome):
        parts = request.nomeCompleto.strip().split()
        if not primeiro_nome and parts:
            primeiro_nome = parts[0]
        if not sobrenome and len(parts) > 1:
            sobrenome = " ".join(parts[1:])
    nome_completo = f"{primeiro_nome} {sobrenome}".strip() or (request.nomeCompleto.strip() if request.nomeCompleto else mat)

    # Senha inicial
    raw_senha = request.senha.strip() if request.senha and request.senha.strip() else mat
    senha_hash = hash_password(raw_senha)
    
    id_sup = request.idSupervisor
    if not id_sup and current_user.get("id_supervisor"):
        id_sup = current_user.get("id_supervisor")

    ativo_val = True if request.ativo is None else request.ativo
    status_colab = normalizar_status(request.statusColaborador or ("Ativo" if ativo_val else "Inativo"))
    if status_colab in ("Ativo", "Férias", "Emprestado"):
        ativo_val = True
    else:
        ativo_val = False

    id_sup_emp = request.idSupervisorEmprestimo if status_colab == "Emprestado" else None
    base_emp = request.codigoBaseAtpEmprestimo.strip() if (status_colab == "Emprestado" and request.codigoBaseAtpEmprestimo) else None

    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            INSERT INTO tb_tecnico (
                matricula, nome_completo, primeiro_nome, sobrenome, cargo, id_supervisor, role, 
                cpf, email, senha, ativo, status_colaborador, centro_custo, codigo_base_atp,
                id_supervisor_emprestimo, codigo_base_atp_emprestimo, is_primeiro_acesso
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true)
            RETURNING id_tecnico;
        """, (
            mat, nome_completo, primeiro_nome, sobrenome, request.cargo or "Tecnico de Campo", id_sup, role_to_set, 
            request.cpf, request.email, senha_hash, ativo_val, status_colab, 
            request.centroCusto.strip() if request.centroCusto else None,
            request.codigoBaseAtp.strip() if request.codigoBaseAtp else None,
            id_sup_emp, base_emp
        ))
        novo = cur.fetchone()
        id_tec = novo["id_tecnico"]

        if request.ctBases:
            for ct in request.ctBases:
                cur.execute("INSERT INTO tb_tecnico_base (id_tecnico, ct_codigo) VALUES (%s, %s);", (id_tec, ct))

        return {"idTecnico": id_tec, "message": "Técnico cadastrado com sucesso."}

@router.put("/tecnicos/{id_tecnico}")
def update_tecnico(id_tecnico: int, request: TecnicoUpdateRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    user_role = current_user.get("role", "").upper()
    
    with get_db_cursor(commit=True) as cur:
        updates = []
        params = []
        
        if request.primeiroNome is not None:
            updates.append("primeiro_nome = %s")
            params.append(request.primeiroNome.strip())
        if request.sobrenome is not None:
            updates.append("sobrenome = %s")
            params.append(request.sobrenome.strip())
        if request.nomeCompleto is not None:
            updates.append("nome_completo = %s")
            params.append(request.nomeCompleto.strip())
        elif request.primeiroNome is not None or request.sobrenome is not None:
            cur.execute("SELECT primeiro_nome, sobrenome FROM tb_tecnico WHERE id_tecnico = %s;", (id_tecnico,))
            curr = cur.fetchone()
            p_nome = request.primeiroNome.strip() if request.primeiroNome is not None else (curr["primeiro_nome"] or "")
            s_nome = request.sobrenome.strip() if request.sobrenome is not None else (curr["sobrenome"] or "")
            updates.append("nome_completo = %s")
            params.append(f"{p_nome} {s_nome}".strip())

        if request.matricula is not None:
            updates.append("matricula = %s")
            params.append(request.matricula.strip())
        if request.cargo is not None:
            updates.append("cargo = %s")
            params.append(request.cargo)
        if request.idSupervisor is not None:
            updates.append("id_supervisor = %s")
            params.append(request.idSupervisor)
            
        if request.role is not None:
            if user_role != "MODERADOR" and request.role != "PADRAO":
                raise HTTPException(status_code=403, detail="Supervisores só podem gerenciar usuários com perfil técnico.")
            updates.append("role = %s")
            params.append(request.role)
            
        if request.statusColaborador is not None:
            s_colab = normalizar_status(request.statusColaborador)
            updates.append("status_colaborador = %s")
            params.append(s_colab)
            
            is_ativo = s_colab in ("Ativo", "Férias", "Emprestado")
            updates.append("ativo = %s")
            params.append(is_ativo)

            if s_colab == "Emprestado":
                if request.idSupervisorEmprestimo is not None:
                    updates.append("id_supervisor_emprestimo = %s")
                    params.append(request.idSupervisorEmprestimo)
                if request.codigoBaseAtpEmprestimo is not None:
                    updates.append("codigo_base_atp_emprestimo = %s")
                    params.append(request.codigoBaseAtpEmprestimo.strip())
            else:
                updates.append("id_supervisor_emprestimo = NULL")
                updates.append("codigo_base_atp_emprestimo = NULL")
        else:
            if request.idSupervisorEmprestimo is not None:
                updates.append("id_supervisor_emprestimo = %s")
                params.append(request.idSupervisorEmprestimo)
            if request.codigoBaseAtpEmprestimo is not None:
                updates.append("codigo_base_atp_emprestimo = %s")
                params.append(request.codigoBaseAtpEmprestimo.strip())

        if request.ativo is not None and request.statusColaborador is None:
            updates.append("ativo = %s")
            params.append(request.ativo)
            updates.append("status_colaborador = %s")
            params.append("Ativo" if request.ativo else "Inativo")

        if request.centroCusto is not None:
            updates.append("centro_custo = %s")
            params.append(request.centroCusto.strip() if request.centroCusto else None)

        if request.codigoBaseAtp is not None:
            updates.append("codigo_base_atp = %s")
            params.append(request.codigoBaseAtp.strip() if request.codigoBaseAtp else None)

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
def reset_senha(id_tecnico: int, request: Optional[ResetSenhaRequest] = None, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT matricula FROM tb_tecnico WHERE id_tecnico = %s;", (id_tecnico,))
        t = cur.fetchone()
        if not t:
            raise HTTPException(status_code=404, detail="Técnico não encontrado.")
        
        if request and request.novaSenha and request.novaSenha.strip():
            senha_hash = hash_password(request.novaSenha.strip())
            msg = "Senha redefinida com sucesso."
        else:
            senha_hash = hash_password(t["matricula"])
            msg = "Senha resetada para a matrícula com sucesso."

        cur.execute("UPDATE tb_tecnico SET senha = %s, is_primeiro_acesso = true WHERE id_tecnico = %s;", (senha_hash, id_tecnico))
        return {"message": msg}

@router.get("/supervisores")
def list_supervisores():
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id_supervisor, matricula, nome_completo, email, celular_corporativo, ativo, role, cpf, id_coordenador
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
                "cpf": r.get("cpf"),
                "idCoordenador": r.get("id_coordenador"),
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
