"""
Módulo de segurança e validação de autenticação via API Key (X-API-Key).
"""

from fastapi import Security, HTTPException, status
from fastapi.security.api_key import APIKeyHeader
from src.config import settings

API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)


async def verify_api_key(api_key: str = Security(api_key_header)) -> str:
    """
    Valida se a requisição possui o cabeçalho X-API-Key correto.
    """
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Acesso não autorizado: Cabeçalho 'X-API-Key' ausente.",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    if api_key != settings.DATA_INGEST_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Acesso não autorizado: Chave de API ('X-API-Key') inválida.",
            headers={"WWW-Authenticate": "ApiKey"},
        )
        
    return api_key
