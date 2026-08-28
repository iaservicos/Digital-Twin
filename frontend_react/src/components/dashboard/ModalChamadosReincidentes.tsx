import React, { useState, useEffect } from 'react';
import { 
  X, AlertTriangle, CheckCircle2, Clock, Calendar, 
  Search, Cpu, ArrowRight, UserCheck, Wrench, ShieldAlert, Sparkles, Filter
} from 'lucide-react';
import { api } from '../../services/api';

export interface ChamadoReincidenteDTO {
  chamadoAnterior: string;
  chamadoRrc: string;
  ftAnterior?: string | null;
  ftRrc?: string | null;
  diasEntreAtendimentos?: number | null;
  tecnicoNomeAnterior?: string | null;
  tecnicoNomeRrc?: string | null;
  ctAnterior?: string | null;
  ctRrc?: string | null;
  projetoAnterior?: string | null;
  projetoRrc?: string | null;
  defeitoAnterior?: string | null;
  ocorrenciaChamadoAnterior?: string | null;
  textoEncerradoAnterior?: string | null;
  aplicadoPecaAnterior?: string | null;
}

interface ModalChamadosReincidentesProps {
  isOpen: boolean;
  onClose: () => void;
  tecnicoId?: number;
  tecnicoNome?: string;
  selectedMonth?: string;
  percentualReincidencia?: number;
  pontosReincidencia?: number;
}

const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return 'N/D';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function ModalChamadosReincidentes({
  isOpen,
  onClose,
  tecnicoId,
  tecnicoNome,
  selectedMonth,
  percentualReincidencia = 0,
  pontosReincidencia = 0
}: ModalChamadosReincidentesProps) {
  const [reincidentes, setReincidentes] = useState<ChamadoReincidenteDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWithParts, setFilterWithParts] = useState<'all' | 'with_parts' | 'without_parts'>('all');

  useEffect(() => {
    if (!isOpen || !tecnicoId) return;

    const fetchReincidentes = async () => {
      setLoading(true);
      try {
        let url = `/dashboard/tecnico/${tecnicoId}/reincidentes`;
        if (selectedMonth && selectedMonth !== 'Campanha Inteira' && selectedMonth !== 'Média Final') {
          url += `?mesAno=${encodeURIComponent(selectedMonth)}`;
        }
        const res = await api.get(url);
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
  }, [isOpen, tecnicoId, selectedMonth]);

  if (!isOpen) return null;

  // Filtros
  const filteredList = reincidentes.filter(item => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch = 
      !term ||
      (item.chamadoAnterior && item.chamadoAnterior.toLowerCase().includes(term)) ||
      (item.chamadoRrc && item.chamadoRrc.toLowerCase().includes(term)) ||
      (item.defeitoAnterior && item.defeitoAnterior.toLowerCase().includes(term)) ||
      (item.ocorrenciaChamadoAnterior && item.ocorrenciaChamadoAnterior.toLowerCase().includes(term)) ||
      (item.tecnicoNomeRrc && item.tecnicoNomeRrc.toLowerCase().includes(term)) ||
      (item.textoEncerradoAnterior && item.textoEncerradoAnterior.toLowerCase().includes(term));

    if (!matchSearch) return false;

    if (filterWithParts === 'with_parts') {
      return item.aplicadoPecaAnterior && item.aplicadoPecaAnterior.toUpperCase() !== 'NÃO' && item.aplicadoPecaAnterior.toUpperCase() !== 'SEM PEÇA';
    }
    if (filterWithParts === 'without_parts') {
      return !item.aplicadoPecaAnterior || item.aplicadoPecaAnterior.toUpperCase() === 'NÃO' || item.aplicadoPecaAnterior.toUpperCase() === 'SEM PEÇA';
    }
    return true;
  });

  // Médias e estatísticas
  const totalReinc = reincidentes.length;
  const mediaDias = totalReinc > 0
    ? Math.round(reincidentes.reduce((acc, r) => acc + (r.diasEntreAtendimentos || 0), 0) / totalReinc)
    : 0;

  const isDentroMeta = percentualReincidencia <= 7.0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="relative p-6 bg-gradient-to-r from-pink-950/40 via-slate-900 to-slate-900 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-pink-500/20 text-pink-400 border border-pink-500/30 rounded-2xl shadow-lg shadow-pink-500/10">
              <ShieldAlert size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest bg-pink-500/20 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-full">
                  KPI Individual
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {tecnicoNome || 'Técnico'}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight mt-0.5">
                Detalhamento de Chamados Reincidentes
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* STATS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-950/60 border-b border-slate-800 text-xs">
          <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800/80 flex flex-col items-center text-center">
            <span className="text-slate-400 font-medium uppercase text-[10px]">Taxa Reincidência</span>
            <span className={`text-xl font-black mt-0.5 ${isDentroMeta ? 'text-emerald-400' : 'text-pink-400'}`}>
              {percentualReincidencia.toFixed(1)}%
            </span>
            <span className="text-[10px] text-slate-500">Meta: ≤ 7.0%</span>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800/80 flex flex-col items-center text-center">
            <span className="text-slate-400 font-medium uppercase text-[10px]">Total Reincidentes</span>
            <span className="text-xl font-black text-white mt-0.5">
              {totalReinc}
            </span>
            <span className="text-[10px] text-slate-500">no período selecionado</span>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800/80 flex flex-col items-center text-center">
            <span className="text-slate-400 font-medium uppercase text-[10px]">Pontuação Obtida</span>
            <span className={`text-xl font-black mt-0.5 ${pontosReincidencia > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {pontosReincidencia.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ 15 pts</span>
            </span>
            <span className="text-[10px] text-slate-500">{pontosReincidencia >= 15 ? 'Meta Máxima' : pontosReincidencia >= 10 ? 'Meta Parcial' : 'Fora da Meta'}</span>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800/80 flex flex-col items-center text-center">
            <span className="text-slate-400 font-medium uppercase text-[10px]">Tempo Médio Retorno</span>
            <span className="text-xl font-black text-amber-400 mt-0.5">
              {mediaDias > 0 ? `${mediaDias} dias` : '—'}
            </span>
            <span className="text-[10px] text-slate-500">até reabertura RRC</span>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Buscar por chamado, defeito ou laudo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-500 hover:text-white text-xs"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Filter size={14} className="text-slate-400" />
            <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-[11px]">
              <button
                onClick={() => setFilterWithParts('all')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${filterWithParts === 'all' ? 'bg-pink-500/20 text-pink-300' : 'text-slate-400 hover:text-white'}`}
              >
                Todos ({reincidentes.length})
              </button>
              <button
                onClick={() => setFilterWithParts('with_parts')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${filterWithParts === 'with_parts' ? 'bg-pink-500/20 text-pink-300' : 'text-slate-400 hover:text-white'}`}
              >
                Com Peça
              </button>
              <button
                onClick={() => setFilterWithParts('without_parts')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${filterWithParts === 'without_parts' ? 'bg-pink-500/20 text-pink-300' : 'text-slate-400 hover:text-white'}`}
              >
                Sem Peça
              </button>
            </div>
          </div>
        </div>

        {/* LIST CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-10 h-10 border-3 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
              <p className="text-xs text-slate-400 font-medium">Carregando histórico de reincidências...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-base font-bold text-white">Nenhuma Reincidência Encontrada</h3>
              <p className="text-xs text-slate-400 max-w-md">
                {reincidentes.length === 0 
                  ? "Excelente performance! O técnico não possui chamados reincidentes registrados neste período."
                  : "Nenhum chamado corresponde aos filtros de busca aplicados."}
              </p>
            </div>
          ) : (
            filteredList.map((item, idx) => {
              const dias = item.diasEntreAtendimentos;
              const isRapido = dias !== null && dias !== undefined && dias <= 7;

              return (
                <div 
                  key={idx}
                  className="bg-slate-950/70 border border-slate-800/80 hover:border-pink-500/40 rounded-2xl p-4 transition-all space-y-3 group shadow-md"
                >
                  {/* CARD HEADER: COMPARATIVO DE NÚMERO DE CHAMADOS */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/60">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-xl border border-slate-700/60">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">1º Atendimento:</span>
                        <strong className="text-xs font-mono text-pink-300">#{item.chamadoAnterior || 'N/D'}</strong>
                      </div>

                      <ArrowRight size={14} className="text-slate-500 hidden sm:block" />

                      <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-xl border border-slate-700/60">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Reabertura RRC:</span>
                        <strong className="text-xs font-mono text-rose-400">#{item.chamadoRrc || 'N/D'}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {dias !== null && dias !== undefined && (
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border ${
                          isRapido 
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse' 
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          <Clock size={12} />
                          Reaberto em {dias} {dias === 1 ? 'dia' : 'dias'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* GRID COMPARATIVO DE DATAS E TÉCNICOS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* COLUNA 1: PRIMEIRO ATENDIMENTO */}
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 font-semibold text-slate-300">
                          <Calendar size={13} className="text-pink-400" />
                          Data: {formatDate(item.ftAnterior)}
                        </span>
                        <span>CT: {item.ctAnterior || '—'}</span>
                      </div>

                      {/* DEFEITO E OCORRÊNCIA APONTADA */}
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Falha / Defeito Apontado:</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                          <span className="font-semibold text-amber-300">
                            {item.defeitoAnterior || item.ocorrenciaChamadoAnterior || 'Defeito não detalhado'}
                          </span>
                        </div>
                      </div>

                      {/* LAUDO / TEXTO ENCERRADO */}
                      {item.textoEncerradoAnterior && (
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold">Laudo do 1º Atendimento:</span>
                          <p className="text-[11px] text-slate-300 bg-slate-950/80 p-2 rounded-lg border border-slate-850 mt-0.5 line-clamp-3 leading-relaxed">
                            {item.textoEncerradoAnterior}
                          </p>
                        </div>
                      )}

                      {/* PEÇA APLICADA */}
                      <div className="flex items-center gap-1 text-[11px]">
                        <Cpu size={12} className="text-slate-400" />
                        <span className="text-slate-400">Peça Aplicada:</span>
                        <strong className="text-slate-200">{item.aplicadoPecaAnterior || 'Não / Sem Peça'}</strong>
                      </div>
                    </div>

                    {/* COLUNA 2: REABERTURA (RRC) */}
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 font-semibold text-slate-300">
                          <Calendar size={13} className="text-rose-400" />
                          Reaberto em: {formatDate(item.ftRrc)}
                        </span>
                        <span>CT: {item.ctRrc || '—'}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Técnico que Atendeu a Reincidência:</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <UserCheck size={14} className="text-emerald-400 shrink-0" />
                          <span className="font-semibold text-slate-200">
                            {item.tecnicoNomeRrc || 'Não informado'}
                          </span>
                        </div>
                      </div>

                      {item.projetoRrc && (
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold">Projeto / Contrato:</span>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            {item.projetoRrc}
                          </p>
                        </div>
                      )}

                      <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-[11px] text-rose-300/90 leading-relaxed mt-2">
                        💡 <strong>Ação Recomendada:</strong> Revisar os procedimentos de teste pós-reparo e o diagnóstico inicial de defeito para evitar reaberturas no mesmo componente.
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
          <span>Mostrando {filteredList.length} de {reincidentes.length} chamados reincidentes</span>
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
