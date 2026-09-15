import React, { useEffect, useState, useMemo } from 'react';
import { Users, Filter, CheckCircle2, XCircle, Medal, RefreshCw, UserX, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { CircularProgress } from '../components/ui/CircularProgress';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import ChamadosHistoryCard from '../components/dashboard/ChamadosHistoryCard';
import { TecnicoMetricsUI } from '../components/dashboard/TecnicoMetricsUI';
import { ModalChamadosSemTecnico } from '../components/dashboard/ModalChamadosSemTecnico';
import { useTecnicoMetrics } from '../hooks/useTecnicoMetrics';
import { toTitleCase } from '../utils/stringFormatters';

export default function AdminDashboardScreen() {
  const { user } = useAuthStore();
  
  // JSDoc: Identifica se é Moderador (nível 3)
  const isModerador = user?.role === 'MODERADOR';

  const [rankingOriginal, setRankingOriginal] = useState<any[]>([]);
  const [todosTecnicos, setTodosTecnicos] = useState<any[]>([]);
  const [todosSupervisores, setTodosSupervisores] = useState<any[]>([]);
  const [todasBases, setTodasBases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModalSemTecnicoOpen, setIsModalSemTecnicoOpen] = useState(false);
  const [semTecnicoResumo, setSemTecnicoResumo] = useState<{ totalGeral: number; regioesQtd: number } | null>(null);
  
  // Filtros
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all');
  const [selectedEquipe, setSelectedEquipe] = useState<string>('all');
  const [selectedTecnicoIdentifier, setSelectedTecnicoIdentifier] = useState<string>('all');

  // Mês selecionado (para o Drilldown do Técnico)
  const [selectedMonth, setSelectedMonth] = useState<string>('Média Final');

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        // Primeiro busca supervisores para identificar o logado
        const supResp = await api.get('/supervisores');
        const supList = supResp.data || [];
        if (mounted) setTodosSupervisores(supList);
        
        // Se for supervisor, passamos o id dele na requisição para não baixar a base inteira
        let queryIdSupervisor = undefined;
        if (!isModerador && user?.matricula) {
           const logado = supList.find((s:any) => s.matricula === user.matricula);
           if (logado) queryIdSupervisor = logado.idSupervisor;
        }

        const [rankingResp, tecnicosResp, basesResp] = await Promise.all([
          api.get('/dashboard/ranking'),
          api.get('/tecnicos', { params: { idSupervisor: queryIdSupervisor } }),
          api.get('/bases', { params: { idSupervisor: queryIdSupervisor } })
        ]);
        
        if (mounted) {
          if (rankingResp.data) setRankingOriginal(rankingResp.data);
          if (tecnicosResp.data) setTodosTecnicos(tecnicosResp.data);
          if (basesResp.data) setTodasBases(basesResp.data);
        }
      } catch (error) {
        console.error('Erro ao buscar dados do dashboard:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    
    // Configura valor inicial do supervisor se não for moderador
    if (!isModerador && user?.matricula) {
      setSelectedSupervisor(user.matricula);
    }
    
    return () => { mounted = false; };
  }, [isModerador, user?.matricula]);

  const handleProcessarMes = async () => {
    try {
      setIsProcessing(true);
      await api.post('/dashboard/calcular', {}, { timeout: 120000 });
      // Recarrega os dados após processamento
      const response = await api.get('/dashboard/ranking');
      if (response.data) {
        setRankingOriginal(response.data);
      }
      alert('Cálculo finalizado com sucesso! A tela foi atualizada com os novos dados.');
    } catch (error) {
      console.error('Erro ao processar mês:', error);
      alert('Ocorreu um erro ao processar o mês. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 1. Lógica de Supervisores
  const listaSupervisores = useMemo(() => {
    return todosSupervisores.sort((a, b) => (a.nomeCompleto || '').localeCompare(b.nomeCompleto || ''));
  }, [todosSupervisores]);

  // Se for Moderador, escolhe qualquer um. Se for Admin, crava nele mesmo.
  const supervisorEfetivo = isModerador ? selectedSupervisor : (user?.matricula || 'none');

  // Recupera o ID do supervisor efetivo para filtrar as bases
  const supervisorEfetivoId = useMemo(() => {
    if (supervisorEfetivo === 'all') return 'all';
    const sup = listaSupervisores.find(s => s.matricula === supervisorEfetivo || s.idSupervisor?.toString() === supervisorEfetivo);
    return sup ? sup.idSupervisor : 'all';
  }, [supervisorEfetivo, listaSupervisores]);

  // Busca resumo de chamados sem técnico exclusivamente para a moderação
  useEffect(() => {
    if (!isModerador) {
      setSemTecnicoResumo(null);
      return;
    }
    let mounted = true;
    const fetchSemTecnicoResumo = async () => {
      try {
        const params: Record<string, any> = {};
        if (supervisorEfetivoId !== 'all') {
          params.idSupervisor = supervisorEfetivoId;
        }
        const resp = await api.get('/dashboard/chamados-sem-tecnico', { params });
        if (mounted && resp.data) {
          setSemTecnicoResumo({
            totalGeral: resp.data.totalGeral || 0,
            regioesQtd: resp.data.regioes?.length || 0
          });
        }
      } catch (err) {
        console.error('Erro ao buscar resumo de chamados sem técnico:', err);
      }
    };
    fetchSemTecnicoResumo();
    return () => { mounted = false; };
  }, [isModerador, supervisorEfetivoId]);

  // 2. Lógica de Equipes (Base ATP)
  const equipesDisponiveis = useMemo(() => {
    let filtradas = todasBases;
    if (supervisorEfetivoId !== 'all') {
      filtradas = todasBases.filter(b => b.idSupervisor === supervisorEfetivoId);
    }
    
    // Deduplicar por ctCodigo, já que uma macro base pode ter várias cidades mas os técnicos 
    // são filtrados apenas pelo ctCodigo e idSupervisor
    const unicas = Array.from(new Map(filtradas.map(b => [b.ctCodigo, b])).values());
    
    return unicas.sort((a, b) => (a.nomeAtp || '').localeCompare(b.nomeAtp || ''));
  }, [todasBases, supervisorEfetivoId]);

  // Se a base selecionada não estiver na lista (ex: mudou de supervisor), reseta
  useEffect(() => {
    if (selectedEquipe !== 'all') {
      const baseAindaVisivel = equipesDisponiveis.find(b => b.ctCodigo === selectedEquipe);
      if (!baseAindaVisivel) {
        setSelectedEquipe('all');
      }
    }
  }, [equipesDisponiveis, selectedEquipe]);

  // 3. Lógica de Técnicos Visíveis
  const tecnicosVisiveis = useMemo(() => {
    // Pega só os TECNICOS
    let lista = todosTecnicos.filter(t => {
      const r = (t.role || '').toUpperCase();
      return r.includes('PADRAO') || r.includes('TECNICO') || r === '';
    });
    
    // Filtra pelas bases permitidas
    if (selectedEquipe !== 'all') {
      lista = lista.filter(t => t.ctBases && t.ctBases.includes(selectedEquipe));
    }
    
    // Filtro adicional: aplica o supervisor selecionado mesmo quando tem equipe selecionada
    if (supervisorEfetivoId !== 'all') {
      lista = lista.filter(t => t.idSupervisor === supervisorEfetivoId);
    }
    return lista.sort((a, b) => (a.nomeCompleto || '').localeCompare(b.nomeCompleto || ''));
  }, [todosTecnicos, selectedEquipe, supervisorEfetivoId]);

  // Se o técnico selecionado não estiver na lista atual, reseta
  useEffect(() => {
    if (selectedTecnicoIdentifier !== 'all') {
      const tecnicoAindaVisivel = tecnicosVisiveis.find(t => 
        (t.matricula && t.matricula === selectedTecnicoIdentifier) || 
        t.idTecnico?.toString() === selectedTecnicoIdentifier
      );
      if (!tecnicoAindaVisivel) {
        setSelectedTecnicoIdentifier('all');
      }
    }
  }, [tecnicosVisiveis, selectedTecnicoIdentifier]);

  const { metricas, displayMetricas } = useTecnicoMetrics(
    rankingOriginal,
    tecnicosVisiveis,
    selectedTecnicoIdentifier,
    selectedMonth
  );

  // 5. Resumo da Equipe (Team Dashboard)
  const teamSummary = useMemo(() => {
    if (tecnicosVisiveis.length === 0) return null;
    
    // Pega as métricas REAIS dos técnicos visíveis
    const metricasReais = tecnicosVisiveis.map(t => rankingOriginal.find(r => 
        (r.matricula && r.matricula === t.matricula) || 
        (r.tecnico && String(r.tecnico).toUpperCase() === String(t.nomeCompleto).toUpperCase())
    )).filter(Boolean);
    
    if (metricasReais.length === 0) {
      return { volumeChamados: 0, reincidenciaQtd: 0, pecasMedia: 0, slaMedia: 0, perdasQtd: 0, qtd: tecnicosVisiveis.length };
    }
    
    const somaProd = metricasReais.reduce((acc, t) => acc + (t.quantidadeProdutividade || 0), 0);
    const mediaSla = metricasReais.reduce((acc, t) => acc + (t.percentualSla || 0), 0) / metricasReais.length;
    const mediaPecas = metricasReais.reduce((acc, t) => acc + (t.percentualEficienciaPecas || 0), 0) / metricasReais.length;
    
    // Qtd Reincidencia = Prod * (Percentual / 100)
    const reincidenciaQtd = Math.round(metricasReais.reduce((acc, t) => acc + (t.quantidadeProdutividade || 0) * (t.percentualReincidencia || 0) / 100, 0));
    const perdasQtd = Math.round(metricasReais.reduce((acc, t) => acc + (t.quantidadeProdutividade || 0) * (t.percentualPerdidos || 0) / 100, 0));
    
    return { volumeChamados: somaProd, reincidenciaQtd, pecasMedia: mediaPecas, slaMedia: mediaSla, perdasQtd, qtd: tecnicosVisiveis.length };
  }, [tecnicosVisiveis, rankingOriginal]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-teal"></div>
      </div>
    );
  }



  return (
    <div className="space-y-6 pb-6 mt-16 md:mt-24 px-4 md:px-8">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 bg-light-surface dark:bg-surface p-4 md:p-6 rounded-positivo-lg shadow-sm border border-light-borderStrong dark:border-border">
        <div>
          <h1 className="text-2xl font-bold text-light-text-main dark:text-text-main flex items-center gap-2">
            <Users className="text-accent-teal" size={24} />
            Painel de Supervisão
          </h1>
          <p className="text-sm text-light-text-muted dark:text-text-muted mt-1">
            {isModerador ? 'Visão global (Moderador)' : `Gestão da equipe: ${user?.localEquipe || 'Sem equipe vinculada'}`}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-3 w-full xl:w-auto">
          
          {/* JSDoc: Dropdown de Supervisor (Apenas para Moderador interagir) */}
          <div className="w-full lg:w-auto">
            <label className="block text-xs font-medium text-light-text-muted dark:text-text-muted mb-1 ml-1">Supervisor</label>
            <select
              value={supervisorEfetivo}
              onChange={(e) => isModerador && setSelectedSupervisor(e.target.value)}
              disabled={!isModerador}
              className={`w-full lg:w-48 bg-slate-50 dark:bg-background border border-light-borderStrong dark:border-border text-light-text-main dark:text-text-main text-sm rounded-positivo-md p-2.5 outline-none transition-shadow ${!isModerador ? 'opacity-75 cursor-not-allowed' : 'focus:ring-accent-teal focus:border-accent-teal'}`}
            >
              {isModerador && <option value="all">Todos os Supervisores</option>}
              {listaSupervisores.map(s => (
                <option key={s.idSupervisor} value={s.matricula || s.idSupervisor?.toString()}>{toTitleCase(s.nomeCompleto)}</option>
              ))}
            </select>
          </div>

          {/* JSDoc: Dropdown de equipes disponivel filtrado pelo Supervisor */}
          <div className="w-full lg:w-auto">
            <label className="block text-xs font-medium text-light-text-muted dark:text-text-muted mb-1 ml-1">Base ATP</label>
            <select
              value={selectedEquipe}
              onChange={(e) => setSelectedEquipe(e.target.value)}
              className="w-full lg:w-64 bg-slate-50 dark:bg-background border border-light-borderStrong dark:border-border text-light-text-main dark:text-text-main text-sm rounded-positivo-md focus:ring-accent-teal focus:border-accent-teal p-2.5 outline-none transition-shadow"
            >
              <option value="all">Todas as Bases</option>
              {equipesDisponiveis.map(base => {
                const eq = base.ctCodigo;
                const label = base.nomeAtp ? `${eq} - ${toTitleCase(base.nomeAtp)} (${base.uf || ''})` : eq;
                return <option key={eq} value={eq}>{label}</option>
              })}
            </select>
          </div>

          {/* JSDoc: Técnicos da base/equipe selecionada */}
          <div className="w-full lg:w-auto">
            <label className="block text-xs font-medium text-light-text-muted dark:text-text-muted mb-1 ml-1">Técnico Analisado</label>
            <select
              value={selectedTecnicoIdentifier}
              onChange={(e) => setSelectedTecnicoIdentifier(e.target.value)}
              className="w-full lg:w-72 bg-slate-50 dark:bg-background border border-light-borderStrong dark:border-border text-light-text-main dark:text-text-main text-sm rounded-positivo-md focus:ring-accent-teal focus:border-accent-teal p-2.5 outline-none transition-shadow"
            >
              <option value="all">-- Visão da Equipe --</option>
              {tecnicosVisiveis.map(t => {
                const optionValue = t.matricula || t.idTecnico?.toString();
                const matText = t.matricula ? `(${t.matricula})` : '';
                return (
                  <option key={t.idTecnico} value={optionValue}>
                    {toTitleCase(t.nomeCompleto)} {matText}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Alerta de Chamados Sem Técnico Atribuído Exclusivo para Moderação */}
      {isModerador && semTecnicoResumo && semTecnicoResumo.totalGeral > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-positivo-lg p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0">
              <UserX size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-light-text-main dark:text-text-main">
                  Atenção Moderação: Chamados Sem Técnico Atribuído
                </h3>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  {semTecnicoResumo.totalGeral} {semTecnicoResumo.totalGeral === 1 ? 'chamado' : 'chamados'}
                </span>
              </div>
              <p className="text-xs text-light-text-muted dark:text-text-muted mt-1">
                Identificados atendimentos sem identificação de técnico distribuídos em {semTecnicoResumo.regioesQtd} regiões/bases operacionais.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsModalSemTecnicoOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-positivo-md bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-sm self-start sm:self-auto shrink-0 cursor-pointer"
          >
            Analisar por Região
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* JSDoc: Visão Global (Team Dashboard) quando nenhum técnico específico está selecionado */}
      {selectedTecnicoIdentifier === 'all' && teamSummary && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className={`grid grid-cols-1 md:grid-cols-2 ${isModerador ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-5'} gap-4`}>
            <div className="bg-light-surface dark:bg-surface p-5 rounded-positivo-lg shadow-sm border border-light-borderStrong dark:border-border">
              <p className="text-sm font-medium text-light-text-muted dark:text-text-muted">Volume de Chamados</p>
              <p className="text-3xl font-bold text-light-text-main dark:text-text-main mt-1">{teamSummary.volumeChamados}</p>
            </div>
            <div className="bg-light-surface dark:bg-surface p-5 rounded-positivo-lg shadow-sm border border-light-borderStrong dark:border-border">
              <p className="text-sm font-medium text-light-text-muted dark:text-text-muted">Reincidência (Qtd)</p>
              <p className="text-3xl font-bold text-accent-teal mt-1">{teamSummary.reincidenciaQtd}</p>
            </div>
            <div className="bg-light-surface dark:bg-surface p-5 rounded-positivo-lg shadow-sm border border-light-borderStrong dark:border-border">
              <p className="text-sm font-medium text-light-text-muted dark:text-text-muted">Eficiência Peças (Média)</p>
              <p className="text-3xl font-bold text-brilhamais-gold mt-1">{teamSummary.pecasMedia.toFixed(1)}%</p>
            </div>
            <div className="bg-light-surface dark:bg-surface p-5 rounded-positivo-lg shadow-sm border border-light-borderStrong dark:border-border">
              <p className="text-sm font-medium text-light-text-muted dark:text-text-muted">SLA da Base (Média)</p>
              <p className="text-3xl font-bold text-status-success mt-1">{teamSummary.slaMedia.toFixed(1)}%</p>
            </div>
            <div className="bg-light-surface dark:bg-surface p-5 rounded-positivo-lg shadow-sm border border-light-borderStrong dark:border-border">
              <p className="text-sm font-medium text-light-text-muted dark:text-text-muted">Perdas SLA (Qtd)</p>
              <p className="text-3xl font-bold text-status-error mt-1">{teamSummary.perdasQtd}</p>
            </div>

            {/* JSDoc: Indicador específico de Chamados Sem Técnico exclusivo para Moderadores */}
            {isModerador && (
              <div 
                onClick={() => setIsModalSemTecnicoOpen(true)}
                className="bg-light-surface dark:bg-surface p-5 rounded-positivo-lg shadow-sm border border-amber-500/30 hover:border-amber-500 transition-all cursor-pointer group flex flex-col justify-between"
                title="Clique para auditar chamados sem técnico por região"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-light-text-muted dark:text-text-muted">Sem Técnico</p>
                    <span className="p-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                      <UserX size={16} />
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                    {semTecnicoResumo?.totalGeral ?? 0}
                  </p>
                </div>
                <p className="text-xs text-light-text-muted dark:text-text-muted mt-2 flex items-center justify-between group-hover:text-amber-600 dark:group-hover:text-amber-400">
                  <span>{semTecnicoResumo?.regioesQtd ?? 0} bases</span>
                  <span className="inline-flex items-center gap-0.5 font-medium">
                    Auditar <ArrowRight size={12} />
                  </span>
                </p>
              </div>
            )}
          </div>
          
          <div className="bg-light-surface dark:bg-surface p-6 rounded-positivo-lg shadow-sm border border-light-borderStrong dark:border-border text-center">
            <Filter className="mx-auto h-12 w-12 text-light-text-muted/50 dark:text-text-muted/30 mb-3" />
            <h3 className="text-lg font-medium text-light-text-main dark:text-text-main">Visão Consolidada</h3>
            <p className="text-light-text-muted dark:text-text-muted text-sm mt-1 max-w-md mx-auto">
              Selecione um técnico no menu acima para realizar o drill-down e visualizar o detalhamento do Brilha Mais idêntico à visão do técnico.
            </p>
          </div>
        </div>
      )}

      {/* JSDoc: Visão Individual (Drill-down) que simula o DashboardScreen para manter identidade visual */}
      {selectedTecnicoIdentifier !== 'all' && displayMetricas && (
        <div className="mt-8 pt-8 border-t border-light-borderStrong dark:border-border/50">
          <TecnicoMetricsUI
            metricas={metricas}
            displayMetricas={displayMetricas}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
          />
        </div>
      )}

      {/* Modal de Detalhamento de Chamados Sem Técnico exclusivo para a Moderação */}
      {isModerador && (
        <ModalChamadosSemTecnico
          isOpen={isModalSemTecnicoOpen}
          onClose={() => setIsModalSemTecnicoOpen(false)}
          idSupervisor={supervisorEfetivoId !== 'all' ? supervisorEfetivoId : undefined}
        />
      )}
    </div>
  );
}
