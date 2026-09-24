import logging
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from fastapi import APIRouter, Query, HTTPException, Request
try:
    from core.database import get_db_cursor
    from core.security import decode_access_token
except ImportError:
    from api.core.database import get_db_cursor
    from api.core.security import decode_access_token

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
                cidade = (b.get("cidade") or "").strip()
                uf = (b.get("uf") or "").strip()
                if cidade and uf:
                    lookup[ct] = f"{cidade}/{uf}"
                elif cidade:
                    lookup[ct] = cidade
                elif b.get("nome_atp"):
                    lookup[ct] = b["nome_atp"].strip()
    except Exception as e:
        logger.warning(f"Erro ao carregar lookup de bases: {e}")
    return lookup

@router.get("/dashboard/version")
def get_version():
    return {
        "version": "v1-digitaltwin-fastapi-serverless",
        "runtime": "python-fastapi",
        "timestamp": datetime.now().isoformat()
    }

@router.get("/dashboard/ranking")
def get_ranking(mesAno: Optional[str] = Query(None, description="Data YYYY-MM-DD")):
    with get_db_cursor() as cur:
        # 1. Busca campanha ativa
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
                   COALESCE((SELECT ARRAY_AGG(tb.ct_codigo) FROM tb_tecnico_base tb WHERE tb.id_tecnico = t.id_tecnico), '{}') AS ct_bases
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
                    "npsScore": val_to_pct(h.get("atingimento_nps")),
                    "pontosNps": val_to_double(h.get("pontos_nps")),
                    "percentualEficienciaPecas": val_to_pct(h.get("atingimento_pecas")),
                    "pontosPecas": val_to_double(h.get("pontos_pecas")),
                    "percentualPerdidos": val_to_pct(h.get("atingimento_perdidos")),
                    "pontosPerdidos": val_to_double(h.get("pontos_perdidos")),
                    "pontosTotal": val_to_double(h.get("pontuacao_total")),
                    "elegivel": bool(h.get("status_elegibilidade")),
                    "motivoInelegibilidade": h.get("motivo_inelegibilidade")
                })

            ct_bases = a.get("ct_bases") or []
            local_equipe = ",".join([cidade_por_ct.get(ct, ct) for ct in ct_bases]) if ct_bases else ""

            ranking_dto = {
                "posicaoRanking": posicao,
                "idTecnico": a["id_tecnico"],
                "tecnico": a["nome_completo"],
                "matricula": a["matricula"],
                "localEquipe": local_equipe,
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
                "npsScore": 0.0 if sem_chamados else val_to_pct(a.get("atingimento_nps")),
                "pontosNps": 0.0 if sem_chamados else val_to_double(a.get("pontos_nps")),
                "npsPromotores": 0,
                "npsDetratores": 0,
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
                    WHEN UPPER(COALESCE(p.segmento, '')) LIKE '%GOV%' OR p.projeto LIKE 'H3-%' THEN 'Governo'
                    ELSE COALESCE(p.projeto, 'Corporativo')
                END AS projeto,
                COALESCE(p.atp, p.cliente_cidade, p.ct) AS assistencia_cidade,
                p.ocorrencia_chamado,
                p.texto_encerrado
            FROM tb_consumo_peca p
            WHERE UPPER(COALESCE(p.acao, '')) NOT LIKE '%SEM NECESSIDADE%'
              AND UPPER(COALESCE(p.acao, '')) NOT LIKE '%A009%'
              AND UPPER(COALESCE(p.acao, '')) NOT LIKE '%ORÇAMENTO%'
              AND (
                  UPPER(COALESCE(p.subgrupo, '')) IN ('PLACA MÃE', 'PLACA MAE', 'PLM', 'SSD', 'HD', 'HDD', 'TAMPA FRONTAL/LCD', 'PAINEL LCD', 'LCD', 'LCD ALFANUM')
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%PLACA MAE%'
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%PLM%'
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%SSD%'
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%HARD DISK%'
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%LCD%'
                  OR UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%TELA%'
                  OR UPPER(COALESCE(p.codigo_aplicado_desc, '')) LIKE '%PLM%'
                  OR UPPER(COALESCE(p.codigo_aplicado_desc, '')) LIKE '%SSD%'
                  OR UPPER(COALESCE(p.codigo_aplicado_desc, '')) LIKE '%HDD%'
                  OR UPPER(COALESCE(p.codigo_aplicado_desc, '')) LIKE '%LCD%'
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
def get_tecnico_perdas(id_tecnico: int, mesAno: Optional[str] = Query(None), request: Request = None):
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
                COALESCE(NULLIF(TRIM(c.classifica_chamado), ''), 'PERFORMANCE FALHA GESTAO') AS causa_perda,
                c.texto_encerrado
            FROM tb_chamado c
            JOIN tb_tecnico_base tb ON tb.ct_codigo = c.assistencia_centro_trabalho
            JOIN tb_tecnico t ON t.id_tecnico = tb.id_tecnico
            LEFT JOIN chamados ch ON ch.chamado = c.chamado::text
            WHERE tb.id_tecnico = %s
              AND c.classifica_chamado IN ('PERFORMANCE FALHA GESTAO', 'TRANSFERENCIA ENTRE BASES')
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

@router.get("/dashboard/tecnico/{id_tecnico}/reincidentes")
def get_tecnico_reincidentes(id_tecnico: int, mesAno: Optional[str] = Query(None)):
    with get_db_cursor() as cur:
        # Busca nome e bases do técnico
        cur.execute("""
            SELECT t.nome_completo,
                   COALESCE((SELECT ARRAY_AGG(tb.ct_codigo) FROM tb_tecnico_base tb WHERE tb.id_tecnico = t.id_tecnico), '{}') AS ct_bases
            FROM tb_tecnico t WHERE t.id_tecnico = %s LIMIT 1;
        """, (id_tecnico,))
        t = cur.fetchone()
        if not t:
            return []

        nome_tecnico = t["nome_completo"]
        ct_bases = t["ct_bases"] or []

        sql = """
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
                r.aplicado_peca_rrc,
                r.peca_nome_anterior,
                r.peca_nome_rrc
            FROM tb_encerrados_rrc r
            WHERE (
                UPPER(TRIM(r.tecnico_nome_rrc)) = UPPER(TRIM(%s))
                OR r.ct_rrc = ANY(%s)
            )
        """
        params = [nome_tecnico, ct_bases]

        mes_filtro = (mesAno or "").strip().lower()
        if "jul" in mes_filtro or "2026-07" in mes_filtro or mes_filtro == "7":
            sql += " AND TO_CHAR(r.ft_rrc, 'YYYY-MM') = '2026-07'"
        elif "ago" in mes_filtro or "2026-08" in mes_filtro or mes_filtro == "8":
            sql += " AND TO_CHAR(r.ft_rrc, 'YYYY-MM') = '2026-08'"
        else:
            cur.execute("SELECT data_inicio, data_fim FROM tb_campanha WHERE ativa = true ORDER BY id_campanha DESC LIMIT 1;")
            camp = cur.fetchone()
            if camp and camp.get("data_inicio") and camp.get("data_fim"):
                sql += " AND r.ft_rrc >= %s AND r.ft_rrc <= %s"
                params.extend([datetime.combine(camp["data_inicio"], datetime.min.time()),
                               datetime.combine(camp["data_fim"], datetime.max.time())])

        sql += " ORDER BY r.ft_rrc DESC;"
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
                "aplicadoPecaRrc": r.get("aplicado_peca_rrc"),
                "pecaNomeAnterior": r.get("peca_nome_anterior"),
                "pecaNomeRrc": r.get("peca_nome_rrc")
            }
            for r in rows
        ]

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
