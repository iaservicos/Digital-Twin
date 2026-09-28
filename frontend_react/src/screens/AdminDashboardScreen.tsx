import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  Users, 
  UserX, 
  ArrowRight, 
  ArrowLeft,
  Search, 
  X, 
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { TecnicoMetricsUI } from '../components/dashboard/TecnicoMetricsUI';
import { AdminDashboardBento } from '../components/dashboard/AdminDashboardBento';
import { AdminRankingTable } from '../components/dashboard/AdminRankingTable';
import { ModalDetalhesPontuacao } from '../components/dashboard/ModalDetalhesPontuacao';
import ModalChamadosSlaPerdidos from '../components/dashboard/ModalChamadosSlaPerdidos';
import { ModalHistoricoChamados } from '../components/dashboard/ModalHistoricoChamados';
import ModalChamadosPerdas from '../components/dashboard/ModalChamadosPerdas';
import ModalChamadosReincidentes from '../components/dashboard/ModalChamadosReincidentes';
import ModalChamadosPecas from '../components/dashboard/ModalChamadosPecas';
import { ModalChamadosSemTecnico } from '../components/dashboard/ModalChamadosSemTecnico';
import { useTecnicoMetrics } from '../hooks/useTecnicoMetrics';
import { toTitleCase } from '../utils/stringFormatters';

export default function AdminDashboardScreen() {
  const { user } = useAuthStore();
  
  // Identifica se é Moderador (nível 3 / Moderação Global)
  const isModerador = ['MODERADOR', 'ROLE_MODERADOR'].includes((user?.role || '').toUpperCase());

  const [rankingOriginal, setRankingOriginal] = useState<any[]>([]);
  const [todosTecnicos, setTodosTecnicos] = useState<any[]>([]);
  const [todosSupervisores, setTodosSupervisores] = useState<any[]>([]);
  const [todasBases, setTodasBases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Estados dos Modais Interativos da Operação
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSlaModalOpen, setIsSlaModalOpen] = useState(false);
  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
  const [historicoInitialDate, setHistoricoInitialDate] = useState<string>('');
  const [isPerdasModalOpen, setIsPerdasModalOpen] = useState(false);
  const [isReincidentesModalOpen, setIsReincidentesModalOpen] = useState(false);
  const [isPecasModalOpen, setIsPecasModalOpen] = useState(false);
  const [isModalSemTecnicoOpen, setIsModalSemTecnicoOpen] = useState(false);
  const [semTecnicoResumo, setSemTecnicoResumo] = useState<{ totalGeral: number; regioesQtd: number } | null>(null);
  
  // Filtros principais
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all');
  const [selectedEquipe, setSelectedEquipe] = useState<string>('all');
  const [selectedTecnicoIdentifier, setSelectedTecnicoIdentifier] = useState<string>('all');

  // Estado para a Pesquisa de Técnico em Tempo Real no Topo
  const [searchTecnicoQuery, setSearchTecnicoQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Mês selecionado (para o Drilldown do Técnico)
  const [selectedMonth, setSelectedMonth] = useState<string>('Média Final');

  // Fecha dropdown de pesquisa ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
           const logado = supList.find((s: any) => 
             String(s.matricula) === String(user.matricula) || 
             String(s.idSupervisor) === String(user.matricula) ||
             (user.nomeCompleto && s.nomeCompleto?.toLowerCase() === user.nomeCompleto.toLowerCase())
           );
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
  }, [isModerador, user?.matricula, user?.nomeCompleto]);

  // 1. Lógica de Supervisores
  const listaSupervisores = useMemo(() => {
    return [...todosSupervisores].sort((a, b) => (a.nomeCompleto || '').localeCompare(b.nomeCompleto || ''));
  }, [todosSupervisores]);

  // Identifica o supervisor logado caso seja perfil SUPERVISOR
  const supervisorLogado = useMemo(() => {
    if (isModerador) return null;
    return listaSupervisores.find(s => 
      String(s.matricula) === String(user?.matricula) || 
      String(s.idSupervisor) === String(user?.matricula) ||
      (user?.nomeCompleto && s.nomeCompleto?.toLowerCase() === user.nomeCompleto.toLowerCase())
    );
  }, [isModerador, listaSupervisores, user]);

  // Se for Moderador, respeita o filtro do dropdown. Se for Supervisor, fixa no logado.
  const supervisorEfetivo = useMemo(() => {
    if (isModerador) return selectedSupervisor;
    if (supervisorLogado) return supervisorLogado.matricula || String(supervisorLogado.idSupervisor);
    return user?.matricula || 'none';
  }, [isModerador, selectedSupervisor, supervisorLogado, user?.matricula]);

  // Recupera o ID numérico do supervisor efetivo para filtrar as bases e técnicos
  const supervisorEfetivoId = useMemo(() => {
    if (supervisorEfetivo === 'all') return 'all';
    const sup = listaSupervisores.find(s => 
      String(s.matricula) === String(supervisorEfetivo) || 
      String(s.idSupervisor) === String(supervisorEfetivo)
    );
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
    
    // Deduplicar por ctCodigo
    const unicas = Array.from(new Map(filtradas.map(b => [b.ctCodigo, b])).values());
    return unicas.sort((a, b) => (a.nomeAtp || '').localeCompare(b.nomeAtp || ''));
  }, [todasBases, supervisorEfetivoId]);

  // Se a base selecionada não estiver na lista (ex: mudou de supervisor), reseta para 'all'
  useEffect(() => {
    if (selectedEquipe !== 'all') {
      const baseAindaVisivel = equipesDisponiveis.find(b => b.ctCodigo === selectedEquipe);
      if (!baseAindaVisivel) {
        setSelectedEquipe('all');
      }
    }
  }, [equipesDisponiveis, selectedEquipe]);

  // 3. Lógica de Técnicos Visíveis (base/supervisor)
  const tecnicosVisiveis = useMemo(() => {
    let lista = todosTecnicos.filter(t => {
      const r = (t.role || '').toUpperCase();
      return r.includes('PADRAO') || r.includes('TECNICO') || r === '';
    });
    
    // Filtra pelas bases permitidas
    if (selectedEquipe !== 'all') {
      lista = lista.filter(t => t.ctBases && t.ctBases.includes(selectedEquipe));
    }
    
    // Filtra por supervisor
    if (supervisorEfetivoId !== 'all') {
      lista = lista.filter(t => t.idSupervisor === supervisorEfetivoId);
    }
    return lista.sort((a, b) => (a.nomeCompleto || '').localeCompare(b.nomeCompleto || ''));
  }, [todosTecnicos, selectedEquipe, supervisorEfetivoId]);

  // Técnicos filtrados pela pesquisa em tempo real do cabeçalho
  const tecnicosFiltradosBusca = useMemo(() => {
    const q = searchTecnicoQuery.trim().toLowerCase();
    if (!q) return tecnicosVisiveis;
    return tecnicosVisiveis.filter(t => 
      (t.nomeCompleto && t.nomeCompleto.toLowerCase().includes(q)) ||
      (t.matricula && String(t.matricula).includes(q))
    );
  }, [tecnicosVisiveis, searchTecnicoQuery]);

  // Técnico selecionado atualmente como objeto
  const selectedTecnicoObj = useMemo(() => {
    if (selectedTecnicoIdentifier === 'all') return null;
    return tecnicosVisiveis.find(t => 
      (t.matricula && String(t.matricula) === String(selectedTecnicoIdentifier)) || 
      String(t.idTecnico) === String(selectedTecnicoIdentifier)
    );
  }, [selectedTecnicoIdentifier, tecnicosVisiveis]);

  // Se o técnico selecionado não estiver na lista atual, reseta para visão geral
  useEffect(() => {
    if (selectedTecnicoIdentifier !== 'all') {
      const tecnicoAindaVisivel = tecnicosVisiveis.find(t => 
        (t.matricula && String(t.matricula) === String(selectedTecnicoIdentifier)) || 
        String(t.idTecnico) === String(selectedTecnicoIdentifier)
      );
      if (!tecnicoAindaVisivel) {
        setSelectedTecnicoIdentifier('all');
        setSearchTecnicoQuery('');
      }
    }
  }, [tecnicosVisiveis, selectedTecnicoIdentifier]);

  // Atualiza texto de exibição da pesquisa quando o técnico selecionado mudar externamente
  useEffect(() => {
    if (selectedTecnicoObj) {
      setSearchTecnicoQuery(`${toTitleCase(selectedTecnicoObj.nomeCompleto)} (${selectedTecnicoObj.matricula || selectedTecnicoObj.idTecnico})`);
    } else if (selectedTecnicoIdentifier === 'all' && !isSearchOpen) {
      setSearchTecnicoQuery('');
    }
  }, [selectedTecnicoObj, selectedTecnicoIdentifier, isSearchOpen]);

  const { metricas, displayMetricas } = useTecnicoMetrics(
    rankingOriginal,
    tecnicosVisiveis,
    selectedTecnicoIdentifier,
    selectedMonth
  );

  // 4. Resumo da Equipe (Dashboard Operacional Consolidado)
  const teamSummary = useMemo(() => {
    if (tecnicosVisiveis.length === 0) return null;
    
    // Pega as métricas reais dos técnicos visíveis
    const metricasReais = tecnicosVisiveis.map(t => rankingOriginal.find(r => 
        (r.matricula && String(r.matricula) === String(t.matricula)) || 
        (r.idTecnico && String(r.idTecnico) === String(t.idTecnico)) ||
        (r.tecnico && String(r.tecnico).toUpperCase() === String(t.nomeCompleto).toUpperCase())
    )).filter(Boolean);
    
    if (metricasReais.length === 0) {
      return { 
        volumeChamados: 0, 
        reincidenciaQtd: 0, 
        pecasMedia: 0, 
        slaMedia: 0, 
        perdasQtd: 0, 
        qtd: tecnicosVisiveis.length,
        pontosMedia: 0,
        reincidenciaMedia: 0,
        perdasMedia: 0
      };
    }
    
    const somaProd = metricasReais.reduce((acc, t) => acc + (t.quantidadeProdutividade || 0), 0);
    const mediaSla = metricasReais.reduce((acc, t) => acc + (t.percentualSla || 0), 0) / metricasReais.length;
    const mediaPecas = metricasReais.reduce((acc, t) => acc + (t.percentualEficienciaPecas || 0), 0) / metricasReais.length;
    const mediaPontos = metricasReais.reduce((acc, t) => acc + (t.pontosTotal || 0), 0) / metricasReais.length;
    const mediaReincidencia = metricasReais.reduce((acc, t) => acc + (t.percentualReincidencia || 0), 0) / metricasReais.length;
    const mediaPerdas = metricasReais.reduce((acc, t) => acc + (t.percentualPerdidos || 0), 0) / metricasReais.length;
    
    // Qtd Reincidência = Prod * (Percentual / 100)
    const reincidenciaQtd = Math.round(metricasReais.reduce((acc, t) => acc + (t.quantidadeProdutividade || 0) * (t.percentualReincidencia || 0) / 100, 0));
    const perdasQtd = Math.round(metricasReais.reduce((acc, t) => acc + (t.quantidadeProdutividade || 0) * (t.percentualPerdidos || 0) / 100, 0));
    
    return { 
      volumeChamados: somaProd, 
      reincidenciaQtd, 
      pecasMedia: mediaPecas, 
      slaMedia: mediaSla, 
      perdasQtd, 
      qtd: tecnicosVisiveis.length,
      pontosMedia: mediaPontos,
      reincidenciaMedia: mediaReincidencia,
      perdasMedia: mediaPerdas
    };
  }, [tecnicosVisiveis, rankingOriginal]);

  // Metricas simuladas da Operação para abrir o ModalDetalhesPontuacao
  const operationalMetricas = useMemo(() => {
    if (!teamSummary) return null;
    return {
      tecnico: isModerador ? 'Operação Geral' : (supervisorLogado?.nomeCompleto || 'Equipe de Supervisão'),
      matricula: 'OPERACAO',
      localEquipe: selectedEquipe !== 'all' ? selectedEquipe : 'Todas as Bases',
      pontosTotal: Math.round(teamSummary.pontosMedia),
      percentualSla: teamSummary.slaMedia,
      pontosSla: teamSummary.slaMedia >= 90 ? 25 : Number(((teamSummary.slaMedia / 90) * 25).toFixed(1)),
      percentualReincidencia: teamSummary.reincidenciaMedia,
      pontosReincidencia: teamSummary.reincidenciaMedia <= 7 ? 20 : Math.max(0, Number((20 - (teamSummary.reincidenciaMedia - 7) * 2).toFixed(1))),
      percentualEficienciaPecas: teamSummary.pecasMedia,
      pontosPecas: teamSummary.pecasMedia >= 85 ? 20 : Number(((teamSummary.pecasMedia / 85) * 20).toFixed(1)),
      quantidadeProdutividade: teamSummary.volumeChamados,
      pontosProdutividade: 15,
      percentualPerdidos: teamSummary.perdasMedia,
      pontosPerdidos: 10,
      elegivel: true,
      motivoInelegibilidade: ''
    };
  }, [teamSummary, isModerador, supervisorLogado, selectedEquipe]);

  const handleSelectTecnico = (t: any) => {
    const val = t.matricula || String(t.idTecnico);
    setSelectedTecnicoIdentifier(val);
    setSearchTecnicoQuery(`${toTitleCase(t.nomeCompleto)} (${t.matricula || t.idTecnico})`);
    setIsSearchOpen(false);
  };

  const handleResetToAll = () => {
    setSelectedTecnicoIdentifier('all');
    setSearchTecnicoQuery('');
    setIsSearchOpen(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  // Primeiro técnico da lista para passar como âncora aos modais que exigem um ID de referência
  const primeiroTecnicoId = tecnicosVisiveis.length > 0 ? tecnicosVisiveis[0].idTecnico : 0;
  const escopoNomeOperacao = isModerador 
    ? 'Toda a Operação' 
    : (supervisorLogado?.nomeCompleto || 'Equipe');

  return (
    <div className="w-full space-y-6 pb-8">
      {/* ========================================================================= */}
      {/* 1. BARRA SUPERIOR DE SUPERVISÃO & FILTROS (Padrão Cyber Ciano Positivo)   */}
      {/* ========================================================================= */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 bg-light-surface dark:bg-surface p-5 md:p-6 rounded-[24px] border border-light-borderStrong dark:border-border shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-inner">
              <Users size={22} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-light-text-main dark:text-slate-100 tracking-tight">
                Painel de Supervisão
              </h1>
              <p className="text-xs text-light-text-muted dark:text-slate-400 mt-0.5 font-medium">
                {isModerador 
                  ? 'Visão Global • Moderação da Operação' 
                  : `Gestão de Operação • ${supervisorLogado?.nomeCompleto ? toTitleCase(supervisorLogado.nomeCompleto) : (user?.nomeCompleto || 'Supervisor')}`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
          
          {/* SELETOR DE SUPERVISOR (Exclusivo para Moderadores) */}
          {isModerador && (
            <div className="w-full sm:w-auto">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">
                Supervisor
              </label>
              <div className="relative">
                <select
                  value={selectedSupervisor}
                  onChange={(e) => setSelectedSupervisor(e.target.value)}
                  className="w-full sm:w-48 appearance-none bg-light-background dark:bg-input-bg border border-light-borderStrong dark:border-border text-light-text-main dark:text-slate-200 text-xs font-semibold rounded-xl p-2.5 pr-8 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all shadow-inner"
                >
                  <option value="all">Todos os Supervisores</option>
                  {listaSupervisores.map(s => (
                    <option key={s.idSupervisor} value={s.matricula || s.idSupervisor?.toString()}>
                      {toTitleCase(s.nomeCompleto)}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* SELETOR DE BASE ATP (Disponível para Supervisor e Moderador) */}
          <div className="w-full sm:w-auto">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">
              Base ATP
            </label>
            <div className="relative">
              <select
                value={selectedEquipe}
                onChange={(e) => setSelectedEquipe(e.target.value)}
                className="w-full sm:w-60 appearance-none bg-light-background dark:bg-input-bg border border-light-borderStrong dark:border-border text-light-text-main dark:text-slate-200 text-xs font-semibold rounded-xl p-2.5 pr-8 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all shadow-inner"
              >
                <option value="all">Todas as Bases ({equipesDisponiveis.length})</option>
                {equipesDisponiveis.map(base => {
                  const eq = base.ctCodigo;
                  const label = base.nomeAtp ? `${eq} - ${toTitleCase(base.nomeAtp)} (${base.uf || ''})` : eq;
                  return <option key={eq} value={eq}>{label}</option>;
                })}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* PESQUISA INTELIGENTE DE TÉCNICO (Disponível para Supervisor e Moderador) */}
          <div className="w-full sm:w-auto relative" ref={searchContainerRef}>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 flex items-center justify-between">
              <span>Pesquisar Técnico</span>
              {selectedTecnicoIdentifier !== 'all' && (
                <button 
                  type="button"
                  onClick={handleResetToAll}
                  className="text-cyan-400 hover:underline lowercase font-medium tracking-normal cursor-pointer"
                >
                  limpar
                </button>
              )}
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Nome ou matrícula..."
                value={searchTecnicoQuery}
                onChange={(e) => {
                  setSearchTecnicoQuery(e.target.value);
                  setIsSearchOpen(true);
                  if (e.target.value === '' && selectedTecnicoIdentifier !== 'all') {
                    setSelectedTecnicoIdentifier('all');
                  }
                }}
                onFocus={() => setIsSearchOpen(true)}
                className="w-full sm:w-64 bg-light-background dark:bg-input-bg border border-light-borderStrong dark:border-border text-light-text-main dark:text-slate-200 text-xs font-semibold rounded-xl pl-9 pr-8 py-2.5 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all shadow-inner"
              />
              {searchTecnicoQuery && (
                <button
                  type="button"
                  onClick={handleResetToAll}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Limpar seleção e voltar para a Operação"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdown com Resultados da Pesquisa em Tempo Real */}
            {isSearchOpen && (
              <div className="absolute left-0 right-0 sm:right-auto sm:w-80 mt-1.5 bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-2xl shadow-2xl z-50 p-2 max-h-72 overflow-y-auto backdrop-blur-md">
                {/* Opção Rápida: Visão Consolidada */}
                <button
                  type="button"
                  onClick={handleResetToAll}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer mb-1 ${
                    selectedTecnicoIdentifier === 'all'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      : 'text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles size={14} className="text-cyan-400" />
                    ✨ Visão Geral da Operação (Consolidada)
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md font-semibold">
                    {tecnicosVisiveis.length} tec
                  </span>
                </button>

                <div className="border-t border-border/60 my-1"></div>

                {tecnicosFiltradosBusca.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-slate-400">
                    Nenhum técnico encontrado para esta busca.
                  </div>
                ) : (
                  tecnicosFiltradosBusca.map(t => {
                    const isSelected = (t.matricula && String(t.matricula) === String(selectedTecnicoIdentifier)) || 
                                       String(t.idTecnico) === String(selectedTecnicoIdentifier);
                    return (
                      <button
                        key={t.idTecnico}
                        type="button"
                        onClick={() => handleSelectTecnico(t)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-bold'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100 font-medium'
                        }`}
                      >
                        <div className="truncate mr-2">
                          <p className="truncate font-semibold">{toTitleCase(t.nomeCompleto)}</p>
                          <p className="text-[10px] text-slate-400">Mat: {t.matricula || 'S/M'}</p>
                        </div>
                        {t.ctBases && t.ctBases.length > 0 && (
                          <span className="shrink-0 text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded">
                            {t.ctBases[0]}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ALERTA DE CHAMADOS SEM TÉCNICO (Exclusivo para a Moderação)               */}
      {/* ========================================================================= */}
      {isModerador && semTecnicoResumo && semTecnicoResumo.totalGeral > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-[24px] p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5 sm:mt-0 border border-amber-500/30">
              <UserX size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-light-text-main dark:text-slate-100">
                  Atenção Moderação: Chamados Sem Técnico Atribuído
                </h3>
                <span className="px-2.5 py-0.5 text-[11px] font-black rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {semTecnicoResumo.totalGeral} {semTecnicoResumo.totalGeral === 1 ? 'chamado' : 'chamados'}
                </span>
              </div>
              <p className="text-xs text-light-text-muted dark:text-slate-400 mt-0.5">
                Identificados atendimentos sem identificação de técnico distribuídos em {semTecnicoResumo.regioesQtd} regiões/bases operacionais.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsModalSemTecnicoOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-md self-start sm:self-auto shrink-0 cursor-pointer"
          >
            Analisar por Região
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CASO 1: VISÃO DA OPERAÇÃO (BENTO GRID 3x2 + RANKING DE PONTOS)            */}
      {/* ========================================================================= */}
      {selectedTecnicoIdentifier === 'all' && teamSummary && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
          
          {/* A. DASHBOARD BENTO SUPERIOR (3x2, idêntico aos técnicos com interatividade) */}
          <AdminDashboardBento
            teamSummary={teamSummary}
            selectedEquipe={selectedEquipe}
            selectedEquipeNome={equipesDisponiveis.find(b => b.ctCodigo === selectedEquipe)?.nomeAtp}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            onOpenDetailsModal={() => setIsDetailsModalOpen(true)}
            onOpenSlaModal={() => setIsSlaModalOpen(true)}
            onOpenHistoricoModal={(date?: string) => {
              setHistoricoInitialDate(date || '');
              setIsHistoricoModalOpen(true);
            }}
            onOpenPerdasModal={() => setIsPerdasModalOpen(true)}
            onOpenReincidentesModal={() => setIsReincidentesModalOpen(true)}
            onOpenPecasModal={() => setIsPecasModalOpen(true)}
          />

          {/* B. RANKING DE PONTOS DE TODOS OS TÉCNICOS (Substitui quadro inferior) */}
          <AdminRankingTable
            tecnicosVisiveis={tecnicosVisiveis}
            rankingOriginal={rankingOriginal}
            basesDisponiveis={equipesDisponiveis}
            supervisoresDisponiveis={listaSupervisores}
            isModerador={isModerador}
            selectedSupervisor={selectedSupervisor}
            onSelectSupervisor={setSelectedSupervisor}
            selectedEquipe={selectedEquipe}
            onSelectEquipe={setSelectedEquipe}
            onSelectTecnico={handleSelectTecnico}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* CASO 2: DRILL-DOWN DO TÉCNICO SELECIONADO                                 */}
      {/* ========================================================================= */}
      {selectedTecnicoIdentifier !== 'all' && displayMetricas && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* Banner Contextual do Técnico Selecionado */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 md:p-5 rounded-[24px] bg-cyan-500/10 border border-cyan-500/30 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-black text-lg shadow-inner">
                {selectedTecnicoObj?.nomeCompleto ? selectedTecnicoObj.nomeCompleto.charAt(0).toUpperCase() : 'T'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-500/20 px-2 py-0.5 rounded-md">
                    Visão Individual do Técnico
                  </span>
                  {selectedTecnicoObj?.ctBases && selectedTecnicoObj.ctBases.length > 0 && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      Base: {selectedTecnicoObj.ctBases.join(', ')}
                    </span>
                  )}
                </div>
                <h2 className="text-lg md:text-xl font-bold text-light-text-main dark:text-slate-100 mt-0.5">
                  {toTitleCase(selectedTecnicoObj?.nomeCompleto || displayMetricas.tecnico || 'Técnico')}
                  <span className="text-slate-400 text-sm font-normal ml-2">
                    (Mat: {selectedTecnicoObj?.matricula || displayMetricas.matricula || selectedTecnicoIdentifier})
                  </span>
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetToAll}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-light-surface dark:bg-surface hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 text-xs font-bold border border-light-borderStrong dark:border-border hover:border-cyan-500/40 transition-all cursor-pointer shadow-md self-start sm:self-auto shrink-0"
            >
              <ArrowLeft size={15} />
              Voltar para Visão da Operação / Ranking
            </button>
          </div>

          {/* Renderização do Dashboard Detalhado do Técnico */}
          <TecnicoMetricsUI
            metricas={metricas}
            displayMetricas={displayMetricas}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAIS INTERATIVOS DA OPERAÇÃO (Acionados pelo Bento Grid da Operação)     */}
      {/* ========================================================================= */}
      {operationalMetricas && (
        <ModalDetalhesPontuacao
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          metricas={operationalMetricas}
        />
      )}

      <ModalChamadosSlaPerdidos
        isOpen={isSlaModalOpen}
        onClose={() => setIsSlaModalOpen(false)}
        tecnicoId={primeiroTecnicoId}
        tecnicoNome={escopoNomeOperacao}
        selectedMonth={selectedMonth}
        percentualSla={teamSummary?.slaMedia || 0}
        pontosSla={25}
      />

      <ModalHistoricoChamados
        isOpen={isHistoricoModalOpen}
        onClose={() => setIsHistoricoModalOpen(false)}
        tecnicoId={primeiroTecnicoId}
        initialDate={historicoInitialDate}
      />

      <ModalChamadosPerdas
        isOpen={isPerdasModalOpen}
        onClose={() => setIsPerdasModalOpen(false)}
        tecnicoId={primeiroTecnicoId}
        tecnicoNome={escopoNomeOperacao}
        selectedMonth={selectedMonth}
        percentualPerdidos={teamSummary?.perdasMedia || 0}
      />

      <ModalChamadosReincidentes
        isOpen={isReincidentesModalOpen}
        onClose={() => setIsReincidentesModalOpen(false)}
        tecnicoId={primeiroTecnicoId}
        tecnicoNome={escopoNomeOperacao}
        selectedMonth={selectedMonth}
        percentualReincidencia={teamSummary?.reincidenciaMedia || 0}
      />

      <ModalChamadosPecas
        isOpen={isPecasModalOpen}
        onClose={() => setIsPecasModalOpen(false)}
        tecnicoId={primeiroTecnicoId}
        tecnicoNome={escopoNomeOperacao}
        selectedMonth={selectedMonth}
        percentualConsumo={teamSummary?.pecasMedia || 0}
      />

      {/* Modal de Auditoria de Chamados Sem Técnico Exclusivo para Moderadores */}
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
