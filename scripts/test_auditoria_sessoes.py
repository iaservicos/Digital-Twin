import sys
sys.path.insert(0, '.')
from fastapi.testclient import TestClient
from backend_python.main import app

client = TestClient(app)

def test_auditoria():
    print("=== TEST 1: Login e Criação de Sessão ===")
    resp_login = client.post("/api/v1/auth/login", json={
        "matricula": "75942",
        "senha": "Brilha@123"
    }, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"})
    print("Status:", resp_login.status_code)
    data = resp_login.json()
    assert resp_login.status_code == 200, f"Falha no login: {data}"
    id_sessao = data.get("idSessao")
    token = data.get("accessToken")
    print(f"idSessao retornado: {id_sessao}")
    assert id_sessao is not None, "idSessao não deve ser nulo"
    print(">>> TEST 1 PASSOU!\n")

    print("=== TEST 2: Heartbeat Ping ===")
    resp_ping = client.post("/api/v1/auth/session/ping", json={"idSessao": id_sessao})
    print("Status Ping:", resp_ping.status_code, resp_ping.json())
    assert resp_ping.status_code == 200
    assert resp_ping.json().get("ok") is True
    print(">>> TEST 2 PASSOU!\n")

    print("=== TEST 3: Restrição de Acesso à Auditoria (Não-Moderador) ===")
    resp_forbidden = client.get("/api/v1/auditoria/sessoes", headers={"Authorization": f"Bearer {token}"})
    print("Status Não-Moderador:", resp_forbidden.status_code, resp_forbidden.json())
    assert resp_forbidden.status_code == 403, "Deveria retornar 403 para não-moderador"
    assert "Acesso restrito exclusivamente ao perfil Moderador" in resp_forbidden.json()["detail"]
    print(">>> TEST 3 PASSOU!\n")

    print("=== TEST 4: Acesso à Auditoria por Moderador (Márcio 72916) ===")
    from backend_python.core.security import create_access_token
    moderador_token = create_access_token({
        "sub": "72916",
        "nome": "MARCIO DA SILVA EDUARDO",
        "cargo": "Moderador",
        "role": "MODERADOR"
    })
    resp_audit = client.get("/api/v1/auditoria/sessoes", headers={"Authorization": f"Bearer {moderador_token}"})
    print("Status Auditoria Moderador:", resp_audit.status_code)
    audit_data = resp_audit.json()
    print("KPIs:", audit_data.get("kpis"))
    print("Total Sessões Retornadas:", len(audit_data.get("sessoes", [])))
    assert resp_audit.status_code == 200
    assert audit_data["kpis"]["usuariosOnlineAgora"] >= 1
    assert len(audit_data["sessoes"]) >= 1
    print("Primeira Sessão:", audit_data["sessoes"][0])
    print(">>> TEST 4 PASSOU!\n")

    print("=== TEST 5: Encerramento de Sessão ===")
    resp_end = client.post("/api/v1/auth/session/end", json={"idSessao": id_sessao})
    print("Status Session End:", resp_end.status_code, resp_end.json())
    assert resp_end.status_code == 200
    assert resp_end.json().get("ok") is True
    print(">>> TEST 5 PASSOU!\n")

    # Verifica status final no banco
    resp_audit_after = client.get("/api/v1/auditoria/sessoes", headers={"Authorization": f"Bearer {moderador_token}"})
    s_encerrada = next((s for s in resp_audit_after.json()["sessoes"] if s["idSessao"] == id_sessao), None)
    print("Sessão após encerramento:", s_encerrada)
    assert s_encerrada is not None
    assert s_encerrada["status"] == "Finalizada"
    print(">>> TEST 5 VERIFICADO NO BANCO COM STATUS FINALIZADA!\n")

    print("TODOS OS TESTES DE AUDITORIA E SESSÃO PASSARAM COM SUCESSO!")

if __name__ == "__main__":
    test_auditoria()
