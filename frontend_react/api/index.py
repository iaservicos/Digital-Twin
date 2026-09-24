import time
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from backend_python.routes import auth, dashboard, campanhas, tecnicos, perfil

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

# Rotas de Healthcheck
@app.get("/health")
@app.get("/api/v1/health")
def healthcheck():
    return {
        "status": "UP",
        "service": "brilha-mais-backend-python",
        "timestamp": datetime.now().isoformat()
    }

# Inclui os roteadores com prefixo vazio (ex: /auth/login) e prefixo /api/v1 (ex: /api/v1/auth/login)
# Isso garante que qualquer requisição vinda do frontend (com ou sem /api/v1) funcione perfeitamente!
for router in [auth.router, dashboard.router, campanhas.router, tecnicos.router, perfil.router]:
    app.include_router(router)
    app.include_router(router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend_python.main:app", host="0.0.0.0", port=8080, reload=True)
