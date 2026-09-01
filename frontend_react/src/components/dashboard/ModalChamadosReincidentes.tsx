import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  RotateCcw, 
  Calendar, 
  User, 
  UserCheck, 
  Layers, 
  AlertTriangle, 
  Cpu, 
  Clock, 
  ArrowRight,
  Filter,
  Search,
  CheckCircle2,
  Building2
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export interface ChamadoReincidenteDTO {
  chamadoAnterior: string;
  chamadoRrc: string;
  ftAnterior?: string;
  ftRrc?: string;
  diasEntreAtendimentos?: number;
  tecnicoNomeAnterior?: string;
  tecnicoNomeRrc?: string;
  ctAnterior?: string;
  ctRrc?: string;
  projetoAnterior?: string;
  projetoRrc?: string;
  defeitoAnterior?: string;
  ocorrenciaChamadoAnterior?: string;
  textoEncerradoAnterior?: string;
  aplicadoPecaAnterior?: string;
  defeitoRrc?: string;
  ocorrenciaChamadoRrc?: string;
  textoEncerradoRrc?: string;
  aplicadoPecaRrc?: string;
  pecaNomeAnterior?: string;
  pecaNomeRrc?: string;
}

interface ModalChamadosReincidentesProps {
  isOpen: boolean;
  onClose: () => void;
  tecnicoId?: number;
  tecnicoNome?: string;
  mesAno?: string;
  selectedMonth?: string;
  taxaReincidencia?: number;
  percentualReincidencia?: number;
  pontosReincidencia?: number;
}

const formatCidadeBase = (cidade?: string, ct?: string): string => {
  if (cidade && cidade.trim() !== '' && cidade.trim() !== '-') {
    return cidade.trim();
  }
  if (!ct || ct.trim() === '' || ct.trim() === '-') return 'Base Geral';
  const clean = ct.replace(/^CT\s*-\s*/i, '').trim();
  if (clean.length <= 4) return `Base ${clean.toUpperCase()}`;
  return clean;
};

const formatProjeto = (proj?: string): string => {
  if (!proj || proj.trim() === '' || proj.trim() === '-') return 'Corporativo';
  const p = proj.toUpperCase().trim();
  if (p.includes('GOV') || p.includes('GOVERNO') || p.startsWith('H3-')) {
    return 'Governo';
  }
  return 'Corporativo';
};

const formatDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return 'Não informada';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Não informada';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return 'Não informada';
  }
};

const formatMesAno = (mesAnoStr?: string) => {
  if (!mesAnoStr) return 'Campanha Ativa';
  const s = mesAnoStr.toLowerCase().trim();
  if (s.includes('jul') || s.includes('2026-07') || s === '7') return 'Julho';
  if (s.includes('ago') || s.includes('2026-08') || s === '8') return 'Agosto';
  if (s.includes('set') || s.includes('2026-09') || s === '9') return 'Setembro';
  if (s.includes('campanha') || s.includes('media') || s.includes('média')) return 'Campanha';
  return mesAnoStr.charAt(0).toUpperCase() + mesAnoStr.slice(1);
};

export default function ModalChamadosReincidentes({
  isOpen,
  onClose,
  tecnicoId,
  tecnicoNome,
  mesAno,
  selectedMonth,
  taxaReincidencia,
  percentualReincidencia,
  pontosReincidencia = 0
}: ModalChamadosReincidentesProps) {
  const user = useAuthStore(state => state.user);
  const role = (user?.role || '').toUpperCase();
  const isSupervisorOrAdmin = ['SUPERVISOR', 'MODERADOR', 'ADMIN', 'ROLE_SUPERVISOR', 'ROLE_MODERADOR', 'ROLE_ADMIN'].includes(role);

  const mesFiltroAtivo = mesAno || selectedMonth;
  const taxaFinal = taxaReincidencia ?? percentualReincidencia ?? 0;

  const [reincidentes, setReincidentes] = useState<ChamadoReincidenteDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroPeca, setFiltroPeca] = useState<'TODOS' | 'COM_PECA' | 'SEM_PECA'>('TODOS');

  const targetId = tecnicoId || (user as any)?.idTecnico || (user as any)?.id || (user as any)?.tecnicoId;

  useEffect(() => {
    if (!isOpen) return;

    const fetchReincidentes = async () => {
      try {
        setLoading(true);
        const params: Record<string, string> = {};
        if (mesFiltroAtivo) params.mesAno = mesFiltroAtivo;

        const idParaBuscar = targetId || 0;
        const res = await api.get(`/dashboard/tecnico/${idParaBuscar}/reincidentes`, { params });
        if (Array.isArray(res.data)) {
          setReincidentes(res.data);
        } else {
          setReincidentes([]);
        }
      } catch (err) {
        console.error('Erro ao buscar chamados reincidentes:', err);
        setReincidentes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReincidentes();
  }, [isOpen, targetId, mesFiltroAtivo]);

  // Filtros de busca e tipo de peça
  const filteredList = useMemo(() => {
    return reincidentes.filter(item => {
      const matchSearch = 
        (item.chamadoAnterior && item.chamadoAnterior.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.chamadoRrc && item.chamadoRrc.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.tecnicoNomeAnterior && item.tecnicoNomeAnterior.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.tecnicoNomeRrc && item.tecnicoNomeRrc.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.defeitoAnterior && item.defeitoAnterior.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.ocorrenciaChamadoAnterior && item.ocorrenciaChamadoAnterior.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.defeitoRrc && item.defeitoRrc.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.ocorrenciaChamadoRrc && item.ocorrenciaChamadoRrc.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchSearch) return false;

      if (filtroPeca === 'COM_PECA') {
        const pecaAnt = (item.aplicadoPecaAnterior || '').toUpperCase();
        const pecaRrc = (item.aplicadoPecaRrc || '').toUpperCase();
        return pecaAnt.includes('SIM') || pecaAnt.includes('S') || pecaAnt.includes('TROCA') ||
               pecaRrc.includes('SIM') || pecaRrc.includes('S') || pecaRrc.includes('TROCA');
      }
      if (filtroPeca === 'SEM_PECA') {
        const pecaAnt = (item.aplicadoPecaAnterior || '').toUpperCase();
        const pecaRrc = (item.aplicadoPecaRrc || '').toUpperCase();
        const temPecaAnt = pecaAnt.includes('SIM') || pecaAnt.includes('S') || pecaAnt.includes('TROCA');
        const temPecaRrc = pecaRrc.includes('SIM') || pecaRrc.includes('S') || pecaRrc.includes('TROCA');
        return !temPecaAnt && !temPecaRrc;
      }

      return true;
    });
  }, [reincidentes, searchTerm, filtroPeca]);

  // Contagens para os botões de filtro
  const totalComPeca = useMemo(() => {
    return reincidentes.filter(item => {
      const pecaAnt = (item.aplicadoPecaAnterior || '').toUpperCase();
      const pecaRrc = (item.aplicadoPecaRrc || '').toUpperCase();
      return pecaAnt.includes('SIM') || pecaAnt.includes('S') || pecaAnt.includes('TROCA') ||
             pecaRrc.includes('SIM') || pecaRrc.includes('S') || pecaRrc.includes('TROCA');
    }).length;
  }, [reincidentes]);

  const totalSemPeca = reincidentes.length - totalComPeca;

  // Tempo médio de retorno até reabertura
  const tempoMedioDias = useMemo(() => {
    if (reincidentes.length === 0) return null;
    const soma = reincidentes.reduce((acc, r) => acc + (r.diasEntreAtendimentos || 0), 0);
    return Math.round(soma / reincidentes.length);
  }, [reincidentes]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* HEADER DO MODAL - PADRONIZADO COM TAILWIND & IDENTIDADE BRILHA+ */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl">
              <RotateCcw size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {isSupervisorOrAdmin ? 'VISÃO GERENCIAL' : 'KPI INDIVIDUAL'}
                </span>
                {mesFiltroAtivo && (
                  <span className="text-[11px] font-semibold text-slate-400">
                    • {formatMesAno(mesFiltroAtivo)}
                  </span>
                )}
                {tecnicoNome && (
                  <span className="text-[11px] font-semibold text-slate-400">
                    • {tecnicoNome}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">
                Detalhamento de Chamados Reincidentes
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* CARDS DE RESUMO KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 sm:p-6 bg-slate-950/40 border-b border-slate-800/80">
          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-slate-400 font-medium uppercase text-[10px] block">Taxa Reincidência</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-black ${taxaFinal <= 7.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {taxaFinal.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">Meta: ≤ 7.0%</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-slate-400 font-medium uppercase text-[10px] block">Total Reincidentes</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-white">
                {reincidentes.length}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">chamados</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-slate-400 font-medium uppercase text-[10px] block">Pontuação</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-white">
                {pontosReincidencia.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">pts (peso 30%)</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-slate-400 font-medium uppercase text-[10px] block">Tempo Médio</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-white">
                {tempoMedioDias !== null ? `${tempoMedioDias} dias` : '—'}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">até reabertura</span>
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS E BUSCA */}
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input
              type="text"
              placeholder="Buscar por chamado, técnico ou defeito..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto w-full sm:w-auto overflow-x-auto text-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1 mr-1">
              <Filter size={12} />
              Peça:
            </span>
            <button
              onClick={() => setFiltroPeca('TODOS')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                filtroPeca === 'TODOS'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              Todos ({reincidentes.length})
            </button>
            <button
              onClick={() => setFiltroPeca('COM_PECA')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                filtroPeca === 'COM_PECA'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              Com Peça ({totalComPeca})
            </button>
            <button
              onClick={() => setFiltroPeca('SEM_PECA')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                filtroPeca === 'SEM_PECA'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              Sem Peça ({totalSemPeca})
            </button>
          </div>
        </div>

        {/* CONTEÚDO: LISTA DE CHAMADOS REINCIDENTES */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400 mb-3"></div>
              <p className="text-sm font-medium">Carregando chamados reincidentes...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-base font-bold text-white">Nenhuma Reincidência Encontrada</h3>
              <p className="text-xs text-slate-400 max-w-md mt-1">
                {searchTerm || filtroPeca !== 'TODOS'
                  ? 'Nenhum chamado reincidente corresponde aos filtros selecionados. Tente limpar os filtros.'
                  : isSupervisorOrAdmin
                    ? 'Nenhuma reincidência foi registrada para esta base/equipe no período selecionado.'
                    : 'Excelente performance! Você não possui chamados reincidentes registrados sob sua responsabilidade neste período.'}
              </p>
            </div>
          ) : (
            filteredList.map((item, idx) => {
              const dias = item.diasEntreAtendimentos;
              const isRapido = dias !== null && dias !== undefined && dias <= 7;

              return (
                <div 
                  key={`${item.chamadoAnterior}-${item.chamadoRrc}-${idx}`}
                  className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 sm:p-5 transition-all shadow-md flex flex-col gap-3 group"
                >
                  {/* CARD HEADER: COMPARATIVO DE NÚMERO DE CHAMADOS */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">1º Atendimento:</span>
                        <strong className="text-xs font-mono font-bold text-slate-200">#{item.chamadoAnterior || 'N/D'}</strong>
                      </div>

                      <ArrowRight size={14} className="text-slate-600 hidden sm:block" />

                      <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Reabertura RRC:</span>
                        <strong className="text-xs font-mono font-bold text-slate-200">#{item.chamadoRrc || 'N/D'}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {dias !== null && dias !== undefined && (
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 border ${
                          isRapido 
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' 
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          <Clock size={12} className="text-slate-400" />
                          Reaberto em {dias} {dias === 1 ? 'dia' : 'dias'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* GRID COMPARATIVO: PRIMEIRO ATENDIMENTO vs REABERTURA (RRC) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    
                    {/* COLUNA 1: PRIMEIRO ATENDIMENTO */}
                    <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/70 space-y-2.5 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                          <span className="flex items-center gap-1 font-bold text-slate-300">
                            <Calendar size={13} className="text-slate-400" />
                            Primeiro Atendimento: {formatDateTime(item.ftAnterior)}
                          </span>
                          {item.ctAnterior && (
                            <span className="font-semibold text-slate-400 flex items-center gap-1 text-[10px]">
                              <Building2 size={11} className="text-slate-500" />
                              {formatCidadeBase(item.ctAnterior, item.ctAnterior)}
                            </span>
                          )}
                        </div>

                        {/* TÉCNICO DO 1º ATENDIMENTO */}
                        <div>
                          <span className="text-slate-500 font-medium block text-[10px] uppercase">Técnico (1º Atendimento)</span>
                          <span className="text-slate-200 font-semibold flex items-center gap-1 mt-0.5">
                            <User size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate">{item.tecnicoNomeAnterior || 'Não informado'}</span>
                          </span>
                        </div>

                        {/* PROJETO */}
                        <div>
                          <span className="text-slate-500 font-medium block text-[10px] uppercase">Projeto</span>
                          <span className="text-slate-200 font-semibold flex items-center gap-1 mt-0.5">
                            <Layers size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate">{formatProjeto(item.projetoAnterior)}</span>
                          </span>
                        </div>

                        {/* DEFEITO E OCORRÊNCIA APONTADA */}
                        <div>
                          <span className="text-slate-500 font-medium block text-[10px] uppercase">Falha / Defeito Apontado</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <AlertTriangle size={13} className="text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-200">
                              {item.defeitoAnterior || item.ocorrenciaChamadoAnterior || 'Defeito não detalhado'}
                            </span>
                          </div>
                        </div>

                        {/* ENCERRAMENTO (1º ATENDIMENTO) COM BARRA DE ROLAGEM */}
                        <div>
                          <span className="text-slate-500 font-medium block text-[10px] uppercase">Encerramento (1º Atendimento)</span>
                          {item.textoEncerradoAnterior ? (
                            <div className="text-[11px] text-slate-300 bg-slate-950/90 p-2.5 rounded-lg border border-slate-800/80 mt-1 max-h-28 overflow-y-auto pr-1.5 leading-relaxed font-mono select-text">
                              {item.textoEncerradoAnterior}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 italic bg-slate-950/40 p-2 rounded-lg border border-slate-800/50 mt-1">
                              Texto de encerramento não registrado.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* PEÇA APLICADA (1º ATENDIMENTO) */}
                      <div className="flex items-start gap-1.5 text-[11px] pt-2 border-t border-slate-800/60">
                        <Cpu size={13} className={item.pecaNomeAnterior && item.pecaNomeAnterior !== 'Nenhuma peça aplicada' ? "text-cyan-400 mt-0.5 shrink-0" : "text-slate-500 mt-0.5 shrink-0"} />
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[10px] uppercase font-bold">Peça Aplicada (1º Atendimento):</span>
                          <strong className={item.pecaNomeAnterior && item.pecaNomeAnterior !== 'Nenhuma peça aplicada' ? "text-cyan-300 font-semibold" : "text-slate-500 font-normal"}>
                            {item.pecaNomeAnterior || (item.aplicadoPecaAnterior === 'Sim' ? 'Sim (Peça Aplicada)' : 'Nenhuma peça aplicada')}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* COLUNA 2: REABERTURA (RRC) */}
                    <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/70 space-y-2.5 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                          <span className="flex items-center gap-1 font-bold text-slate-300">
                            <Calendar size={13} className="text-slate-400" />
                            Reabertura (RRC): {formatDateTime(item.ftRrc)}
                          </span>
                          {item.ctRrc && (
                            <span className="font-semibold text-slate-400 flex items-center gap-1 text-[10px]">
                              <Building2 size={11} className="text-slate-500" />
                              {formatCidadeBase(item.ctRrc, item.ctRrc)}
                            </span>
                          )}
                        </div>

                        {/* TÉCNICO QUE ATENDEU A REINCIDÊNCIA */}
                        <div>
                          <span className="text-slate-500 font-medium block text-[10px] uppercase">Técnico (Reabertura)</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <UserCheck size={13} className="text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-200">
                              {item.tecnicoNomeRrc || 'Não informado'}
                            </span>
                          </div>
                        </div>

                        {/* PROJETO */}
                        <div>
                          <span className="text-slate-500 font-medium block text-[10px] uppercase">Projeto</span>
                          <span className="text-slate-200 font-semibold flex items-center gap-1 mt-0.5">
                            <Layers size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate">{formatProjeto(item.projetoRrc || item.projetoAnterior)}</span>
                          </span>
                        </div>

                        {/* FALHA / DEFEITO APONTADO NO 2º CHAMADO */}
                        <div>
                          <span className="text-slate-500 font-medium block text-[10px] uppercase">Falha / Defeito Apontado (2º Chamado)</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <AlertTriangle size={13} className="text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-200">
                              {item.defeitoRrc || item.ocorrenciaChamadoRrc || 'Defeito não detalhado'}
                            </span>
                          </div>
                        </div>

                        {/* ENCERRAMENTO (REABERTURA RRC) COM BARRA DE ROLAGEM */}
                        <div>
                          <span className="text-slate-500 font-medium block text-[10px] uppercase">Encerramento (Reabertura RRC)</span>
                          {item.textoEncerradoRrc ? (
                            <div className="text-[11px] text-slate-300 bg-slate-950/90 p-2.5 rounded-lg border border-slate-800/80 mt-1 max-h-28 overflow-y-auto pr-1.5 leading-relaxed font-mono select-text">
                              {item.textoEncerradoRrc}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 italic bg-slate-950/40 p-2 rounded-lg border border-slate-800/50 mt-1">
                              Texto de encerramento não registrado.
                            </div>
                          )}
                        </div>

                        {/* PEÇA APLICADA NO 2º ATENDIMENTO */}
                        <div className="flex items-start gap-1.5 text-[11px] pt-2 border-t border-slate-800/60">
                          <Cpu size={13} className={item.pecaNomeRrc && item.pecaNomeRrc !== 'Nenhuma peça aplicada' ? "text-cyan-400 mt-0.5 shrink-0" : "text-slate-500 mt-0.5 shrink-0"} />
                          <div className="flex flex-col">
                            <span className="text-slate-400 text-[10px] uppercase font-bold">Peça Aplicada (2º Chamado):</span>
                            <strong className={item.pecaNomeRrc && item.pecaNomeRrc !== 'Nenhuma peça aplicada' ? "text-cyan-300 font-semibold" : "text-slate-500 font-normal"}>
                              {item.pecaNomeRrc || (item.aplicadoPecaRrc === 'Sim' ? 'Sim (Peça Aplicada)' : 'Nenhuma peça aplicada')}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* BOX DE ANÁLISE DE REINCIDÊNCIA */}
                      <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-[11px] text-slate-300 leading-relaxed mt-2">
                        💡 <strong className="text-slate-200">Análise de Reincidência:</strong> Falha reincidente dentro do intervalo de 30 dias. Revisar diagnósticos e conferência de testes pós-reparo para assegurar a resolução definitiva na primeira visita.
                      </div>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Mostrando <strong className="text-slate-200">{filteredList.length}</strong> de <strong className="text-slate-200">{reincidentes.length}</strong> chamados reincidentes
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
