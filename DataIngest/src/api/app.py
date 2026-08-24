"""
Aplicação principal FastAPI.
Configura middlewares (CORS), documentação OpenAPI/Swagger e inclui as rotas do projeto.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes import router as chamados_router

app = FastAPI(
    title="DigitalTwin - API de Integração Databricks",
    description="API REST de alta performance para consulta e sincronização de dados do Databricks para o PostgreSQL.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configuração de CORS para permitir consumo via Frontend/Web App
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar rotas
app.include_router(chamados_router)


@app.get("/", tags=["Healthcheck"])
def healthcheck():
    """Endpoint de verificação de integridade da API."""
    return {
        "status": "online",
        "service": "DigitalTwin API",
        "docs": "/docs"
    }
