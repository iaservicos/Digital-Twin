# Dockerfile para o Microserviço DataIngest (Python 3.12 / Databricks ETL)
FROM python:3.12-slim

# Evitar gravação de arquivos .pyc e ativar buffer de saída sem atrasos
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Instalar dependências de sistema necessárias para compilação/conexão PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependências do Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o código fonte da aplicação
COPY . .

# Expor a porta da API REST HTTP (FastAPI)
EXPOSE 8000

# Comando de inicialização padrão do container
CMD ["python", "run_sync.py", "--api", "--host", "0.0.0.0", "--port", "8000"]
