"""
Aplicação principal FastAPI.
Configura middlewares (CORS), documentação OpenAPI/Swagger com suporte a X-API-Key, rotas e Landing Page.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.openapi.utils import get_openapi
from datetime import datetime
from src.api.routes import router as chamados_router
from src.connectors.postgres_client import PostgreSQLClient

app = FastAPI(
    title="Digital Twin - DataIngest & Analytics Engine",
    description="Motor analítico de alta performance (Polars + Databricks ETL) para a Plataforma Digital Twin.",
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

# Registrar rotas protegidas da API
app.include_router(chamados_router)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="Digital Twin - DataIngest & Analytics Engine",
        version="1.0.0",
        description="Motor analítico de alta performance (Polars + Databricks ETL) protegido por X-API-Key.",
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "Insira a chave secreta de serviço configurada em DATA_INGEST_API_KEY para autenticar as rotas protegidas."
        }
    }
    openapi_schema["security"] = [{"ApiKeyAuth": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi


@app.get("/health", tags=["Healthcheck"])
@app.get("/api/v1/health", tags=["Healthcheck"])
def healthcheck():
    """Endpoint público JSON de verificação de integridade da API."""
    db_status = "CONNECTED"
    try:
        pg = PostgreSQLClient()
        with pg._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
    except Exception as e:
        db_status = f"DISCONNECTED: {str(e)}"

    return {
        "status": "UP",
        "service": "DataIngest Engine",
        "database": db_status,
        "timestamp": datetime.now().isoformat()
    }


@app.get("/", response_class=HTMLResponse, tags=["Dashboard"])
@app.get("/api/v1", response_class=HTMLResponse, tags=["Dashboard"])
def landing_page():
    """Página de apresentação e status visual do motor DataIngest."""
    
    db_status = "ONLINE"
    db_color = "#10b981"
    try:
        pg = PostgreSQLClient()
        with pg._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
    except Exception:
        db_status = "DEGRADED"
        db_color = "#f59e0b"

    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DataIngest Engine | Positivo Tecnologia</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
      background: radial-gradient(circle at 50% 0%, #064e3b 0%, #022c22 40%, #020617 100%);
      color: #f8fafc;
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      position: relative;
      overflow-x: hidden;
    }}
    .glow {{
      position: absolute;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, rgba(16, 185, 129, 0) 70%);
      top: -120px;
      border-radius: 50%;
      pointer-events: none;
    }}
    .card {{
      background: rgba(15, 23, 42, 0.82);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 28px;
      padding: 44px;
      max-width: 660px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 50px rgba(16, 185, 129, 0.15);
      text-align: center;
      position: relative;
      z-index: 1;
    }}
    .badge-live {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #34d399;
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 22px;
    }}
    .dot {{
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 12px #10b981;
      animation: pulse 2s infinite;
    }}
    @keyframes pulse {{
      0%, 100% {{ opacity: 1; transform: scale(1); }}
      50% {{ opacity: 0.35; transform: scale(0.75); }}
    }}
    h1 {{
      font-family: 'Outfit', sans-serif;
      font-size: 34px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #ffffff 0%, #a7f3d0 50%, #34d399 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }}
    p.subtitle {{
      color: #94a3b8;
      font-size: 15px;
      margin-bottom: 34px;
      line-height: 1.5;
    }}
    .grid-status {{
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
      margin-bottom: 34px;
      text-align: left;
    }}
    .status-item {{
      background: rgba(30, 41, 59, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 18px;
    }}
    .status-item span.label {{
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }}
    .status-item span.val {{
      font-size: 14px;
      font-weight: 700;
      color: #f1f5f9;
    }}
    .actions {{
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }}
    .btn {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 22px;
      border-radius: 14px;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s ease;
    }}
    .btn-primary {{
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);
    }}
    .btn-primary:hover {{
      transform: translateY(-2px);
      box-shadow: 0 6px 22px rgba(16, 185, 129, 0.5);
    }}
    .btn-secondary {{
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #cbd5e1;
    }}
    .btn-secondary:hover {{
      background: rgba(51, 65, 85, 0.8);
      color: #ffffff;
      transform: translateY(-2px);
    }}
    .footer {{
      margin-top: 26px;
      font-size: 12px;
      color: #475569;
    }}
  </style>
</head>
<body>
  <div class="glow"></div>
  <div class="card">
    <div class="badge-live"><div class="dot"></div> ENGINE OPERACIONAL</div>
    <h1>DataIngest & Analytics</h1>
    <p class="subtitle">Motor de Ingestão Databricks e Cálculo Analítico Polars &mdash; Positivo Tecnologia</p>
    <div class="grid-status">
      <div class="status-item">
        <span class="label">Runtime</span>
        <span class="val">Python 3.12 / FastAPI</span>
      </div>
      <div class="status-item">
        <span class="label">Motor Analítico</span>
        <span class="val" style="color: #34d399;">Polars Vectorized (5s Batch)</span>
      </div>
      <div class="status-item">
        <span class="label">PostgreSQL Sync</span>
        <span class="val" style="color: {db_color};">{db_status}</span>
      </div>
      <div class="status-item">
        <span class="label">Horário do Servidor</span>
        <span class="val">{now_str}</span>
      </div>
    </div>
    <div class="actions">
      <a href="/docs" class="btn btn-primary" target="_blank">⚡ Swagger OpenAPI</a>
      <a href="/redoc" class="btn btn-secondary" target="_blank">📖 ReDoc</a>
      <a href="/health" class="btn btn-secondary" target="_blank">🩺 Health JSON</a>
    </div>
    <div class="footer">&copy; 2026 Positivo Tecnologia &bull; Brilha+ Data Engine</div>
  </div>
</body>
</html>"""

    return HTMLResponse(content=html)
