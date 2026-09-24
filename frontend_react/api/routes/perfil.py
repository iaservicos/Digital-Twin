import logging
from typing import Optional, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
try:
    from core.database import get_db_cursor
except ImportError:
    from api.core.database import get_db_cursor

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Perfil & Foto"])

class FotoPerfilUpdateRequest(BaseModel):
    foto: Optional[str] = None

@router.get("/foto-perfil/{identificador}")
def get_foto_perfil(identificador: str):
    mat = (identificador or "").strip()
    with get_db_cursor() as cur:
        # 1. Encontra id do técnico
        cur.execute("SELECT id_tecnico FROM tb_tecnico WHERE UPPER(matricula) = %s LIMIT 1;", (mat.upper(),))
        t = cur.fetchone()
        if not t and mat.isdigit():
            cur.execute("SELECT id_tecnico FROM tb_tecnico WHERE id_tecnico = %s LIMIT 1;", (int(mat),))
            t = cur.fetchone()

        if not t:
            return {"foto": None}

        # 2. Busca foto
        cur.execute("SELECT foto_base64 FROM tb_foto_perfil WHERE id_tecnico = %s LIMIT 1;", (t["id_tecnico"],))
        f = cur.fetchone()
        if f and f.get("foto_base64"):
            return {"foto": f["foto_base64"]}
        return {"foto": None}

@router.put("/foto-perfil/{identificador}")
def update_foto_perfil(identificador: str, request: FotoPerfilUpdateRequest):
    mat = (identificador or "").strip()
    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id_tecnico FROM tb_tecnico WHERE UPPER(matricula) = %s LIMIT 1;", (mat.upper(),))
        t = cur.fetchone()
        if not t and mat.isdigit():
            cur.execute("SELECT id_tecnico FROM tb_tecnico WHERE id_tecnico = %s LIMIT 1;", (int(mat),))
            t = cur.fetchone()

        if not t:
            raise HTTPException(status_code=404, detail="Técnico não encontrado.")

        id_tec = t["id_tecnico"]
        cur.execute("""
            INSERT INTO tb_foto_perfil (id_tecnico, foto_base64)
            VALUES (%s, %s)
            ON CONFLICT (id_tecnico) 
            DO UPDATE SET foto_base64 = EXCLUDED.foto_base64;
        """, (id_tec, request.foto))

        return {"message": "Foto atualizada com sucesso"}
