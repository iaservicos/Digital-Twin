import logging
from typing import Optional, List, Dict, Any, Tuple
from datetime import date, datetime
from fastapi import APIRouter, Query, HTTPException, Request
from backend_python.core.database import get_db_cursor
from backend_python.core.security import decode_access_token

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Dashboard & KPIs"])

MESES_NOMES = {
    1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
    5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
    9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
}

def formatar_label_mes(d: Optional[date]) -> str:
    if not d:
        return "Mês"
    if d.day > 27:
        return "Média Final"
    return MESES_NOMES.get(d.month, "Mês")

def val_to_pct(val) -> float:
    if val is None:
        return 0.0
    v = float(val)
    # No Spring Boot: b.multiply(100).doubleValue()
    return round(v * 100.0, 2)

def val_to_double(val) -> float:
    if val is None:
        return 0.0
    return round(float(val), 2)

def carregar_lookup_bases() -> Dict[str, str]:
    """Mapeia ct_codigo para Cidade/UF."""
    lookup = {}
    try:
        with get_db_cursor() as cur:
            cur.execute("SELECT ct_codigo, cidade, uf, nome_atp FROM tb_base_atp WHERE ct_codigo IS NOT NULL;")
            for b in cur.fetchall():
                ct = b["ct_codigo"]
                cidade = (b.get("cidade") or "").strip().title()
                uf = (b.get("uf") or "").strip().upper()
                if cidade and uf:
                    lookup[ct] = f"{cidade} - {uf}"
                elif cidade:
                    lookup[ct] = cidade
                elif b.get("nome_atp"):
                    lookup[ct] = b["nome_atp"].strip().title()
    except Exception as e:
        logger.warning(f"Erro ao carregar lookup de bases: {e}")
    return lookup

def resolver_intervalo_datas(cur, mesAno: Optional[Any]) -> Tuple[datetime, datetime]:
    """Retorna (data_inicio, data_fim) para queries de agregação em tb_chamado, tb_consumo_peca, reincidentes."""
    mes_str = (mesAno if isinstance(mesAno, str) else "") or ""
    mes_lower = mes_str.strip().lower()

    if "jul" in mes_lower or "2026-07" in mes_lower or mes_lower == "7":
        return datetime(2026, 7, 1, 0, 0, 0), datetime(2026, 7, 31, 23, 59, 59)
    elif "ago" in mes_lower or "2026-08" in mes_lower or mes_lower == "8":
        return datetime(2026, 8, 1, 0, 0, 0), datetime(2026, 8, 31, 23, 59, 59)
    elif "set" in mes_lower or "2026-09" in mes_lower or mes_lower == "9":
        return datetime(2026, 9, 1, 0, 0, 0), datetime(2026, 9, 30, 23, 59, 59)
    elif "out" in mes_lower or "2026-10" in mes_lower or mes_lower == "10":
        return datetime(2026, 10, 1, 0, 0, 0), datetime(2026, 10, 31, 23, 59, 59)

    if len(mes_str) >= 7 and mes_str[4] == '-':
        try:
            ano = int(mes_str[:4])
            mes = int(mes_str[5:7])
            ultimo_dia = 31 if mes in (1, 3, 5, 7, 8, 10, 12) else (30 if mes != 2 else 28)
            return datetime(ano, mes, 1, 0, 0, 0), datetime(ano, mes, ultimo_dia, 23, 59, 59)
        except Exception:
            pass

    cur.execute("SELECT data_inicio, data_fim FROM tb_campanha WHERE ativa = true ORDER BY id_campanha DESC LIMIT 1;")
    camp = cur.fetchone()
    if camp and camp.get("data_inicio") and camp.get("data_fim"):
        return datetime.combine(camp["data_inicio"], datetime.min.time()), datetime.combine(camp["data_fim"], datetime.max.time())

    return datetime(2026, 8, 1, 0, 0, 0), datetime(2026, 8, 31, 23, 59, 59)

@router.get("/dashboard/version")
def get_version():
    return {
        "version": "v1-digitaltwin-fastapi-serverless",
        "runtime": "python-fastapi",
        "timestamp": datetime.now().isoformat()
    }

@router.get("/dashboard/ranking")
def get_ranking(
    mesAno: Optional[str] = Query(None, description="Data YYYY-MM-DD"),
    campanhaId: Optional[int] = Query(None, description="ID da Campanha")
):
    with get_db_cursor() as cur:
        # 1. Busca campanha (por ID ou ativa)
        if campanhaId:
            cur.execute("SELECT id_campanha, data_inicio, data_fim FROM tb_campanha WHERE id_campanha = %s;", (campanhaId,))
            campanha = cur.fetchone()
        else:
            cur.execute("SELECT id_campanha, data_inicio, data_fim FROM tb_campanha WHERE ativa = true ORDER BY id_campanha DESC LIMIT 1;")
            campanha = cur.fetchone()

        data_ref = None
        if mesAno:
            try:
                data_ref = date.fromisoformat(mesAno)
            except Exception:
                data_ref = None

        if not data_ref:
            if campanha and campanha.get("data_fim"):
                # Verifica se há mês com dados na campanha
                cur.execute("""
                    SELECT MAX(mes_ano) as max_mes 
                    FROM tb_apuracao_mensal 
                    WHERE mes_ano BETWEEN %s AND %s AND total_chamados > 0;
                """, (campanha["data_inicio"], campanha["data_fim"]))
                row = cur.fetchone()
                if row and row.get("max_mes"):
                    data_ref = row["max_mes"]

            if not data_ref:
                cur.execute("SELECT MAX(mes_ano) as max_mes FROM tb_apuracao_mensal;")
                row = cur.fetchone()
                data_ref = row["max_mes"] if row and row.get("max_mes") else date.today().replace(day=1)

        # 2. Busca apuração do mês de referência
        cur.execute("""
            SELECT a.*, t.id_tecnico, t.nome_completo, t.matricula, t.cargo, t.role,
                   COALESCE((SELECT ARRAY_AGG(tb.ct_codigo) FROM tb_tecnico_base tb WHERE tb.id_tecnico = t.id_tecnico), '{}') AS ct_bases,
                   (SELECT fp.foto_base64 FROM tb_foto_perfil fp WHERE fp.id_tecnico = t.id_tecnico LIMIT 1) AS foto_perfil
            FROM tb_apuracao_mensal a
            JOIN tb_tecnico t ON t.id_tecnico = a.id_tecnico
            WHERE a.mes_ano = %s
            ORDER BY a.pontuacao_total DESC;
        """, (data_ref,))
        apuracoes = cur.fetchall()

        if not apuracoes:
            return []

        # 3. Busca histórico de todos os técnicos
        tecnico_ids = [a["id_tecnico"] for a in apuracoes]
        historico_map: Dict[int, List[Dict[str, Any]]] = {tid: [] for tid in tecnico_ids}

        if campanha and campanha.get("data_inicio") and campanha.get("data_fim"):
            cur.execute("""
                SELECT * FROM tb_apuracao_mensal 
                WHERE id_tecnico = ANY(%s) AND mes_ano BETWEEN %s AND %s 
                ORDER BY mes_ano ASC;
            """, (tecnico_ids, campanha["data_inicio"], campanha["data_fim"]))
        else:
            cur.execute("""
                SELECT * FROM tb_apuracao_mensal 
                WHERE id_tecnico = ANY(%s) 
                ORDER BY mes_ano ASC;
            """, (tecnico_ids,))
        
        for h in cur.fetchall():
            tid = h["id_tecnico"]
            historico_map[tid].append(h)

        # 4. Lookup de bases
        cidade_por_ct = carregar_lookup_bases()

        # 5. Monta DTOs idênticos ao Java
        ranking_list = []
        posicao = 1

        for a in apuracoes:
            sem_chamados = not a.get("total_chamados") or a["total_chamados"] == 0
            historico_tecnico = historico_map.get(a["id_tecnico"], [])

            historico_dto_list = []
            for h in historico_tecnico:
                historico_dto_list.append({
                    "mes": formatar_label_mes(h.get("mes_ano")),
                    "mesReferencia": h["mes_ano"].isoformat() if h.get("mes_ano") else None,
                    "percentualSla": val_to_pct(h.get("atingimento_sla")),
                    "pontosSla": val_to_double(h.get("pontos_sla")),
                    "percentualReincidencia": val_to_pct(h.get("atingimento_reincidencia")),
                    "pontosReincidencia": val_to_double(h.get("pontos_reincidencia")),
                    "percentualReincidenciaEquipe": val_to_pct(h.get("atingimento_reincidencia_equipe")),
                    "pontosReincidenciaEquipe": val_to_double(h.get("pontos_reincidencia_equipe")),
                    "percentualEficienciaPecas": val_to_pct(h.get("atingimento_pecas")),
                    "pontosPecas": val_to_double(h.get("pontos_pecas")),
                    "percentualPerdidos": val_to_pct(h.get("atingimento_perdidos")),
                    "pontosPerdidos": val_to_double(h.get("pontos_perdidos")),
                    "pontosTotal": val_to_double(h.get("pontuacao_total")),
                    "elegivel": bool(h.get("status_elegibilidade")),
                    "motivoInelegibilidade": h.get("motivo_inelegibilidade"),
                    "fonteRrcDenominador": h.get("fonte_rrc_denominador"),
                    "fonteReincidencia": h.get("fonte_reincidencia"),
                    "fontePecas": h.get("fonte_pecas")
                })

            ct_bases = a.get("ct_bases") or []
            locais_unicos = []
            for ct in ct_bases:
                loc = cidade_por_ct.get(ct, ct)
                if loc and loc not in locais_unicos:
                    locais_unicos.append(loc)
            local_equipe = ", ".join(locais_unicos) if locais_unicos else ""

            ranking_dto = {
                "posicaoRanking": posicao,
                "idTecnico": a["id_tecnico"],
                "tecnico": a["nome_completo"],
                "matricula": a["matricula"],
                "localEquipe": local_equipe,
                "fotoPerfil": a.get("foto_perfil"),
                "pontosTotal": 0.0 if sem_chamados else val_to_double(a.get("pontuacao_total")),
                "percentualPerdidos": 0.0 if sem_chamados else val_to_pct(a.get("atingimento_perdidos")),
                "pontosPerdidos": 0.0 if sem_chamados else val_to_double(a.get("pontos_perdidos")),
                "percentualSla": 0.0 if sem_chamados else val_to_pct(a.get("atingimento_sla")),
                "pontosSla": 0.0 if sem_chamados else val_to_double(a.get("pontos_sla")),
                "percentualReincidencia": 0.0 if sem_chamados else val_to_pct(a.get("atingimento_reincidencia")),
                "pontosReincidencia": 0.0 if sem_chamados else val_to_double(a.get("pontos_reincidencia")),
                "percentualReincidenciaEquipe": 0.0 if sem_chamados else val_to_pct(a.get("atingimento_reincidencia_equipe")),
                "pontosReincidenciaEquipe": 0.0 if sem_chamados else val_to_double(a.get("pontos_reincidencia_equipe")),
                "quantidadeProdutividade": a.get("total_chamados") or 0,
                "pontosProdutividade": 0.0 if sem_chamados else val_to_double(a.get("pontos_pecas")),
                "percentualEficienciaPecas": 0.0 if sem_chamados else val_to_pct(a.get("atingimento_pecas")),
                "pontosPecas": 0.0 if sem_chamados else val_to_double(a.get("pontos_pecas")),
                "fonteRrcDenominador": a.get("fonte_rrc_denominador"),
                "fonteReincidencia": a.get("fonte_reincidencia"),
                "fontePecas": a.get("fonte_pecas"),
                "elegivel": False if sem_chamados else bool(a.get("status_elegibilidade")),
                "motivoInelegibilidade": "Sem chamados atendidos no período" if sem_chamados else a.get("motivo_inelegibilidade"),
                "mesReferencia": a["mes_ano"].isoformat() if a.get("mes_ano") else None,
                "historico": historico_dto_list
            }

            ranking_list.append(ranking_dto)
            posicao += 1

        return ranking_list

@router.get("/dashboard/tecnico/{id_tecnico}/pecas")
def get_tecnico_pecas(id_tecnico: int, mesAno: Optional[str] = Query(None)):
    with get_db_cursor() as cur:
        # Busca nome do técnico
        cur.execute("SELECT nome_completo FROM tb_tecnico WHERE id_tecnico = %s LIMIT 1;", (id_tecnico,))
        t = cur.fetchone()
        nome_tecnico = t["nome_completo"] if t else None

        sql = """
            SELECT 
                p.chamado,
                p.ft,
                p.equipamento AS tipo_equipamento,
                p.acao,
                p.codigo_solicitado_desc AS cod_solic_desc,
                p.codigo_aplicado_desc AS cod_aplic_desc,
                p.subgrupo,
                p.grupo_mercadoria,
                p.grupo_mercadoria_desc,
                p.tecnico_nome,
                CASE 
                    WHEN UPPER(COALESCE(p.segmento, '')) LIKE '%%GOV%%' OR p.projeto LIKE 'H3-%%' THEN 'Governo'
                    ELSE COALESCE(p.projeto, 'Corporativo')
                END AS projeto,
                COALESCE(p.atp, p.cliente_cidade, p.ct) AS assistencia_cidade,
                p.ocorrencia_chamado,
                p.texto_encerrado
            FROM tb_consumo_peca p
            WHERE UPPER(COALESCE(p.acao, '')) NOT LIKE '%%SEM NECESSIDADE%%'
              AND UPPER(COALESCE(p.acao, '')) NOT LIKE '%%A009%%'
              AND UPPER(COALESCE(p.acao, '')) NOT LIKE '%%ORÇAMENTO%%'
              AND (
                  UPPER(COALESCE(p.subgrupo, '')) IN ('PLACA MÃE', 'PLACA MAE', 'PLM', 'SSD', 'HD', 'HDD', 'TAMPA FRONTAL/LCD', 'PAINEL LCD', 'LCD', 'LCD ALFANUM')
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%%PLACA MAE%%'
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%%PLM%%'
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%%SSD%%'
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%%HARD DISK%%'
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%%LCD%%'
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%%TELA%%'
                  OR UPPER(COALESCE(p.codigo_aplicado_desc, '')) LIKE '%%PLM%%'
                  OR UPPER(COALESCE(p.codigo_aplicado_desc, '')) LIKE '%%SSD%%'
                  OR UPPER(COALESCE(p.codigo_aplicado_desc, '')) LIKE '%%HDD%%'
                  OR UPPER(COALESCE(p.codigo_aplicado_desc, '')) LIKE '%%LCD%%'
              )
        """
        params = []
        if nome_tecnico:
            sql += " AND UPPER(TRIM(p.tecnico_nome)) LIKE UPPER(TRIM(%s)) || '%%'"
            params.append(nome_tecnico)

        mes_filtro = (mesAno or "").strip().lower()
        if "jul" in mes_filtro or "2026-07" in mes_filtro or mes_filtro == "7":
            sql += " AND TO_CHAR(p.ft, 'YYYY-MM') = '2026-07'"
        elif "ago" in mes_filtro or "2026-08" in mes_filtro or mes_filtro == "8":
            sql += " AND TO_CHAR(p.ft, 'YYYY-MM') = '2026-08'"
        elif "set" in mes_filtro or "2026-09" in mes_filtro or mes_filtro == "9":
            sql += " AND TO_CHAR(p.ft, 'YYYY-MM') = '2026-09'"
        elif "out" in mes_filtro or "2026-10" in mes_filtro or mes_filtro == "10":
            sql += " AND TO_CHAR(p.ft, 'YYYY-MM') = '2026-10'"
        else:
            cur.execute("SELECT data_inicio, data_fim FROM tb_campanha WHERE ativa = true ORDER BY id_campanha DESC LIMIT 1;")
            camp = cur.fetchone()
            if camp and camp.get("data_inicio") and camp.get("data_fim"):
                sql += " AND p.ft >= %s AND p.ft <= %s"
                params.extend([datetime.combine(camp["data_inicio"], datetime.min.time()),
                               datetime.combine(camp["data_fim"], datetime.max.time())])

        sql += " ORDER BY p.ft DESC;"
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()

        return [
            {
                "chamado": str(r["chamado"]),
                "ft": r["ft"].isoformat() if r.get("ft") else None,
                "tipoEquipamento": r.get("tipo_equipamento"),
                "acao": r.get("acao"),
                "codSolicDesc": r.get("cod_solic_desc"),
                "codAplicDesc": r.get("cod_aplic_desc"),
                "subgrupo": r.get("subgrupo"),
                "grupoMercadoria": r.get("grupo_mercadoria"),
                "grupoMercadoriaDesc": r.get("grupo_mercadoria_desc"),
                "tecnicoNome": r.get("tecnico_nome"),
                "projeto": r.get("projeto"),
                "assistenciaCidade": r.get("assistencia_cidade"),
                "ocorrenciaChamado": r.get("ocorrencia_chamado"),
                "textoEncerrado": r.get("texto_encerrado")
            }
            for r in rows
        ]

@router.get("/dashboard/tecnico/{id_tecnico}/sla-perdidos")
def get_tecnico_sla_perdidos(id_tecnico: int, mesAno: Optional[str] = Query(None), request: Request = None):
    # Verifica perfil do usuário autenticado no header
    auth_header = request.headers.get("Authorization") if request else None
    user_claims = {}
    if auth_header and auth_header.startswith("Bearer "):
        try:
            user_claims = decode_access_token(auth_header.split(" ")[1])
        except Exception:
            pass

    user_role = (user_claims.get("role") or "").upper()
    is_supervisor_or_admin = any(x in user_role for x in ["SUPERVISOR", "MODERADOR", "ADMIN"])

    with get_db_cursor() as cur:
        sql = """
            SELECT 
                c.chamado,
                c.ft,
                c.tecnico_nome,
                c.assistencia_centro_trabalho AS ct,
                COALESCE(
                    (SELECT b.cidade FROM tb_base_atp b WHERE b.ct_codigo = c.assistencia_centro_trabalho AND b.cidade IS NOT NULL LIMIT 1),
                    c.assistencia_nome,
                    c.assistencia_centro_trabalho
                ) AS assistencia_nome,
                c.equipamento,
                CASE 
                    WHEN ch.gp_segmento = 'GOV' OR ch.gp_desc LIKE '%GOVERNO%' OR c.projeto LIKE 'H3-%' THEN 'Governo'
                    ELSE 'Corporativo'
                END AS projeto,
                c.sla_status,
                COALESCE(NULLIF(TRIM(c.classifica_chamado), ''), 'FORA DO SLA') AS causa_perda,
                c.texto_encerrado
            FROM tb_chamado c
            JOIN tb_tecnico_base tb ON tb.ct_codigo = c.assistencia_centro_trabalho
            JOIN tb_tecnico t ON t.id_tecnico = tb.id_tecnico
            LEFT JOIN chamados ch ON ch.chamado = c.chamado::text
            WHERE tb.id_tecnico = %s
              AND UPPER(TRIM(c.sla_status)) = 'FORA'
        """
        params = [id_tecnico]

        if not is_supervisor_or_admin:
            sql += """ AND (
                UPPER(TRIM(c.tecnico_nome)) = UPPER(TRIM(t.nome_completo)) 
                OR TRANSLATE(UPPER(TRIM(c.tecnico_nome)), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC') = TRANSLATE(UPPER(TRIM(t.nome_completo)), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC')
            )"""

        mes_filtro = (mesAno or "").strip().lower()
        if "jul" in mes_filtro or "2026-07" in mes_filtro or mes_filtro == "7":
            sql += " AND TO_CHAR(c.ft, 'YYYY-MM') = '2026-07'"
        elif "ago" in mes_filtro or "2026-08" in mes_filtro or mes_filtro == "8":
            sql += " AND TO_CHAR(c.ft, 'YYYY-MM') = '2026-08'"
        else:
            cur.execute("SELECT data_inicio, data_fim FROM tb_campanha WHERE ativa = true ORDER BY id_campanha DESC LIMIT 1;")
            camp = cur.fetchone()
            if camp and camp.get("data_inicio") and camp.get("data_fim"):
                sql += " AND c.ft >= %s AND c.ft <= %s"
                params.extend([datetime.combine(camp["data_inicio"], datetime.min.time()),
                               datetime.combine(camp["data_fim"], datetime.max.time())])

        sql += " ORDER BY c.ft DESC;"
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()

        return [
            {
                "chamado": str(r["chamado"]),
                "dataFt": r["ft"].isoformat() if r.get("ft") else None,
                "tecnicoNome": r.get("tecnico_nome"),
                "ctCodigo": r.get("ct"),
                "assistenciaNome": r.get("assistencia_nome"),
                "equipamento": r.get("equipamento"),
                "projeto": r.get("projeto"),
                "slaStatus": r.get("sla_status"),
                "causaPerda": r.get("causa_perda"),
                "textoEncerramento": r.get("texto_encerrado")
            }
            for r in rows
        ]

@router.get("/dashboard/tecnico/{id_tecnico}/perdas")
def get_tecnico_perdas(
    id_tecnico: int, 
    mesAno: Optional[str] = Query(None), 
    equipe: Optional[str] = Query(None),
    request: Request = None
):
    with get_db_cursor() as cur:
        d_ini, d_fim = resolver_intervalo_datas(cur, mesAno)
        equipe_val = equipe if isinstance(equipe, str) and equipe != 'all' and equipe.strip() else None

        where_conds = [
            "c.classifica_chamado IN ('PERFORMANCE FALHA GESTAO', 'TRANSFERENCIA ENTRE BASES')",
            "c.ft >= %s",
            "c.ft <= %s"
        ]
        params: List[Any] = [d_ini, d_fim]

        if id_tecnico > 0:
            cur.execute("SELECT nome_completo FROM tb_tecnico WHERE id_tecnico = %s LIMIT 1;", (id_tecnico,))
            t = cur.fetchone()
            nome_tec = t["nome_completo"] if t else ""
            where_conds.append("(c.id_tecnico = %s OR UPPER(TRIM(c.tecnico_nome)) = UPPER(TRIM(%s)))")
            params.extend([id_tecnico, nome_tec])
        elif equipe_val:
            where_conds.append("c.assistencia_centro_trabalho = %s")
            params.append(equipe_val)

        where_clause = " AND ".join(where_conds)
        sql = f"""
            SELECT 
                c.chamado,
                c.ft,
                c.tecnico_nome,
                c.assistencia_centro_trabalho AS ct,
                COALESCE(
                    (SELECT b.cidade FROM tb_base_atp b WHERE b.ct_codigo = c.assistencia_centro_trabalho AND b.cidade IS NOT NULL LIMIT 1),
                    c.assistencia_nome,
                    c.assistencia_centro_trabalho
                ) AS assistencia_nome,
                c.equipamento,
                CASE 
                    WHEN c.projeto LIKE 'H3-%%' OR UPPER(COALESCE(c.projeto, '')) LIKE '%%GOV%%' THEN 'Governo'
                    ELSE COALESCE(c.projeto, 'Corporativo')
                END AS projeto,
                c.sla_status,
                COALESCE(NULLIF(TRIM(c.classifica_chamado), ''), 'PERFORMANCE FALHA GESTAO') AS causa_perda,
                c.texto_encerrado
            FROM tb_chamado c
            WHERE {where_clause}
            ORDER BY c.ft DESC;
        """
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()

        return [
            {
                "chamado": str(r["chamado"]),
                "ft": r["ft"].isoformat() if r.get("ft") else None,
                "tecnicoNome": r.get("tecnico_nome"),
                "ct": r.get("ct"),
                "assistenciaNome": r.get("assistencia_nome"),
                "equipamento": r.get("equipamento"),
                "projeto": r.get("projeto"),
                "slaStatus": r.get("sla_status"),
                "causaPerda": r.get("causa_perda"),
                "textoEncerrado": r.get("texto_encerrado")
            }
            for r in rows
        ]

@router.get("/dashboard/tecnico/{id_tecnico}/perdas-semanais")
def get_tecnico_perdas_semanais(
    id_tecnico: int,
    mesAno: Optional[str] = Query(None),
    equipe: Optional[str] = Query(None)
):
    with get_db_cursor() as cur:
        d_ini, d_fim = resolver_intervalo_datas(cur, mesAno)
        equipe_val = equipe if isinstance(equipe, str) and equipe != 'all' and equipe.strip() else None
        
        where_conds = [
            "c.classifica_chamado IN ('PERFORMANCE FALHA GESTAO', 'TRANSFERENCIA ENTRE BASES')",
            "c.ft >= %s",
            "c.ft <= %s"
        ]
        params: List[Any] = [d_ini, d_fim]

        if id_tecnico > 0:
            cur.execute("SELECT nome_completo FROM tb_tecnico WHERE id_tecnico = %s LIMIT 1;", (id_tecnico,))
            t = cur.fetchone()
            nome_tec = t["nome_completo"] if t else ""
            where_conds.append("(c.id_tecnico = %s OR UPPER(TRIM(c.tecnico_nome)) = UPPER(TRIM(%s)))")
            params.extend([id_tecnico, nome_tec])
        elif equipe_val:
            where_conds.append("c.assistencia_centro_trabalho = %s")
            params.append(equipe_val)

        where_clause = " AND ".join(where_conds)
        cur.execute(f"""
            SELECT date_trunc('week', c.ft) AS semana_inicio, COUNT(*) AS qtd
            FROM tb_chamado c
            WHERE {where_clause}
            GROUP BY semana_inicio
            ORDER BY semana_inicio ASC;
        """, tuple(params))
        rows = cur.fetchall()

        result = []
        for idx, r in enumerate(rows):
            result.append({
                "label": f"Sem {idx + 1}",
                "value": int(r["qtd"] or 0)
            })

        while len(result) < 4:
            result.append({
                "label": f"Sem {len(result) + 1}",
                "value": 0
            })

        return result

@router.get("/dashboard/tecnico/{id_tecnico}/reincidentes-semanais")
def get_tecnico_reincidentes_semanais(
    id_tecnico: int,
    mesAno: Optional[str] = Query(None),
    equipe: Optional[str] = Query(None)
):
    with get_db_cursor() as cur:
        d_ini, d_fim = resolver_intervalo_datas(cur, mesAno)
        equipe_val = equipe if isinstance(equipe, str) and equipe != 'all' and equipe.strip() else None

        where_conds = [
            "r.ft_rrc >= %s",
            "r.ft_rrc <= %s"
        ]
        params: List[Any] = [d_ini, d_fim]

        if id_tecnico > 0:
            cur.execute("SELECT nome_completo FROM tb_tecnico WHERE id_tecnico = %s LIMIT 1;", (id_tecnico,))
            t = cur.fetchone()
            nome_tec = t["nome_completo"] if t else ""
            where_conds.append("UPPER(TRIM(r.tecnico_nome_anterior)) = UPPER(TRIM(%s))")
            params.append(nome_tec)
        elif equipe_val:
            where_conds.append("r.ct_anterior = %s")
            params.append(equipe_val)

        where_clause = " AND ".join(where_conds)
        cur.execute(f"""
            SELECT date_trunc('week', r.ft_rrc) AS semana_inicio, COUNT(*) AS qtd
            FROM reincidentes r
            WHERE {where_clause}
            GROUP BY semana_inicio
            ORDER BY semana_inicio ASC;
        """, tuple(params))
        rows = cur.fetchall()

        result = []
        for idx, r in enumerate(rows):
            result.append({
                "label": f"Sem {idx + 1}",
                "value": int(r["qtd"] or 0)
            })

        while len(result) < 4:
            result.append({
                "label": f"Sem {len(result) + 1}",
                "value": 0
            })

        return result

@router.get("/dashboard/tecnico/{id_tecnico}/pecas-distribuicao")
def get_tecnico_pecas_distribuicao(
    id_tecnico: int,
    mesAno: Optional[str] = Query(None),
    equipe: Optional[str] = Query(None)
):
    with get_db_cursor() as cur:
        d_ini, d_fim = resolver_intervalo_datas(cur, mesAno)
        equipe_val = equipe if isinstance(equipe, str) and equipe != 'all' and equipe.strip() else None

        ch_conds = ["c.ft >= %s", "c.ft <= %s"]
        ch_params: List[Any] = [d_ini, d_fim]

        pecas_conds = [
            "p.ft >= %s", 
            "p.ft <= %s",
            "UPPER(COALESCE(p.acao, '')) NOT LIKE '%%SEM NECESSIDADE%%'",
            "UPPER(COALESCE(p.acao, '')) NOT LIKE '%%A009%%'",
            "UPPER(COALESCE(p.acao, '')) NOT LIKE '%%ORÇAMENTO%%'"
        ]
        pecas_params: List[Any] = [d_ini, d_fim]

        if id_tecnico > 0:
            cur.execute("SELECT nome_completo FROM tb_tecnico WHERE id_tecnico = %s LIMIT 1;", (id_tecnico,))
            t = cur.fetchone()
            nome_tec = t["nome_completo"] if t else ""
            ch_conds.append("(c.id_tecnico = %s OR UPPER(TRIM(c.tecnico_nome)) = UPPER(TRIM(%s)))")
            ch_params.extend([id_tecnico, nome_tec])
            pecas_conds.append("UPPER(TRIM(p.tecnico_nome)) = UPPER(TRIM(%s))")
            pecas_params.append(nome_tec)
        elif equipe_val:
            ch_conds.append("c.assistencia_centro_trabalho = %s")
            ch_params.append(equipe_val)
            pecas_conds.append("p.ct = %s")
            pecas_params.append(equipe_val)

        # Total de chamados atendidos na Base DL (tb_chamado)
        cur.execute(f"SELECT COUNT(*) AS total FROM tb_chamado c WHERE {' AND '.join(ch_conds)};", tuple(ch_params))
        total_atendimentos = cur.fetchone()["total"] or 0

        # Contagem das 4 categorias de peças elegíveis (PLM, SSD, HD, Tela LCD)
        cur.execute(f"""
            SELECT 
                COUNT(*) FILTER (WHERE UPPER(p.subgrupo) LIKE '%%LCD%%' OR UPPER(p.subgrupo) LIKE '%%TELA%%' OR UPPER(p.grupo_mercadoria_desc) LIKE '%%LCD%%') AS tela,
                COUNT(*) FILTER (WHERE UPPER(p.subgrupo) LIKE '%%SSD%%' OR UPPER(p.grupo_mercadoria_desc) LIKE '%%SSD%%') AS ssd,
                COUNT(*) FILTER (WHERE UPPER(p.subgrupo) LIKE '%%HD%%' OR UPPER(p.subgrupo) LIKE '%%HDD%%' OR UPPER(p.grupo_mercadoria_desc) LIKE '%%HARD DISK%%') AS hd,
                COUNT(*) FILTER (WHERE UPPER(p.subgrupo) LIKE '%%PLM%%' OR UPPER(p.subgrupo) LIKE '%%PLACA%%' OR UPPER(p.grupo_mercadoria_desc) LIKE '%%PLACA%%') AS plm
            FROM tb_consumo_peca p
            WHERE {' AND '.join(pecas_conds)};
        """, tuple(pecas_params))
        row = cur.fetchone()

        tela = int(row["tela"] or 0)
        ssd = int(row["ssd"] or 0)
        hd = int(row["hd"] or 0)
        plm = int(row["plm"] or 0)
        total_pecas = tela + ssd + hd + plm

        percentual_consumo = round((total_pecas / total_atendimentos * 100), 1) if total_atendimentos > 0 else 0.0

        if total_pecas > 0:
            p_tela = round((tela / total_pecas) * 100)
            p_ssd = round((ssd / total_pecas) * 100)
            p_hd = round((hd / total_pecas) * 100)
            p_plm = max(0, 100 - (p_tela + p_ssd + p_hd))
        else:
            p_tela = p_ssd = p_hd = p_plm = 0

        return {
            "totalAtendimentos": total_atendimentos,
            "totalPecasElegiveis": total_pecas,
            "percentualConsumo": percentual_consumo,
            "categorias": [
                { "key": "tela", "label": "Tela LCD", "qtd": tela, "pct": p_tela },
                { "key": "ssd", "label": "SSD", "qtd": ssd, "pct": p_ssd },
                { "key": "hd", "label": "HD", "qtd": hd, "pct": p_hd },
                { "key": "plm", "label": "PLM", "qtd": plm, "pct": p_plm },
            ]
        }

@router.get("/dashboard/tecnico/{id_tecnico}/reincidentes")
def get_tecnico_reincidentes(
    id_tecnico: int, 
    mesAno: Optional[str] = Query(None),
    equipe: Optional[str] = Query(None)
):
    with get_db_cursor() as cur:
        d_ini, d_fim = resolver_intervalo_datas(cur, mesAno)
        equipe_val = equipe if isinstance(equipe, str) and equipe != 'all' and equipe.strip() else None

        where_conds = ["r.ft_rrc >= %s", "r.ft_rrc <= %s"]
        params: List[Any] = [d_ini, d_fim]

        if id_tecnico > 0:
            cur.execute("SELECT nome_completo FROM tb_tecnico WHERE id_tecnico = %s LIMIT 1;", (id_tecnico,))
            t = cur.fetchone()
            nome_tec = t["nome_completo"] if t else ""
            where_conds.append("UPPER(TRIM(r.tecnico_nome_anterior)) = UPPER(TRIM(%s))")
            params.append(nome_tec)
        elif equipe_val:
            where_conds.append("r.ct_anterior = %s")
            params.append(equipe_val)

        sql = f"""
            SELECT 
                r.chamado_anterior,
                r.chamado_rrc,
                r.ft_anterior,
                r.ft_rrc,
                CASE 
                    WHEN r.ft_rrc IS NOT NULL AND r.ft_anterior IS NOT NULL 
                    THEN EXTRACT(DAY FROM (r.ft_rrc - r.ft_anterior))::bigint 
                    ELSE NULL 
                END AS dias_entre,
                CASE 
                    WHEN r.ft_rrc IS NOT NULL AND r.ft_anterior IS NOT NULL 
                    THEN ROUND(EXTRACT(EPOCH FROM (r.ft_rrc - r.ft_anterior)) / 3600)::bigint 
                    ELSE NULL 
                END AS horas_entre,
                r.tecnico_nome_anterior,
                r.tecnico_nome_rrc,
                COALESCE((SELECT b.cidade FROM tb_base_atp b WHERE b.ct_codigo = r.ct_anterior LIMIT 1), r.ct_anterior) AS ct_anterior,
                COALESCE((SELECT b.cidade FROM tb_base_atp b WHERE b.ct_codigo = r.ct_rrc LIMIT 1), r.ct_rrc) AS ct_rrc,
                r.projeto_anterior,
                r.projeto_rrc,
                r.defeito_anterior,
                r.ocorrencia_chamado_anterior,
                r.texto_encerrado_anterior,
                r.aplicado_peca_anterior,
                r.defeito_rrc,
                r.ocorrencia_chamado_rrc,
                r.texto_encerrado_rrc,
                r.aplicado_peca_rrc
            FROM reincidentes r
            WHERE {' AND '.join(where_conds)}
            ORDER BY r.ft_rrc DESC;
        """
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()

        return [
            {
                "chamadoAnterior": r["chamado_anterior"],
                "chamadoRrc": r["chamado_rrc"],
                "ftAnterior": r["ft_anterior"].isoformat() if r.get("ft_anterior") else None,
                "ftRrc": r["ft_rrc"].isoformat() if r.get("ft_rrc") else None,
                "diasEntre": r.get("dias_entre"),
                "horasEntre": r.get("horas_entre"),
                "tecnicoNomeAnterior": r.get("tecnico_nome_anterior"),
                "tecnicoNomeRrc": r.get("tecnico_nome_rrc"),
                "ctAnterior": r.get("ct_anterior"),
                "ctRrc": r.get("ct_rrc"),
                "projetoAnterior": r.get("projeto_anterior"),
                "projetoRrc": r.get("projeto_rrc"),
                "defeitoAnterior": r.get("defeito_anterior"),
                "ocorrenciaChamadoAnterior": r.get("ocorrencia_chamado_anterior"),
                "textoEncerradoAnterior": r.get("texto_encerrado_anterior"),
                "aplicadoPecaAnterior": r.get("aplicado_peca_anterior"),
                "defeitoRrc": r.get("defeito_rrc"),
                "ocorrenciaChamadoRrc": r.get("ocorrencia_chamado_rrc"),
                "textoEncerradoRrc": r.get("texto_encerrado_rrc"),
                "aplicadoPecaRrc": r.get("aplicado_peca_rrc")
            }
            for r in rows
        ]

@router.get("/dashboard/tecnico/{id_tecnico}/chamados")
def get_tecnico_chamados(
    id_tecnico: int,
    mesAno: Optional[str] = Query(None),
    data: Optional[str] = Query(None),
    dataInicio: Optional[str] = Query(None),
    dataFim: Optional[str] = Query(None),
    page: int = Query(0, ge=0),
    size: int = Query(10, ge=1, le=100)
):
    with get_db_cursor() as cur:
        if id_tecnico == 0:
            tec_clause = "1=1"
            base_params = []
        else:
            cur.execute("SELECT nome_completo FROM tb_tecnico WHERE id_tecnico = %s LIMIT 1;", (id_tecnico,))
            t = cur.fetchone()
            nome_tecnico = t["nome_completo"] if t else ""
            tec_clause = "(c.id_tecnico = %s OR UPPER(TRIM(c.tecnico_nome)) = UPPER(TRIM(%s)))"
            base_params = [id_tecnico, nome_tecnico]

        # Busca histórico de atendimentos por dia e data do último atendimento
        cur.execute(f"""
            SELECT to_char(c.ft, 'YYYY-MM-DD') AS dia, COUNT(*) AS qtd
            FROM tb_chamado c
            WHERE {tec_clause} AND c.ft IS NOT NULL
            GROUP BY dia
            ORDER BY dia DESC;
        """, base_params)
        dias_rows = cur.fetchall()

        atendimentos_por_dia = {r["dia"]: r["qtd"] for r in dias_rows}
        ultimo_atendimento = dias_rows[0]["dia"] if dias_rows else None

        # Filtro opcional por data ou mês/ano
        where_extra = []
        extra_params = []

        data_filtro = data if isinstance(data, str) else (dataInicio if isinstance(dataInicio, str) else None)
        mes_filtro = mesAno if isinstance(mesAno, str) else None

        if data_filtro:
            where_extra.append("to_char(c.ft, 'YYYY-MM-DD') = %s")
            extra_params.append(data_filtro[:10])
        elif mes_filtro and mes_filtro not in ("Campanha Inteira", "Média Final"):
            where_extra.append("to_char(c.ft, 'YYYY-MM') = %s")
            extra_params.append(mes_filtro[:7])

        extra_clause = f"AND {' AND '.join(where_extra)}" if where_extra else ""

        p_val = page if isinstance(page, int) else 0
        s_val = size if isinstance(size, int) else 10

        # Total de chamados no filtro
        cur.execute(f"""
            SELECT COUNT(*) AS total
            FROM tb_chamado c
            WHERE {tec_clause} {extra_clause}
        """, base_params + extra_params)
        total_elements = cur.fetchone()["total"]
        total_pages = max(1, (total_elements + s_val - 1) // s_val)

        # Conteúdo paginado
        offset = p_val * s_val
        cur.execute(f"""
            SELECT 
                c.chamado,
                c.ft,
                c.tecnico_nome,
                c.assistencia_centro_trabalho AS ct,
                COALESCE(
                    (SELECT b.cidade FROM tb_base_atp b WHERE b.ct_codigo = c.assistencia_centro_trabalho AND b.cidade IS NOT NULL LIMIT 1),
                    c.assistencia_nome,
                    c.assistencia_centro_trabalho
                ) AS assistencia_nome,
                c.equipamento,
                CASE 
                    WHEN c.projeto LIKE 'H3-%%' THEN 'Governo'
                    ELSE COALESCE(c.projeto, 'Corporativo')
                END AS projeto,
                c.sla_status,
                c.classifica_chamado,
                c.texto_encerrado
            FROM tb_chamado c
            WHERE {tec_clause} {extra_clause}
            ORDER BY c.ft DESC NULLS LAST, c.chamado DESC
            LIMIT %s OFFSET %s;
        """, base_params + extra_params + [s_val, offset])
        rows = cur.fetchall()

        content = [
            {
                "chamado": r["chamado"],
                "ft": r["ft"].isoformat() if r.get("ft") else None,
                "tecnicoNome": r.get("tecnico_nome"),
                "ct": r.get("ct"),
                "assistenciaNome": r.get("assistencia_nome"),
                "equipamento": r.get("equipamento"),
                "projeto": r.get("projeto"),
                "slaStatus": (r.get("sla_status") or "").upper(),
                "classificaChamado": r.get("classifica_chamado"),
                "textoEncerrado": r.get("texto_encerrado")
            }
            for r in rows
        ]

        return {
            "content": content,
            "totalElements": total_elements,
            "totalPages": total_pages,
            "page": p_val,
            "size": s_val,
            "ultimoAtendimento": ultimo_atendimento,
            "atendimentosPorDia": atendimentos_por_dia,
            "totalChamados": sum(atendimentos_por_dia.values())
        }

@router.get("/dashboard/chamados-sem-tecnico")
def get_chamados_sem_tecnico(mesAno: Optional[str] = Query(None), idSupervisor: Optional[int] = Query(None)):
    with get_db_cursor() as cur:
        sql = """
            SELECT 
                COALESCE(b.uf, 'OUTROS') AS uf,
                COALESCE(b.atp_resumidas, b.nome_atp, 'BASE INDEFINIDA') AS atp_nome,
                c.assistencia_centro_trabalho AS ct_codigo,
                COUNT(*) AS total_chamados,
                COUNT(*) FILTER (WHERE UPPER(TRIM(c.sla_status)) = 'DENTRO') AS dentro_sla,
                COUNT(*) FILTER (WHERE UPPER(TRIM(c.sla_status)) = 'FORA') AS fora_sla,
                ROUND((COUNT(*) FILTER (WHERE UPPER(TRIM(c.sla_status)) = 'DENTRO')::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1) AS perc_sla
            FROM tb_chamado c
            LEFT JOIN tb_base_atp b ON b.ct_codigo = c.assistencia_centro_trabalho
            WHERE (
                c.tecnico_nome IS NULL 
                OR TRIM(c.tecnico_nome) = '' 
                OR UPPER(TRIM(c.tecnico_nome)) IN ('NÃO DEFINIDO', 'NAO DEFINIDO', 'SEM TECNICO', 'SEM TÉCNICO', 'PENDENTE')
            )
        """
        params = []
        if idSupervisor:
            sql += " AND b.id_supervisor = %s"
            params.append(idSupervisor)

        mes_filtro = (mesAno or "").strip().lower()
        if "jul" in mes_filtro or "2026-07" in mes_filtro or mes_filtro == "7":
            sql += " AND TO_CHAR(c.ft, 'YYYY-MM') = '2026-07'"
        elif "ago" in mes_filtro or "2026-08" in mes_filtro or mes_filtro == "8":
            sql += " AND TO_CHAR(c.ft, 'YYYY-MM') = '2026-08'"
        else:
            cur.execute("SELECT data_inicio, data_fim FROM tb_campanha WHERE ativa = true ORDER BY id_campanha DESC LIMIT 1;")
            camp = cur.fetchone()
            if camp and camp.get("data_inicio") and camp.get("data_fim"):
                sql += " AND c.ft >= %s AND c.ft <= %s"
                params.extend([datetime.combine(camp["data_inicio"], datetime.min.time()),
                               datetime.combine(camp["data_fim"], datetime.max.time())])

        sql += """
            GROUP BY b.uf, b.atp_resumidas, b.nome_atp, c.assistencia_centro_trabalho
            ORDER BY total_chamados DESC;
        """
        cur.execute(sql, tuple(params))
        regioes = cur.fetchall()

        total_geral = sum(r["total_chamados"] for r in regioes)
        total_bases = len(regioes)

        return {
            "totalGeral": total_geral,
            "totalBasesAfetadas": total_bases,
            "regioes": [
                {
                    "uf": r["uf"],
                    "atpNome": r["atp_nome"],
                    "ctCodigo": r["ct_codigo"],
                    "totalChamados": r["total_chamados"],
                    "dentroSla": r["dentro_sla"],
                    "foraSla": r["fora_sla"],
                    "percSla": float(r["perc_sla"] or 0)
                }
                for r in regioes
            ],
            "chamados": []
        }
