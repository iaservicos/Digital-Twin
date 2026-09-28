import React, { useState, useMemo } from 'react';
import { 
  Trophy, 
  Medal, 
  Search, 
  CheckCircle2, 
  XCircle, 
  ArrowUpRight, 
  ChevronLeft, 
  ChevronRight, 
  SlidersHorizontal,
  ChevronDown,
  User,
  Activity,
  Wrench,
  Clock,
  RefreshCw,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { toTitleCase } from '../../utils/stringFormatters';

interface AdminRankingTableProps {
  tecnicosVisiveis: any[];
  rankingOriginal: any[];
  basesDisponiveis: any[];
  supervisoresDisponiveis?: any[];
  isModerador: boolean;
  selectedSupervisor: string;
  onSelectSupervisor?: (sup: string) => void;
  selectedEquipe: string;
  onSelectEquipe: (equipe: string) => void;
  onSelectTecnico: (tecnico: any) => void;
}

export const AdminRankingTable: React.FC<AdminRankingTableProps> = ({
  tecnicosVisiveis,
  rankingOriginal,
  basesDisponiveis,
  supervisoresDisponiveis = [],
  isModerador,
  selectedSupervisor,
  onSelectSupervisor,
  selectedEquipe,
  onSelectEquipe,
  onSelectTecnico
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [kpiSort, setKpiSort] = useState<'PONTOS' | 'SLA' | 'PECAS' | 'REINCIDENCIA' | 'PERDAS' | 'PROD'>('PONTOS');
  const [elegibilidadeFilter, setElegibilidadeFilter] = useState<'TODOS' | 'ELEGIVEIS' | 'INELEGIVEIS'>('TODOS');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Monta o mapa de dados do ranking cruzando técnicos visíveis com o rankingOriginal
  const rankingList = useMemo(() => {
    return tecnicosVisiveis.map(t => {
      const r = rankingOriginal.find(item => 
        (item.matricula && String(item.matricula) === String(t.matricula)) ||
        (item.idTecnico && String(item.idTecnico) === String(t.idTecnico)) ||
        (item.tecnico && String(item.tecnico).toUpperCase() === String(t.nomeCompleto).toUpperCase())
      );

      return {
        idTecnico: t.idTecnico,
        matricula: t.matricula,
        nomeCompleto: t.nomeCompleto,
        ctBases: t.ctBases || [],
        base: (t.ctBases && t.ctBases.length > 0) ? t.ctBases[0] : (r?.localEquipe || 'Sem Base'),
        pontosTotal: r?.pontosTotal ?? 0,
        percentualSla: r?.percentualSla ?? 0,
        percentualEficienciaPecas: r?.percentualEficienciaPecas ?? 0,
        percentualReincidencia: r?.percentualReincidencia ?? 0,
        percentualPerdidos: r?.percentualPerdidos ?? 0,
        volumeChamados: r?.quantidadeProdutividade ?? 0,
        elegivel: r ? Boolean(r.elegivel) : false,
        motivoInelegibilidade: r?.motivoInelegibilidade || '',
        posicaoOficial: r?.posicaoRanking ?? 999,
        rawObj: t
      };
    });
  }, [tecnicosVisiveis, rankingOriginal]);

  // Aplica busca e filtros locais
  const filteredAndSortedList = useMemo(() => {
    let list = [...rankingList];

    // 1. Filtro de Elegibilidade
    if (elegibilidadeFilter === 'ELEGIVEIS') {
      list = list.filter(item => item.elegivel);
    } else if (elegibilidadeFilter === 'INELEGIVEIS') {
      list = list.filter(item => !item.elegivel);
    }

    // 2. Busca Rápida (Nome, Matrícula, Base)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(item => 
        item.nomeCompleto.toLowerCase().includes(q) ||
        (item.matricula && String(item.matricula).includes(q)) ||
        (item.base && item.base.toLowerCase().includes(q))
      );
    }

    // 3. Ordenação por KPI
    list.sort((a, b) => {
      switch (kpiSort) {
        case 'SLA':
          return b.percentualSla - a.percentualSla;
        case 'PECAS':
          return b.percentualEficienciaPecas - a.percentualEficienciaPecas;
        case 'REINCIDENCIA':
          return a.percentualReincidencia - b.percentualReincidencia; // menor é melhor
        case 'PERDAS':
          return a.percentualPerdidos - b.percentualPerdidos; // menor é melhor
        case 'PROD':
          return b.volumeChamados - a.volumeChamados;
        case 'PONTOS':
        default:
          return b.pontosTotal - a.pontosTotal;
      }
    });

    return list;
  }, [rankingList, elegibilidadeFilter, searchTerm, kpiSort]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedList.length / itemsPerPage));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedList.slice(start, start + itemsPerPage);
  }, [filteredAndSortedList, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-[24px] p-5 md:p-6 shadow-xl space-y-5">
      
      {/* 1. CABEÇALHO DO RANKING & TÍTULO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-light-borderStrong/60 dark:border-border/60">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
            <Trophy size={22} />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black text-light-text-main dark:text-slate-100 tracking-tight flex items-center gap-2">
              Ranking de Pontos dos Técnicos
              <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-full">
                {filteredAndSortedList.length} {filteredAndSortedList.length === 1 ? 'técnico' : 'técnicos'}
              </span>
            </h2>
            <p className="text-xs text-light-text-muted dark:text-slate-400 mt-0.5">
              Classificação geral e matriz de KPIs sob a supervisão. Clique em qualquer colaborador para ver o dashboard individual.
            </p>
          </div>
        </div>

        {/* Busca Rápida na Tabela */}
        <div className="relative w-full lg:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Filtrar técnico na tabela..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-light-background dark:bg-input-bg border border-light-borderStrong dark:border-border text-light-text-main dark:text-slate-200 text-xs font-semibold rounded-xl pl-9 pr-3 py-2.5 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all shadow-inner"
          />
        </div>
      </div>

      {/* 2. BARRA DE FILTROS DO RANKING (Supervisão, Base ATP, KPI, Elegibilidade) */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-light-background dark:bg-input-bg/70 p-3 rounded-2xl border border-light-borderStrong/60 dark:border-border/60">
        
        {/* Filtros à Esquerda */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <SlidersHorizontal size={13} className="text-cyan-400" />
            Filtros:
          </span>

          {/* Filtro de Base ATP */}
          <div className="relative">
            <select
              value={selectedEquipe}
              onChange={(e) => {
                onSelectEquipe(e.target.value);
                setCurrentPage(1);
              }}
              className="appearance-none bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border text-slate-200 text-xs font-semibold rounded-xl py-1.5 pl-3 pr-8 focus:border-cyan-500/60 outline-none transition-all"
            >
              <option value="all">Todas as Bases ({basesDisponiveis.length})</option>
              {basesDisponiveis.map(b => (
                <option key={b.ctCodigo} value={b.ctCodigo}>
                  {b.ctCodigo} {b.nomeAtp ? `- ${toTitleCase(b.nomeAtp)}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Filtro / Ordenação por KPI */}
          <div className="relative">
            <select
              value={kpiSort}
              onChange={(e) => {
                setKpiSort(e.target.value as any);
                setCurrentPage(1);
              }}
              className="appearance-none bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border text-cyan-400 text-xs font-bold rounded-xl py-1.5 pl-3 pr-8 focus:border-cyan-500/60 outline-none transition-all"
            >
              <option value="PONTOS">🏆 Ordenar: Pontos Total</option>
              <option value="SLA">⚡ Ordenar: Maior SLA</option>
              <option value="PECAS">🔧 Ordenar: Maior Eficiência Peças</option>
              <option value="REINCIDENCIA">🔄 Ordenar: Menor Reincidência</option>
              <option value="PERDAS">🛡️ Ordenar: Menor Perda de SLA</option>
              <option value="PROD">📦 Ordenar: Maior Produtividade</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none" />
          </div>
        </div>

        {/* Filtro de Elegibilidade à Direita */}
        <div className="inline-flex bg-slate-900/80 p-1 rounded-xl border border-border">
          <button
            onClick={() => { setElegibilidadeFilter('TODOS'); setCurrentPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              elegibilidadeFilter === 'TODOS'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos ({rankingList.length})
          </button>
          <button
            onClick={() => { setElegibilidadeFilter('ELEGIVEIS'); setCurrentPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              elegibilidadeFilter === 'ELEGIVEIS'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Elegíveis ({rankingList.filter(i => i.elegivel).length})
          </button>
          <button
            onClick={() => { setElegibilidadeFilter('INELEGIVEIS'); setCurrentPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              elegibilidadeFilter === 'INELEGIVEIS'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Inelegíveis ({rankingList.filter(i => !i.elegivel).length})
          </button>
        </div>
      </div>

      {/* 3. TABELA DE RANKING COM DESIGN CYBER CIANO POSITIVO */}
      <div className="overflow-x-auto rounded-2xl border border-light-borderStrong dark:border-border">
        <table className="w-full text-left border-collapse min-w-[950px]">
          <thead>
            <tr className="bg-light-background dark:bg-input-bg text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-light-borderStrong dark:border-border">
              <th className="py-3 px-4 text-center w-16">#</th>
              <th className="py-3 px-4">Técnico</th>
              <th className="py-3 px-4 text-center">Pontos Total</th>
              <th className="py-3 px-4 text-center">SLA</th>
              <th className="py-3 px-4 text-center">Eficiência Peças</th>
              <th className="py-3 px-4 text-center">Reincidência</th>
              <th className="py-3 px-4 text-center">Perdas SLA</th>
              <th className="py-3 px-4 text-center">Volume</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-light-borderStrong/60 dark:divide-border/60 text-xs">
            {paginatedList.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  <p className="text-sm font-semibold">Nenhum técnico encontrado com os filtros aplicados.</p>
                  <p className="text-xs text-slate-500 mt-1">Tente ajustar a busca ou alterar a base selecionada.</p>
                </td>
              </tr>
            ) : (
              paginatedList.map((item, index) => {
                const globalRank = (currentPage - 1) * itemsPerPage + index + 1;
                
                // Formatação de medalhas para o top 3
                let rankBadge = (
                  <span className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 font-bold text-xs flex items-center justify-center mx-auto border border-slate-700">
                    {globalRank}
                  </span>
                );
                if (globalRank === 1) {
                  rankBadge = (
                    <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 font-black text-xs flex items-center justify-center mx-auto border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                      🥇
                    </span>
                  );
                } else if (globalRank === 2) {
                  rankBadge = (
                    <span className="w-7 h-7 rounded-full bg-slate-300/20 text-slate-200 font-black text-xs flex items-center justify-center mx-auto border border-slate-300/40">
                      🥈
                    </span>
                  );
                } else if (globalRank === 3) {
                  rankBadge = (
                    <span className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-300 font-black text-xs flex items-center justify-center mx-auto border border-orange-500/40">
                      🥉
                    </span>
                  );
                }

                return (
                  <tr
                    key={item.idTecnico + '-' + item.matricula}
                    onClick={() => onSelectTecnico(item.rawObj)}
                    className="hover:bg-cyan-500/5 transition-colors cursor-pointer group"
                    title={`Clique para abrir o Dashboard de ${item.nomeCompleto}`}
                  >
                    {/* 1. Posição */}
                    <td className="py-3 px-4 text-center">
                      {rankBadge}
                    </td>

                    {/* 2. Técnico & Base */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                          {item.nomeCompleto.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate max-w-[200px] sm:max-w-xs">
                          <p className="font-bold text-light-text-main dark:text-slate-100 group-hover:text-cyan-400 transition-colors truncate">
                            {toTitleCase(item.nomeCompleto)}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium mt-0.5">
                            <span className="font-mono">Mat: {item.matricula || 'S/M'}</span>
                            <span>•</span>
                            <span className="truncate">{item.base}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 3. Pontos Total */}
                    <td className="py-3 px-4 text-center">
                      <span className="font-black text-base text-light-text-main dark:text-slate-100">
                        {item.pontosTotal.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal ml-1">pts</span>
                    </td>

                    {/* 4. SLA */}
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        item.percentualSla >= 90.0 
                          ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' 
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}>
                        {item.percentualSla.toFixed(1)}%
                      </span>
                    </td>

                    {/* 5. Eficiência de Peças */}
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        item.percentualEficienciaPecas >= 85.0 
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}>
                        {item.percentualEficienciaPecas.toFixed(1)}%
                      </span>
                    </td>

                    {/* 6. Reincidência */}
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        item.percentualReincidencia <= 7.0 
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}>
                        {item.percentualReincidencia.toFixed(1)}%
                      </span>
                    </td>

                    {/* 7. Perdas de SLA */}
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        item.percentualPerdidos <= 1.0 
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}>
                        {item.percentualPerdidos.toFixed(1)}%
                      </span>
                    </td>

                    {/* 8. Volume de Produtividade */}
                    <td className="py-3 px-4 text-center font-bold text-slate-300">
                      {item.volumeChamados}
                    </td>

                    {/* 9. Status Elegibilidade */}
                    <td className="py-3 px-4 text-center">
                      {item.elegivel ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 size={11} />
                          Elegível
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30" title={item.motivoInelegibilidade}>
                          <XCircle size={11} />
                          Inelegível
                        </span>
                      )}
                    </td>

                    {/* 10. Ação */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTecnico(item.rawObj);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer group-hover:translate-x-0.5 transition-transform"
                      >
                        Dashboard
                        <ArrowRight size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. CONTROLES DE PAGINAÇÃO */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-400">
          <p>
            Exibindo <span className="font-bold text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-bold text-slate-200">{Math.min(currentPage * itemsPerPage, filteredAndSortedList.length)}</span> de <span className="font-bold text-slate-200">{filteredAndSortedList.length}</span> técnicos
          </p>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-light-borderStrong dark:border-border hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-300"
              title="Página Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            
            <div className="px-3 py-1 font-bold text-slate-200 bg-slate-900 border border-border rounded-xl">
              {currentPage} / {totalPages}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-light-borderStrong dark:border-border hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-300"
              title="Próxima Página"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
