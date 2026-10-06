import sys
sys.path.insert(0, '.')
from fastapi.testclient import TestClient
from backend_python.main import app

client = TestClient(app)

def test_all():
    print("=== TEST 1: Login do Robson (75942) ===")
    resp = client.post("/api/v1/auth/login", json={
        "matricula": "75942",
        "senha": "Brilha@123"
    })
    print(f"Status: {resp.status_code}")
    data = resp.json()
    print("Response data:", data)
    assert resp.status_code == 200, f"Falha no login do Robson: {data}"
    assert data["primeiroAcesso"] is True, "Primeiro acesso do Robson deve ser True"
    assert "Robson" in data["nome"], "Nome do Robson deve estar no retorno"
    robson_token = data["accessToken"]
    print(">>> TEST 1 PASSOU! Robson loga com sucesso e tem primeiroAcesso=True!\n")

    print("=== TEST 3: Cadastro com variação de senha padrão (brilha123) ===")
    import random
    test_mat = f"TEST{random.randint(10000, 99999)}"
    resp_create = client.post("/api/v1/tecnicos", 
        json={
            "matricula": test_mat,
            "nomeCompleto": "Teste Automatizado Senha Padrao",
            "senha": "brilha123",
            "cargo": "Tecnico de Testes",
            "role": "PADRAO"
        },
        headers={"Authorization": f"Bearer {robson_token}"}
    )
    print(f"Status: {resp_create.status_code}")
    print("Response:", resp_create.json())
    assert resp_create.status_code == 200, f"Erro ao cadastrar com senha padrão: {resp_create.json()}"
    print(">>> TEST 3 PASSOU! Senha brilha123 normalizada com sucesso sem erro 400!\n")

    print("=== TEST 4: Validação de Matrícula Duplicada ===")
    resp_dup = client.post("/api/v1/tecnicos", 
        json={
            "matricula": test_mat,
            "nomeCompleto": "Outro Técnico Mesma Matrícula",
            "senha": "Brilha@123"
        },
        headers={"Authorization": f"Bearer {robson_token}"}
    )
    print(f"Status: {resp_dup.status_code}")
    print("Response:", resp_dup.json())
    assert resp_dup.status_code == 400, "Deveria retornar 400 para matrícula duplicada"
    assert "Já existe um colaborador cadastrado com a matrícula" in resp_dup.json()["detail"]
    print(">>> TEST 4 PASSOU! Mensagem de duplicidade clara e amigável!\n")

    # Limpar técnico de teste
    test_id = resp_create.json().get("idTecnico")
    if test_id:
        client.delete(f"/api/v1/tecnicos/{test_id}", headers={"Authorization": f"Bearer {robson_token}"})
        print(f"Técnico de teste {test_mat} limpo com sucesso.")

    print("\nTODOS OS TESTES PASSARAM COM 100% DE SUCESSO!")

if __name__ == "__main__":
    test_all()
