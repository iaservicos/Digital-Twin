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
    dataFim: Optional[str] = None
    duracaoMeses: Optional[int] = 2

class AtualizarCampanhaRequest(BaseModel):
    dataInicio: Optional[str] = None
    dataFim: Optional[str] = None
    ativa: Optional[bool] = None

class FaixaRegraRequest(BaseModel):
    descricaoFaixa: Optional[str] = None
    pontos: Optional[float] = None
    pontosObtidos: Optional[float] = None
    atingimentoMinimo: Optional[float] = None
    atingimentoMaximo: Optional[float] = None
    valorMinimo: Optional[float] = None
    valorMaximo: Optional[float] = None
    ordem: Optional[int] = 1

class EncerrarCampanhaRequest(BaseModel):
    limparDadosBrutos: Optional[bool] = False

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

        data_fim = request.dataFim
        if not data_fim:
            import calendar
            dt_ini = date.fromisoformat(request.dataInicio)
            meses = request.duracaoMeses or 2
            total_meses = dt_ini.month - 1 + meses
            ano = dt_ini.year + total_meses // 12
            mes = total_meses % 12 + 1
            _, last_day = calendar.monthrange(ano, mes)
            data_fim = date(ano, mes, min(dt_ini.day, last_day)).isoformat()

        cur.execute("""
            INSERT INTO tb_campanha (data_inicio, data_fim, duracao_meses, ativa, atualizado_em)
            VALUES (%s, %s, %s, true, NOW())
            RETURNING id_campanha, data_inicio, data_fim, ativa, duracao_meses;
        """, (request.dataInicio, data_fim, request.duracaoMeses))
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

@router.post("/campanha/encerrar")
def encerrar_campanha(request: Optional[EncerrarCampanhaRequest] = None, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_db_cursor(commit=True) as cur:
        # Desativa a campanha ativa no banco
        cur.execute("UPDATE tb_campanha SET ativa = false, atualizado_em = NOW() WHERE ativa = true;")
        
        # Se solicitado, limpa dados brutos operacionais preservando apuração mensal e rankings
        if request and request.limparDadosBrutos:
            cur.execute("DELETE FROM tb_consumo_peca;")
            cur.execute("DELETE FROM tb_chamado;")
            logger.info("Dados operacionais brutos (tb_chamado, tb_consumo_peca) excluídos pelo encerramento de campanha.")
            
        return {"message": "Campanha encerrada com sucesso."}

@router.get("/regras")
def get_regras():
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id_regra, nome_indicador, descricao, classe, is_gatilho, peso_percentual, meta_percentual
            FROM tb_regra_kpi
            ORDER BY id_regra ASC;
        """)
        rows = cur.fetchall()
        return [
            {
                "idRegra": r["id_regra"],
                "nomeIndicador": r.get("nome_indicador"),
                "nomeKpi": r.get("nome_indicador"),
                "descricao": r.get("descricao"),
                "classe": r.get("classe"),
                "isGatilho": r.get("is_gatilho"),
                "pesoPercentual": float(r["peso_percentual"]) if r.get("peso_percentual") is not None else 0.0,
                "metaPercentual": float(r["meta_percentual"]) if r.get("meta_percentual") is not None else 0.0
            }
            for r in rows
        ]

@router.get("/regras/{id_regra}/faixas")
def get_faixas_regra(id_regra: int):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id_faixa, id_regra, valor_minimo, valor_maximo, pontos_obtidos
            FROM tb_faixa_pontuacao
            WHERE id_regra = %s
            ORDER BY id_faixa ASC;
        """, (id_regra,))
        rows = cur.fetchall()
        return [
            {
                "idFaixa": r["id_faixa"],
                "idRegra": r["id_regra"],
                "valorMinimo": float(r["valor_minimo"]) if r.get("valor_minimo") is not None else 0.0,
                "valorMaximo": float(r["valor_maximo"]) if r.get("valor_maximo") is not None else 0.0,
                "atingimentoMinimo": float(r["valor_minimo"]) if r.get("valor_minimo") is not None else 0.0,
                "atingimentoMaximo": float(r["valor_maximo"]) if r.get("valor_maximo") is not None else 0.0,
                "pontosObtidos": float(r["pontos_obtidos"]) if r.get("pontos_obtidos") is not None else 0.0,
                "pontos": float(r["pontos_obtidos"]) if r.get("pontos_obtidos") is not None else 0.0
            }
            for r in rows
        ]

@router.post("/regras/{id_regra}/faixas")
def criar_faixa_regra(id_regra: int, request: FaixaRegraRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_db_cursor(commit=True) as cur:
        v_min = request.valorMinimo if request.valorMinimo is not None else (request.atingimentoMinimo or 0.0)
        v_max = request.valorMaximo if request.valorMaximo is not None else (request.atingimentoMaximo or 0.0)
        pts = request.pontosObtidos if request.pontosObtidos is not None else (request.pontos or 0.0)
        cur.execute("""
            INSERT INTO tb_faixa_pontuacao (id_regra, valor_minimo, valor_maximo, pontos_obtidos)
            VALUES (%s, %s, %s, %s)
            RETURNING id_faixa, id_regra, valor_minimo, valor_maximo, pontos_obtidos;
        """, (id_regra, v_min, v_max, pts))
        nova = cur.fetchone()
        return {
            "idFaixa": nova["id_faixa"],
            "idRegra": nova["id_regra"],
            "valorMinimo": float(nova["valor_minimo"]),
            "valorMaximo": float(nova["valor_maximo"]),
            "pontosObtidos": float(nova["pontos_obtidos"]),
            "message": "Faixa criada com sucesso."
        }

@router.put("/regras/faixas/{id_faixa}")
def atualizar_faixa(id_faixa: int, request: FaixaRegraRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_db_cursor(commit=True) as cur:
        v_min = request.valorMinimo if request.valorMinimo is not None else (request.atingimentoMinimo or 0.0)
        v_max = request.valorMaximo if request.valorMaximo is not None else (request.atingimentoMaximo or 0.0)
        pts = request.pontosObtidos if request.pontosObtidos is not None else (request.pontos or 0.0)
        cur.execute("""
            UPDATE tb_faixa_pontuacao
            SET valor_minimo = %s, valor_maximo = %s, pontos_obtidos = %s
            WHERE id_faixa = %s;
        """, (v_min, v_max, pts, id_faixa))
        return {"message": "Faixa atualizada com sucesso."}

@router.delete("/regras/faixas/{id_faixa}")
def deletar_faixa(id_faixa: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM tb_faixa_pontuacao WHERE id_faixa = %s;", (id_faixa,))
        return {"message": "Faixa removida com sucesso."}
