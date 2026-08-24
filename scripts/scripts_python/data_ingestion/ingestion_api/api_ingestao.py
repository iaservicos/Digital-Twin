import os
import io
import pandas as pd
import uuid
import jwt
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime
from sqlalchemy import create_engine, text

# Inicialização do App FastAPI para o microserviço de ingestão
app = FastAPI(title="Brilha+ Ingestion API")

# Habilitando CORS para permitir chamadas do frontend (React)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# SEGURANÇA E AUTENTICAÇÃO (JWT)
# ==============================================================================
security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise HTTPException(status_code=500, detail="JWT_SECRET não configurado no servidor Python")
    try:
        # Decodifica o secret em Base64 para bater com o formato do Spring Boot (Java)
        import base64
        secret_bytes = base64.b64decode(secret)
        payload = jwt.decode(token, secret_bytes, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sua sessão expirou. Faça login novamente.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token de segurança inválido ou corrompido.")

# ==============================================================================
# CONFIGURAÇÃO DO BANCO DE DADOS
# ==============================================================================
# A URL de conexão vem do docker-compose ou do ambiente local
DB_URL = os.getenv('DATABASE_URL')
if not DB_URL:
    spring_url = os.getenv('SPRING_DATASOURCE_URL')
    if spring_url:
        DB_URL = spring_url.replace('jdbc:', '')

if not DB_URL:
    raise RuntimeError("A variável de ambiente DATABASE_URL (ou SPRING_DATASOURCE_URL) não está configurada.")

# Criando a engine de conexão síncrona do SQLAlchemy com resiliência de pool
engine = create_engine(
    DB_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=5,
    max_overflow=0
)

# Dicionário em memória para rastrear o progresso de cada BackgroundTask
# A chave é o task_id (UUID) gerado na hora do upload.
task_progress = {}

# ==============================================================================
# PROCESSADORES ASSÍNCRONOS DE PLANILHAS (BACKGROUND TASKS)
# ==============================================================================

def process_base_dl(task_id: str, file_contents: bytes):
    """Processa a planilha principal Base DL e popula tb_chamado."""
    try:
        # 1. Fase de leitura do arquivo binário na memória via Pandas
        task_progress[task_id] = {"status": "processing", "progress": 0, "message": "Lendo planilha Base DL no Pandas..."}
        df = pd.read_excel(io.BytesIO(file_contents), sheet_name=0)
        
        # Validação Exata das Colunas Requeridas
        colunas_esperadas = ['Chamado', 'Projeto', 'FT', 'SLA_status', 'Equipamento', 
                             'Material_descricao', 'Comercial', 'Assistencia_centro_trabalho', 
                             'Assistencia_nome', 'Tecnico_nome', 'Texto_encerrado', 'Reincidente', 'Classifica_chamado']
        colunas_faltantes = [c for c in colunas_esperadas if c not in df.columns]
        
        if colunas_faltantes:
            raise KeyError(f"Erro de Validação: As seguintes colunas NÃO foram encontradas na Base DL: {colunas_faltantes}. As colunas lidas foram: {list(df.columns)}. Ajuste o Excel para que tenha exatamente as 12 colunas esperadas.")

        # Limpeza básica: ignora linhas sem número de Chamado ou nome de Técnico
        df = df.dropna(subset=['Chamado', 'Tecnico_nome'])
        total_rows = len(df)
        
        with engine.connect() as conn:
            # 2. Pré-carregamento de relacionamentos para validação (Base e Técnico)
            task_progress[task_id] = {"status": "processing", "progress": 10, "message": "Buscando técnicos..."}
            
            # Mapeamento do nome do técnico para o ID relacional
            df_tec = pd.read_sql("SELECT id_tecnico, UPPER(nome_completo) as nome FROM tb_tecnico", conn)
            tec_map = pd.Series(df_tec.id_tecnico.values, index=df_tec.nome).to_dict()
            
            # Sincronização automática de Bases (Evita ForeignKeyViolation)
            task_progress[task_id] = {"status": "processing", "progress": 15, "message": "Sincronizando novas bases (ATPs)..."}
            bases_df = df[['Assistencia_centro_trabalho', 'Assistencia_nome']].dropna().drop_duplicates()
            bases_insert = []
            for _, row in bases_df.iterrows():
                bases_insert.append({
                    'ct': str(row['Assistencia_centro_trabalho'])[:20],
                    'nome': str(row['Assistencia_nome'])[:150]
                })
            if bases_insert:
                existing_cts = set(r[0] for r in conn.execute(text("SELECT DISTINCT ct_codigo FROM tb_base_atp WHERE ct_codigo IS NOT NULL")).fetchall())
                new_bases = [b for b in bases_insert if b['ct'] not in existing_cts]
                if new_bases:
                    conn.execute(text("""
                        INSERT INTO tb_base_atp (ct_codigo, nome_atp, tipo_atp) 
                        VALUES (:ct, :nome, 'IMPORTACAO_AUTO')
                    """), new_bases)
                    conn.commit()

            # 3. Tratamento e transformação linha a linha
            chamados_insert = []
            for _, row in df.iterrows():
                chamado_num = int(row['Chamado'])
                nome_tec = str(row['Tecnico_nome']).strip().upper()
                id_tec = tec_map.get(nome_tec) # Resgata o ID pelo nome exato
                
                # Trata as datas
                val_ft = row.get('FT')
                data_ft = None
                if pd.notna(val_ft) and str(val_ft).strip():
                    try:
                        parsed_ft = pd.to_datetime(val_ft, dayfirst=False) if not isinstance(val_ft, datetime) else val_ft
                        if pd.notna(parsed_ft):
                            data_ft = parsed_ft
                    except Exception:
                        pass

                chamados_insert.append({
                    'chamado': chamado_num,
                    'projeto': str(row.get('Projeto'))[:255] if pd.notna(row.get('Projeto')) else None,
                    'ft': data_ft,
                    'sla_status': str(row.get('SLA_status')).strip().lower()[:255] if pd.notna(row.get('SLA_status')) else None,
                    'equipamento': str(row.get('Equipamento'))[:255] if pd.notna(row.get('Equipamento')) else None,
                    'material_descricao': str(row.get('Material_descricao'))[:255] if pd.notna(row.get('Material_descricao')) else None,
                    'comercial': str(row.get('Comercial'))[:255] if pd.notna(row.get('Comercial')) else None,
                    'assistencia_centro_trabalho': str(row.get('Assistencia_centro_trabalho'))[:255] if pd.notna(row.get('Assistencia_centro_trabalho')) else None,
                    'assistencia_nome': str(row.get('Assistencia_nome'))[:255] if pd.notna(row.get('Assistencia_nome')) else None,
                    'tecnico_nome': str(row.get('Tecnico_nome'))[:255] if pd.notna(row.get('Tecnico_nome')) else None,
                    'texto_encerrado': str(row.get('Texto_encerrado')) if pd.notna(row.get('Texto_encerrado')) else None,
                    'reincidente': str(row.get('Reincidente'))[:255] if pd.notna(row.get('Reincidente')) else None,
                    'classifica_chamado': str(row.get('Classifica_chamado'))[:255] if pd.notna(row.get('Classifica_chamado')) else None,
                    'id_tecnico': id_tec
                })

            # 4. Inserção em lotes de 1.000 para não estourar a memória/timeout do banco
            for i in range(0, len(chamados_insert), 1000):
                chunk = chamados_insert[i:i+1000]
                
                # O progresso de inserção representa de 10% a 100% da tarefa
                current_progress = 10 + int((i / total_rows) * 90)
                task_progress[task_id] = {
                    "status": "processing", 
                    "progress": current_progress, 
                    "message": f"Banco: inserindo lote {min(i+1000, total_rows)}/{total_rows}"
                }
                
                # Ingestão Incremental: Se o chamado já existir, ele é atualizado
                conn.execute(text("""
                    INSERT INTO tb_chamado (chamado, projeto, ft, sla_status, equipamento, material_descricao, comercial, 
                    assistencia_centro_trabalho, assistencia_nome, tecnico_nome, texto_encerrado, reincidente, classifica_chamado, id_tecnico) 
                    VALUES (:chamado, :projeto, :ft, :sla_status, :equipamento, :material_descricao, :comercial, 
                    :assistencia_centro_trabalho, :assistencia_nome, :tecnico_nome, :texto_encerrado, :reincidente, :classifica_chamado, :id_tecnico)
                    ON CONFLICT (chamado) DO UPDATE SET 
                    projeto = EXCLUDED.projeto, 
                    ft = EXCLUDED.ft, 
                    sla_status = EXCLUDED.sla_status, 
                    equipamento = EXCLUDED.equipamento, 
                    material_descricao = EXCLUDED.material_descricao, 
                    comercial = EXCLUDED.comercial, 
                    assistencia_centro_trabalho = EXCLUDED.assistencia_centro_trabalho, 
                    assistencia_nome = EXCLUDED.assistencia_nome, 
                    tecnico_nome = EXCLUDED.tecnico_nome, 
                    texto_encerrado = EXCLUDED.texto_encerrado, 
                    reincidente = EXCLUDED.reincidente, 
                    classifica_chamado = EXCLUDED.classifica_chamado, 
                    id_tecnico = EXCLUDED.id_tecnico
                """), chunk)
                conn.commit()
        
        # Conclusão com sucesso
        task_progress[task_id] = {"status": "completed", "progress": 100, "message": f"Sucesso! {total_rows} chamados lidos (inseridos apenas os novos)."}
    except Exception as e:
        task_progress[task_id] = {"status": "error", "progress": 0, "message": str(e)}

def process_parts(task_id: str, file_contents: bytes):
    """Processa o consumo de peças (planilha paralela)."""
    try:
        task_progress[task_id] = {"status": "processing", "progress": 0, "message": "Lendo planilha de Peças..."}
        df = pd.read_excel(io.BytesIO(file_contents))
        
        # Converte as colunas para minúsculo para evitar erros de digitação (Case Insensitive)
        import unicodedata
        def normalize_col(c):
            s = unicodedata.normalize('NFKD', str(c)).encode('ASCII', 'ignore').decode('utf-8')
            return s.strip().lower().replace(' ', '_')
            
        df.columns = [normalize_col(c) for c in df.columns]
        
        # Validação Exata das Colunas Requeridas
        colunas_esperadas = ['chamado', 'ct', 'atp', 'ft', 'segmento', 'projeto', 'equipamento', 'sintoma', 'tecnico_nome', 'subgrupo', 'acao']
        colunas_faltantes = [c for c in colunas_esperadas if c not in df.columns]
        if colunas_faltantes:
            raise KeyError(f"Erro de Validação: As seguintes colunas NÃO foram encontradas na planilha de Peças: {colunas_faltantes}. As colunas lidas foram: {list(df.columns)}. Ajuste o Excel para que fique exatamente igual ao esperado.")
            
        df = df.dropna(subset=['chamado'])
        total_rows = len(df)
        
        with engine.begin() as conn:
            # PROTEÇÃO DE DUPLICIDADE: Busca os (chamado, subgrupo) já existentes para não duplicar peças idênticas do mesmo chamado
            pecas_existentes = {(str(r[0]), str(r[1])) for r in conn.execute(text("SELECT chamado, subgrupo FROM tb_consumo_peca")).fetchall()}

            # PREPARAÇÃO DE TÉCNICOS PARA OS 3 FILTROS
            df_tec = pd.read_sql("""
                SELECT t.id_tecnico, UPPER(TRIM(t.nome_completo)) as nome, t.matricula, tb.ct_codigo
                FROM tb_tecnico t
                LEFT JOIN tb_tecnico_base tb ON t.id_tecnico = tb.id_tecnico
            """, conn)
            
            # Agrupa as bases (CT) por técnico caso ele tenha mais de uma
            df_tec_grp = df_tec.groupby(['id_tecnico', 'nome', 'matricula'])['ct_codigo'].apply(lambda x: [str(i).strip() for i in x if pd.notna(i)]).reset_index()

            pecas_insert = []
            alertas_moderador = []
            
            for _, row in df.iterrows():
                chamado_num = str(row['chamado']).strip()
                sub = str(row.get('subgrupo', ''))[:255] if pd.notna(row.get('subgrupo')) else ''
                
                # Só insere se não existir essa mesma peça para esse mesmo chamado
                if (chamado_num, sub) not in pecas_existentes:
                    
                    tecnico_planilha = str(row.get('tecnico_nome', '')).strip().upper()
                    matricula_planilha = str(row.get('matricula', '')).strip() if 'matricula' in row else ''
                    ct_planilha = str(row.get('ct', '')).strip()
                    
                    # Filtro 1: Nome (Startswith para cobrir abreviações)
                    matches = df_tec_grp[df_tec_grp['nome'].str.startswith(tecnico_planilha)] if tecnico_planilha else pd.DataFrame()
                    
                    # Filtro 2: Desempate por Matrícula
                    if len(matches) > 1 and matricula_planilha:
                        matches_mat = matches[matches['matricula'] == matricula_planilha]
                        if not matches_mat.empty:
                            matches = matches_mat
                            
                    # Filtro 3: Desempate por Base ATP (ct)
                    if len(matches) > 1 and ct_planilha:
                        # Filtra apenas técnicos que tenham esse CT na sua lista de bases
                        matches_ct = matches[matches['ct_codigo'].apply(lambda cts: ct_planilha in cts)]
                        if not matches_ct.empty:
                            matches = matches_ct

                    # Validação de Ambiguidade
                    if len(matches) > 1:
                        # Ainda encontrou 2 nomes semelhantes após 3 filtros!
                        alertas_moderador.append(f"Chamado {chamado_num}: Duplicidade encontrada para o técnico '{tecnico_planilha}'. Linha ignorada para tratativa manual.")
                        continue # Pula para o próximo sem inserir
                        
                    # Se encontrou exatamente 1, usa o nome oficial. Se encontrou 0, grava o original.
                    if len(matches) == 1:
                        nome_salvar = matches.iloc[0]['nome']
                    else:
                        nome_salvar = tecnico_planilha
                        
                    pecas_existentes.add((chamado_num, sub))
                    
                    # Converte a data FT
                    val_ft = row.get('ft')
                    ft_date = None
                    if pd.notna(val_ft) and str(val_ft).strip():
                        try:
                            parsed_date = pd.to_datetime(val_ft, dayfirst=False) if not isinstance(val_ft, datetime) else val_ft
                            if pd.notna(parsed_date):
                                ft_date = parsed_date
                        except Exception as e:
                            print(f"Aviso: Falha ao converter data '{val_ft}': {e}")
                            pass
                            
                    pecas_insert.append({
                        'chamado': chamado_num,
                        'ct': str(row.get('ct', ''))[:255] if pd.notna(row.get('ct')) else None,
                        'atp': str(row.get('atp', ''))[:255] if pd.notna(row.get('atp')) else None,
                        'ft': ft_date,
                        'segmento': str(row.get('segmento', ''))[:255] if pd.notna(row.get('segmento')) else None,
                        'projeto': str(row.get('projeto', ''))[:255] if pd.notna(row.get('projeto')) else None,
                        'equipamento': str(row.get('equipamento', ''))[:255] if pd.notna(row.get('equipamento')) else None,
                        'sintoma': str(row.get('sintoma', '')) if pd.notna(row.get('sintoma')) else None,
                        'tecnico_nome': nome_salvar[:255] if nome_salvar else None,
                        'subgrupo': sub if sub != '' else None,
                        'acao': str(row.get('acao', ''))[:255] if pd.notna(row.get('acao')) else None
                    })

            for i in range(0, len(pecas_insert), 1000):
                chunk = pecas_insert[i:i+1000]
                current_progress = int((i / total_rows) * 100)
                task_progress[task_id] = {
                    "status": "processing", 
                    "progress": current_progress, 
                    "message": f"Banco: inserindo lote {min(i+1000, total_rows)}/{total_rows}"
                }
                conn.execute(text("""
                    INSERT INTO tb_consumo_peca (chamado, ct, atp, ft, segmento, projeto, equipamento, sintoma, tecnico_nome, subgrupo, acao)
                    VALUES (:chamado, :ct, :atp, :ft, :segmento, :projeto, :equipamento, :sintoma, :tecnico_nome, :subgrupo, :acao)
                """), chunk)
                
        msg_sucesso = f"Sucesso! {len(pecas_insert)} peças processadas."
        if alertas_moderador:
            msg_sucesso += f" Atenção: {len(alertas_moderador)} linhas ignoradas por técnicos duplicados. Tratamento manual requerido."
        
        task_progress[task_id] = {
            "status": "completed", 
            "progress": 100, 
            "message": msg_sucesso,
            "alerts": alertas_moderador
        }
    except Exception as e:
        task_progress[task_id] = {"status": "error", "progress": 0, "message": str(e)}

def process_reincidencia(task_id: str, file_contents: bytes):
    """
    Processa registros de chamados reincidentes.
    Lê uma planilha contendo as 26 colunas exatas de reincidência,
    mapeia de forma case-insensitive e insere os dados no banco.
    """
    try:
        task_progress[task_id] = {"status": "processing", "progress": 0, "message": "Lendo planilha de Reincidência..."}
        df = pd.read_excel(io.BytesIO(file_contents))
        
        # Limpa os nomes das colunas e força tudo para minúsculo (Case Insensitive)
        df.columns = df.columns.str.strip().str.lower()
        
        # Flexibilidade: Identifica a coluna que representa o Chamado Novo (RRC)
        possiveis_nomes_rrc = ['chamado_rrc', 'chamado_novo', 'chamado novo', 'chamado']
        col_chamado_rrc = next((col for col in possiveis_nomes_rrc if col in df.columns), None)
        
        if not col_chamado_rrc:
            raise KeyError("A planilha não contém a coluna 'chamado_rrc' ou equivalente.")
            
        df = df.dropna(subset=[col_chamado_rrc])
        total_rows = len(df)
        
        with engine.begin() as conn:
            # Lógica Incremental: Remove do banco APENAS os chamados que estão nesta planilha
            chamados_na_planilha = []
            for c in df[col_chamado_rrc].dropna():
                try:
                    chamados_na_planilha.append(int(c))
                except:
                    pass
            
            # Deleta em pequenos lotes para não estourar o limite da query
            for i in range(0, len(chamados_na_planilha), 1000):
                chunk_ids = tuple(chamados_na_planilha[i:i+1000])
                if chunk_ids:
                    conn.execute(text("DELETE FROM tb_reincidencia WHERE chamado_rrc IN :ids"), {"ids": chunk_ids})
            
            reinc_insert = []
            for _, row in df.iterrows():
                # Tenta extrair o número do chamado principal (RRC). Se falhar, pula a linha.
                try:
                    chamado_rrc_num = int(row[col_chamado_rrc])
                except:
                    continue
                
                # Helper interno para converter datas de forma segura e retornar None se for nulo ('NaT')
                def get_date(col_name):
                    val = row.get(col_name)
                    return val if pd.notna(val) else None

                # Trata o campo intervalo_dias que pode ser nulo ou string mal formatada
                interval_val = row.get('intervalo_dias')
                try:
                    intervalo = int(interval_val) if pd.notna(interval_val) else None
                except:
                    intervalo = None

                # Extração dos 26 campos, buscando pelos nomes em minúsculo devido à padronização acima.
                reinc_insert.append({
                    'chamado_anterior': int(row['chamado_anterior']) if pd.notna(row.get('chamado_anterior')) else None,
                    'ft_anterior': get_date('ft_anterior'),
                    'intervalo_dias': intervalo,
                    'chamado_rrc': chamado_rrc_num,
                    'ft_rrc': get_date('ft_rrc'),
                    'encerramento_rrc': get_date('encerramento_rrc'),
                    'classificacao': str(row.get('classificacao', ''))[:150] if pd.notna(row.get('classificacao')) else None,
                    'defeito_anterior': str(row.get('defeito_anterior', ''))[:255] if pd.notna(row.get('defeito_anterior')) else None,
                    'aplicado_peca_anterior': str(row.get('aplicado_peca_anterior', ''))[:255] if pd.notna(row.get('aplicado_peca_anterior')) else None,
                    'segmento_rrc': str(row.get('segmento_rrc', ''))[:100] if pd.notna(row.get('segmento_rrc')) else None,
                    'ct_rrc': str(row.get('ct_rrc', ''))[:100] if pd.notna(row.get('ct_rrc')) else None,
                    'ct_anterior': str(row.get('ct_anterior', ''))[:100] if pd.notna(row.get('ct_anterior')) else None,
                    'material_descricao_rrc': str(row.get('material_descricao_rrc', ''))[:255] if pd.notna(row.get('material_descricao_rrc')) else None,
                    'equipamento': str(row.get('equipamento', ''))[:150] if pd.notna(row.get('equipamento')) else None,
                    'projeto_anterior': str(row.get('projeto_anterior', ''))[:150] if pd.notna(row.get('projeto_anterior')) else None,
                    'tecnico_nome_rrc': str(row.get('tecnico_nome_rrc', ''))[:150] if pd.notna(row.get('tecnico_nome_rrc')) else None,
                    'tecnico_nome_anterior': str(row.get('tecnico_nome_anterior', ''))[:150] if pd.notna(row.get('tecnico_nome_anterior')) else None,
                    'texto_encerrado_rrc': str(row.get('texto_encerrado_rrc', '')) if pd.notna(row.get('texto_encerrado_rrc')) else None,
                    'motivo_class': str(row.get('motivo_class', ''))[:150] if pd.notna(row.get('motivo_class')) else None,
                    'sub_class': str(row.get('sub_class', ''))[:150] if pd.notna(row.get('sub_class')) else None,
                    'mesmo_motivo': str(row.get('mesmo_motivo', ''))[:150] if pd.notna(row.get('mesmo_motivo')) else None,
                    'peca': str(row.get('peca', ''))[:150] if pd.notna(row.get('peca')) else None,
                    'porque_nao_evitamos': str(row.get('porque_não_evitamos', '')) if pd.notna(row.get('porque_não_evitamos')) else None
                })

            # Realiza a inserção dos dados convertidos na tabela tb_reincidencia em pequenos lotes (1000)
            for i in range(0, len(reinc_insert), 1000):
                chunk = reinc_insert[i:i+1000]
                current_progress = int((i / total_rows) * 100)
                task_progress[task_id] = {
                    "status": "processing", 
                    "progress": current_progress, 
                    "message": f"Banco: inserindo lote {min(i+1000, total_rows)}/{total_rows}"
                }
                conn.execute(text("""
                    INSERT INTO tb_reincidencia (
                        chamado_anterior, ft_anterior, intervalo_dias, chamado_rrc, ft_rrc, encerramento_rrc, classificacao, 
                        defeito_anterior, aplicado_peca_anterior,
                        segmento_rrc, ct_rrc, ct_anterior,
                        material_descricao_rrc, equipamento, projeto_anterior, tecnico_nome_rrc,
                        tecnico_nome_anterior, texto_encerrado_rrc, motivo_class, sub_class,
                        mesmo_motivo, peca, porque_nao_evitamos
                    ) VALUES (
                        :chamado_anterior, :ft_anterior, :intervalo_dias, :chamado_rrc, :ft_rrc, :encerramento_rrc, :classificacao,
                        :defeito_anterior, :aplicado_peca_anterior,
                        :segmento_rrc, :ct_rrc, :ct_anterior,
                        :material_descricao_rrc, :equipamento, :projeto_anterior, :tecnico_nome_rrc,
                        :tecnico_nome_anterior, :texto_encerrado_rrc, :motivo_class, :sub_class,
                        :mesmo_motivo, :peca, :porque_nao_evitamos
                    )
                """), chunk)

                
        task_progress[task_id] = {"status": "completed", "progress": 100, "message": f"Sucesso! {total_rows} reincidências processadas com 26 colunas."}
    except Exception as e:
        task_progress[task_id] = {"status": "error", "progress": 0, "message": str(e)}

def process_encerrados_rrc(task_id: str, file_contents: bytes):
    """Processa chamados de projetos especiais que compõem estatística e descontam pontos da equipe."""
    try:
        task_progress[task_id] = {"status": "processing", "progress": 0, "message": "Lendo planilha de Encerrados RRC..."}
        df = pd.read_excel(io.BytesIO(file_contents))
        
        # Converte as colunas para minúsculo para evitar erros de digitação (Case Insensitive)
        import unicodedata
        def normalize_col(c):
            # Remove acentos e converte para minúsculo com underscore
            s = unicodedata.normalize('NFKD', str(c)).encode('ASCII', 'ignore').decode('utf-8')
            return s.strip().lower().replace(' ', '_')
            
        df.columns = [normalize_col(c) for c in df.columns]

        # PROTEÇÃO: Verifica se o usuário subiu a planilha de Reincidência no lugar errado
        if any('chamado_rrc' in c or 'chamado_anterior' in c for c in df.columns):
            raise ValueError("ATENÇÃO: Você anexou a planilha de 'Reincidências' no campo de 'Encerrados RRC'! Por favor, verifique o arquivo e selecione a planilha base de Encerrados.")
        
        # Mapeamento estrito: Não vamos renomear colunas ou tentar adivinhar nomes.
        # A planilha DEVE conter exatamente as colunas definidas no padrão.
                    
        colunas_esperadas = ['chamado', 'segmento', 'projeto', 'assistencia_codigo', 'assistencia_nome', 'ft', 'tecnico_nome', 'texto_encerrado']
        colunas_faltantes = [c for c in colunas_esperadas if c not in df.columns]
        if colunas_faltantes:
            raise KeyError(f"Erro de Validação: As seguintes colunas NÃO foram encontradas na planilha: {colunas_faltantes}. As colunas que o sistema conseguiu ler foram: {list(df.columns)}. Por favor, ajuste o cabeçalho no Excel para que fique exatamente igual ao esperado.")
            
        df = df.dropna(subset=['chamado'])
        total_rows = len(df)
        
        with engine.begin() as conn:
            # Lógica Incremental: Remove do banco APENAS os chamados que estão nesta planilha
            chamados_na_planilha = df['chamado'].dropna().astype(str).tolist()
            
            # Deleta em pequenos lotes para não estourar o limite da query
            for i in range(0, len(chamados_na_planilha), 1000):
                chunk_ids = tuple(chamados_na_planilha[i:i+1000])
                if chunk_ids:
                    conn.execute(text("DELETE FROM tb_reincidencia_encerrados WHERE chamado IN :ids"), {"ids": chunk_ids})
            
            enc_insert = []
            for _, row in df.iterrows():
                
                # Tenta converter FT (com dayfirst=False para formato americano)
                val_ft = row.get('ft')
                ft_date = None
                if pd.notna(val_ft) and str(val_ft).strip():
                    try:
                        parsed_date = pd.to_datetime(val_ft, dayfirst=False) if not isinstance(val_ft, datetime) else val_ft
                        # Evita que NaT (Not a Time) do Pandas cause problemas no PostgreSQL
                        if pd.notna(parsed_date):
                            ft_date = parsed_date
                    except Exception as e:
                        print(f"Aviso: Falha ao converter data '{val_ft}': {e}")
                        pass

                enc_insert.append({
                    'chamado': str(row['chamado']).strip(),
                    'segmento': str(row.get('segmento', ''))[:150] if pd.notna(row.get('segmento')) else None,
                    'projeto': str(row.get('projeto', ''))[:150] if pd.notna(row.get('projeto')) else None,
                    'assistencia_codigo': str(row.get('assistencia_codigo', ''))[:100] if pd.notna(row.get('assistencia_codigo')) else None,
                    'assistencia_nome': str(row.get('assistencia_nome', ''))[:255] if pd.notna(row.get('assistencia_nome')) else None,
                    'ft': ft_date,
                    'tecnico_nome': str(row.get('tecnico_nome', ''))[:255] if pd.notna(row.get('tecnico_nome')) else None,
                    'texto_encerrado': str(row.get('texto_encerrado', '')) if pd.notna(row.get('texto_encerrado')) else None
                })

            for i in range(0, len(enc_insert), 1000):
                chunk = enc_insert[i:i+1000]
                current_progress = int((i / total_rows) * 100)
                task_progress[task_id] = {
                    "status": "processing", 
                    "progress": current_progress, 
                    "message": f"Banco: inserindo lote {min(i+1000, total_rows)}/{total_rows}"
                }
                conn.execute(text("""
                    INSERT INTO tb_reincidencia_encerrados (
                        chamado, segmento, projeto, assistencia_codigo, assistencia_nome, ft, tecnico_nome, texto_encerrado
                    ) VALUES (
                        :chamado, :segmento, :projeto, :assistencia_codigo, :assistencia_nome, :ft, :tecnico_nome, :texto_encerrado
                    )
                    ON CONFLICT (chamado) DO NOTHING
                """), chunk)
                
        task_progress[task_id] = {"status": "completed", "progress": 100, "message": f"Sucesso! {total_rows} encerrados processados."}
    except Exception as e:
        task_progress[task_id] = {"status": "error", "progress": 0, "message": str(e)}

# ==============================================================================
# ENDPOINTS REST DA API
# ==============================================================================

@app.post("/api/ingestion/upload")
async def upload_planilha(type: str, background_tasks: BackgroundTasks, file: UploadFile = File(...), token_payload: dict = Depends(verify_token)):
    """
    Endpoint principal para recebimento de planilhas.
    Recebe o arquivo via rede e delega o processamento demorado para uma BackgroundTask.
    Retorna o task_id IMEDIATAMENTE para o frontend, impedindo Timeout no navegador.
    """
    try:
        # Carrega o arquivo para a memória do servidor
        contents = await file.read()
        
        # Cria um "Ticket" de acompanhamento único (UUID)
        task_id = str(uuid.uuid4())
        
        # Estado inicial
        task_progress[task_id] = {"status": "queued", "progress": 0, "message": "Enviado ao processamento..."}

        # Despacha o worker correspondente para a trilha assíncrona
        if type == 'BaseDL':
            background_tasks.add_task(process_base_dl, task_id, contents)
        elif type == 'Parts':
            background_tasks.add_task(process_parts, task_id, contents)
        elif type == 'Reincidencia':
            background_tasks.add_task(process_reincidencia, task_id, contents)
        elif type == 'EncerradosRRC':
            background_tasks.add_task(process_encerrados_rrc, task_id, contents)
        else:
            raise HTTPException(status_code=400, detail="Tipo de planilha inválido")
            
        # Responde pro Front (React) liberando a conexão HTTP principal
        return {"task_id": task_id, "message": "Processamento iniciado em segundo plano."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ingestion/progress/{task_id}")
async def get_progress(task_id: str):
    """
    Endpoint de Polling.
    O frontend vai pingar esta rota a cada 1 segundo (ex:) para saber
    em que pé está o processamento no backend e atualizar a barra verde na interface.
    """
    if task_id not in task_progress:
        raise HTTPException(status_code=404, detail="Task ID não encontrado.")
    return task_progress[task_id]

if __name__ == "__main__":
    import uvicorn
    # Inicia o servidor Python FastAPI na porta 8001
    uvicorn.run(app, host="0.0.0.0", port=8001)
