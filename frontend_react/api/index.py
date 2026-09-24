import sys
import os

# Garante que o diretório da API esteja no sys.path para o runtime serverless do Vercel
api_dir = os.path.dirname(os.path.abspath(__file__))
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

import time
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

try:
    from routes import auth, dashboard, campanhas, tecnicos, perfil
except ImportError:
    from api.routes import auth, dashboard, campanhas, tecnicos, perfil

app = FastAPI(
    title="Brilha+ API (Python Serverless)",
    description="Backend unificado de alta performance para Técnicos e Supervisores no Vercel",
    version="1.0.0"
)

# Configuração de CORS irrestrito para desenvolvimento e produção
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware para logging de tempo de resposta
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000.0
    response.headers["X-Process-Time-Ms"] = f"{process_time:.2f}"
    return response

from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Erro interno ({type(exc).__name__}): {str(exc)}",
            "traceback": traceback.format_exc()
        }
    )

# Rotas de Healthcheck
@app.get("/health")
@app.get("/api/v1/health")
def healthcheck():
    return {
        "status": "UP",
        "service": "brilha-mais-backend-python",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/v1/diagnostic")
def diagnostic():
    try:
        from core import config
        from core.database import get_db_cursor
        with get_db_cursor() as cur:
            cur.execute("SELECT current_database() as db, current_user as usr, version() as ver;")
            db_info = cur.fetchone()
        return {
            "status": "CONECTADO",
            "db_info": db_info,
            "host": config.POSTGRES_HOST,
            "port": config.POSTGRES_PORT,
            "user": config.POSTGRES_USER
        }
    except Exception as e:
        return {
            "status": "FALHA_CONEXAO",
            "error_type": type(e).__name__,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

# Inclui os roteadores com prefixo vazio (ex: /auth/login) e prefixo /api/v1 (ex: /api/v1/auth/login)
# Isso garante que qualquer requisição vinda do frontend (com ou sem /api/v1) funcione perfeitamente!
for router in [auth.router, dashboard.router, campanhas.router, tecnicos.router, perfil.router]:
    app.include_router(router)
    app.include_router(router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend_python.main:app", host="0.0.0.0", port=8080, reload=True)
