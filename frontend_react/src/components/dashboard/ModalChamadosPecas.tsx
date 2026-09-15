import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Search, 
  Cpu, 
  Package, 
  Layers, 
  Calendar, 
  User, 
  Building2, 
  CheckCircle2, 
  Filter, 
  Clock,
  Wrench,
  FileText
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export interface PecaAplicadaDTO {
  chamado: string;
  ft: string;
  tipoEquipamento: string;
  acao: string;
  codSolicDesc: string;
  codAplicDesc: string;
  subgrupo?: string;
  grupoMercadoria: string;
  grupoMercadoriaDesc: string;
  tecnicoNome: string;
  projeto: string;
  assistenciaCidade: string;
  ocorrenciaChamado: string;
  textoEncerrado: string;
}

interface ModalChamadosPecasProps {
  isOpen: boolean;
  onClose: () => void;
  tecnicoId?: number | null;
  tecnicoNome?: string;
  selectedMonth?: string;
  percentualConsumo?: number;
  pontosPecas?: number;
}

// Helper de formatação de data e hora no padrão 'DD/MM/AAAA HH:mm'
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

// Helper de formatação de mês/ano
const formatMesAno = (mesAnoStr?: string | null): string => {
  if (!mesAnoStr) return 'Campanha Completa';
  const str = mesAnoStr.trim();
  if (str === '2026-07' || str.toLowerCase().includes('jul')) return 'Julho / 2026';
  if (str === '2026-08' || str.toLowerCase().includes('ago')) return 'Agosto / 2026';
  if (str === '2026-09' || str.toLowerCase().includes('set')) return 'Setembro / 2026';
  return str;
};

// Helper de segmentação por grupo de peça elegível da campanha
const categorizarPeca = (item: PecaAplicadaDTO): string => {
  const sub = (item.subgrupo || '').toUpperCase();
  const desc = (item.codAplicDesc || item.codSolicDesc || '').toUpperCase();
  const grupo = (item.grupoMercadoriaDesc || '').toUpperCase();

  if (sub.includes('PLACA') || sub.includes('PLM') || desc.includes('PLM') || desc.includes('PLACA') || grupo.includes('PLACA')) return 'PLM';
  if (sub.includes('SSD') || sub.includes('HD') || desc.includes('SSD') || desc.includes('HD') || desc.includes('HARD DISK') || grupo.includes('SSD') || grupo.includes('HARD DISK')) return 'STORAGE';
  if (sub.includes('LCD') || sub.includes('TELA') || desc.includes('LCD') || desc.includes('TELA') || grupo.includes('LCD') || grupo.includes('TELA')) return 'TELA';
  return 'OUTROS';
};

export default function ModalChamadosPecas({
  isOpen,
  onClose,
  tecnicoId,
  tecnicoNome = 'Técnico',
  selectedMonth,
  percentualConsumo = 0,
  pontosPecas = 12.5
}: ModalChamadosPecasProps) {
  const user = useAuthStore(state => state.user);
  const role = (user?.role || '').toUpperCase();
  const isSupervisorOrAdmin = ['SUPERVISOR', 'MODERADOR', 'ADMIN', 'ROLE_SUPERVISOR', 'ROLE_MODERADOR', 'ROLE_ADMIN'].includes(role);

  const [pecas, setPecas] = useState<PecaAplicadaDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<'TODAS' | 'PLM' | 'STORAGE' | 'TELA'>('TODAS');

  const targetId = tecnicoId || (user as any)?.idTecnico || (user as any)?.id || (user as any)?.tecnicoId;

  useEffect(() => {
    if (!isOpen) return;

    const fetchPecas = async () => {
      try {
        setLoading(true);
        const params: Record<string, string> = {};
        if (selectedMonth && selectedMonth !== 'Campanha Inteira' && selectedMonth !== 'Média Final') {
          params.mesAno = selectedMonth;
        }

        const idParaBuscar = targetId || 0;
        const res = await api.get(`/dashboard/tecnico/${idParaBuscar}/pecas`, { params });
        if (Array.isArray(res.data)) {
          setPecas(res.data);
        } else {
          setPecas([]);
        }
      } catch (err) {
        console.error('Erro ao buscar detalhamento de peças aplicadas:', err);
        setPecas([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPecas();
  }, [isOpen, targetId, selectedMonth]);

  // Contadores por categoria elegível
  const contadores = useMemo(() => {
    const counts = { TODAS: pecas.length, PLM: 0, STORAGE: 0, TELA: 0 };
    pecas.forEach(p => {
      const cat = categorizarPeca(p);
      if (cat in counts) {
        counts[cat as keyof typeof counts]++;
      }
    });
    return counts;
  }, [pecas]);

  // Total de chamados únicos com aplicação de peça
  const totalChamadosUnicos = useMemo(() => {
    return new Set(pecas.map(p => p.chamado)).size;
  }, [pecas]);

  // Filtragem
  const filteredPecas = useMemo(() => {
    return pecas.filter(item => {
      const matchSearch =
        (item.chamado && item.chamado.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.subgrupo && item.subgrupo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.codAplicDesc && item.codAplicDesc.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.codSolicDesc && item.codSolicDesc.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.tecnicoNome && item.tecnicoNome.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.grupoMercadoriaDesc && item.grupoMercadoriaDesc.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.acao && item.acao.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.projeto && item.projeto.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.textoEncerrado && item.textoEncerrado.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchSearch) return false;

      if (categoriaFiltro === 'TODAS') return true;
      return categorizarPeca(item) === categoriaFiltro;
    });
  }, [pecas, searchTerm, categoriaFiltro]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        
        {/* HEADER DO MODAL */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 rounded-xl">
              <Cpu size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  {isSupervisorOrAdmin && !tecnicoNome ? 'VISÃO GERENCIAL' : 'KPI INDIVIDUAL'}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  • {formatMesAno(selectedMonth)}
                </span>
                {tecnicoNome && (
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    • {tecnicoNome}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Detalhamento de Peças Aplicadas
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Fechar Modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* BANNER INFORMATIVO DE ELEGIBILIDADE DA CAMPANHA */}
        <div className="bg-cyan-50 dark:bg-cyan-500/10 border-b border-cyan-100 dark:border-cyan-500/20 px-6 py-2.5 flex items-center gap-2 text-xs text-cyan-800 dark:text-cyan-300">
          <Layers size={15} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
          <span>
            <strong>Peças Elegíveis da Campanha:</strong> Exibindo exclusivamente chamados com aplicação de <strong>Placa Mãe</strong>, <strong>SSD</strong>, <strong>HD/HDD</strong> e <strong>Tela LCD</strong> (meta: ≤ 25.0%).
          </span>
        </div>

        {/* CARDS DE RESUMO KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/80">
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium uppercase text-[10px] block">Taxa de Consumo</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-black ${percentualConsumo <= 25.0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {percentualConsumo.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">Meta: ≤ 25.0%</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium uppercase text-[10px] block">Total de Peças</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-slate-900 dark:text-white">
                {pecas.length}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">peças aplicadas</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium uppercase text-[10px] block">Chamados com Peça</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-slate-900 dark:text-white">
                {totalChamadosUnicos}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">atendimentos</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium uppercase text-[10px] block">Pontuação do KPI</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-slate-900 dark:text-white">
                {pontosPecas.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">pts (peso 12.5%)</span>
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS E BUSCA */}
        <div className="p-4 bg-slate-50/70 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={15} />
            <input
              type="text"
              placeholder="Buscar por chamado, peça ou laudo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-colors shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto w-full sm:w-auto overflow-x-auto text-xs">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-500 uppercase flex items-center gap-1 mr-1">
              <Filter size={12} /> Categoria:
            </span>
            <button
              onClick={() => setCategoriaFiltro('TODAS')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                categoriaFiltro === 'TODAS'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Todas ({contadores.TODAS})
            </button>
            <button
              onClick={() => setCategoriaFiltro('PLM')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                categoriaFiltro === 'PLM'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Placa Mãe ({contadores.PLM})
            </button>
            <button
              onClick={() => setCategoriaFiltro('STORAGE')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                categoriaFiltro === 'STORAGE'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              SSD / HD ({contadores.STORAGE})
            </button>
            <button
              onClick={() => setCategoriaFiltro('TELA')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                categoriaFiltro === 'TELA'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Tela / LCD ({contadores.TELA})
            </button>
          </div>
        </div>

        {/* CONTEÚDO: LISTA DE PEÇAS APLICADAS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500 mb-3"></div>
              <p className="text-sm font-medium">Carregando peças aplicadas...</p>
            </div>
          ) : filteredPecas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Nenhuma Peça Encontrada</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
                {searchTerm || categoriaFiltro !== 'TODAS'
                  ? 'Nenhuma peça corresponde aos filtros selecionados. Tente limpar os filtros.'
                  : 'Nenhum registro de aplicação de peça encontrado para o período selecionado.'}
              </p>
            </div>
          ) : (
            filteredPecas.map((item, idx) => {
              return (
                <div 
                  key={`${item.chamado}-${idx}`}
                  className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-4 sm:p-5 transition-all shadow-xs flex flex-col gap-3 group"
                >
                  {/* CABEÇALHO DO ITEM: OS, DATA, AÇÃO E GRUPO */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">OS:</span>
                        <strong className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">#{item.chamado || 'N/D'}</strong>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-400 dark:text-slate-500" />
                        <span>Atendimento: {formatDateTime(item.ft)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {item.grupoMercadoriaDesc && (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                          {item.grupoMercadoriaDesc}
                        </span>
                      )}
                      {item.acao && (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20">
                          {item.acao}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* GRID DE INFORMAÇÕES DETALHADAS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    
                    {/* COLUNA 1: PEÇAS (APLICADA vs SOLICITADA) */}
                    <div className="bg-slate-50/70 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/60 space-y-2.5 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-800 pb-2">
                          <span className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                            <Cpu size={13} className="text-cyan-600 dark:text-cyan-400" />
                            Peça Aplicada em Campo
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-500 dark:text-slate-500 font-medium block text-[10px] uppercase">Descrição da Peça Aplicada</span>
                          {item.subgrupo && (
                            <div className="mt-1 mb-1">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-100 text-cyan-800 border border-cyan-200 dark:bg-cyan-950/80 dark:text-cyan-300 dark:border-cyan-800/60 inline-block">
                                Subgrupo: {item.subgrupo}
                              </span>
                            </div>
                          )}
                          <strong className="text-cyan-700 dark:text-cyan-300 font-semibold text-xs block mt-0.5">
                            {item.codAplicDesc || 'Peça aplicada não especificada'}
                          </strong>
                        </div>

                        {item.codSolicDesc && item.codSolicDesc !== item.codAplicDesc && (
                          <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/60">
                            <span className="text-slate-500 dark:text-slate-500 font-medium block text-[10px] uppercase">Peça Solicitada Originalmente</span>
                            <span className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                              <Package size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                              <span className="truncate">{item.codSolicDesc}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* TÉCNICO EXECUTOR */}
                      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/60">
                        <span className="text-slate-500 dark:text-slate-500 font-medium block text-[10px] uppercase">Técnico Executor</span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1 mt-0.5">
                          <User size={13} className="text-slate-400 dark:text-slate-400 shrink-0" />
                          <span className="truncate">{item.tecnicoNome || 'Não informado'}</span>
                        </span>
                      </div>
                    </div>

                    {/* COLUNA 2: CONTEXTO DO CHAMADO & LAUDO */}
                    <div className="bg-slate-50/70 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/60 space-y-2.5 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-800 pb-2">
                          <span className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                            <FileText size={13} className="text-slate-500 dark:text-slate-400" />
                            Contexto do Atendimento
                          </span>
                          {item.assistenciaCidade && (
                            <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[10px]">
                              <Building2 size={11} className="text-slate-400 dark:text-slate-500" />
                              {item.assistenciaCidade}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-slate-500 dark:text-slate-500 font-medium block text-[10px] uppercase">Equipamento</span>
                            <span className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1 mt-0.5">
                              <Wrench size={12} className="text-slate-400 dark:text-slate-400 shrink-0" />
                              <span className="truncate">{item.tipoEquipamento || 'Não especificado'}</span>
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-500 dark:text-slate-500 font-medium block text-[10px] uppercase">Projeto</span>
                            <span className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1 mt-0.5">
                              <Layers size={12} className="text-slate-400 dark:text-slate-400 shrink-0" />
                              <span className="truncate">{item.projeto || 'Corporativo'}</span>
                            </span>
                          </div>
                        </div>

                        {/* LAUDO TÉCNICO */}
                        <div>
                          <span className="text-slate-500 dark:text-slate-500 font-medium block text-[10px] uppercase">Laudo Técnico / Encerramento</span>
                          {item.textoEncerrado ? (
                            <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-950/90 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/80 mt-1 max-h-24 overflow-y-auto pr-1.5 leading-relaxed font-mono select-text">
                              {item.textoEncerrado}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 italic bg-slate-100/50 dark:bg-slate-950/40 p-2 rounded-lg border border-slate-200/50 dark:border-slate-800/50 mt-1">
                              Texto de encerramento não registrado.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER DO MODAL */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <span>
            Mostrando <strong className="text-slate-900 dark:text-slate-200">{filteredPecas.length}</strong> de <strong className="text-slate-900 dark:text-slate-200">{pecas.length}</strong> peças aplicadas
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
