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
  return str;
};

// Helper de segmentação por grupo de peça
const categorizarPeca = (item: PecaAplicadaDTO): string => {
  const grupo = (item.grupoMercadoriaDesc || '').toUpperCase();
  const desc = (item.codAplicDesc || item.codSolicDesc || '').toUpperCase();

  if (grupo.includes('PLACA') || desc.includes('PLM') || desc.includes('PLACA')) return 'PLM';
  if (grupo.includes('SSD') || grupo.includes('HARD DISK') || grupo.includes('DISCO') || desc.includes('SSD') || desc.includes('HD')) return 'STORAGE';
  if (grupo.includes('LCD') || grupo.includes('TELA') || desc.includes('LCD') || desc.includes('TELA')) return 'TELA';
  if (grupo.includes('BATER') || desc.includes('BATER') || desc.includes('FONTE') || grupo.includes('FONTE')) return 'ENERGIA';
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
  const [categoriaFiltro, setCategoriaFiltro] = useState<'TODAS' | 'PLM' | 'STORAGE' | 'TELA' | 'ENERGIA' | 'OUTROS'>('TODAS');

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

  // Contadores por categoria
  const contadores = useMemo(() => {
    const counts = { TODAS: pecas.length, PLM: 0, STORAGE: 0, TELA: 0, ENERGIA: 0, OUTROS: 0 };
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* HEADER DO MODAL */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl">
              <Cpu size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {isSupervisorOrAdmin ? 'VISÃO GERENCIAL' : 'KPI INDIVIDUAL'}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  • {formatMesAno(selectedMonth)}
                </span>
                {tecnicoNome && (
                  <span className="text-[11px] font-semibold text-slate-400">
                    • {tecnicoNome}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">
                Detalhamento de Peças Aplicadas
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Fechar Modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* CARDS DE RESUMO KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 sm:p-6 bg-slate-950/40 border-b border-slate-800/80">
          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-slate-400 font-medium uppercase text-[10px] block">Taxa de Consumo</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-black ${percentualConsumo <= 25.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {percentualConsumo.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">Meta: ≤ 25.0%</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-slate-400 font-medium uppercase text-[10px] block">Total de Peças</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-white">
                {pecas.length}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">peças aplicadas</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-slate-400 font-medium uppercase text-[10px] block">Chamados com Peça</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-white">
                {totalChamadosUnicos}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">atendimentos</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-slate-400 font-medium uppercase text-[10px] block">Pontuação do KPI</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-white">
                {pontosPecas.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">pts (peso 12.5%)</span>
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS E BUSCA */}
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input
              type="text"
              placeholder="Buscar por chamado, peça ou laudo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto w-full sm:w-auto overflow-x-auto text-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1 mr-1">
              <Filter size={12} /> Categoria:
            </span>
            <button
              onClick={() => setCategoriaFiltro('TODAS')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                categoriaFiltro === 'TODAS'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              Todas ({contadores.TODAS})
            </button>
            <button
              onClick={() => setCategoriaFiltro('PLM')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                categoriaFiltro === 'PLM'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              Placa Mãe ({contadores.PLM})
            </button>
            <button
              onClick={() => setCategoriaFiltro('STORAGE')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                categoriaFiltro === 'STORAGE'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              SSD / HD ({contadores.STORAGE})
            </button>
            <button
              onClick={() => setCategoriaFiltro('TELA')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                categoriaFiltro === 'TELA'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              Tela / LCD ({contadores.TELA})
            </button>
            <button
              onClick={() => setCategoriaFiltro('ENERGIA')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                categoriaFiltro === 'ENERGIA'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              Bateria / Fonte ({contadores.ENERGIA})
            </button>
          </div>
        </div>

        {/* CONTEÚDO: LISTA DE PEÇAS APLICADAS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400 mb-3"></div>
              <p className="text-sm font-medium">Carregando peças aplicadas...</p>
            </div>
          ) : filteredPecas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-base font-bold text-white">Nenhuma Peça Encontrada</h3>
              <p className="text-xs text-slate-400 max-w-md mt-1">
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
                  className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 sm:p-5 transition-all shadow-md flex flex-col gap-3 group"
                >
                  {/* CABEÇALHO DO ITEM: OS, DATA, AÇÃO E GRUPO */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">OS:</span>
                        <strong className="text-xs font-mono font-bold text-slate-200">#{item.chamado || 'N/D'}</strong>
                      </div>

                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-500" />
                        <span>Atendimento: {formatDateTime(item.ft)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {item.grupoMercadoriaDesc && (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {item.grupoMercadoriaDesc}
                        </span>
                      )}
                      {item.acao && (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {item.acao}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* GRID DE INFORMAÇÕES DETALHADAS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    
                    {/* COLUNA 1: PEÇAS (APLICADA vs SOLICITADA) */}
                    <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/60 space-y-2.5 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                          <span className="flex items-center gap-1 font-bold text-slate-300">
                            <Cpu size={13} className="text-cyan-400" />
                            Peça Aplicada em Campo
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-500 font-medium block text-[10px] uppercase">Descrição da Peça Aplicada</span>
                          <strong className="text-cyan-300 font-semibold text-xs block mt-0.5">
                            {item.codAplicDesc || 'Peça aplicada não especificada'}
                          </strong>
                        </div>

                        {item.codSolicDesc && item.codSolicDesc !== item.codAplicDesc && (
                          <div className="pt-2 border-t border-slate-800/60">
                            <span className="text-slate-500 font-medium block text-[10px] uppercase">Peça Solicitada Originalmente</span>
                            <span className="text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                              <Package size={12} className="text-slate-500 shrink-0" />
                              <span className="truncate">{item.codSolicDesc}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* TÉCNICO EXECUTOR */}
                      <div className="pt-2 border-t border-slate-800/60">
                        <span className="text-slate-500 font-medium block text-[10px] uppercase">Técnico Executor</span>
                        <span className="text-slate-200 font-semibold flex items-center gap-1 mt-0.5">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">{item.tecnicoNome || 'Não informado'}</span>
                        </span>
                      </div>
                    </div>

                    {/* COLUNA 2: CONTEXTO DO CHAMADO & LAUDO */}
                    <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/60 space-y-2.5 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                          <span className="flex items-center gap-1 font-bold text-slate-300">
                            <FileText size={13} className="text-slate-400" />
                            Contexto do Atendimento
                          </span>
                          {item.assistenciaCidade && (
                            <span className="font-semibold text-slate-400 flex items-center gap-1 text-[10px]">
                              <Building2 size={11} className="text-slate-500" />
                              {item.assistenciaCidade}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-slate-500 font-medium block text-[10px] uppercase">Equipamento</span>
                            <span className="text-slate-200 font-semibold flex items-center gap-1 mt-0.5">
                              <Wrench size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate">{item.tipoEquipamento || 'Não especificado'}</span>
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-500 font-medium block text-[10px] uppercase">Projeto</span>
                            <span className="text-slate-200 font-semibold flex items-center gap-1 mt-0.5">
                              <Layers size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate">{item.projeto || 'Corporativo'}</span>
                            </span>
                          </div>
                        </div>

                        {/* LAUDO TÉCNICO */}
                        <div>
                          <span className="text-slate-500 font-medium block text-[10px] uppercase">Laudo Técnico / Encerramento</span>
                          {item.textoEncerrado ? (
                            <div className="text-[11px] text-slate-300 bg-slate-950/90 p-2.5 rounded-lg border border-slate-800/80 mt-1 max-h-24 overflow-y-auto pr-1.5 leading-relaxed font-mono select-text">
                              {item.textoEncerrado}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 italic bg-slate-950/40 p-2 rounded-lg border border-slate-800/50 mt-1">
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
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Mostrando <strong className="text-slate-200">{filteredPecas.length}</strong> de <strong className="text-slate-200">{pecas.length}</strong> peças aplicadas
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
