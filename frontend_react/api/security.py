import time
import base64
import bcrypt
import jwt
from typing import Optional, Dict, Any
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
try:
    from core import config
except ImportError:
    try:
        from api.core import config
    except ImportError:
        import config

security_scheme = HTTPBearer(auto_error=False)

def _get_signing_key() -> bytes:
    # Decodifica a chave base64 idêntica à utilizada pelo Spring Boot
    return base64.b64decode(config.JWT_SECRET)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha em texto puro bate com o hash BCrypt."""
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def hash_password(plain_password: str) -> str:
    """Gera o hash BCrypt para nova senha."""
    salt = bcrypt.gensalt(rounds=10)
    return bcrypt.hashpw(plain_password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: Dict[str, Any], expires_delta_seconds: Optional[int] = None) -> str:
    """Gera um token JWT com algoritmo HS384 compatível com o Spring Boot."""
    to_encode = data.copy()
    now = int(time.time())
    expire = now + (expires_delta_seconds if expires_delta_seconds else config.JWT_EXPIRATION_SECONDS)
    
    to_encode.update({
        "iat": now,
        "exp": expire
    })
    
    encoded_jwt = jwt.encode(to_encode, _get_signing_key(), algorithm=config.JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodifica e valida o token JWT."""
    try:
        payload = jwt.decode(token, _get_signing_key(), algorithms=[config.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado. Por favor, realize novo login."
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação inválido."
        )

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme)) -> Dict[str, Any]:
    """Dependency do FastAPI para extrair o usuário autenticado a partir do Bearer Token."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária."
        )
    return decode_access_token(credentials.credentials)
