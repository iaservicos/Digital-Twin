FROM python:3.11-slim

WORKDIR /app

# Instalar dependências essenciais do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar a aplicação
COPY api_ingestao.py .

# Variáveis de ambiente default
ENV PORT=8001
ENV HOST=0.0.0.0

# O Render vai passar a porta via variável $PORT
EXPOSE 8001

# Comando para iniciar o servidor
CMD uvicorn api_ingestao:app --host 0.0.0.0 --port ${PORT:-8001}
