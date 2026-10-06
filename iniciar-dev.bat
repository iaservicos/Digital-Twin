@echo off
echo ===================================================
echo   INICIANDO ECOSSISTEMA DIGITAL TWIN (DEV MODE)
echo ===================================================
echo.

echo 1. Subindo containers Docker (Postgres, Python, React)...
docker-compose -f docker-compose.dev.yml up --build

pause
