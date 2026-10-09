import logging
import re
from typing import Optional, List, Dict, Any, Tuple
from datetime import date, datetime
from fastapi import APIRouter, Query, HTTPException, Request
try:
    from backend_python.core.database import get_db_cursor
    from backend_python.core.security import decode_access_token
except ImportError:
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
    import calendar
    mes_str = (mesAno if isinstance(mesAno, str) else "") or ""
    mes_lower = mes_str.strip().lower()

    if "/" in mes_str:
        parts = mes_str.strip().split("/")
        if len(parts) == 2:
            try:
                mes = int(parts[0])
                ano = int(parts[1])
                _, last_day = calendar.monthrange(ano, mes)
                return datetime(ano, mes, 1, 0, 0, 0), datetime(ano, mes, last_day, 23, 59, 59, 999999)
            except Exception:
                pass

    if len(mes_str) >= 7 and mes_str[4] == '-':
        try:
            ano = int(mes_str[:4])
            mes = int(mes_str[5:7])
            _, last_day = calendar.monthrange(ano, mes)
            return datetime(ano, mes, 1, 0, 0, 0), datetime(ano, mes, last_day, 23, 59, 59, 999999)
        except Exception:
            pass

    if "jul" in mes_lower or "2026-07" in mes_lower or mes_lower == "7":
        return datetime(2026, 7, 1, 0, 0, 0), datetime(2026, 7, 31, 23, 59, 59, 999999)
    elif "ago" in mes_lower or "2026-08" in mes_lower or mes_lower == "8":
        return datetime(2026, 8, 1, 0, 0, 0), datetime(2026, 8, 31, 23, 59, 59, 999999)
    elif "set" in mes_lower or "2026-09" in mes_lower or mes_lower == "9":
        return datetime(2026, 9, 1, 0, 0, 0), datetime(2026, 9, 30, 23, 59, 59, 999999)
    elif "out" in mes_lower or "2026-10" in mes_lower or mes_lower == "10":
        return datetime(2026, 10, 1, 0, 0, 0), datetime(2026, 10, 31, 23, 59, 59, 999999)

    cur.execute("SELECT data_inicio, data_fim FROM tb_campanha WHERE ativa = true ORDER BY id_campanha DESC LIMIT 1;")
    camp = cur.fetchone()
    if camp and camp.get("data_inicio") and camp.get("data_fim"):
        return datetime.combine(camp["data_inicio"], datetime.min.time()), datetime.combine(camp["data_fim"], datetime.max.time())

    return datetime(2026, 9, 1, 0, 0, 0), datetime(2026, 9, 30, 23, 59, 59, 999999)

def safe_int(val: Any) -> Optional[int]:
    if val is None:
        return None
    try:
        if isinstance(val, (int, float)):
            return int(val)
        if isinstance(val, str) and val.strip().isdigit():
            return int(val.strip())
    except Exception:
        pass
    return None

def resolver_codigo_atp(cur, equipe_input: Any) -> Optional[str]:
    """Valida ou resolve um parâmetro de equipe/base para o código numérico oficial da ATP (ct_codigo)."""
    if equipe_input is None or not isinstance(equipe_input, (str, int)):
        return None
    val = str(equipe_input).strip()
    if not val or val.lower() == 'all':
        return None
    # 1. Se já for o ct_codigo numérico direto existente em tb_base_atp
    cur.execute("SELECT ct_codigo FROM tb_base_atp WHERE ct_codigo = %s LIMIT 1;", (val,))
    row = cur.fetchone()
    if row and row.get("ct_codigo"):
        return str(row["ct_codigo"])
    # 2. Se for sigla/UF ou nome da ATP
    cur.execute("""
        SELECT ct_codigo FROM tb_base_atp 
        WHERE UPPER(TRIM(atp_resumidas)) = UPPER(TRIM(%s))
           OR UPPER(TRIM(uf)) = UPPER(TRIM(%s))
           OR UPPER(TRIM(nome_atp)) ILIKE UPPER(TRIM(%s))
        LIMIT 1;
    """, (val, val, f"%{val}%"))
    row2 = cur.fetchone()
    if row2 and row2.get("ct_codigo"):
        return str(row2["ct_codigo"])
    return val


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
    campanhaId: Optional[int] = Query(None, description="ID da Campanha"),
    segmento: Optional[str] = Query(None, description="Total, Gov ou Corp"),
    request: Request = None
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
            JOIN tb_tecnico t ON t.id_tecnico = a.id_tecnico AND t.fl_validado = true
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
                h_mes_ano = h.get("mes_ano")
                if campanha and campanha.get("data_inicio") and campanha.get("data_fim") and h_mes_ano:
                    if not (campanha["data_inicio"] <= h_mes_ano <= campanha["data_fim"]):
                        continue
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
                    "percentualPerdidos": val_to_double(h.get("atingimento_perdidos")),
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
                "percentualPerdidos": 0.0 if sem_chamados else val_to_double(a.get("atingimento_perdidos")),
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

        # Blindagem de segurança: Se a requisição vier de um técnico autenticado,
        # filtra a lista retornando apenas os indicadores do próprio técnico para
        # alimentar seu dashboard pessoal sem expor o ranking competitivo dos demais.
        if request:
            auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token_str = auth_header.split(" ", 1)[1].strip()
                try:
                    user_payload = decode_access_token(token_str)
                    user_role = (user_payload.get("role") or "").upper()
                    user_cargo = (user_payload.get("cargo") or "").lower()
                    is_gestor = (
                        any(r in user_role for r in ("SUPERVISOR", "MODERADOR", "ADMINISTRADOR", "ADMIN")) or
                        any(c in user_cargo for c in ("supervisor", "moderador", "admin"))
                    )
                    if not is_gestor:
                        matricula_tec = str(user_payload.get("sub") or "").strip().upper()
                        nome_tec = str(user_payload.get("nome") or "").strip().upper()
                        return [
                            r for r in ranking_list
                            if (matricula_tec and str(r.get("matricula") or "").strip().upper() == matricula_tec)
                            or (nome_tec and str(r.get("tecnico") or "").strip().upper() == nome_tec)
                        ]
                except Exception:
                    pass

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

        # Fallback de resiliência: se tb_consumo_peca estiver vazia, consulta a base real pecas (210k registros)
        if not rows:
            sql_fb = """
                SELECT 
                    p.chamado,
                    p.ft,
                    p.tipo_equipamento,
                    p.acao,
                    p.cod_solic_desc,
                    p.cod_aplic_desc,
                    p.grupo_mercadoria_desc AS subgrupo,
                    p.grupo_mercadoria,
                    p.grupo_mercadoria_desc,
                    p.tecnico_nome,
                    'Operacional' AS projeto,
                    NULL AS assistencia_cidade,
                    NULL AS ocorrencia_chamado,
                    NULL AS texto_encerrado
                FROM pecas p
                WHERE UPPER(COALESCE(p.acao, '')) NOT LIKE '%%SEM NECESSIDADE%%'
                  AND UPPER(COALESCE(p.acao, '')) NOT LIKE '%%A009%%'
                  AND UPPER(COALESCE(p.acao, '')) NOT LIKE '%%ORÇAMENTO%%'
                  AND (
                      UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%%PLACA%%' OR
                      UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%%LCD%%' OR
                      UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%%TELA%%' OR
                      UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%%SSD%%' OR
                      UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%%HARD DISK%%' OR
                      UPPER(COALESCE(p.grupo_mercadoria_desc, '')) LIKE '%%DISCO%%' OR
                      UPPER(COALESCE(p.cod_aplic_desc, '')) LIKE '%%PLM%%' OR
                      UPPER(COALESCE(p.cod_aplic_desc, '')) LIKE '%%PLACA%%' OR
                      UPPER(COALESCE(p.cod_aplic_desc, '')) LIKE '%%LCD%%' OR
                      UPPER(COALESCE(p.cod_aplic_desc, '')) LIKE '%%TELA%%' OR
                      UPPER(COALESCE(p.cod_aplic_desc, '')) LIKE '%%SSD%%' OR
                      UPPER(COALESCE(p.cod_aplic_desc, '')) LIKE '%%HD%%'
                  )
            """
            params_fb = []
            if nome_tecnico:
                sql_fb += " AND UPPER(TRIM(p.tecnico_nome)) LIKE UPPER(TRIM(%s)) || '%%'"
                params_fb.append(nome_tecnico)

            if "jul" in mes_filtro or "2026-07" in mes_filtro or mes_filtro == "7":
                sql_fb += " AND TO_CHAR(p.ft, 'YYYY-MM') = '2026-07'"
            elif "ago" in mes_filtro or "2026-08" in mes_filtro or mes_filtro == "8":
                sql_fb += " AND TO_CHAR(p.ft, 'YYYY-MM') = '2026-08'"
            elif "set" in mes_filtro or "2026-09" in mes_filtro or mes_filtro == "9":
                sql_fb += " AND TO_CHAR(p.ft, 'YYYY-MM') = '2026-09'"
            elif "out" in mes_filtro or "2026-10" in mes_filtro or mes_filtro == "10":
                sql_fb += " AND TO_CHAR(p.ft, 'YYYY-MM') = '2026-10'"
            else:
                cur.execute("SELECT data_inicio, data_fim FROM tb_campanha WHERE ativa = true ORDER BY id_campanha DESC LIMIT 1;")
                camp = cur.fetchone()
                if camp and camp.get("data_inicio") and camp.get("data_fim"):
                    sql_fb += " AND p.ft >= %s AND p.ft <= %s"
                    params_fb.extend([datetime.combine(camp["data_inicio"], datetime.min.time()),
                                      datetime.combine(camp["data_fim"], datetime.max.time())])

            sql_fb += " ORDER BY p.ft DESC LIMIT 500;"
            cur.execute(sql_fb, tuple(params_fb))
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
def get_tecnico_sla_perdidos(
    id_tecnico: int,
    mesAno: Optional[str] = Query(None),
    tipo: Optional[str] = Query("equipe"),  # 'individual' ou 'equipe'
    equipe: Optional[str] = Query(None),
    idSupervisor: Optional[int] = Query(None),
    request: Request = None
):
    with get_db_cursor() as cur:
        d_ini, d_fim = resolver_intervalo_datas(cur, mesAno)
        equipe_val = resolver_codigo_atp(cur, equipe)
        sup_id = safe_int(idSupervisor)
        tipo_str = tipo if isinstance(tipo, str) else "equipe"

        # Resolve bases do técnico ou supervisor
        ct_list = []
        nome_tecnico = None
        if id_tecnico > 0:
            cur.execute("SELECT nome_completo FROM tb_tecnico WHERE id_tecnico = %s LIMIT 1;", (id_tecnico,))
            t = cur.fetchone()
            nome_tecnico = t["nome_completo"] if t else None

            # Prioriza a base de lotação principal
            cur.execute("SELECT ct_codigo FROM tb_tecnico_base WHERE id_tecnico = %s AND ct_codigo IS NOT NULL LIMIT 1;", (id_tecnico,))
            row_tec = cur.fetchone()
            if row_tec and row_tec.get("ct_codigo"):
                ct_list = [row_tec["ct_codigo"]]

            if not ct_list and nome_tecnico:
                cur.execute("""
                    SELECT assistencia_centro_trabalho 
                    FROM tb_chamado 
                    WHERE id_tecnico = %s OR UPPER(TRIM(tecnico_nome)) = UPPER(TRIM(%s))
                    GROUP BY assistencia_centro_trabalho 
                    ORDER BY count(*) DESC LIMIT 1;
                """, (id_tecnico, nome_tecnico))
                r_ct = cur.fetchone()
                if r_ct and r_ct.get("assistencia_centro_trabalho"):
                    ct_list = [r_ct["assistencia_centro_trabalho"]]
        elif sup_id:
            cur.execute("SELECT DISTINCT ct_codigo FROM tb_base_atp WHERE id_supervisor = %s AND ct_codigo IS NOT NULL;", (sup_id,))
            ct_list = [r["ct_codigo"] for r in cur.fetchall() if r.get("ct_codigo")]

        if equipe_val:
            ct_list = [equipe_val]

        # Prioriza chamados_sla (Base DL oficial do SLA)
        cur.execute("""
            SELECT COUNT(*) as cnt 
            FROM chamados_sla 
            WHERE ft >= %s AND ft <= %s AND ct_codigo IS NOT NULL;
        """, (d_ini, d_fim))
        row_csla = cur.fetchone()
        has_chamados_sla = bool(row_csla and (row_csla.get("cnt") or 0) > 0)

        if has_chamados_sla:
            csla_conds = [
                "ft >= %s AND ft <= %s",
                "UPPER(TRIM(sla_status)) NOT IN ('DENTRO', 'NO PRAZO')"
            ]
            csla_params: List[Any] = [d_ini, d_fim]
            if tipo_str == "individual" and id_tecnico > 0 and nome_tecnico:
                csla_conds.append("UPPER(TRIM(tecnico_nome)) = UPPER(TRIM(%s))")
                csla_params.append(nome_tecnico)
                if ct_list:
                    csla_conds.append("ct_codigo = ANY(%s)")
                    csla_params.append(ct_list)
            else:
                if ct_list:
                    csla_conds.append("ct_codigo = ANY(%s)")
                    csla_params.append(ct_list)
                elif id_tecnico > 0 and nome_tecnico:
                    csla_conds.append("UPPER(TRIM(tecnico_nome)) = UPPER(TRIM(%s))")
                    csla_params.append(nome_tecnico)

            clause_csla = " AND ".join(csla_conds)
            sql = f"""
                SELECT 
                    b.chamado,
                    b.ft,
                    b.tecnico_nome,
                    b.ct_codigo as ct,
                    COALESCE(
                        (SELECT a.nome_atp FROM tb_base_atp a WHERE a.ct_codigo = b.ct_codigo AND a.nome_atp IS NOT NULL LIMIT 1),
                        b.atp_nome,
                        b.ct_codigo
                    ) AS assistencia_nome,
                    b.atp_nome AS atp_resumidas,
                    b.equipamento,
                    CASE 
                        WHEN UPPER(COALESCE(b.segmento, '')) LIKE '%%GOV%%' OR b.projeto LIKE 'H3-%%' THEN 'Governo'
                        ELSE 'Corporativo'
                    END AS projeto,
                    b.sla_status,
                    COALESCE(NULLIF(TRIM(b.classifica_chamado), ''), 'FORA DO SLA') AS causa_perda,
                    b.texto_encerrado
                FROM chamados_sla b
                WHERE {clause_csla}
                ORDER BY b.ft DESC
                LIMIT 500;
            """
            cur.execute(sql, tuple(csla_params))
            rows = cur.fetchall()
            return [
                {
                    "chamado": str(r["chamado"]),
                    "dataFt": r["ft"].isoformat() if r.get("ft") else None,
                    "tecnicoNome": r.get("tecnico_nome"),
                    "ctCodigo": r.get("ct"),
                    "atpResumidas": r.get("atp_resumidas"),
                    "assistenciaNome": r.get("assistencia_nome"),
                    "equipamento": r.get("equipamento"),
                    "projeto": r.get("projeto"),
                    "slaStatus": r.get("sla_status"),
                    "causaPerda": r.get("causa_perda"),
                    "textoEncerramento": r.get("texto_encerrado")
                }
                for r in rows
            ]

        # Fallback legado para tb_chamado
        where_conds_c = [
            "UPPER(TRIM(c.sla_status)) = 'FORA'",
            "c.chamado != 80015143798",
            "c.chamado != 60006488287",
            "(ch.gp_segmento IS NULL OR ch.gp_segmento != 'VAR')",
            "(ch.tipo IS NULL OR ch.tipo NOT IN ('VISTORIA', 'VENDA DE SERVIÇOS', 'SOLICITAÇÃO DE ORÇAMENTO', 'ACOMPANHAMENTO GOV/CORP/TE'))",
            "(c.texto_encerrado IS NULL OR c.texto_encerrado NOT ILIKE '%%CANCELAD%%')"
        ]
        where_conds_ch = [
            "UPPER(TRIM(ch.sla_status)) = 'FORA'",
            "ch.chamado != '80015143798'",
            "(ch.gp_segmento IS NULL OR ch.gp_segmento != 'VAR')",
            "(ch.tipo IS NULL OR ch.tipo NOT IN ('VISTORIA', 'VENDA DE SERVIÇOS', 'SOLICITAÇÃO DE ORÇAMENTO', 'ACOMPANHAMENTO GOV/CORP/TE'))",
            "(ch.texto_encerrado IS NULL OR ch.texto_encerrado NOT ILIKE '%%CANCELAD%%')",
            "ch.chamado::bigint NOT IN (SELECT chamado FROM tb_chamado WHERE chamado IS NOT NULL)"
        ]
        p_c: List[Any] = []
        p_ch: List[Any] = []

        if mesAno and mesAno not in ('Campanha Inteira', 'Média Final'):
            where_conds_c.append("c.ft >= %s AND c.ft <= %s")
            p_c.extend([d_ini, d_fim])
            where_conds_ch.append("ch.ft >= %s AND ch.ft <= %s")
            p_ch.extend([d_ini, d_fim])

        if tipo_str == "individual" and id_tecnico > 0 and nome_tecnico:
            where_conds_c.append("(c.id_tecnico = %s OR UPPER(TRIM(c.tecnico_nome)) = UPPER(TRIM(%s)))")
            p_c.extend([id_tecnico, nome_tecnico])
            where_conds_ch.append("UPPER(TRIM(ch.tecnico_nome)) = UPPER(TRIM(%s))")
            p_ch.append(nome_tecnico)
        else:
            if ct_list:
                where_conds_c.append("c.assistencia_centro_trabalho = ANY(%s)")
                p_c.append(ct_list)
                where_conds_ch.append("ch.assistencia_centro_trabalho = ANY(%s)")
                p_ch.append(ct_list)
            elif id_tecnico > 0 and nome_tecnico:
                where_conds_c.append("(c.id_tecnico = %s OR UPPER(TRIM(c.tecnico_nome)) = UPPER(TRIM(%s)))")
                p_c.extend([id_tecnico, nome_tecnico])
                where_conds_ch.append("UPPER(TRIM(ch.tecnico_nome)) = UPPER(TRIM(%s))")
                p_ch.append(nome_tecnico)

        clause_c = " AND ".join(where_conds_c)
        clause_ch = " AND ".join(where_conds_ch)
        sql = f"""
            WITH base_chamados AS (
                SELECT 
                    c.chamado::text as chamado,
                    c.assistencia_centro_trabalho as ct,
                    c.ft,
                    c.tecnico_nome,
                    c.equipamento,
                    c.projeto,
                    c.sla_status,
                    c.texto_encerrado,
                    c.classifica_chamado,
                    ch.gp_segmento,
                    ch.tipo
                FROM tb_chamado c
                LEFT JOIN chamados ch ON ch.chamado = c.chamado::text
                WHERE {clause_c}
                
                UNION ALL
                
                SELECT 
                    ch.chamado,
                    ch.assistencia_centro_trabalho as ct,
                    ch.ft,
                    ch.tecnico_nome,
                    ch.tipo_equipamento as equipamento,
                    ch.projeto,
                    ch.sla_status,
                    ch.texto_encerrado,
                    NULL as classifica_chamado,
                    ch.gp_segmento,
                    ch.tipo
                FROM chamados ch
                WHERE {clause_ch}
            )
            SELECT 
                b.chamado,
                b.ft,
                b.tecnico_nome,
                b.ct,
                COALESCE(
                    (SELECT a.nome_atp FROM tb_base_atp a WHERE a.ct_codigo = b.ct AND a.nome_atp IS NOT NULL LIMIT 1),
                    (SELECT a.cidade FROM tb_base_atp a WHERE a.ct_codigo = b.ct AND a.cidade IS NOT NULL LIMIT 1),
                    b.ct
                ) AS assistencia_nome,
                (SELECT a.atp_resumidas FROM tb_base_atp a WHERE a.ct_codigo = b.ct AND a.atp_resumidas IS NOT NULL LIMIT 1) AS atp_resumidas,
                b.equipamento,
                CASE 
                    WHEN b.gp_segmento = 'GOV' OR b.projeto LIKE 'H3-%%' OR UPPER(COALESCE(b.projeto, '')) LIKE '%%GOV%%' THEN 'Governo'
                    ELSE 'Corporativo'
                END AS projeto,
                b.sla_status,
                COALESCE(NULLIF(TRIM(b.classifica_chamado), ''), 'FORA DO SLA') AS causa_perda,
                b.texto_encerrado
            FROM base_chamados b
            ORDER BY b.ft DESC
            LIMIT 500;
        """
        cur.execute(sql, tuple(p_c + p_ch))
        rows = cur.fetchall()

        return [
            {
                "chamado": str(r["chamado"]),
                "dataFt": r["ft"].isoformat() if r.get("ft") else None,
                "tecnicoNome": r.get("tecnico_nome"),
                "ctCodigo": r.get("ct"),
                "atpResumidas": r.get("atp_resumidas"),
                "assistenciaNome": r.get("assistencia_nome"),
                "equipamento": r.get("equipamento"),
                "projeto": r.get("projeto"),
                "slaStatus": r.get("sla_status"),
                "causaPerda": r.get("causa_perda"),
                "textoEncerramento": r.get("texto_encerrado")
            }
            for r in rows
        ]

@router.get("/dashboard/tecnico/{id_tecnico}/sla-segmentos")
def get_tecnico_sla_segmentos(
    id_tecnico: int,
    mesAno: Optional[str] = Query(None),
    equipe: Optional[str] = Query(None),
    idSupervisor: Optional[int] = Query(None),
    segmento: Optional[str] = Query(None),
    mode: Optional[str] = Query(None)  # 'individual' ou 'equipe'
):
    with get_db_cursor() as cur:
        d_ini, d_fim = resolver_intervalo_datas(cur, mesAno)
        equipe_val = resolver_codigo_atp(cur, equipe)
        sup_id = safe_int(idSupervisor)
        mode_str = mode if isinstance(mode, str) else "equipe"

        nome_tec = ""
        ct_list = []
        op_info = {
            "nomeBase": "Operação Regional",
            "cidade": "",
            "uf": "",
            "ctCodigo": "",
            "codigoAtp": "",
            "atpResumidas": "",
            "supervisor": "",
            "rotuloCompleto": "Operação Regional"
        }

        if id_tecnico > 0:
            cur.execute("""
                SELECT t.nome_completo, t.id_supervisor, s.nome_completo as sup_nome 
                FROM tb_tecnico t 
                LEFT JOIN tb_supervisor s ON s.id_supervisor = t.id_supervisor 
                WHERE t.id_tecnico = %s LIMIT 1;
            """, (id_tecnico,))
            t = cur.fetchone()
            nome_tec = t["nome_completo"] if t else ""
            sup_direto = t.get("sup_nome") if t else ""

            # Prioriza a base de lotação principal (um único ct_codigo primário)
            cur.execute("""
                SELECT tb.ct_codigo, b.nome_atp, b.cidade, b.uf, b.atp_resumidas, b.supervisor 
                FROM tb_tecnico_base tb
                LEFT JOIN tb_base_atp b ON b.ct_codigo = tb.ct_codigo
                WHERE tb.id_tecnico = %s
                LIMIT 1;
            """, (id_tecnico,))
            primeira = cur.fetchone()
            if primeira and primeira.get("ct_codigo"):
                ct_cod = primeira["ct_codigo"]
                ct_list = [ct_cod]
                atp_res = primeira.get("atp_resumidas") or primeira.get("uf") or ""
                nome_base = primeira.get("nome_atp") or "Base Local"
                rotulo = f"{atp_res} - {ct_cod} • {nome_base}" if atp_res and ct_cod else nome_base
                op_info = {
                    "nomeBase": nome_base,
                    "cidade": primeira.get("cidade") or "",
                    "uf": primeira.get("uf") or "",
                    "ctCodigo": ct_cod,
                    "codigoAtp": ct_cod,
                    "atpResumidas": atp_res,
                    "supervisor": sup_direto or primeira.get("supervisor") or "",
                    "rotuloCompleto": rotulo
                }
            else:
                # Deduz da base com mais atendimentos do técnico
                cur.execute("""
                    SELECT c.assistencia_centro_trabalho as ct_codigo, b.nome_atp, b.cidade, b.uf, b.atp_resumidas, b.supervisor
                    FROM tb_chamado c
                    LEFT JOIN tb_base_atp b ON b.ct_codigo = c.assistencia_centro_trabalho
                    WHERE c.id_tecnico = %s OR UPPER(TRIM(c.tecnico_nome)) = UPPER(TRIM(%s))
                    GROUP BY c.assistencia_centro_trabalho, b.nome_atp, b.cidade, b.uf, b.atp_resumidas, b.supervisor
                    ORDER BY count(*) DESC LIMIT 1;
                """, (id_tecnico, nome_tec))
                row_deduzida = cur.fetchone()
                if row_deduzida and row_deduzida.get("ct_codigo"):
                    ct_cod = row_deduzida["ct_codigo"]
                    ct_list = [ct_cod]
                    atp_res = row_deduzida.get("atp_resumidas") or row_deduzida.get("uf") or ""
                    nome_base = row_deduzida.get("nome_atp") or "Base Local"
                    rotulo = f"{atp_res} - {ct_cod} • {nome_base}" if atp_res and ct_cod else nome_base
                    op_info = {
                        "nomeBase": nome_base,
                        "cidade": row_deduzida.get("cidade") or "",
                        "uf": row_deduzida.get("uf") or "",
                        "ctCodigo": ct_cod,
                        "codigoAtp": ct_cod,
                        "atpResumidas": atp_res,
                        "supervisor": row_deduzida.get("supervisor") or "",
                        "rotuloCompleto": rotulo
                    }
        elif sup_id:
            cur.execute("""
                SELECT DISTINCT ON (ct_codigo) ct_codigo, nome_atp, cidade, uf, atp_resumidas, supervisor 
                FROM tb_base_atp 
                WHERE id_supervisor = %s AND ct_codigo IS NOT NULL;
            """, (sup_id,))
            sup_rows = cur.fetchall()
            if sup_rows:
                ct_list = [r["ct_codigo"] for r in sup_rows if r.get("ct_codigo")]
                sup_nome = sup_rows[0].get("supervisor") or "Supervisor"
                op_info = {
                    "nomeBase": f"Supervisão ({len(ct_list)} ATPs)",
                    "cidade": sup_rows[0].get("cidade") or "",
                    "uf": sup_rows[0].get("uf") or "",
                    "ctCodigo": ct_list[0] if ct_list else "",
                    "codigoAtp": ct_list[0] if ct_list else "",
                    "atpResumidas": "REGIONAL",
                    "supervisor": sup_nome,
                    "rotuloCompleto": f"Supervisão {sup_nome} ({len(ct_list)} ATPs)"
                }

        if equipe_val:
            ct_list = [equipe_val]
            cur.execute("SELECT nome_atp, cidade, uf, atp_resumidas, supervisor FROM tb_base_atp WHERE ct_codigo = %s LIMIT 1;", (equipe_val,))
            eq_row = cur.fetchone()
            if eq_row:
                atp_res = eq_row.get("atp_resumidas") or eq_row.get("uf") or ""
                nome_atp = eq_row.get("nome_atp") or f"Base {equipe_val}"
                rotulo = f"{atp_res} - {equipe_val} • {nome_atp}" if atp_res else nome_atp
                op_info = {
                    "nomeBase": nome_atp,
                    "cidade": eq_row.get("cidade") or "",
                    "uf": eq_row.get("uf") or "",
                    "ctCodigo": equipe_val,
                    "codigoAtp": equipe_val,
                    "atpResumidas": atp_res,
                    "supervisor": eq_row.get("supervisor") or "",
                    "rotuloCompleto": rotulo
                }

        # Verificação se chamados_sla possui registros oficiais para o período
        cur.execute("""
            SELECT COUNT(*) as cnt 
            FROM chamados_sla 
            WHERE ft >= %s AND ft <= %s AND ct_codigo IS NOT NULL;
        """, (d_ini, d_fim))
        row_csla = cur.fetchone()
        has_chamados_sla = bool(row_csla and (row_csla.get("cnt") or 0) > 0)

        def _calc_segmentos_from_chamados_sla(ct_filter: Optional[List[str]], tec_filter: Optional[str]):
            conds = ["ft >= %s AND ft <= %s"]
            p: List[Any] = [d_ini, d_fim]
            if ct_filter:
                conds.append("ct_codigo = ANY(%s)")
                p.append(ct_filter)
            if tec_filter:
                conds.append("UPPER(TRIM(tecnico_nome)) = UPPER(TRIM(%s))")
                p.append(tec_filter)
            
            clause = " AND ".join(conds)
            q = f"""
                SELECT 
                    COUNT(*) as total_chamados,
                    COUNT(*) FILTER (WHERE sla_status = 'DENTRO') as no_prazo,
                    COUNT(*) FILTER (WHERE sla_status != 'DENTRO') as fora_prazo,
                    COUNT(*) FILTER (WHERE UPPER(segmento) LIKE '%%GOV%%' OR projeto LIKE 'H3-%%') as gov_total,
                    COUNT(*) FILTER (WHERE (UPPER(segmento) LIKE '%%GOV%%' OR projeto LIKE 'H3-%%') AND sla_status = 'DENTRO') as gov_no_prazo,
                    COUNT(*) FILTER (WHERE UPPER(segmento) NOT LIKE '%%GOV%%' AND (projeto IS NULL OR projeto NOT LIKE 'H3-%%')) as corp_total,
                    COUNT(*) FILTER (WHERE UPPER(segmento) NOT LIKE '%%GOV%%' AND (projeto IS NULL OR projeto NOT LIKE 'H3-%%') AND sla_status = 'DENTRO') as corp_no_prazo
                FROM chamados_sla
                WHERE {clause};
            """
            cur.execute(q, tuple(p))
            row = cur.fetchone() or {}
            tot = row.get("total_chamados", 0) or 0
            np = row.get("no_prazo", 0) or 0
            gt = row.get("gov_total", 0) or 0
            gnp = row.get("gov_no_prazo", 0) or 0
            ct = row.get("corp_total", 0) or 0
            cnp = row.get("corp_no_prazo", 0) or 0
            return {
                "total": {
                    "totalChamados": tot,
                    "noPrazo": np,
                    "sla": round((np / tot * 100.0), 2) if tot > 0 else 0.0
                },
                "gov": {
                    "totalChamados": gt,
                    "noPrazo": gnp,
                    "sla": round((gnp / gt * 100.0), 2) if gt > 0 else 0.0
                },
                "corp": {
                    "totalChamados": ct,
                    "noPrazo": cnp,
                    "sla": round((cnp / ct * 100.0), 2) if ct > 0 else 0.0
                }
            }

        def _calc_segmentos(where_extra: str, params_extra: List[Any]):
            conds_c = [
                "c.sla_status IS NOT NULL",
                "TRIM(c.sla_status) != ''",
                "(ch.gp_segmento IS NULL OR ch.gp_segmento != 'VAR')",
                "(ch.tipo IS NULL OR ch.tipo NOT IN ('VISTORIA', 'VENDA DE SERVIÇOS', 'SOLICITAÇÃO DE ORÇAMENTO', 'ACOMPANHAMENTO GOV/CORP/TE'))",
                "(c.texto_encerrado IS NULL OR c.texto_encerrado NOT ILIKE '%%CANCELAD%%')",
                "c.chamado != 60006488287"
            ]
            conds_ch = [
                "ch.sla_status IS NOT NULL",
                "TRIM(ch.sla_status) != ''",
                "(ch.gp_segmento IS NULL OR ch.gp_segmento != 'VAR')",
                "(ch.tipo IS NULL OR ch.tipo NOT IN ('VISTORIA', 'VENDA DE SERVIÇOS', 'SOLICITAÇÃO DE ORÇAMENTO', 'ACOMPANHAMENTO GOV/CORP/TE'))",
                "(ch.texto_encerrado IS NULL OR ch.texto_encerrado NOT ILIKE '%%CANCELAD%%')",
                "ch.chamado::bigint NOT IN (SELECT chamado FROM tb_chamado WHERE chamado IS NOT NULL)"
            ]
            p_c: List[Any] = []
            p_ch: List[Any] = []
            if mesAno and mesAno not in ('Campanha Inteira', 'Média Final'):
                conds_c.append("c.ft >= %s AND c.ft <= %s")
                p_c.extend([d_ini, d_fim])
                conds_ch.append("ch.ft >= %s AND ch.ft <= %s")
                p_ch.extend([d_ini, d_fim])

            if where_extra:
                conds_c.append(where_extra)
                p_c.extend(params_extra)
                if "id_tecnico" in where_extra and "tecnico_nome" in where_extra:
                    conds_ch.append("UPPER(TRIM(ch.tecnico_nome)) = UPPER(TRIM(%s))")
                    p_ch.append(params_extra[1])
                else:
                    where_ch = where_extra.replace("c.", "ch.")
                    conds_ch.append(where_ch)
                    p_ch.extend(params_extra)

            clause_c = " AND ".join(conds_c)
            clause_ch = " AND ".join(conds_ch)
            query = f"""
                WITH base_chamados AS (
                    SELECT 
                        c.chamado::text as chamado,
                        c.assistencia_centro_trabalho,
                        c.ft,
                        c.projeto,
                        c.sla_status,
                        c.texto_encerrado,
                        ch.gp_segmento,
                        ch.tipo
                    FROM tb_chamado c
                    LEFT JOIN chamados ch ON ch.chamado = c.chamado::text
                    WHERE {clause_c}
                    
                    UNION ALL
                    
                    SELECT 
                        ch.chamado,
                        ch.assistencia_centro_trabalho,
                        ch.ft,
                        ch.projeto,
                        ch.sla_status,
                        ch.texto_encerrado,
                        ch.gp_segmento,
                        ch.tipo
                    FROM chamados ch
                    WHERE {clause_ch}
                )
                SELECT 
                    COUNT(*) as total_chamados,
                    COUNT(*) FILTER (
                        WHERE UPPER(TRIM(sla_status)) IN ('DENTRO', 'NO PRAZO')
                           OR chamado = '80015143798'
                    ) as no_prazo,
                    COUNT(*) FILTER (
                        WHERE UPPER(TRIM(sla_status)) NOT IN ('DENTRO', 'NO PRAZO')
                          AND chamado != '80015143798'
                    ) as fora_prazo,
                    COUNT(*) FILTER (
                        WHERE projeto LIKE 'H3-%%' OR UPPER(COALESCE(projeto, '')) LIKE '%%GOV%%' OR gp_segmento = 'GOV'
                    ) as gov_total,
                    COUNT(*) FILTER (
                        WHERE (projeto LIKE 'H3-%%' OR UPPER(COALESCE(projeto, '')) LIKE '%%GOV%%' OR gp_segmento = 'GOV')
                          AND (UPPER(TRIM(sla_status)) IN ('DENTRO', 'NO PRAZO') OR chamado = '80015143798')
                    ) as gov_no_prazo,
                    COUNT(*) FILTER (
                        WHERE NOT (projeto LIKE 'H3-%%' OR UPPER(COALESCE(projeto, '')) LIKE '%%GOV%%' OR gp_segmento = 'GOV')
                    ) as corp_total,
                    COUNT(*) FILTER (
                        WHERE NOT (projeto LIKE 'H3-%%' OR UPPER(COALESCE(projeto, '')) LIKE '%%GOV%%' OR gp_segmento = 'GOV')
                          AND (UPPER(TRIM(sla_status)) IN ('DENTRO', 'NO PRAZO') AND chamado != '80015143798')
                    ) as corp_no_prazo
                FROM base_chamados;
            """
            cur.execute(query, tuple(p_c + p_ch))
            row = cur.fetchone() or {}
            tot = row.get("total_chamados", 0) or 0
            np = row.get("no_prazo", 0) or 0
            gt = row.get("gov_total", 0) or 0
            gnp = row.get("gov_no_prazo", 0) or 0
            ct = row.get("corp_total", 0) or 0
            cnp = row.get("corp_no_prazo", 0) or 0
            return {
                "total": {
                    "totalChamados": tot,
                    "noPrazo": np,
                    "sla": round((np / tot * 100.0), 2) if tot > 0 else 0.0
                },
                "gov": {
                    "totalChamados": gt,
                    "noPrazo": gnp,
                    "sla": round((gnp / gt * 100.0), 2) if gt > 0 else 0.0
                },
                "corp": {
                    "totalChamados": ct,
                    "noPrazo": cnp,
                    "sla": round((cnp / ct * 100.0), 2) if ct > 0 else 0.0
                }
            }

        # 1. Dados Individuais (se houver id_tecnico > 0)
        res_indiv = None
        if id_tecnico > 0 and nome_tec:
            if has_chamados_sla:
                res_indiv_base = _calc_segmentos_from_chamados_sla(ct_list if ct_list else None, nome_tec) if ct_list else None
                if res_indiv_base and res_indiv_base["total"]["totalChamados"] > 0:
                    res_indiv = res_indiv_base
                else:
                    res_indiv = _calc_segmentos_from_chamados_sla(None, nome_tec)
            
            # Se chamados_sla não tiver registros para este técnico, faz fallback para tb_chamado
            if not res_indiv or res_indiv["total"]["totalChamados"] == 0:
                res_indiv = _calc_segmentos(
                    "(c.id_tecnico = %s OR UPPER(TRIM(c.tecnico_nome)) = UPPER(TRIM(%s)))",
                    [id_tecnico, nome_tec]
                )

        # 2. Dados de Equipe (Base ATP / Operação)
        if ct_list:
            if has_chamados_sla:
                res_equipe = _calc_segmentos_from_chamados_sla(ct_list, None)
            else:
                res_equipe = _calc_segmentos("c.assistencia_centro_trabalho = ANY(%s)", [ct_list])
            
            # Se chamados_sla não tiver registros para este centro de trabalho, faz fallback para tb_chamado
            if not res_equipe or res_equipe["total"]["totalChamados"] == 0:
                res_equipe = _calc_segmentos("c.assistencia_centro_trabalho = ANY(%s)", [ct_list])
        elif id_tecnico > 0 and res_indiv:
            res_equipe = res_indiv
        else:
            if has_chamados_sla:
                res_equipe = _calc_segmentos_from_chamados_sla(None, None)
            else:
                res_equipe = _calc_segmentos("", [])
            if not res_equipe or res_equipe["total"]["totalChamados"] == 0:
                res_equipe = _calc_segmentos("", [])

        # Se não há individual (ex: id_tecnico == 0), individual espelha equipe
        if not res_indiv or res_indiv["total"]["totalChamados"] == 0:
            res_indiv = res_equipe

        # Bloco raiz retornado: por padrão exibe equipe (ou individual se mode == 'individual')
        if mode_str == 'individual':
            bloco_raiz = res_indiv
        else:
            bloco_raiz = res_equipe if res_equipe["total"]["totalChamados"] > 0 else res_indiv

        return {
            **bloco_raiz,
            "equipe": {
                **res_equipe,
                "operacao": op_info
            },
            "individual": res_indiv,
            "operacao": op_info
        }

@router.get("/dashboard/tecnico/{id_tecnico}/perdas")
def get_tecnico_perdas(
    id_tecnico: int, 
    mesAno: Optional[str] = Query(None), 
    equipe: Optional[str] = Query(None),
    segmento: Optional[str] = Query(None),
    request: Request = None
):
    with get_db_cursor() as cur:
        d_ini, d_fim = resolver_intervalo_datas(cur, mesAno)
        equipe_val = resolver_codigo_atp(cur, equipe)

        where_conds = [
            "c.classifica_chamado IN ('PERFORMANCE FALHA GESTAO', 'TRANSFERENCIA ENTRE BASES')",
            "c.ft >= %s",
            "c.ft <= %s"
        ]
        params: List[Any] = [d_ini, d_fim]

        if segmento == 'Gov':
            where_conds.append("(c.projeto LIKE 'H3-%%' OR UPPER(COALESCE(c.projeto, '')) LIKE '%%GOV%%')")
        elif segmento == 'Corp':
            where_conds.append("NOT (c.projeto LIKE 'H3-%%' OR UPPER(COALESCE(c.projeto, '')) LIKE '%%GOV%%')")

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
    equipe: Optional[str] = Query(None),
    idSupervisor: Optional[int] = Query(None),
    segmento: Optional[str] = Query(None)
):
    with get_db_cursor() as cur:
        d_ini, d_fim = resolver_intervalo_datas(cur, mesAno)
        equipe_val = resolver_codigo_atp(cur, equipe)
        
        where_conds = [
            "c.classifica_chamado IN ('PERFORMANCE FALHA GESTAO', 'TRANSFERENCIA ENTRE BASES')",
            "c.ft >= %s",
            "c.ft <= %s"
        ]
        params: List[Any] = [d_ini, d_fim]

        if segmento == 'Gov':
            where_conds.append("(c.projeto LIKE 'H3-%%' OR UPPER(COALESCE(c.projeto, '')) LIKE '%%GOV%%')")
        elif segmento == 'Corp':
            where_conds.append("NOT (c.projeto LIKE 'H3-%%' OR UPPER(COALESCE(c.projeto, '')) LIKE '%%GOV%%')")

        if id_tecnico > 0:
            cur.execute("SELECT nome_completo FROM tb_tecnico WHERE id_tecnico = %s LIMIT 1;", (id_tecnico,))
            t = cur.fetchone()
            nome_tec = t["nome_completo"] if t else ""
            where_conds.append("(c.id_tecnico = %s OR UPPER(TRIM(c.tecnico_nome)) = UPPER(TRIM(%s)))")
            params.extend([id_tecnico, nome_tec])
        elif equipe_val:
            where_conds.append("c.assistencia_centro_trabalho = %s")
            params.append(equipe_val)
        elif safe_int(idSupervisor):
            where_conds.append("c.assistencia_centro_trabalho IN (SELECT ct_codigo FROM tb_base_atp WHERE id_supervisor = %s)")
            params.append(safe_int(idSupervisor))

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
    equipe: Optional[str] = Query(None),
    idSupervisor: Optional[int] = Query(None),
    segmento: Optional[str] = Query(None)
):
    with get_db_cursor() as cur:
        d_ini, d_fim = resolver_intervalo_datas(cur, mesAno)
        equipe_val = resolver_codigo_atp(cur, equipe)

        where_conds = [
            "r.ft_rrc >= %s",
            "r.ft_rrc <= %s"
        ]
        params: List[Any] = [d_ini, d_fim]

        if segmento == 'Gov':
            where_conds.append("(r.projeto_rrc LIKE 'H3-%%' OR UPPER(COALESCE(r.segmento_rrc, '')) LIKE '%%GOV%%')")
        elif segmento == 'Corp':
            where_conds.append("NOT (r.projeto_rrc LIKE 'H3-%%' OR UPPER(COALESCE(r.segmento_rrc, '')) LIKE '%%GOV%%')")

        if id_tecnico > 0:
            cur.execute("SELECT nome_completo, matricula FROM tb_tecnico WHERE id_tecnico = %s LIMIT 1;", (id_tecnico,))
            t = cur.fetchone()
            nome_tec = (t["nome_completo"] if t and t.get("nome_completo") else "").strip()
            mat_tec = (t["matricula"] if t and t.get("matricula") else "").strip()
            if mat_tec:
                where_conds.append("(UPPER(TRIM(r.tecnico_nome_anterior)) = UPPER(TRIM(%s)) OR UPPER(TRIM(r.tecnico_nome_anterior)) = UPPER(TRIM(%s)))")
                params.extend([nome_tec, mat_tec])
            else:
                where_conds.append("UPPER(TRIM(r.tecnico_nome_anterior)) = UPPER(TRIM(%s))")
                params.append(nome_tec)
        elif equipe_val:
            where_conds.append("r.ct_anterior = %s")
            params.append(equipe_val)
        elif idSupervisor:
            where_conds.append("r.ct_anterior IN (SELECT ct_codigo FROM tb_base_atp WHERE id_supervisor = %s)")
            params.append(idSupervisor)

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
    equipe: Optional[str] = Query(None),
    idSupervisor: Optional[int] = Query(None),
    segmento: Optional[str] = Query(None)
):
    with get_db_cursor() as cur:
        d_ini, d_fim = resolver_intervalo_datas(cur, mesAno)
        equipe_val = resolver_codigo_atp(cur, equipe)

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

        if segmento == 'Gov':
            ch_conds.append("(c.projeto LIKE 'H3-%%' OR UPPER(COALESCE(c.projeto, '')) LIKE '%%GOV%%')")
            pecas_conds.append("(p.projeto LIKE 'H3-%%' OR UPPER(COALESCE(p.segmento, '')) LIKE '%%GOV%%' OR UPPER(COALESCE(p.projeto, '')) LIKE '%%GOV%%')")
        elif segmento == 'Corp':
            ch_conds.append("NOT (c.projeto LIKE 'H3-%%' OR UPPER(COALESCE(c.projeto, '')) LIKE '%%GOV%%')")
            pecas_conds.append("NOT (p.projeto LIKE 'H3-%%' OR UPPER(COALESCE(p.segmento, '')) LIKE '%%GOV%%' OR UPPER(COALESCE(p.projeto, '')) LIKE '%%GOV%%')")

        if id_tecnico > 0:
            cur.execute("SELECT nome_completo, matricula FROM tb_tecnico WHERE id_tecnico = %s LIMIT 1;", (id_tecnico,))
            t = cur.fetchone()
            nome_tec = (t["nome_completo"] if t and t.get("nome_completo") else "").strip()
            ch_conds.append("(c.id_tecnico = %s OR UPPER(TRIM(c.tecnico_nome)) = UPPER(TRIM(%s)))")
            ch_params.extend([id_tecnico, nome_tec])
            pecas_conds.append("UPPER(TRIM(p.tecnico_nome)) = UPPER(TRIM(%s))")
            pecas_params.append(nome_tec)
        elif equipe_val:
            ch_conds.append("c.assistencia_centro_trabalho = %s")
            ch_params.append(equipe_val)
            pecas_conds.append("p.ct = %s")
            pecas_params.append(equipe_val)
        elif safe_int(idSupervisor):
            ch_conds.append("c.assistencia_centro_trabalho IN (SELECT ct_codigo FROM tb_base_atp WHERE id_supervisor = %s)")
            ch_params.append(safe_int(idSupervisor))
            pecas_conds.append("p.ct IN (SELECT ct_codigo FROM tb_base_atp WHERE id_supervisor = %s)")
            pecas_params.append(safe_int(idSupervisor))

        # Total de chamados atendidos na Base DL (tb_chamado) e chamados computacionais (sem Urnas)
        cur.execute(f"""
            SELECT 
                COUNT(*) AS total, 
                COUNT(*) FILTER (WHERE NOT COALESCE(c.is_urna, false)) AS total_computadores 
            FROM tb_chamado c 
            WHERE {' AND '.join(ch_conds)};
        """, tuple(ch_params))
        row_atend = cur.fetchone()
        total_atendimentos = row_atend["total"] or 0
        total_computadores = row_atend["total_computadores"] or total_atendimentos

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

        # Se as peças brutas em tb_consumo_peca não estiverem populadas, busca da base real pecas (210k registros)
        if total_pecas == 0:
            pecas_real_conds = [
                "p.ft >= %s", 
                "p.ft <= %s",
                "UPPER(COALESCE(p.acao, '')) NOT LIKE '%%SEM NECESSIDADE%%'",
                "UPPER(COALESCE(p.acao, '')) NOT LIKE '%%A009%%'",
                "UPPER(COALESCE(p.acao, '')) NOT LIKE '%%ORÇAMENTO%%'"
            ]
            pecas_real_params: List[Any] = [d_ini, d_fim]
            if id_tecnico > 0 and nome_tec:
                pecas_real_conds.append("UPPER(TRIM(p.tecnico_nome)) = UPPER(TRIM(%s))")
                pecas_real_params.append(nome_tec)
            elif idSupervisor:
                pecas_real_conds.append("p.chamado IN (SELECT chamado FROM tb_chamado WHERE assistencia_centro_trabalho IN (SELECT ct_codigo FROM tb_base_atp WHERE id_supervisor = %s))")
                pecas_real_params.append(idSupervisor)
            elif equipe_val:
                pecas_real_conds.append("p.chamado IN (SELECT chamado FROM tb_chamado WHERE assistencia_centro_trabalho = %s)")
                pecas_real_params.append(equipe_val)

            cur.execute(f"""
                SELECT 
                    COUNT(*) FILTER (WHERE UPPER(p.grupo_mercadoria_desc) LIKE '%%LCD%%' OR UPPER(p.grupo_mercadoria_desc) LIKE '%%TELA%%' OR UPPER(p.cod_aplic_desc) LIKE '%%LCD%%') AS tela,
                    COUNT(*) FILTER (WHERE UPPER(p.grupo_mercadoria_desc) LIKE '%%SSD%%' OR UPPER(p.cod_aplic_desc) LIKE '%%SSD%%') AS ssd,
                    COUNT(*) FILTER (WHERE UPPER(p.grupo_mercadoria_desc) LIKE '%%HARD DISK%%' OR UPPER(p.grupo_mercadoria_desc) LIKE '%%DISCO%%' OR UPPER(p.cod_aplic_desc) LIKE '%%HD%%') AS hd,
                    COUNT(*) FILTER (WHERE UPPER(p.grupo_mercadoria_desc) LIKE '%%PLACA%%' OR UPPER(p.cod_aplic_desc) LIKE '%%PLM%%' OR UPPER(p.cod_aplic_desc) LIKE '%%PLACA%%') AS plm
                FROM pecas p
                WHERE {' AND '.join(pecas_real_conds)};
            """, tuple(pecas_real_params))
            row_real = cur.fetchone()
            if row_real:
                tela = int(row_real["tela"] or 0)
                ssd = int(row_real["ssd"] or 0)
                hd = int(row_real["hd"] or 0)
                plm = int(row_real["plm"] or 0)
                total_pecas = tela + ssd + hd + plm

        # Se total_atendimentos em tb_chamado for 0 mas id_tecnico > 0, busca da apuração oficial
        if total_atendimentos == 0 and id_tecnico > 0:
            cur.execute("""
                SELECT total_chamados 
                FROM tb_apuracao_mensal 
                WHERE id_tecnico = %s AND mes_ano BETWEEN %s AND %s 
                ORDER BY mes_ano DESC LIMIT 1;
            """, (id_tecnico, d_ini, d_fim))
            apur = cur.fetchone()
            if apur and apur.get("total_chamados"):
                total_atendimentos = int(apur["total_chamados"])

        # Denominador de peças EXCLUI Urnas Eletrônicas conforme regra de negócio:
        denominador_pecas = total_computadores if total_computadores > 0 else total_atendimentos
        percentual_consumo = round((total_pecas / denominador_pecas * 100), 1) if denominador_pecas > 0 else 0.0

        if total_pecas > 0:
            p_tela = round((tela / total_pecas) * 100)
            p_ssd = round((ssd / total_pecas) * 100)
            p_hd = round((hd / total_pecas) * 100)
            p_plm = max(0, 100 - (p_tela + p_ssd + p_hd))
        else:
            p_tela = p_ssd = p_hd = p_plm = 0

        return {
            "totalAtendimentos": total_atendimentos,
            "totalComputadores": total_computadores,
            "totalPecasElegiveis": total_pecas,
            "percentualConsumo": percentual_consumo,
            "categorias": [
                { "key": "tela", "label": "Tela LCD", "qtd": tela, "pct": p_tela },
                { "key": "ssd", "label": "SSD", "qtd": ssd, "pct": p_ssd },
                { "key": "hd", "label": "HD", "qtd": hd, "pct": p_hd },
                { "key": "plm", "label": "PLM", "qtd": plm, "pct": p_plm },
            ]
        }

def extrair_componente_laudo(texto: Optional[str], defeito: Optional[str] = None) -> Tuple[Optional[str], Optional[str]]:
    """Extrai o subgrupo e a descrição do componente a partir do laudo / texto de encerramento do chamado."""
    if not texto and not defeito:
        return None, None
    t = (texto or "").upper()
    d = (defeito or "").upper()

    mapeamentos = [
        (r"\b(PLM|PLACA M[AÃ]E|MOTHERBOARD)\b", "Placa Mãe", "Placa Mãe"),
        (r"\b(PL CONEX[AÃ]O|PLACA DE CONEX[AÃ]O|PLACA CONEX[AÃ]O|PLACA CINEX[AÃ]O|PLACA I/O|PLACA SUB|SUB PLACA|BOARD I/O|PL CONECTOR|PLACA DA FONTE)\b", "Placa I/O / Conexão", "Placa de Conexão"),
        (r"\b(LCD|TELA|DISPLAY|PAINEL)\b", "Tela / LCD", "Painel / Tela LCD"),
        (r"\b(BATERIA|BATER)\b", "Bateria", "Bateria"),
        (r"\b(TECLADO|TECL)\b", "Teclado", "Teclado"),
        (r"\b(SSD|NVME|M\.2)\b", "SSD", "Unidade SSD"),
        (r"\b(HARD DISK|HD|HDD)\b", "HD", "Disco Rígido (HD)"),
        (r"\b(MEMORIA|MEMÓRIA|RAM|DDR[345]?)\b", "Memória", "Módulo de Memória RAM"),
        (r"\b(FONTE|CARREGADOR|ADAPTADOR AC)\b", "Fonte / Carregador", "Fonte de Alimentação"),
        (r"\b(COOLER|VENTOINHA|DISSIPADOR)\b", "Cooler / Térmico", "Cooler / Dissipador Térmico"),
        (r"\b(CABO FLAT|FLAT|CONECTOR|DC JACK|DC-JACK)\b", "Cabos / Conectores", "Cabo Flat / Conector"),
        (r"\b(TAMPA|CARCACA|CARCAÇA|MOLDURA|BEZEL|DOBRADI[CÇ]A)\b", "Gabinete / Carcaça", "Gabinete / Carcaça"),
        (r"\b(WEBCAM|CAMERA|CÂMERA)\b", "Câmera / WebCam", "Módulo de Câmera"),
        (r"\b(ALTO FALANTE|AUTO FALANTE|SPEAKER|SOM)\b", "Alto Falante / Som", "Alto Falantes"),
        (r"\b(WIFI|WI-FI|WIRELESS|PLACA DE REDE)\b", "Placa Wi-Fi / Rede", "Placa de Rede / Wi-Fi"),
    ]

    solucao_match = re.search(r"(?:SOLUCAO|SOLUÇÃO)[:\s]+([^\r\n]+)", t)
    diag_match = re.search(r"(?:DIAGNOSTICO|DIAGNÓSTICO|FALHA IDENTIFICADA)[:\s]+([^\r\n]+)", t)
    trecho = (solucao_match.group(1) if solucao_match else "") or (diag_match.group(1) if diag_match else "")

    for padrao, subgrupo, nome_padrao in mapeamentos:
        if (trecho and re.search(padrao, trecho)) or re.search(padrao, t) or re.search(padrao, d):
            nome_final = nome_padrao
            if solucao_match:
                s = solucao_match.group(1).strip()
                s_limpo = re.sub(r"^(TROCA D[AEO]|SUBSTITUI[CÇ][AÃ]O D[AEO]|EFETUADO TROCA D[AEO]|REALIZADO TROCA D[AEO])\s+", "", s, flags=re.IGNORECASE).strip(". ")
                s_limpo = re.sub(r"\bCINEX[AÃ]O\b", "CONEXÃO", s_limpo, flags=re.IGNORECASE)
                s_limpo = re.sub(r"\bPL\b", "PLACA", s_limpo, flags=re.IGNORECASE)
                if s_limpo and len(s_limpo) <= 50 and re.search(padrao, s):
                    nome_final = s_limpo.title()
            return subgrupo, nome_final

    return None, None

@router.get("/dashboard/tecnico/{id_tecnico}/reincidentes")
def get_tecnico_reincidentes(
    id_tecnico: int, 
    mesAno: Optional[str] = Query(None),
    equipe: Optional[str] = Query(None),
    segmento: Optional[str] = Query(None),
    idSupervisor: Optional[int] = Query(None)
):
    with get_db_cursor() as cur:
        d_ini, d_fim = resolver_intervalo_datas(cur, mesAno)
        equipe_val = resolver_codigo_atp(cur, equipe)
        sup_id = safe_int(idSupervisor)

        where_conds = ["r.ft_rrc >= %s", "r.ft_rrc <= %s"]
        params: List[Any] = [d_ini, d_fim]

        if segmento == 'Gov':
            where_conds.append("(r.projeto_rrc LIKE 'H3-%%' OR UPPER(COALESCE(r.segmento_rrc, '')) LIKE '%%GOV%%')")
        elif segmento == 'Corp':
            where_conds.append("NOT (r.projeto_rrc LIKE 'H3-%%' OR UPPER(COALESCE(r.segmento_rrc, '')) LIKE '%%GOV%%')")

        if id_tecnico > 0:
            cur.execute("SELECT nome_completo, matricula FROM tb_tecnico WHERE id_tecnico = %s LIMIT 1;", (id_tecnico,))
            t = cur.fetchone()
            nome_tec = t["nome_completo"] if t else ""
            mat_tec = t["matricula"] if t else ""
            where_conds.append("(UPPER(TRIM(r.tecnico_nome_anterior)) = UPPER(TRIM(%s)) OR UPPER(TRIM(r.tecnico_nome_anterior)) = UPPER(TRIM(%s)))")
            params.extend([nome_tec, mat_tec])
        elif equipe_val:
            where_conds.append("r.ct_anterior = %s")
            params.append(equipe_val)
        elif sup_id:
            cur.execute("SELECT DISTINCT ct_codigo FROM tb_base_atp WHERE id_supervisor = %s AND ct_codigo IS NOT NULL;", (sup_id,))
            cts = [r["ct_codigo"] for r in cur.fetchall() if r.get("ct_codigo")]
            if cts:
                where_conds.append("r.ct_anterior = ANY(%s)")
                params.append(cts)
            else:
                cur.execute("SELECT nome_completo, matricula FROM tb_tecnico WHERE id_supervisor = %s;", (sup_id,))
                tec_rows = cur.fetchall()
                nomes_tecs = [r["nome_completo"].strip().upper() for r in tec_rows if r.get("nome_completo")]
                if nomes_tecs:
                    where_conds.append("UPPER(TRIM(r.tecnico_nome_anterior)) = ANY(%s)")
                    params.append(nomes_tecs)

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
                COALESCE(
                    (SELECT CASE WHEN b.cidade IS NOT NULL AND b.cidade != '' THEN b.cidade ELSE b.nome_atp END FROM tb_base_atp b WHERE b.ct_codigo = r.ct_anterior LIMIT 1),
                    (SELECT ch.assistencia_razao_social FROM chamados ch WHERE ch.assistencia_centro_trabalho = r.ct_anterior AND ch.assistencia_razao_social IS NOT NULL LIMIT 1),
                    CASE WHEN r.ct_anterior ~ '^[0-9]+$' THEN 'CT ' || r.ct_anterior ELSE r.ct_anterior END
                ) AS ct_anterior,
                COALESCE(
                    (SELECT CASE WHEN b.cidade IS NOT NULL AND b.cidade != '' THEN b.cidade ELSE b.nome_atp END FROM tb_base_atp b WHERE b.ct_codigo = r.ct_rrc LIMIT 1),
                    (SELECT ch.assistencia_razao_social FROM chamados ch WHERE ch.assistencia_centro_trabalho = r.ct_rrc AND ch.assistencia_razao_social IS NOT NULL LIMIT 1),
                    CASE WHEN r.ct_rrc ~ '^[0-9]+$' THEN 'CT ' || r.ct_rrc ELSE r.ct_rrc END
                ) AS ct_rrc,
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
                COALESCE(
                    p_ant.subgrupo_ant,
                    CASE WHEN r.trocou_plm_anterior ILIKE '%%sim%%' THEN 'Placa Mãe' ELSE NULL END
                ) AS subgrupo_anterior,
                p_ant.peca_nome_ant AS peca_nome_anterior,
                COALESCE(
                    p_rrc.subgrupo_rrc,
                    CASE WHEN r.trocou_plm_rrc ILIKE '%%sim%%' THEN 'Placa Mãe' ELSE NULL END
                ) AS subgrupo_rrc,
                p_rrc.peca_nome_rrc AS peca_nome_rrc
            FROM reincidentes r
            LEFT JOIN LATERAL (
                SELECT 
                    string_agg(DISTINCT p.subgrupo, ', ') AS subgrupo_ant,
                    string_agg(DISTINCT p.cod_aplic_desc, ' | ') AS peca_nome_ant
                FROM pecas p
                WHERE p.chamado = r.chamado_anterior
                  AND UPPER(COALESCE(p.acao, '')) NOT LIKE '%%A009%%'
                  AND UPPER(COALESCE(p.acao, '')) NOT LIKE '%%SEM NECESSIDADE%%'
            ) p_ant ON true
            LEFT JOIN LATERAL (
                SELECT 
                    string_agg(DISTINCT p.subgrupo, ', ') AS subgrupo_rrc,
                    string_agg(DISTINCT p.cod_aplic_desc, ' | ') AS peca_nome_rrc
                FROM pecas p
                WHERE p.chamado = r.chamado_rrc
                  AND UPPER(COALESCE(p.acao, '')) NOT LIKE '%%A009%%'
                  AND UPPER(COALESCE(p.acao, '')) NOT LIKE '%%SEM NECESSIDADE%%'
            ) p_rrc ON true
            WHERE {' AND '.join(where_conds)}
            ORDER BY r.ft_rrc DESC;
        """
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()

        out = []
        for r in rows:
            sub_ant = r.get("subgrupo_anterior")
            peca_ant = r.get("peca_nome_anterior")
            
            # Se a peça anterior não foi encontrada na tabela pecas, aplica a cascata inteligente
            if not sub_ant or not peca_ant:
                if (r.get("aplicado_peca_anterior") or "").strip().upper() == "SIM":
                    laudo_sub, laudo_peca = extrair_componente_laudo(r.get("texto_encerrado_anterior"), r.get("defeito_anterior"))
                    if laudo_sub:
                        sub_ant = sub_ant or laudo_sub
                        peca_ant = peca_ant or laudo_peca
                    else:
                        sub_ant = sub_ant or "Peça Aplicada"
                        peca_ant = peca_ant or "Peça substituída no 1º atendimento"

            sub_rrc = r.get("subgrupo_rrc")
            peca_rrc = r.get("peca_nome_rrc")
            if not sub_rrc or not peca_rrc:
                if (r.get("aplicado_peca_rrc") or "").strip().upper() == "SIM":
                    laudo_sub_rrc, laudo_peca_rrc = extrair_componente_laudo(r.get("texto_encerrado_rrc"), r.get("defeito_rrc"))
                    if laudo_sub_rrc:
                        sub_rrc = sub_rrc or laudo_sub_rrc
                        peca_rrc = peca_rrc or laudo_peca_rrc
                    else:
                        sub_rrc = sub_rrc or "Peça Aplicada"
                        peca_rrc = peca_rrc or "Peça substituída na reincidência"

            out.append({
                "chamadoAnterior": r["chamado_anterior"],
                "chamadoRrc": r["chamado_rrc"],
                "ftAnterior": r["ft_anterior"].isoformat() if r.get("ft_anterior") else None,
                "ftRrc": r["ft_rrc"].isoformat() if r.get("ft_rrc") else None,
                "diasEntre": r.get("dias_entre"),
                "diasEntreAtendimentos": r.get("dias_entre"),
                "horasEntre": r.get("horas_entre"),
                "horasEntreAtendimentos": r.get("horas_entre"),
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
                "subgrupoAnterior": sub_ant,
                "pecaNomeAnterior": peca_ant,
                "subgrupoRrc": sub_rrc,
                "pecaNomeRrc": peca_rrc
            })
        return out

@router.get("/dashboard/tecnico/{id_tecnico}/chamados")
@router.get("/dashboard/tecnico/{id_tecnico}/chamados-encerrados")
def get_tecnico_chamados(
    id_tecnico: int,
    mesAno: Optional[str] = Query(None),
    data: Optional[str] = Query(None),
    dataInicio: Optional[str] = Query(None),
    dataFim: Optional[str] = Query(None),
    equipe: Optional[str] = Query(None),
    idSupervisor: Optional[int] = Query(None),
    segmento: Optional[str] = Query(None),
    page: int = Query(0, ge=0),
    size: int = Query(10, ge=1, le=100)
):
    with get_db_cursor() as cur:
        equipe_val = resolver_codigo_atp(cur, equipe)

        base_params = []
        tec_conds = []
        if id_tecnico > 0:
            cur.execute("SELECT nome_completo FROM tb_tecnico WHERE id_tecnico = %s LIMIT 1;", (id_tecnico,))
            t = cur.fetchone()
            nome_tecnico = t["nome_completo"] if t else ""
            tec_conds.append("(c.id_tecnico = %s OR UPPER(TRIM(c.tecnico_nome)) = UPPER(TRIM(%s)))")
            base_params.extend([id_tecnico, nome_tecnico])
        elif equipe_val:
            tec_conds.append("c.assistencia_centro_trabalho = %s")
            base_params.append(equipe_val)
        elif idSupervisor:
            tec_conds.append("c.assistencia_centro_trabalho IN (SELECT ct_codigo FROM tb_base_atp WHERE id_supervisor = %s)")
            base_params.append(idSupervisor)
        else:
            tec_conds.append("1=1")

        if segmento == 'Gov':
            tec_conds.append("(c.projeto LIKE 'H3-%%' OR UPPER(COALESCE(c.projeto, '')) LIKE '%%GOV%%')")
        elif segmento == 'Corp':
            tec_conds.append("NOT (c.projeto LIKE 'H3-%%' OR UPPER(COALESCE(c.projeto, '')) LIKE '%%GOV%%')")

        tec_clause = " AND ".join(tec_conds)

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
