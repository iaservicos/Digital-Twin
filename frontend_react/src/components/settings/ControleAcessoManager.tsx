import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { 
  Users, 
  Activity, 
  Clock, 
  ShieldCheck, 
  Search, 
  RefreshCw, 
  Laptop, 
  Smartphone, 
  Tablet, 
  Globe, 
  Calendar, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  AlertTriangle,
  ChevronDown,
  Check
} from 'lucide-react';
import { BentoCard } from '../ui/BentoCard';
import { Button } from '../ui/Button';

interface SessaoItem {
  idSessao: string;
  matricula: string;
  nomeCompleto: string;
  cargo: string;
  role: string;
  ipAddress: string;
  dispositivo: string;
  navegador: string;
  loginAt: string | null;
  ultimoPingAt: string | null;
  logoutAt: string | null;
  duracaoSegundos: number;
  status: string;
  statusRaw: string;
}

interface AuditoriaResponse {
  kpis: {
    usuariosOnlineAgora: number;
    totalAcessos: number;
    usuariosUnicos: number;
    tempoMedioSegundos: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  sessoes: SessaoItem[];
}

export default function ControleAcessoManager() {
  const { user } = useAuthStore();
  const isModerador = user?.role === 'MODERADOR' || user?.cargo === 'Moderador';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AuditoriaResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('TODOS');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [periodoFiltro, setPeriodoFiltro] = useState<'HOJE' | '7DIAS' | 'MES' | 'TODOS'>('HOJE');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  const statusOptions = [
    { value: 'TODOS', label: 'Todos os Status', dot: 'bg-primary' },
    { value: 'ONLINE', label: 'Apenas Online', dot: 'bg-emerald-400 animate-pulse' },
    { value: 'ENCERRADA', label: 'Finalizadas', dot: 'bg-slate-400' },
    { value: 'EXPIRADA', label: 'Expiradas / Inativas', dot: 'bg-amber-400' },
  ];

  // Carrega os dados de auditoria
  const fetchAuditoria = async () => {
    try {
      setLoading(true);

      let dataInicio: string | undefined;
      const hoje = new Date();
      if (periodoFiltro === 'HOJE') {
        dataInicio = hoje.toISOString().split('T')[0];
      } else if (periodoFiltro === '7DIAS') {
        const d7 = new Date();
        d7.setDate(d7.getDate() - 7);
        dataInicio = d7.toISOString().split('T')[0];
      } else if (periodoFiltro === 'MES') {
        const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataInicio = primeiroDia.toISOString().split('T')[0];
      }

      const params: any = {
        page: currentPage,
        pageSize: PAGE_SIZE,
        statusFiltro: statusFiltro !== 'TODOS' ? statusFiltro : undefined,
        busca: searchTerm.trim() || undefined,
        dataInicio
      };

      const response = await api.get('/auditoria/sessoes', { params });
      setData(response.data);
    } catch (err: any) {
      console.error('Erro ao buscar auditoria de sessões:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isModerador) {
      fetchAuditoria();
    }
  }, [currentPage, statusFiltro, periodoFiltro, isModerador]);

  // Debounce para a busca
  useEffect(() => {
    const handler = setTimeout(() => {
      setCurrentPage(1);
      if (isModerador) {
        fetchAuditoria();
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const formatSeconds = (totalSec: number) => {
    if (!totalSec || totalSec <= 0) return '0s';
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatDateTimeBR = (isoStr?: string | null) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  if (!isModerador) {
    return (
      <BentoCard className="p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
          <AlertTriangle size={24} />
        </div>
        <h3 className="text-base font-bold text-light-text-main dark:text-text-main">Acesso Restrito</h3>
        <p className="text-xs text-light-text-muted dark:text-text-muted max-w-md mx-auto">
          O painel de auditoria e controle de acessos é reservado exclusivamente para o perfil de Moderador do sistema.
        </p>
      </BentoCard>
    );
  }

  const kpis = data?.kpis || {
    usuariosOnlineAgora: 0,
    totalAcessos: 0,
    usuariosUnicos: 0,
    tempoMedioSegundos: 0
  };

  const totalPages = data?.pagination?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* 4 BENTO CARDS DE MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Online Agora */}
        <BentoCard className="p-5 flex items-center gap-4 border-emerald-500/20 bg-emerald-500/5">
          <div className="relative p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <Activity size={22} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Online Agora</span>
            <div className="text-2xl font-black text-light-text-main dark:text-text-main mt-0.5 tracking-tight">
              {kpis.usuariosOnlineAgora}
            </div>
            <p className="text-[10px] text-light-text-muted dark:text-text-muted">Usuários ativos em tempo real</p>
          </div>
        </BentoCard>

        {/* Card 2: Total de Acessos */}
        <BentoCard className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Users size={22} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Acessos no Período</span>
            <div className="text-2xl font-black text-light-text-main dark:text-text-main mt-0.5 tracking-tight">
              {kpis.totalAcessos}
            </div>
            <p className="text-[10px] text-light-text-muted dark:text-text-muted">Sessões registradas no histórico</p>
          </div>
        </BentoCard>

        {/* Card 3: Tempo Médio de Sessão */}
        <BentoCard className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-500 border border-sky-500/20 shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">Tempo Médio Conectado</span>
            <div className="text-2xl font-black text-light-text-main dark:text-text-main mt-0.5 tracking-tight">
              {formatSeconds(kpis.tempoMedioSegundos)}
            </div>
            <p className="text-[10px] text-light-text-muted dark:text-text-muted">Permanência média por sessão</p>
          </div>
        </BentoCard>

        {/* Card 4: Usuários Únicos */}
        <BentoCard className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500 border border-purple-500/20 shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Colaboradores Distintos</span>
            <div className="text-2xl font-black text-light-text-main dark:text-text-main mt-0.5 tracking-tight">
              {kpis.usuariosUnicos}
            </div>
            <p className="text-[10px] text-light-text-muted dark:text-text-muted">Usuários que acessaram o sistema</p>
          </div>
        </BentoCard>
      </div>

      {/* PAINEL PRINCIPAL DE CONTROLE E TABELA */}
      <BentoCard className="p-6 space-y-6">
        {/* Cabeçalho com Filtros */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-light-border dark:border-border">
          <div>
            <h3 className="text-lg font-bold text-light-text-main dark:text-text-main tracking-tight flex items-center gap-2">
              <ShieldCheck className="text-primary" size={20} />
              Controle de Acessos & Sessões
            </h3>
            <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5">
              Auditoria em tempo real de quem acessou o sistema, por quanto tempo e através de qual dispositivo
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Seletor de Período */}
            <div className="flex items-center bg-light-surface/60 dark:bg-surface-elevated/40 p-1 rounded-full border border-light-border dark:border-white/10 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPeriodoFiltro('HOJE')}
                className={`px-3 py-1.5 rounded-full transition-all ${
                  periodoFiltro === 'HOJE'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main'
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setPeriodoFiltro('7DIAS')}
                className={`px-3 py-1.5 rounded-full transition-all ${
                  periodoFiltro === '7DIAS'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main'
                }`}
              >
                7 Dias
              </button>
              <button
                type="button"
                onClick={() => setPeriodoFiltro('MES')}
                className={`px-3 py-1.5 rounded-full transition-all ${
                  periodoFiltro === 'MES'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main'
                }`}
              >
                Mês
              </button>
              <button
                type="button"
                onClick={() => setPeriodoFiltro('TODOS')}
                className={`px-3 py-1.5 rounded-full transition-all ${
                  periodoFiltro === 'TODOS'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main'
                }`}
              >
                Todos
              </button>
            </div>

            {/* Filtro de Status Customizado Bento */}
            <div className="relative">
              {isStatusDropdownOpen && (
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsStatusDropdownOpen(false)} 
                />
              )}

              <button
                type="button"
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className="flex items-center gap-2.5 bg-light-surface/80 dark:bg-surface-elevated/60 border border-light-border dark:border-white/10 text-light-text-main dark:text-text-main text-xs font-semibold rounded-full px-4 py-2 hover:border-primary/60 focus:outline-none transition-all cursor-pointer shadow-sm min-w-[165px] justify-between select-none"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${statusOptions.find(o => o.value === statusFiltro)?.dot || 'bg-primary'}`} />
                  <span>{statusOptions.find(o => o.value === statusFiltro)?.label || 'Todos os Status'}</span>
                </div>
                <ChevronDown 
                  size={14} 
                  className={`text-light-text-muted dark:text-text-muted transition-transform duration-200 ${
                    isStatusDropdownOpen ? 'rotate-180 text-primary' : ''
                  }`} 
                />
              </button>

              {isStatusDropdownOpen && (
                <div className="absolute left-0 mt-2 z-50 min-w-[205px] bg-light-surface/95 dark:bg-surface/95 border border-light-borderStrong dark:border-white/15 rounded-2xl p-1.5 shadow-2xl backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 slide-in-from-top-2 duration-150 space-y-1">
                  {statusOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setStatusFiltro(opt.value);
                        setCurrentPage(1);
                        setIsStatusDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs transition-all cursor-pointer ${
                        statusFiltro === opt.value
                          ? 'bg-primary/20 text-primary font-bold shadow-xs'
                          : 'text-light-text-main dark:text-text-main hover:bg-light-surface-elevated dark:hover:bg-white/10 hover:text-primary'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
                        <span>{opt.label}</span>
                      </div>
                      {statusFiltro === opt.value && <Check size={14} className="text-primary shrink-0 ml-2" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Busca textual */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted pointer-events-none" size={14} />
              <input
                type="text"
                placeholder="Buscar colaborador..."
                className="w-full glass-bento border border-light-border/60 dark:border-white/10 text-light-text-main dark:text-text-main text-xs font-semibold rounded-full pl-9 pr-4 py-2 focus:outline-none focus:border-primary/60"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={fetchAuditoria}
              disabled={loading}
              icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
              className="shrink-0"
            >
              Atualizar
            </Button>
          </div>
        </div>

        {/* TABELA DE SESSÕES */}
        <div className="overflow-x-auto scrollbar-hide rounded-2xl border border-light-border dark:border-white/10">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead className="bg-light-surface/60 dark:bg-surface-elevated/40 text-light-text-muted dark:text-text-muted text-[11px] uppercase font-semibold border-b border-light-border dark:border-white/10">
              <tr>
                <th className="px-4 py-3.5">Colaborador</th>
                <th className="px-4 py-3.5">Cargo / Perfil</th>
                <th className="px-4 py-3.5">Início do Acesso</th>
                <th className="px-4 py-3.5">Último Sinal / Saída</th>
                <th className="px-4 py-3.5 text-center">Tempo Conectado</th>
                <th className="px-4 py-3.5">Dispositivo & Rede</th>
                <th className="px-4 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-light-text-muted dark:text-text-muted">
                    <Loader2 className="animate-spin mx-auto mb-2 text-primary" size={24} />
                    Carregando sessões de acesso...
                  </td>
                </tr>
              ) : !data?.sessoes || data.sessoes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-light-text-muted dark:text-text-muted">
                    Nenhum registro de acesso encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                data.sessoes.map((s) => {
                  const isOnline = s.status === 'Online';
                  const initials = s.nomeCompleto
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr key={s.idSessao} className="hover:bg-primary/5 transition-colors">
                      {/* Colaborador */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary/20 to-primary/40 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-light-text-main dark:text-text-main flex items-center gap-1.5">
                              {s.nomeCompleto}
                            </div>
                            <span className="text-[10px] text-light-text-muted dark:text-text-muted font-mono">
                              Matrícula: {s.matricula}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Cargo / Perfil */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-light-text-secondary dark:text-text-secondary">
                          {s.cargo}
                        </div>
                        <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-0.5 border ${
                          s.role === 'MODERADOR'
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                            : s.role === 'ADMINISTRADOR'
                            ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        }`}>
                          {s.role}
                        </span>
                      </td>

                      {/* Início */}
                      <td className="px-4 py-3 text-light-text-secondary dark:text-text-secondary font-mono text-[11px]">
                        {formatDateTimeBR(s.loginAt)}
                      </td>

                      {/* Fim / Último Sinal */}
                      <td className="px-4 py-3 text-light-text-secondary dark:text-text-secondary font-mono text-[11px]">
                        {s.logoutAt ? formatDateTimeBR(s.logoutAt) : formatDateTimeBR(s.ultimoPingAt)}
                      </td>

                      {/* Tempo Conectado */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                          <Clock size={12} />
                          {formatSeconds(s.duracaoSegundos)}
                        </span>
                      </td>

                      {/* Dispositivo / Navegador / IP */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-light-text-main dark:text-text-main font-medium">
                          {s.dispositivo === 'Mobile' ? (
                            <Smartphone size={14} className="text-primary" />
                          ) : s.dispositivo === 'Tablet' ? (
                            <Tablet size={14} className="text-primary" />
                          ) : (
                            <Laptop size={14} className="text-primary" />
                          )}
                          <span>{s.navegador}</span>
                        </div>
                        <span className="text-[10px] text-light-text-muted dark:text-text-muted font-mono block">
                          IP: {s.ipAddress}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                            Online
                          </span>
                        ) : s.status === 'Finalizada' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-light-surface dark:bg-surface-elevated text-light-text-muted dark:text-text-muted border border-light-border dark:border-white/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-light-text-muted dark:bg-text-muted" />
                            Finalizada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                            Inativa
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINAÇÃO */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-light-text-muted dark:text-text-muted">
              Página {currentPage} de {totalPages} ({data?.pagination?.totalItems || 0} registros)
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                icon={<ChevronLeft size={16} />}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
                icon={<ChevronRight size={16} />}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </BentoCard>
    </div>
  );
}
