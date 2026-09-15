import React, { useEffect, useState, useMemo } from 'react';
import { 
  X, Search, AlertTriangle, Building2, UserX, 
  MapPin, CheckCircle2, XCircle, Filter, ArrowRight, ShieldAlert, Layers
} from 'lucide-react';
import { api } from '../../services/api';

export interface RegiaoSemTecnico {
  uf: string;
  atpNome: string;
  ctCodigo: string;
  totalChamados: number;
  dentroSla: number;
  foraSla: number;
  percSla: number;
}

export interface ChamadoSemTecnicoItem {
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

interface ChamadosSemTecnicoData {
  totalGeral: number;
  totalBasesAfetadas: number;
  regioes: RegiaoSemTecnico[];
  chamados: ChamadoSemTecnicoItem[];
}

interface ModalChamadosSemTecnicoProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth?: string;
  idSupervisor?: number | string;
}

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

export const ModalChamadosSemTecnico: React.FC<ModalChamadosSemTecnicoProps> = ({
  isOpen,
  onClose,
  selectedMonth,
  idSupervisor
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ChamadosSemTecnicoData | null>(null);
  const [activeTab, setActiveTab] = useState<'regioes' | 'extrato'>('regioes');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUf, setSelectedUf] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setLoading(true);

    const params: Record<string, any> = {};
    if (selectedMonth && selectedMonth !== 'Campanha Inteira') {
      params.mesAno = selectedMonth;
    }
    if (idSupervisor && idSupervisor !== 'all') {
      params.idSupervisor = idSupervisor;
    }

    api.get('/dashboard/chamados-sem-tecnico', { params })
      .then(resp => {
        if (mounted && resp.data) {
          setData(resp.data);
        }
      })
      .catch(err => {
        console.error('Erro ao buscar chamados sem técnico:', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, selectedMonth, idSupervisor]);

  // Lista de UFs únicas para o filtro
  const ufsDisponiveis = useMemo(() => {
    if (!data?.regioes) return [];
    const set = new Set(data.regioes.map(r => r.uf).filter(Boolean));
    return Array.from(set).sort();
  }, [data?.regioes]);

  // Regiões filtradas
  const regioesFiltradas = useMemo(() => {
    if (!data?.regioes) return [];
    return data.regioes.filter(r => {
      const matchUf = selectedUf === 'all' || r.uf === selectedUf;
      const matchSearch = !searchTerm || 
        r.atpNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.ctCodigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.uf.toLowerCase().includes(searchTerm.toLowerCase());
      return matchUf && matchSearch;
    });
  }, [data?.regioes, selectedUf, searchTerm]);

  // Chamados individuais filtrados
  const chamadosFiltrados = useMemo(() => {
    if (!data?.chamados) return [];
    return data.chamados.filter(c => {
      const matchUf = selectedUf === 'all' || (
        data.regioes.find(r => r.ctCodigo === c.ctCodigo)?.uf === selectedUf
      );
      const matchSearch = !searchTerm ||
        c.chamado.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.equipamento && c.equipamento.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.projeto && c.projeto.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.assistenciaNome && c.assistenciaNome.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.ctCodigo && c.ctCodigo.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchUf && matchSearch;
    });
  }, [data?.chamados, data?.regioes, selectedUf, searchTerm]);

  // Paginação
  const totalPages = Math.ceil(chamadosFiltrados.length / itemsPerPage);
  const chamadosPaginados = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return chamadosFiltrados.slice(start, start + itemsPerPage);
  }, [chamadosFiltrados, currentPage]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-positivo-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-6 border-b border-light-border dark:border-border/60 bg-slate-50 dark:bg-background/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-positivo-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <UserX size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-light-text-main dark:text-text-main">
                  Chamados sem Técnico Atribuído
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Auditoria Operacional
                </span>
              </div>
              <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5">
                Atendimentos concluídos na base sem técnico executor vinculado (nulos ou 'Não Definido')
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-positivo-md text-light-text-muted hover:text-light-text-main dark:hover:text-text-main hover:bg-slate-200 dark:hover:bg-surface transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Resumo de Cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6 pb-2">
            <div className="bg-slate-50 dark:bg-background/40 p-3.5 rounded-positivo-lg border border-light-border dark:border-border/40">
              <p className="text-xs font-medium text-light-text-muted dark:text-text-muted">Total sem Técnico</p>
              <p className="text-2xl font-bold text-light-text-main dark:text-text-main mt-0.5">
                {data.totalGeral}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-background/40 p-3.5 rounded-positivo-lg border border-light-border dark:border-border/40">
              <p className="text-xs font-medium text-light-text-muted dark:text-text-muted">Bases Impactadas</p>
              <p className="text-2xl font-bold text-accent-teal mt-0.5">
                {data.totalBasesAfetadas}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-background/40 p-3.5 rounded-positivo-lg border border-light-border dark:border-border/40">
              <p className="text-xs font-medium text-light-text-muted dark:text-text-muted">Dentro do SLA</p>
              <p className="text-2xl font-bold text-status-success mt-0.5">
                {data.regioes.reduce((acc, r) => acc + r.dentroSla, 0)}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-background/40 p-3.5 rounded-positivo-lg border border-light-border dark:border-border/40">
              <p className="text-xs font-medium text-light-text-muted dark:text-text-muted">Fora do SLA</p>
              <p className="text-2xl font-bold text-status-error mt-0.5">
                {data.regioes.reduce((acc, r) => acc + r.foraSla, 0)}
              </p>
            </div>
          </div>
        )}

        {/* Barra de Filtros e Abas */}
        <div className="p-6 pt-3 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-light-border dark:border-border/40">
          
          {/* Abas */}
          <div className="inline-flex bg-slate-100 dark:bg-background p-1 rounded-positivo-lg border border-light-border dark:border-border/50">
            <button
              onClick={() => { setActiveTab('regioes'); setCurrentPage(1); }}
              className={`px-4 py-1.5 rounded-positivo-md text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'regioes'
                  ? 'bg-light-surface dark:bg-surface text-accent-teal shadow-sm border border-light-borderStrong/40 dark:border-border'
                  : 'text-light-text-muted hover:text-light-text-main dark:hover:text-text-main'
              }`}
            >
              Visão por Região / Base ({regioesFiltradas.length})
            </button>
            <button
              onClick={() => { setActiveTab('extrato'); setCurrentPage(1); }}
              className={`px-4 py-1.5 rounded-positivo-md text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'extrato'
                  ? 'bg-light-surface dark:bg-surface text-accent-teal shadow-sm border border-light-borderStrong/40 dark:border-border'
                  : 'text-light-text-muted hover:text-light-text-main dark:hover:text-text-main'
              }`}
            >
              Extrato Geral ({chamadosFiltrados.length})
            </button>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-2.5">
            {/* Filtro UF */}
            <select
              value={selectedUf}
              onChange={(e) => { setSelectedUf(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 dark:bg-background border border-light-borderStrong dark:border-border text-light-text-main dark:text-text-main text-xs rounded-positivo-md p-2 outline-none"
            >
              <option value="all">Todas as Regiões (UFs)</option>
              {ufsDisponiveis.map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>

            {/* Input Busca */}
            <div className="relative w-48 md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-light-text-muted" />
              <input
                type="text"
                placeholder="Buscar chamado, base, CT..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-background border border-light-borderStrong dark:border-border text-light-text-main dark:text-text-main text-xs rounded-positivo-md focus:ring-accent-teal focus:border-accent-teal outline-none"
              />
            </div>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-light-text-muted">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-teal mb-3" />
              <p className="text-sm">Carregando auditoria de chamados sem técnico...</p>
            </div>
          ) : activeTab === 'regioes' ? (
            /* TABELA POR REGIÃO / BASE */
            <div className="overflow-x-auto border border-light-border dark:border-border/60 rounded-positivo-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-background/70 border-b border-light-border dark:border-border/60 text-light-text-muted uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">UF / Região</th>
                    <th className="py-3 px-4">Base ATP</th>
                    <th className="py-3 px-4">Código CT</th>
                    <th className="py-3 px-4 text-center">Volume Total</th>
                    <th className="py-3 px-4 text-center">Dentro SLA</th>
                    <th className="py-3 px-4 text-center">Fora SLA</th>
                    <th className="py-3 px-4 text-center">Taxa SLA</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border dark:divide-border/40 text-light-text-main dark:text-text-main">
                  {regioesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-light-text-muted">
                        Nenhuma base com chamados sem técnico identificada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    regioesFiltradas.map((r, idx) => (
                      <tr key={`${r.ctCodigo}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-surface/50 transition-colors">
                        <td className="py-3 px-4 font-bold flex items-center gap-1.5">
                          <MapPin size={13} className="text-accent-teal" />
                          <span>{r.uf}</span>
                        </td>
                        <td className="py-3 px-4 font-medium">{r.atpNome}</td>
                        <td className="py-3 px-4 font-mono text-light-text-muted">{r.ctCodigo}</td>
                        <td className="py-3 px-4 text-center font-bold">{r.totalChamados}</td>
                        <td className="py-3 px-4 text-center text-status-success font-semibold">{r.dentroSla}</td>
                        <td className="py-3 px-4 text-center text-status-error font-semibold">{r.foraSla}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            r.percSla >= 90 
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-500 border border-red-500/20'
                          }`}>
                            {r.percSla !== undefined ? `${r.percSla.toFixed(1)}%` : '0.0%'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedUf(r.uf);
                              setSearchTerm(r.ctCodigo);
                              setActiveTab('extrato');
                              setCurrentPage(1);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-accent-teal font-semibold hover:underline cursor-pointer"
                          >
                            <span>Ver Extrato</span>
                            <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* TABELA DE EXTRATO DETALHADO */
            <div className="space-y-4">
              <div className="overflow-x-auto border border-light-border dark:border-border/60 rounded-positivo-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-background/70 border-b border-light-border dark:border-border/60 text-light-text-muted uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-3">Chamado</th>
                      <th className="py-3 px-3">Data / Hora FT</th>
                      <th className="py-3 px-3">Base / CT</th>
                      <th className="py-3 px-3">Equipamento</th>
                      <th className="py-3 px-3">Projeto</th>
                      <th className="py-3 px-3 text-center">SLA Status</th>
                      <th className="py-3 px-3">Motivo / Causa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-light-border dark:divide-border/40 text-light-text-main dark:text-text-main">
                    {chamadosPaginados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-light-text-muted">
                          Nenhum chamado encontrado com os critérios de busca.
                        </td>
                      </tr>
                    ) : (
                      chamadosPaginados.map((c) => (
                        <tr key={c.chamado} className="hover:bg-slate-50/50 dark:hover:bg-surface/50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-light-text-main dark:text-text-main">
                            {c.chamado}
                          </td>
                          <td className="py-2.5 px-3 text-light-text-muted whitespace-nowrap">
                            {formatDateTime(c.dataFt)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-medium block">{c.assistenciaNome}</span>
                            <span className="text-[10px] text-light-text-muted font-mono">CT: {c.ctCodigo}</span>
                          </td>
                          <td className="py-2.5 px-3">{c.equipamento || '-'}</td>
                          <td className="py-2.5 px-3">{c.projeto || 'Corporativo'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                              (c.slaStatus || '').toLowerCase() === 'dentro'
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-500 border border-red-500/20'
                            }`}>
                              {c.slaStatus || 'NÃO DEFINIDO'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-light-text-muted max-w-xs truncate" title={c.textoEncerramento || c.causaPerda}>
                            {c.causaPerda || 'SEM TÉCNICO ATRIBUÍDO'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-light-text-muted">
                    Mostrando página {currentPage} de {totalPages} ({chamadosFiltrados.length} chamados)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-slate-100 dark:bg-background border border-light-border dark:border-border rounded-positivo-md text-xs disabled:opacity-40 cursor-pointer"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-slate-100 dark:bg-background border border-light-border dark:border-border rounded-positivo-md text-xs disabled:opacity-40 cursor-pointer"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-background/60 border-t border-light-border dark:border-border/60 flex items-center justify-between text-xs text-light-text-muted">
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-amber-500" />
            <span>Estes chamados impactam o SLA da Base coletiva, mas não pontuam individualmente para nenhum técnico.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-positivo-md text-xs font-semibold text-light-text-main dark:text-text-main hover:bg-slate-100 dark:hover:bg-surface/80 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
