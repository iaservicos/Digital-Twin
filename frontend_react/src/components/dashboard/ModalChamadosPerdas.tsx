import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Search, 
  AlertTriangle, 
  FileText, 
  Calendar, 
  User, 
  Cpu, 
  Building2, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  Info,
  Users,
  UserCheck,
  Trophy,
  ShieldCheck
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface ChamadoPerda {
  chamado: string;
  ft: string;
  tecnicoNome: string;
  ct: string;
  assistenciaNome: string;
  equipamento: string;
  projeto: string;
  slaStatus: string;
  causaPerda: string;
  textoEncerrado: string;
}

interface ModalChamadosPerdasProps {
  isOpen: boolean;
  onClose: () => void;
  tecnicoId?: number;
  tecnicoNome?: string;
  selectedMonth?: string;
  percentualPerdidos?: number;
  equipe?: string;
}


// Helper de formatação de data e hora no padrão 'DD/MM/AAAA HH:mm' (sem segundos)
const formatDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return 'Data não informada';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const horas = String(d.getHours()).padStart(2, '0');
    const minutos = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${horas}:${minutos}`;
  } catch {
    return dateStr;
  }
};

// Helper de classificação de segmento de projeto: Governo ou Corporativo
const formatProjeto = (proj?: string | null): string => {
  if (!proj || proj.trim() === '-' || proj.trim() === '') return 'Corporativo';
  const p = proj.toUpperCase().trim();
  if (p.startsWith('H3-') || p.includes('GOV') || p.includes('GOVERNO') || p.includes('EDUC')) {
    return 'Governo';
  }
  return 'Corporativo';
};

// Helper para obter a cidade limpa da base ATP (ex: Rio de Janeiro, São Paulo, Curitiba, etc.)
const formatCidadeBase = (assistenciaNome?: string | null, ctCodigo?: string | null): string => {
  const ct = String(ctCodigo || '').trim();
  const nome = String(assistenciaNome || '').trim().toUpperCase();

  // Mapeamento direto por CT de técnicos
  const ctMap: Record<string, string> = {
    '2791005': 'Curitiba',
    '2791006': 'Belo Horizonte',
    '2791040': 'São Paulo',
    '7004721': 'Brasília',
    '7004722': 'Brasília',
    '7812231': 'Porto Alegre',
    '8788160': 'Salvador',
    '8788601': 'Goiânia',
    '8788711': 'Fortaleza',
    '8789471': 'Rio de Janeiro',
    '89000650': 'Manaus',
    '89000940': 'Fortaleza',
    '89001630': 'Rio de Janeiro',
    '89001910': 'Porto Velho',
    '89007090': 'Recife',
    '89007091': 'Maceió',
    '89009100': 'João Pessoa',
    '89009120': 'Palmas',
    '89009160': 'Natal',
    '89009511': 'Cuiabá',
    '89009670': 'Florianópolis'
  };

  if (ct && ctMap[ct]) return ctMap[ct];

  // Extração se contiver parênteses ex: "ICLIENT INFORMATICA - (RIO DE JANEIRO)"
  const matchParen = nome.match(/\(([^)]+)\)/);
  if (matchParen && matchParen[1]) {
    const rawCity = matchParen[1].trim();
    return rawCity.charAt(0).toUpperCase() + rawCity.slice(1).toLowerCase();
  }

  // Detecção por palavras-chave comuns de capitais
  if (nome.includes('RIO DE JANEIRO') || nome.includes('ICLIENT')) return 'Rio de Janeiro';
  if (nome.includes('CURITIBA')) return 'Curitiba';
  if (nome.includes('BELO HORIZONTE') || nome.includes('POSITIVO MG')) return 'Belo Horizonte';
  if (nome.includes('SÃO PAULO') || nome.includes('SAO PAULO') || nome.includes('POSITIVO SP')) return 'São Paulo';
  if (nome.includes('PORTO ALEGRE') || nome.includes('METHA')) return 'Porto Alegre';
  if (nome.includes('SALVADOR') || nome.includes('FULL TIME')) return 'Salvador';
  if (nome.includes('BRASILIA') || nome.includes('PC LINK')) return 'Brasília';
  if (nome.includes('FORTALEZA') || nome.includes('FIELD CE')) return 'Fortaleza';
  if (nome.includes('MANAUS') || nome.includes('FIELD AM')) return 'Manaus';
  if (nome.includes('RECIFE') || nome.includes('FIELD PE')) return 'Recife';
  if (nome.includes('GOIANIA') || nome.includes('CM DIGITAL')) return 'Goiânia';
  if (nome.includes('FLORIANOPOLIS') || nome.includes('FLORIANÓPOLIS')) return 'Florianópolis';

  return assistenciaNome || ctCodigo || 'Base Local';
};

export default function ModalChamadosPerdas({
  isOpen,
  onClose,
  tecnicoId,
  tecnicoNome = 'Técnico',
  selectedMonth,
  percentualPerdidos = 0,
  equipe
}: ModalChamadosPerdasProps) {
  const [chamados, setChamados] = useState<ChamadoPerda[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClassificacao, setSelectedClassificacao] = useState<string>('TODOS');
  const [expandedChamado, setExpandedChamado] = useState<string | null>(null);
  
  // Para supervisores/moderadores: alternador entre ver apenas o técnico atual ou toda a base
  const [visaoFiltro, setVisaoFiltro] = useState<'INDIVIDUAL' | 'BASE'>(
    tecnicoId === 0 || !tecnicoId ? 'BASE' : 'INDIVIDUAL'
  );

  useEffect(() => {
    if (tecnicoId === 0 || !tecnicoId) {
      setVisaoFiltro('BASE');
    } else {
      setVisaoFiltro('INDIVIDUAL');
    }
  }, [tecnicoId]);
  
  const { user } = useAuthStore();
  const isSupervisorOrAdmin = user?.role === 'SUPERVISOR' || user?.role === 'MODERADOR' || user?.role === 'ADMINISTRADOR' || user?.cargo === 'Administrador' || user?.cargo === 'Super Administrador';

  useEffect(() => {
    if (!isOpen || tecnicoId === undefined || tecnicoId === null) return;

    const fetchChamadosPerdas = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string> = {};
        if (selectedMonth && selectedMonth !== 'Campanha Inteira' && selectedMonth !== 'Média Final') {
          params.mesAno = selectedMonth;
        }
        if (equipe) {
          params.equipe = equipe;
        }
        const res = await api.get(`/dashboard/tecnico/${tecnicoId}/perdas`, { params });
        setChamados(res.data || []);
      } catch (err: any) {
        console.error('Erro ao buscar chamados de perdas:', err);
        setError('Não foi possível carregar o detalhamento de perdas.');
      } finally {
        setLoading(false);
      }
    };

    fetchChamadosPerdas();
  }, [isOpen, tecnicoId, selectedMonth, equipe]);

  // Se a visão for individual, filtra somente pelo nome do técnico atual
  const chamadosEscopo = useMemo(() => {
    if (tecnicoId === 0 || visaoFiltro === 'BASE') {
      return chamados;
    }
    if (!isSupervisorOrAdmin || visaoFiltro === 'INDIVIDUAL') {
      const nomeAlvo = (tecnicoNome || user?.nomeCompleto || '').trim().toLowerCase();
      if (!nomeAlvo || nomeAlvo.includes('operação') || nomeAlvo.includes('supervisão') || nomeAlvo === 'todas as bases') {
        return chamados;
      }
      return chamados.filter(c => {
        const tec = (c.tecnicoNome || '').trim().toLowerCase();
        return tec === nomeAlvo || tec.includes(nomeAlvo) || nomeAlvo.includes(tec);
      });
    }
    return chamados;
  }, [chamados, isSupervisorOrAdmin, visaoFiltro, tecnicoNome, user, tecnicoId]);

  // Contadores por classificação do escopo atual
  const stats = useMemo(() => {
    const total = chamadosEscopo.length;
    const falhaGestao = chamadosEscopo.filter(c => c.causaPerda?.toUpperCase().includes('FALHA GESTAO')).length;
    const transferenciaBases = chamadosEscopo.filter(c => c.causaPerda?.toUpperCase().includes('TRANSFERENCIA')).length;
    const outros = total - falhaGestao - transferenciaBases;

    return { total, falhaGestao, transferenciaBases, outros };
  }, [chamadosEscopo]);

  // Filtragem e busca em tempo real
  const filteredChamados = useMemo(() => {
    return chamadosEscopo.filter((c) => {
      const matchSearch = 
        c.chamado?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.tecnicoNome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.equipamento?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.projeto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.textoEncerrado?.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (selectedClassificacao === 'TODOS') return true;
      if (selectedClassificacao === 'FALHA_GESTAO') return c.causaPerda?.toUpperCase().includes('FALHA GESTAO');
      if (selectedClassificacao === 'TRANSFERENCIA') return c.causaPerda?.toUpperCase().includes('TRANSFERENCIA');

      return true;
    });
  }, [chamadosEscopo, searchTerm, selectedClassificacao]);

  if (!isOpen) return null;

  const periodoLabel = selectedMonth && selectedMonth !== 'Média Final' ? selectedMonth : 'Campanha Completa';

  return (
    <div className="fixed inset-0 lg:left-64 z-30 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div 
        className="glass-bento border rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="relative px-6 py-5 border-b border-light-border dark:border-border bg-light-background/60 dark:bg-input-bg/60 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                <AlertTriangle size={12} />
                {visaoFiltro === 'INDIVIDUAL' ? 'SUAS PERDAS DE PERFORMANCE' : 'PERDAS DA EQUIPE (BASE COMPLETA)'}
              </span>
              <span className="text-xs text-light-text-muted dark:text-text-muted font-medium">
                • {periodoLabel}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-light-text-main dark:text-text-main flex items-center gap-2">
              Perdas por Falha de Gestão & Transferência entre Bases
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {isSupervisorOrAdmin && (
              <div className="flex items-center bg-light-surface-elevated/80 dark:bg-surface-elevated/80 p-1 rounded-xl border border-light-border dark:border-border">
                <button
                  onClick={() => setVisaoFiltro('INDIVIDUAL')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    visaoFiltro === 'INDIVIDUAL' 
                      ? 'bg-primary text-slate-950 font-bold shadow-md shadow-primary/20' 
                      : 'text-light-text-muted dark:text-text-muted hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover hover:text-light-textHover dark:hover:text-textHover'
                  }`}
                  title="Ver apenas as perdas deste técnico"
                >
                  <UserCheck size={13} />
                  <span>Individual</span>
                </button>
                <button
                  onClick={() => setVisaoFiltro('BASE')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    visaoFiltro === 'BASE' 
                      ? 'bg-primary text-slate-950 font-bold shadow-md shadow-primary/20' 
                      : 'text-light-text-muted dark:text-text-muted hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover hover:text-light-textHover dark:hover:text-textHover'
                  }`}
                  title="Ver todas as perdas da base"
                >
                  <Users size={13} />
                  <span>Base Completa</span>
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-light-text-muted hover:text-light-text-main dark:text-text-muted dark:hover:text-text-main hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover rounded-xl transition-colors cursor-pointer"
              title="Fechar modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* MINI DASHBOARD DE MÉTRICAS NO TOPO */}
        <div className="px-6 py-4 bg-light-background/60 dark:bg-surface-elevated/40 border-b border-light-borderStrong/60 dark:border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-light-surface dark:bg-surface-elevated border border-light-borderStrong/60 dark:border-border rounded-xl p-3 flex flex-col shadow-xs">
            <span className="text-[10px] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider flex items-center justify-between">
              Taxa de Perdas (Equipe)
              <span className="text-[9px] text-light-text-secondary bg-light-surface-elevated dark:bg-input-bg dark:text-text-muted px-1.5 py-0.5 rounded font-semibold border border-light-borderStrong/40 dark:border-border/40">Meta ≤ 1%</span>
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-2xl font-black ${percentualPerdidos <= 1.0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {percentualPerdidos < 1 && percentualPerdidos > 0 
                  ? percentualPerdidos.toFixed(2) 
                  : percentualPerdidos.toFixed(1)}%
              </span>
              <span className="text-[11px] text-light-text-muted dark:text-text-muted font-medium">
                {percentualPerdidos <= 1.0 ? '✓ Dentro da Meta' : '⚠ Acima da Meta'}
              </span>
            </div>
          </div>

          <div 
            onClick={() => setSelectedClassificacao('FALHA_GESTAO')}
            className={`rounded-xl p-3 flex flex-col cursor-pointer transition-all ${
              selectedClassificacao === 'FALHA_GESTAO' 
                ? 'border-2 border-primary bg-primary/10 dark:border-primary/50 shadow-glow-primary-sm' 
                : 'bg-light-surface dark:bg-surface-elevated border border-light-borderStrong/60 dark:border-border hover:border-light-borderStrong dark:hover:border-border-subtle shadow-xs'
            }`}
          >
            <span className="text-[10px] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider">
              Falhas de Gestão
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-light-text-main dark:text-text-main">{stats.falhaGestao}</span>
              <span className="text-[11px] text-light-text-muted dark:text-text-muted">chamados</span>
            </div>
          </div>

          <div 
            onClick={() => setSelectedClassificacao('TRANSFERENCIA')}
            className={`rounded-xl p-3 flex flex-col cursor-pointer transition-all ${
              selectedClassificacao === 'TRANSFERENCIA' 
                ? 'border-2 border-primary bg-primary/10 dark:border-primary/50 shadow-glow-primary-sm' 
                : 'bg-light-surface dark:bg-surface-elevated border border-light-borderStrong/60 dark:border-border hover:border-light-borderStrong dark:hover:border-border-subtle shadow-xs'
            }`}
          >
            <span className="text-[10px] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider">
              Transferência de Bases
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-light-text-main dark:text-text-main">{stats.transferenciaBases}</span>
              <span className="text-[11px] text-light-text-muted dark:text-text-muted">chamados</span>
            </div>
          </div>

          <div 
            onClick={() => setSelectedClassificacao('TODOS')}
            className={`rounded-xl p-3 flex flex-col cursor-pointer transition-all ${
              selectedClassificacao === 'TODOS' 
                ? 'border-2 border-primary bg-primary/10 dark:border-primary/50 shadow-glow-primary-sm' 
                : 'bg-light-surface dark:bg-surface-elevated border border-light-borderStrong/60 dark:border-border hover:border-light-borderStrong dark:hover:border-border-subtle shadow-xs'
            }`}
          >
            <span className="text-[10px] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider">
              Total de Ocorrências
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-light-text-main dark:text-text-main">{stats.total}</span>
              <span className="text-[11px] text-light-text-muted dark:text-text-muted">{visaoFiltro === 'INDIVIDUAL' ? 'do técnico' : 'na base'}</span>
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS E BUSCA */}
        <div className="px-6 py-3 bg-light-background dark:bg-input-bg border-b border-light-borderStrong/60 dark:border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted" />
            <input
              type="text"
              placeholder={isSupervisorOrAdmin ? "Buscar por chamados ou nome do técnico..." : "Buscar por chamado..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs glass-bento border border-light-border/60 dark:border-white/10 rounded-full text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto scrollbar-hide pb-1 sm:pb-0 text-xs">
            <button
              onClick={() => setSelectedClassificacao('TODOS')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedClassificacao === 'TODOS'
                  ? 'bg-primary text-light-surface dark:text-surface shadow-glow-primary-sm'
                  : 'bg-light-surface-elevated hover:bg-light-surface-hover text-light-text-secondary dark:bg-surface-elevated dark:text-text-muted dark:hover:text-text-main dark:hover:bg-surface-hover'
              }`}
            >
              Todos ({stats.total})
            </button>
            <button
              onClick={() => setSelectedClassificacao('FALHA_GESTAO')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedClassificacao === 'FALHA_GESTAO'
                  ? 'bg-primary text-light-surface dark:text-surface shadow-glow-primary-sm'
                  : 'bg-light-surface-elevated hover:bg-light-surface-hover text-light-text-secondary dark:bg-surface-elevated dark:text-text-muted dark:hover:text-text-main dark:hover:bg-surface-hover'
              }`}
            >
              Falha Gestão ({stats.falhaGestao})
            </button>
            <button
              onClick={() => setSelectedClassificacao('TRANSFERENCIA')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedClassificacao === 'TRANSFERENCIA'
                  ? 'bg-primary text-light-surface dark:text-surface shadow-glow-primary-sm'
                  : 'bg-light-surface-elevated hover:bg-light-surface-hover text-light-text-secondary dark:bg-surface-elevated dark:text-text-muted dark:hover:text-text-main dark:hover:bg-surface-hover'
              }`}
            >
              Transferência ({stats.transferenciaBases})
            </button>
          </div>
        </div>

        {/* LISTA DE CHAMADOS DE PERDAS */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-3">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-light-text-muted dark:text-text-muted">Carregando chamados de perdas...</p>
            </div>
          ) : stats.total === 0 ? (
            /* TELA CELEBRATÓRIA: PARABÉNS PELO DESEMPENHO IMPECÁVEL (ZERO PERDAS) */
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center animate-fade-in">
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-emerald-500/20 dark:bg-emerald-500/30 rounded-full blur-2xl animate-pulse pointer-events-none"></div>
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500/20 via-emerald-500/10 to-teal-400/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-500 shadow-xl shadow-emerald-500/20">
                  <Trophy size={40} className="text-emerald-500 dark:text-emerald-400 drop-shadow-md" />
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-3 shadow-xs">
                <Sparkles size={14} className="text-emerald-500 animate-pulse" />
                <span>Desempenho Impecável • 100% de Eficiência em Gestão</span>
              </div>

              <h3 className="text-2xl font-black text-light-text-main dark:text-text-main tracking-tight mb-2">
                Parabéns pelo Excelente Resultado!
              </h3>

              <div className="max-w-lg space-y-2 text-center">
                <p className="text-sm text-light-text-secondary dark:text-text-muted font-medium leading-relaxed">
                  {visaoFiltro === 'INDIVIDUAL' ? (
                    <>
                      O técnico <strong className="text-emerald-600 dark:text-emerald-400">{tecnicoNome}</strong> encerrou todos os seus atendimentos sem <strong className="underline decoration-emerald-500/50">nenhuma perda de SLA</strong> registrada por falha de gestão ou transferência de bases.
                    </>
                  ) : (
                    <>
                      A equipe da base <strong className="text-emerald-600 dark:text-emerald-400">{tecnicoNome}</strong> operou com maestria impecável, registrando <strong className="underline decoration-emerald-500/50">zero perdas operacionais</strong> no período apurado.
                    </>
                  )}
                </p>
                <p className="text-xs text-light-text-muted dark:text-text-muted leading-relaxed">
                  Com <strong>0,0% de perdas</strong> (muito abaixo do teto limite de 1,0%), você assegura a <strong>pontuação máxima de 20,0 pontos</strong> neste indicador oficial do Programa Brilha+. Continue com essa dedicação exemplar!
                </p>
              </div>

              {/* Mini cards de mérito */}
              <div className="grid grid-cols-2 gap-3 mt-6 max-w-md w-full">
                <div className="bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold text-light-text-muted dark:text-text-muted">Pontuação do KPI</span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">20.0 / 20.0 pts</span>
                  <span className="text-[10px] text-light-text-muted dark:text-text-muted">Nota Máxima</span>
                </div>
                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-3 flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold text-light-text-muted dark:text-text-muted">Taxa de Perdas</span>
                  <span className="text-xl font-black text-primary mt-0.5">0.0%</span>
                  <span className="text-[10px] text-light-text-muted dark:text-text-muted">Meta: ≤ 1.0%</span>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-500 dark:text-rose-400 text-xs">
              <p>{error}</p>
            </div>
          ) : filteredChamados.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <Search size={28} className="text-light-text-muted dark:text-text-muted mb-2" />
              <p className="text-sm font-bold text-light-text-main dark:text-text-main">Nenhum chamado encontrado</p>
              <p className="text-xs text-light-text-muted dark:text-text-muted mt-1">Nenhuma ocorrência corresponde ao termo "{searchTerm}".</p>
            </div>
          ) : (
            filteredChamados.map((item) => {
              const isExpanded = expandedChamado === item.chamado;
              const isFalhaGestao = item.causaPerda?.toUpperCase().includes('FALHA GESTAO');

              return (
                <div
                  key={item.chamado}
                  className={`border rounded-xl p-4 transition-all shadow-xs ${
                    isExpanded 
                      ? 'border-primary/50 bg-light-background dark:bg-input-bg' 
                      : 'bg-light-surface dark:bg-surface-elevated/50 border-light-borderStrong/70 dark:border-border/70 hover:border-light-borderStrong dark:hover:border-border'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-lg border shrink-0 mt-0.5 ${
                        isFalhaGestao 
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' 
                          : 'bg-primary/10 border-primary/30 text-primary'
                      }`}>
                        <AlertTriangle size={18} />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-sm font-black text-light-text-main dark:text-text-main">
                            OS #{item.chamado}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isFalhaGestao
                              ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30'
                              : 'bg-primary/10 text-primary border border-primary/30'
                          }`}>
                            {item.causaPerda}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-light-text-muted dark:text-text-muted">
                          <span className="flex items-center gap-1.5">
                            <User size={13} className="text-light-text-muted dark:text-text-muted" />
                            <strong className="text-light-text-main dark:text-text-main">Técnico:</strong> {item.tecnicoNome || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Cpu size={13} className="text-light-text-muted dark:text-text-muted" />
                            <strong className="text-light-text-main dark:text-text-main">Equip:</strong> {item.equipamento || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-light-text-muted dark:text-text-muted" />
                            <strong className="text-light-text-main dark:text-text-main">Data FT:</strong> {item.ft ? new Date(item.ft).toLocaleDateString('pt-BR') : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedChamado(isExpanded ? null : item.chamado)}
                      className="px-3 py-1.5 text-xs font-semibold bg-light-surface-elevated hover:bg-light-surface-hover border-light-borderStrong/60 text-light-text-secondary dark:bg-surface-elevated dark:border-border dark:text-text-muted dark:hover:text-text-main rounded-lg flex items-center gap-1.5 transition-all self-end sm:self-center cursor-pointer border"
                    >
                      <span>{isExpanded ? 'Ocultar Laudo' : 'Ver Laudo Técnico'}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {/* LAUDO TÉCNICO EXPANSÍVEL */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-light-borderStrong/40 dark:border-border/50 text-xs text-light-text-secondary dark:text-text-main bg-light-surface-elevated/80 dark:bg-background/80 p-3 rounded-lg border">
                      <div className="flex items-center gap-1.5 text-primary font-bold mb-1.5">
                        <FileText size={14} />
                        <span>Texto de Encerramento / Laudo Técnico:</span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed text-light-text-secondary dark:text-text-main">
                        {item.textoEncerrado || 'Nenhum detalhamento ou laudo textual foi registrado para este chamado.'}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3.5 bg-light-background/60 dark:bg-input-bg/60 border-t border-light-border dark:border-border flex items-center justify-between text-xs text-light-text-muted dark:text-text-muted">
          <div className="flex items-center gap-1.5">
            <Info size={14} className="text-primary" />
            <span>O indicador de Perdas afeta a pontuação geral da equipe caso ultrapasse a meta de 1.0%.</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-white/10 text-light-text-muted dark:text-text-muted hover:border-light-borderStrong dark:hover:border-white/20 hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover hover:text-light-text-main dark:hover:text-text-main rounded-xl font-semibold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
