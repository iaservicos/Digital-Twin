import logging
from typing import Optional, List, Dict, Any
from datetime import date
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from backend_python.core.database import get_db_cursor
from backend_python.core.security import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Campanhas & Regras"])

class NovaCampanhaRequest(BaseModel):
    dataInicio: str
    dataFim: str
    duracaoMeses: Optional[int] = 2

class AtualizarCampanhaRequest(BaseModel):
    dataInicio: Optional[str] = None
    dataFim: Optional[str] = None
    ativa: Optional[bool] = None

class FaixaRegraRequest(BaseModel):
    descricaoFaixa: Optional[str] = None
    pontos: Optional[float] = 0.0
    atingimentoMinimo: Optional[float] = None
    atingimentoMaximo: Optional[float] = None
    ordem: Optional[int] = 1

@router.get("/campanha/ativa")
def get_campanha_ativa():
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id_campanha, data_inicio, data_fim, ativa, duracao_meses, atualizado_em
            FROM tb_campanha
            WHERE ativa = true
            ORDER BY id_campanha DESC
            LIMIT 1;
        """)
        camp = cur.fetchone()
        if not camp:
            return None
        return {
            "idCampanha": camp["id_campanha"],
            "dataInicio": camp["data_inicio"].isoformat() if camp.get("data_inicio") else None,
            "dataFim": camp["data_fim"].isoformat() if camp.get("data_fim") else None,
            "ativa": camp["ativa"],
            "duracaoMeses": camp.get("duracao_meses") or 2,
            "atualizadoEm": camp["atualizado_em"].isoformat() if camp.get("atualizado_em") else None
        }

@router.get("/campanha/todas")
def get_todas_campanhas():
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id_campanha, data_inicio, data_fim, ativa, duracao_meses, atualizado_em
            FROM tb_campanha
            ORDER BY data_inicio DESC;
        """)
        rows = cur.fetchall()
        return [
            {
                "idCampanha": r["id_campanha"],
                "dataInicio": r["data_inicio"].isoformat() if r.get("data_inicio") else None,
                "dataFim": r["data_fim"].isoformat() if r.get("data_fim") else None,
                "ativa": r["ativa"],
                "duracaoMeses": r.get("duracao_meses") or 2,
                "atualizadoEm": r["atualizado_em"].isoformat() if r.get("atualizado_em") else None
            }
            for r in rows
        ]

@router.post("/campanha/nova-campanha")
def criar_nova_campanha(request: NovaCampanhaRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_db_cursor(commit=True) as cur:
        # Desativa campanhas anteriores
        cur.execute("UPDATE tb_campanha SET ativa = false;")
        cur.execute("""
            INSERT INTO tb_campanha (data_inicio, data_fim, duracao_meses, ativa, atualizado_em)
            VALUES (%s, %s, %s, true, NOW())
            RETURNING id_campanha, data_inicio, data_fim, ativa, duracao_meses;
        """, (request.dataInicio, request.dataFim, request.duracaoMeses))
        nova = cur.fetchone()
        return {
            "idCampanha": nova["id_campanha"],
            "dataInicio": nova["data_inicio"].isoformat(),
            "dataFim": nova["data_fim"].isoformat(),
            "ativa": nova["ativa"],
            "duracaoMeses": nova["duracao_meses"]
        }

@router.post("/campanha/ativa")
def atualizar_campanha_ativa(request: AtualizarCampanhaRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id_campanha FROM tb_campanha WHERE ativa = true ORDER BY id_campanha DESC LIMIT 1;")
        camp = cur.fetchone()
        if not camp:
            raise HTTPException(status_code=404, detail="Nenhuma campanha ativa encontrada.")

        updates = []
        params = []
        if request.dataInicio:
            updates.append("data_inicio = %s")
            params.append(request.dataInicio)
        if request.dataFim:
            updates.append("data_fim = %s")
            params.append(request.dataFim)
        if request.ativa is not None:
            updates.append("ativa = %s")
            params.append(request.ativa)

        if updates:
            updates.append("atualizado_em = NOW()")
            sql = f"UPDATE tb_campanha SET {', '.join(updates)} WHERE id_campanha = %s;"
            params.append(camp["id_campanha"])
            cur.execute(sql, tuple(params))

        return {"message": "Campanha atualizada com sucesso."}

@router.get("/regras")
def get_regras():
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id_regra, nome_kpi, peso, meta, descricao, tipo_apuracao
            FROM tb_regra_campanha
            ORDER BY id_regra ASC;
        """)
        rows = cur.fetchall()
        return [
            {
                "idRegra": r["id_regra"],
                "nomeKpi": r.get("nome_kpi"),
                "peso": float(r["peso"]) if r.get("peso") is not None else 0.0,
                "meta": float(r["meta"]) if r.get("meta") is not None else 0.0,
                "descricao": r.get("descricao"),
                "tipoApuracao": r.get("tipo_apuracao")
            }
            for r in rows
        ]

@router.get("/regras/{id_regra}/faixas")
def get_faixas_regra(id_regra: int):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id_faixa, id_regra, descricao_faixa, pontos, atingimento_minimo, atingimento_maximo, ordem
            FROM tb_regra_faixa
            WHERE id_regra = %s
            ORDER BY ordem ASC, id_faixa ASC;
        """, (id_regra,))
        rows = cur.fetchall()
        return [
            {
                "idFaixa": r["id_faixa"],
                "idRegra": r["id_regra"],
                "descricaoFaixa": r.get("descricao_faixa"),
                "pontos": float(r["pontos"]) if r.get("pontos") is not None else 0.0,
                "atingimentoMinimo": float(r["atingimento_minimo"]) if r.get("atingimento_minimo") is not None else None,
                "atingimentoMaximo": float(r["atingimento_maximo"]) if r.get("atingimento_maximo") is not None else None,
                "ordem": r.get("ordem") or 1
            }
            for r in rows
        ]

@router.post("/regras/{id_regra}/faixas")
def criar_faixa_regra(id_regra: int, request: FaixaRegraRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            INSERT INTO tb_regra_faixa (id_regra, descricao_faixa, pontos, atingimento_minimo, atingimento_maximo, ordem)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id_faixa;
        """, (id_regra, request.descricaoFaixa, request.pontos, request.atingimentoMinimo, request.atingimentoMaximo, request.ordem))
        nova = cur.fetchone()
        return {"idFaixa": nova["id_faixa"], "message": "Faixa criada com sucesso."}

@router.put("/regras/faixas/{id_faixa}")
def atualizar_faixa(id_faixa: int, request: FaixaRegraRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            UPDATE tb_regra_faixa
            SET descricao_faixa = %s, pontos = %s, atingimento_minimo = %s, atingimento_maximo = %s, ordem = %s
            WHERE id_faixa = %s;
        """, (request.descricaoFaixa, request.pontos, request.atingimentoMinimo, request.atingimentoMaximo, request.ordem, id_faixa))
        return {"message": "Faixa atualizada com sucesso."}

@router.delete("/regras/faixas/{id_faixa}")
def deletar_faixa(id_faixa: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM tb_regra_faixa WHERE id_faixa = %s;", (id_faixa,))
        return {"message": "Faixa removida com sucesso."}
