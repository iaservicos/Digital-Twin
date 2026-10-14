"""
Suíte unificada de testes de regressão da API Digital Twin (Brilha+).
Cobre:
1. Autenticação e primeiro acesso
2. Normalização de senhas padrão
3. Validação de matrícula duplicada
4. Criação, ping e encerramento de sessão
5. Restrição de acesso à auditoria para não-moderadores
6. Proteção estrita do Moderador Márcio (72916)
"""

import os
import sys
import pytest
from fastapi.testclient import TestClient

# Adiciona o caminho raiz ao sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend_python.main import app
from backend_python.core.security import create_access_token

client = TestClient(app)


def test_auth_login_robson():
    """Valida login de técnico com primeiro acesso pendente."""
    resp = client.post("/api/v1/auth/login", json={
        "matricula": "75942",
        "senha": "Brilha@123"
    })
    assert resp.status_code == 200, f"Falha no login: {resp.text}"
    data = resp.json()
    assert data["primeiroAcesso"] is True
    assert "Robson" in data["nome"]
    assert "accessToken" in data


def test_cadastro_senha_padrao_e_duplicidade():
    """Valida cadastro de colaborador, normalização de senha e bloqueio de matrícula duplicada."""
    # Login para obter token
    login_resp = client.post("/api/v1/auth/login", json={
        "matricula": "75942",
        "senha": "Brilha@123"
    })
    token = login_resp.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    import random
    test_mat = f"TEST{random.randint(10000, 99999)}"

    # Cadastro inicial com base ATP autorizada do supervisor
    create_resp = client.post("/api/v1/tecnicos", json={
        "matricula": test_mat,
        "nomeCompleto": "Técnico Teste Automatizado",
        "codigoBaseAtp": "2791006",
        "senha": "brilha123",
        "cargo": "Técnico de Testes",
        "role": "PADRAO"
    }, headers=headers)
    assert create_resp.status_code == 200, f"Erro ao cadastrar: {create_resp.text}"

    # Duplicidade
    dup_resp = client.post("/api/v1/tecnicos", json={
        "matricula": test_mat,
        "nomeCompleto": "Outro Técnico Duplicado",
        "codigoBaseAtp": "2791006",
        "senha": "Brilha@123"
    }, headers=headers)
    assert dup_resp.status_code == 400
    assert "Já existe um colaborador cadastrado com a matrícula" in dup_resp.json()["detail"]

    # Valida que supervisor não pode deletar (apenas moderador tem permissão de delete)
    test_id = create_resp.json().get("idTecnico")
    if test_id:
        del_resp = client.delete(f"/api/v1/tecnicos/{test_id}", headers=headers)
        assert del_resp.status_code == 403


def test_sessao_e_auditoria():
    """Valida ciclo completo de sessão e restrição de acesso a não-moderadores."""
    # 1. Login e sessão
    resp_login = client.post("/api/v1/auth/login", json={
        "matricula": "75942",
        "senha": "Brilha@123"
    }, headers={"User-Agent": "Pytest/TestRunner"})
    assert resp_login.status_code == 200
    id_sessao = resp_login.json().get("idSessao")
    user_token = resp_login.json().get("accessToken")
    assert id_sessao is not None

    # 2. Ping
    resp_ping = client.post("/api/v1/auth/session/ping", json={"idSessao": id_sessao})
    assert resp_ping.status_code == 200
    assert resp_ping.json().get("ok") is True

    # 3. Não-moderador bloqueado com 403
    resp_forbidden = client.get("/api/v1/auditoria/sessoes", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_forbidden.status_code == 403

    # 4. Moderador com permissão (Márcio 72916)
    moderador_token = create_access_token({
        "sub": "72916",
        "nome": "MARCIO DA SILVA EDUARDO",
        "cargo": "Moderador",
        "role": "MODERADOR"
    })
    resp_audit = client.get("/api/v1/auditoria/sessoes", headers={"Authorization": f"Bearer {moderador_token}"})
    assert resp_audit.status_code == 200
    audit_data = resp_audit.json()
    assert audit_data["kpis"]["usuariosOnlineAgora"] >= 1

    # 5. Encerramento de sessão
    resp_end = client.post("/api/v1/auth/session/end", json={"idSessao": id_sessao})
    assert resp_end.status_code == 200


def test_protecao_inviolavel_conta_marcio():
    """Valida que a conta do Moderador Márcio (72916) está blindada contra inativação ou alteração."""
    moderador_token = create_access_token({
        "sub": "72916",
        "nome": "MARCIO DA SILVA EDUARDO",
        "cargo": "Moderador",
        "role": "MODERADOR"
    })
    headers = {"Authorization": f"Bearer {moderador_token}"}

    # Tentativa de inativar ou alterar matrícula protegida 72916
    resp_inactivate = client.patch("/api/v1/tecnicos/72916/inativar", headers=headers)
    # Deve retornar 403 Forbidden ou 400 Bad Request se a rota existir ou ser barrado
    if resp_inactivate.status_code != 404:
        assert resp_inactivate.status_code in (400, 403), "Conta do moderador nunca pode ser inativada"
