import logging
import re
import calendar
from typing import Optional, List, Dict, Any, Tuple
from datetime import date, datetime

try:
    from backend_python.core.database import get_db_cursor
except ImportError:
    try:
        from core.database import get_db_cursor
    except ImportError:
        from api.core.database import get_db_cursor

logger = logging.getLogger(__name__)

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
