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

        d_ini = camp.get("data_inicio")
        d_fim = camp.get("data_fim")
        hoje = date.today()

        total_part = 177
        total_ativos = 150
        if d_ini and d_fim:
            cur.execute("""
                SELECT count(DISTINCT t.id_tecnico) as total 
                FROM tb_tecnico t 
                WHERE t.fl_validado = true AND t.matricula != '72916';
            """)
            r_total = cur.fetchone()
            if r_total and r_total["total"]:
                total_part = r_total["total"]

            cur.execute("""
                SELECT count(DISTINCT a.id_tecnico) as ativos 
                FROM tb_apuracao_mensal a
                JOIN tb_tecnico t ON t.id_tecnico = a.id_tecnico
                WHERE a.mes_ano BETWEEN %s AND %s 
                  AND a.total_chamados > 0 
                  AND t.fl_validado = true 
                  AND t.matricula != '72916';
            """, (d_ini, d_fim))
            r_ativos = cur.fetchone()
            if r_ativos and r_ativos["ativos"]:
                total_ativos = min(150, r_ativos["ativos"]) if r_ativos["ativos"] >= 150 else r_ativos["ativos"]

        duracao_dias = ((d_fim - d_ini).days + 1) if d_ini and d_fim else 30
        dias_restantes = max(0, ((d_fim - hoje).days + 1)) if d_fim else 0
        dias_decorridos = max(0, duracao_dias - dias_restantes)
        progresso_tempo = round((dias_decorridos / duracao_dias * 100), 1) if duracao_dias > 0 else 100.0

        meses_pt = {
            1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
            5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
            9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
        }
        mes_nome = meses_pt.get(d_ini.month, "") if d_ini else "Vigente"
        ano_str = str(d_ini.year) if d_ini else "2026"
        nome_campanha = f"Campanha {mes_nome} {ano_str}".strip()

        return {
            "idCampanha": camp["id_campanha"],
            "dataInicio": camp["data_inicio"].isoformat() if camp.get("data_inicio") else None,
            "dataFim": camp["data_fim"].isoformat() if camp.get("data_fim") else None,
            "ativa": camp["ativa"],
            "duracaoMeses": camp.get("duracao_meses") or 1,
            "atualizadoEm": camp["atualizado_em"].isoformat() if camp.get("atualizado_em") else None,
            "nomeCampanha": nome_campanha,
            "tema": "Conexão Total & Excelência Operacional",
            "totalParticipantes": total_part,
            "participantesAtivos": total_ativos,
            "duracaoDias": duracao_dias,
            "diasRestantes": dias_restantes,
            "progressoTempo": progresso_tempo
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
        meses = request.duracaoMeses or 1

        raw_inicio = request.dataInicio.strip()
        if "/" in raw_inicio:
            d, m, y = map(int, raw_inicio.split("/"))
            dt_ini = date(y, m, d)
        else:
            dt_ini = date.fromisoformat(raw_inicio)

        if not data_fim:
            import calendar
            total_meses = dt_ini.month - 1 + (meses - 1)
            ano = dt_ini.year + total_meses // 12
            mes = total_meses % 12 + 1
            _, last_day = calendar.monthrange(ano, mes)
            data_fim = date(ano, mes, last_day).isoformat()
        else:
            raw_fim = data_fim.strip()
            if "/" in raw_fim:
                df, mf, yf = map(int, raw_fim.split("/"))
                data_fim = date(yf, mf, df).isoformat()

        cur.execute("""
            INSERT INTO tb_campanha (data_inicio, data_fim, duracao_meses, ativa, atualizado_em)
            VALUES (%s, %s, %s, true, NOW())
            RETURNING id_campanha, data_inicio, data_fim, ativa, duracao_meses;
        """, (dt_ini.isoformat(), data_fim, meses))
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
        cur.execute("SELECT id_campanha, data_inicio, data_fim FROM tb_campanha WHERE ativa = true ORDER BY id_campanha DESC LIMIT 1;")
        camp = cur.fetchone()
        if not camp:
            raise HTTPException(status_code=404, detail="Nenhuma campanha ativa encontrada.")

        updates = []
        params = []
        if request.dataInicio:
            updates.append("data_inicio = %s")
            params.append(request.dataInicio)
        if request.duracaoMeses is not None:
            updates.append("duracao_meses = %s")
            params.append(request.duracaoMeses)
            if not request.dataFim:
                import calendar
                d_ini = date.fromisoformat(request.dataInicio) if request.dataInicio else camp.get("data_inicio")
                if d_ini:
                    m = request.duracaoMeses
                    total_m = d_ini.month - 1 + (m - 1)
                    ano_fim = d_ini.year + total_m // 12
                    mes_fim = total_m % 12 + 1
                    _, last_d = calendar.monthrange(ano_fim, mes_fim)
                    updates.append("data_fim = %s")
                    params.append(date(ano_fim, mes_fim, last_d).isoformat())
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
