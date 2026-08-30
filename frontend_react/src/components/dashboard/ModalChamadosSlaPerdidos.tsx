import React, { useEffect, useState, useMemo } from 'react';
import { 
  X, Search, AlertTriangle, Clock, Wrench, Building2, User, 
  FileText, CheckCircle2, Filter, Sparkles, Layers, ArrowRight, ShieldAlert, Package
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export interface ChamadoSlaPerdido {
  chamado: string;
  dataFt: string;
  tecnicoNome: string;
  ctCodigo: string;
  assistenciaNome: string;
  equipamento: string;
  projeto: string;
  slaStatus: string;
  causaPerda: string;
  textoEncerramento: string;
}

interface ModalChamadosSlaPerdidosProps {
  isOpen: boolean;
  onClose: () => void;
  tecnicoId: number | null;
  tecnicoNome: string;
  selectedMonth: string;
  percentualSla: number;
  pontosSla: number;
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

  const matchParen = nome.match(/\(([^)]+)\)/);
  if (matchParen && matchParen[1]) {
    const rawCity = matchParen[1].trim();
    return rawCity.charAt(0).toUpperCase() + rawCity.slice(1).toLowerCase();
  }

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

export const ModalChamadosSlaPerdidos: React.FC<ModalChamadosSlaPerdidosProps> = ({
  isOpen,
  onClose,
  tecnicoId,
  tecnicoNome,
  selectedMonth,
  percentualSla,
  pontosSla
}) => {
  const [chamados, setChamados] = useState<ChamadoSlaPerdido[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCausa, setSelectedCausa] = useState<string>('TODOS');
  const { user } = useAuthStore();
  const isSupervisorOrAdmin = user?.role === 'SUPERVISOR' || user?.role === 'MODERADOR' || user?.role === 'ADMINISTRADOR' || user?.cargo === 'Administrador' || user?.cargo === 'Super Administrador';

  useEffect(() => {
    if (!isOpen || !tecnicoId) return;

    let isMounted = true;
    const fetchChamadosSla = async () => {
      try {
        setLoading(true);
        let url = `/dashboard/tecnico/${tecnicoId}/sla-perdidos`;
        if (selectedMonth && selectedMonth !== 'Campanha Inteira' && selectedMonth !== 'Média Final') {
          url += `?mesAno=${encodeURIComponent(selectedMonth)}`;
        }
        const res = await api.get(url);
        if (isMounted && res.data) {
          setChamados(res.data);
        }
      } catch (err) {
        console.error('Erro ao buscar chamados perdidos de SLA:', err);
        if (isMounted) setChamados([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchChamadosSla();

    return () => {
      isMounted = false;
    };
  }, [isOpen, tecnicoId, selectedMonth]);

  // Lista de causas distintas para os filtros
  const causasDisponiveis = useMemo(() => {
    const setCausas = new Set<string>();
    chamados.forEach(c => {
      if (c.causaPerda) setCausas.add(c.causaPerda);
    });
    return Array.from(setCausas);
  }, [chamados]);

  // Filtragem
  const filteredChamados = useMemo(() => {
    return chamados.filter(item => {
      const matchCausa = selectedCausa === 'TODOS' || item.causaPerda === selectedCausa;
      if (!matchCausa) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();

      return (
        item.chamado?.toLowerCase().includes(term) ||
        item.tecnicoNome?.toLowerCase().includes(term) ||
        item.equipamento?.toLowerCase().includes(term) ||
        item.projeto?.toLowerCase().includes(term) ||
        item.causaPerda?.toLowerCase().includes(term) ||
        item.assistenciaNome?.toLowerCase().includes(term) ||
        item.textoEncerramento?.toLowerCase().includes(term)
      );
    });
  }, [chamados, searchTerm, selectedCausa]);

  if (!isOpen) return null;

  const periodoLabel = (!selectedMonth || selectedMonth === 'Campanha Inteira' || selectedMonth === 'Média Final')
    ? 'Campanha Inteira (Ciclo Completo)'
    : `Mês de ${selectedMonth}`;

  const getCausaBadgeStyle = (causa: string) => {
    const c = (causa || '').toUpperCase();
    if (c.includes('PEÇA') || c.includes('PECA')) {
      return {
        bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        icon: <Package size={14} className="text-amber-400" />
      };
    }
    if (c.includes('GESTAO') || c.includes('GESTÃO')) {
      return {
        bg: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
        icon: <ShieldAlert size={14} className="text-purple-400" />
      };
    }
    if (c.includes('TRANSFERENCIA') || c.includes('TRANSFERÊNCIA')) {
      return {
        bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
        icon: <ArrowRight size={14} className="text-blue-400" />
      };
    }
    return {
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
      icon: <Clock size={14} className="text-rose-400" />
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 relative">
        
        {/* Top Header */}
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-cyan-950/20 to-slate-900">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1"><Clock size={12} /> SLA</span>
              <span className="text-xs text-slate-400 font-medium">
                • {periodoLabel}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">Chamados encerrados fora do SLA</h2>
            
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer self-end sm:self-center"
            title="Fechar Modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mini-Dashboard de Estatísticas de SLA */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-6 bg-slate-950/50 border-b border-slate-800/80">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Atingimento SLA</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-2xl font-black ${percentualSla >= 90 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {percentualSla.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-500 font-semibold">/ Meta ≥ 90%</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Chamados Perdidos</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-rose-400">
                {chamados.length}
              </span>
              <span className="text-xs text-slate-500 font-semibold">ocorrências</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Pontuação do KPI</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-cyan-400">
                {pontosSla.toFixed(1)}
              </span>
              <span className="text-xs text-slate-500 font-semibold">/ 15.0 pts</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-center">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Status da Base</span>
            {percentualSla >= 90 ? (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={14} /> Meta Atingida
              </span>
            ) : (
              <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                <AlertTriangle size={14} /> Abaixo da Meta
              </span>
            )}
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="p-4 sm:p-6 pb-2 border-b border-slate-800/80 flex flex-col gap-3 bg-slate-900/40">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Input de Busca */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={isSupervisorOrAdmin ? "Buscar por chamados ou nome do técnico..." : "Buscar por chamado..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Filtros em Pílulas por Causa da Perda */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide text-xs">
            <span className="text-slate-400 font-semibold flex items-center gap-1 whitespace-nowrap mr-1">
              <Filter size={12} /> Causas:
            </span>
            <button
              onClick={() => setSelectedCausa('TODOS')}
              className={`px-3 py-1 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCausa === 'TODOS'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              Todas ({chamados.length})
            </button>
            {causasDisponiveis.map((causa) => {
              const count = chamados.filter(c => c.causaPerda === causa).length;
              const isSel = selectedCausa === causa;
              return (
                <button
                  key={causa}
                  onClick={() => setSelectedCausa(causa)}
                  className={`px-3 py-1 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isSel
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {causa} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Conteúdo: Lista de Chamados Perdidos */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400 mb-3"></div>
              <p className="text-sm font-medium">Carregando chamados perdidos de SLA...</p>
            </div>
          ) : filteredChamados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-white">Nenhum Chamado Perdido Encontrado</h3>
              <p className="text-sm text-slate-400 max-w-md mt-1">
                {searchTerm || selectedCausa !== 'TODOS'
                  ? 'Nenhum chamado corresponde aos filtros selecionados. Tente limpar os filtros de busca.'
                  : 'Parabéns! Todos os chamados foram finalizados dentro do prazo estipulado de SLA no período selecionado.'}
              </p>
            </div>
          ) : (
            filteredChamados.map((item, index) => {
              const causaStyle = getCausaBadgeStyle(item.causaPerda);
              return (
                <div
                  key={`${item.chamado}-${index}`}
                  className="bg-slate-950/80 border border-slate-800/90 hover:border-cyan-500/40 rounded-xl p-4 sm:p-5 transition-all shadow-md flex flex-col gap-3 group"
                >
                  {/* Linha Superior: Número do Chamado + Badge da Causa */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-black text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-800/40">
                        #{item.chamado}
                      </span>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-500" />
                        <span>Encerramento: {formatDateTime(item.dataFt)}</span>
                      </div>
                    </div>

                    <div className={`px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 w-fit ${causaStyle.bg}`}>
                      {causaStyle.icon}
                      <span>Causa: {item.causaPerda}</span>
                    </div>
                  </div>

                  {/* Informações Centrais: Técnico, Equipamento, Projeto e Base */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs py-1">
                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/50">
                      <span className="text-slate-500 font-medium block">Técnico</span>
                      <span className="text-slate-200 font-bold flex items-center gap-1 mt-0.5">
                        <User size={13} className="text-cyan-400 shrink-0" />
                        <span className="truncate">{item.tecnicoNome || 'Não informado'}</span>
                      </span>
                    </div>

                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/50">
                      <span className="text-slate-500 font-medium block">Equipamento / Modelo</span>
                      <span className="text-slate-200 font-bold flex items-center gap-1 mt-0.5">
                        <Wrench size={13} className="text-amber-400 shrink-0" />
                        <span className="truncate">{item.equipamento || 'Equipamento padrão'}</span>
                      </span>
                    </div>

                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/50">
                      <span className="text-slate-500 font-medium block">Projeto</span>
                      <span className="text-slate-200 font-bold flex items-center gap-1 mt-0.5">
                        <Layers size={13} className="text-indigo-400 shrink-0" />
                        <span className="truncate">{formatProjeto(item.projeto)}</span>
                      </span>
                    </div>

                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/50">
                      <span className="text-slate-500 font-medium block">Base ATP</span>
                      <span className="text-slate-200 font-bold flex items-center gap-1 mt-0.5">
                        <Building2 size={13} className="text-emerald-400 shrink-0" />
                        <span className="truncate">{formatCidadeBase(item.assistenciaNome, item.ctCodigo)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Laudo Técnico / Texto de Encerramento */}
                  {item.textoEncerramento && (
                    <div className="mt-1 bg-slate-900/90 border border-slate-800 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-1.5">
                        <FileText size={13} className="text-cyan-400" />
                        <span>Laudo Técnico & Detalhes de Encerramento:</span>
                      </div>
                      <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed font-mono bg-slate-950/60 p-2.5 rounded border border-slate-800/60 max-h-36 overflow-y-auto">
                        {item.textoEncerramento}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 bg-slate-950">
          <span>Total exibido: <strong className="text-slate-300">{filteredChamados.length}</strong> de <strong className="text-slate-300">{chamados.length}</strong> chamados fora do SLA</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};

export default ModalChamadosSlaPerdidos;
