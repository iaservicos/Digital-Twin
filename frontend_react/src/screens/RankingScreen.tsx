import React, { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { 
  Trophy, 
  Medal, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Award, 
  TrendingUp, 
  User, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpRight, 
  Sparkles, 
  Crown 
} from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { toTitleCase, formatLocalEquipe } from '../utils/stringFormatters';
import { BentoCard } from '../components/ui/BentoCard';

export default function RankingScreen() {
  const { user } = useAuthStore();
  const isAdmin = user?.cargo === 'Administrador' || user?.cargo === 'Admin' || user?.cargo === 'Super Administrador' || ['ADMINISTRADOR', 'ADMIN'].includes((user?.role || '').toUpperCase());
  const isModerador = ['MODERADOR', 'ROLE_MODERADOR'].includes((user?.role || '').toUpperCase()) || user?.cargo === 'Moderador';
  const isSupervisor = ['SUPERVISOR', 'ROLE_SUPERVISOR'].includes((user?.role || '').toUpperCase()) || user?.cargo === 'Supervisor' || user?.cargo === 'Supervisor de Campo';
  const canViewRanking = isAdmin || isModerador || isSupervisor;
  const canViewDetails = canViewRanking;

  // Se for técnico, redireciona imediatamente para o Dashboard pessoal
  if (!canViewRanking) {
    return <Navigate to="/dashboard" replace />;
  }

  const [rankingData, setRankingData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myPos, setMyPos] = useState<number | string>('--');
  const [selectedTecnico, setSelectedTecnico] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    let mounted = true;
    
    const fetchRanking = async () => {
      try {
        const response = await api.get('/dashboard/ranking');
        if (mounted && response.data) {
          const normalize = (str: string) => str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
          
          let myPosition: number | string = '--';
          const mappedData = response.data.map((r: any) => {
            const isMe = (user?.nomeCompleto && r.tecnico && normalize(r.tecnico) === normalize(user.nomeCompleto)) ||
                         (user?.matricula && r.matricula && String(r.matricula) === String(user.matricula));
            
            if (isMe) myPosition = r.posicaoRanking;
            
            return {
              id: r.matricula || r.idTecnico || r.tecnico || Math.random().toString(),
              idTecnico: r.idTecnico,
              matricula: r.matricula,
              name: r.tecnico,
              score: r.pontosTotal || 0,
              base: formatLocalEquipe(r.localEquipe) || 'Base Operacional',
              fotoPerfil: r.fotoPerfil || (isMe ? user?.fotoPerfil : null),
              percentualSla: r.percentualSla || 0,
              percentualEficienciaPecas: r.percentualEficienciaPecas || 0,
              percentualReincidencia: r.percentualReincidencia || 0,
              elegivel: Boolean(r.elegivel),
              isMe: isMe,
              posicaoRanking: r.posicaoRanking,
              rawDto: r
            };
          });
          
          // Garante ordenação decrescente por score / posicaoRanking
          mappedData.sort((a: any, b: any) => (a.posicaoRanking || 999) - (b.posicaoRanking || 999));
          
          setRankingData(mappedData);
          setMyPos(myPosition);
        }
      } catch (error) {
        console.error('Erro ao buscar ranking:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    fetchRanking();
    
    return () => { mounted = false; };
  }, [user]);

  // Os 3 primeiros colocados para o Pódio
  const top1 = rankingData[0] || null;
  const top2 = rankingData[1] || null;
  const top3 = rankingData[2] || null;

  // Filtragem por busca rápida
  const filteredRanking = useMemo(() => {
    if (!searchTerm.trim()) return rankingData;
    const q = searchTerm.toLowerCase().trim();
    return rankingData.filter(item => 
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.matricula && String(item.matricula).includes(q)) ||
      (item.base && item.base.toLowerCase().includes(q))
    );
  }, [rankingData, searchTerm]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filteredRanking.length / itemsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRanking.slice(start, start + itemsPerPage);
  }, [filteredRanking, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 pb-10">
      
      {/* ========================================================================= */}
      {/* 1. CABEÇALHO DO RANKING & STATUS DO USUÁRIO LOGADO                        */}
      {/* ========================================================================= */}
      <BentoCard className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 md:p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
            <Trophy size={26} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-light-text-main dark:text-text-main tracking-tight flex items-center gap-2">
              Ranking Geral da Operação
              <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                {rankingData.length} Técnicos
              </span>
            </h1>
            <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5 font-medium">
              Classificação oficial do programa Brilha+ baseada na matriz de 6 KPIs
            </p>
          </div>
        </div>

        {/* Pílula de Posição da Pessoa Logada (se encontrada) */}
        {myPos !== '--' && (
          <div className="flex items-center gap-3 bg-gradient-to-r from-amber-500/10 to-primary/10 border border-primary/30 px-4 py-2.5 rounded-2xl shadow-sm self-start sm:self-auto">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Sua Posição</p>
              <p className="text-lg font-black text-primary">{myPos}º Lugar</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary-light font-bold flex items-center justify-center border border-primary/30">
              🥇
            </div>
          </div>
        )}
      </BentoCard>

      {/* ========================================================================= */}
      {/* 2. QUADRO DO PÓDIO OLÍMPICO (TOP 3)                                       */}
      {/* ========================================================================= */}
      {rankingData.length >= 3 && (
        <BentoCard className="p-6 md:p-8 shadow-2xl relative overflow-hidden">
          
          {/* Textura sutil geométrica */}
          <div className="absolute inset-0 opacity-10 dark:opacity-15 pointer-events-none bg-[radial-gradient(currentColor_1px,transparent_1px)] text-primary/40 [background-size:20px_20px]"></div>

          <div className="text-center mb-8 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest mb-2 shadow-sm">
              <Sparkles size={14} /> Pódio dos Campeões • Top 3
            </div>
            <h2 className="text-xl md:text-2xl font-black text-light-text-main dark:text-text-main tracking-tight">
              Os Melhores Técnicos da Campanha
            </h2>
            <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
              Reconhecimento oficial de alta performance e excelência operacional
            </p>
          </div>

          {/* ESTRUTURA DOS 3 PEDESTAIS (PÓDIO OLÍMPICO RESPONSIVO) */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-4 md:gap-6 items-end max-w-4xl mx-auto pt-6 pb-2 relative z-10">
            
            {/* ----------------------------------------------------------------- */}
            {/* 2º LUGAR (Esquerda - Prata)                                       */}
            {/* ----------------------------------------------------------------- */}
            {top2 && (
              <div 
                onClick={() => canViewDetails && setSelectedTecnico(top2)}
                className={`flex flex-col items-center text-center order-1 ${
                  canViewDetails ? 'cursor-pointer group transition-transform hover:-translate-y-1' : ''
                }`}
                title={canViewDetails ? "Clique para ver o desempenho de 2º lugar" : undefined}
              >
                {/* Avatar do 2º Colocado */}
                <div className="relative mb-2 sm:mb-3">
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-slate-300 dark:border-border shadow-lg flex items-center justify-center bg-surface ${
                    canViewDetails ? 'group-hover:scale-105 transition-transform' : ''
                  }`}>
                    {top2.fotoPerfil ? (
                      <img src={top2.fotoPerfil} alt={top2.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-muted">
                        <User size={22} className="sm:hidden" />
                        <User size={30} className="hidden sm:block" />
                      </div>
                    )}
                  </div>
                  <span className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-1 w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-slate-300 dark:bg-surface-elevated text-slate-900 dark:text-text-main font-black text-[10px] sm:text-xs flex items-center justify-center border-2 border-surface shadow-md">
                    2º
                  </span>
                </div>

                <div className="mb-1.5 sm:mb-2 w-full px-1 sm:px-2">
                  <p className={`font-bold text-xs sm:text-sm text-light-text-main dark:text-text-main transition-colors truncate ${
                    canViewDetails ? 'group-hover:text-primary' : ''
                  }`}>
                    {toTitleCase(top2.name)}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-primary font-medium truncate mt-0.5">
                    {top2.base}
                  </p>
                  <p className="text-xs sm:text-base font-black text-text-main mt-0.5 sm:mt-1">
                    {top2.score.toFixed(1)} <span className="text-[9px] sm:text-[10px] text-text-muted font-normal">pts</span>
                  </p>
                </div>

                {/* Pedestal Prata */}
                <div className="w-full h-24 sm:h-36 md:h-44 rounded-t-xl sm:rounded-t-2xl bg-gradient-to-t from-slate-400/20 via-slate-400/10 to-slate-400/5 border-t-2 border-x-2 border-border flex flex-col items-center justify-center shadow-lg p-1.5 sm:p-3">
                  <span className="text-lg sm:text-2xl mb-0.5 sm:mb-1">🥈</span>
                  <span className="text-[10px] sm:text-xs font-black text-text-main uppercase tracking-wider">
                    2º Lugar
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-text-muted mt-0.5 hidden xs:inline-block">
                    SLA: {top2.percentualSla.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* ----------------------------------------------------------------- */}
            {/* 1º LUGAR (Centro - Ouro - Campeão / Mais Alto)                     */}
            {/* ----------------------------------------------------------------- */}
            {top1 && (
              <div 
                onClick={() => canViewDetails && setSelectedTecnico(top1)}
                className={`flex flex-col items-center text-center order-2 ${
                  canViewDetails ? 'cursor-pointer group transition-transform hover:-translate-y-1.5' : ''
                }`}
                title={canViewDetails ? "Clique para ver o desempenho do líder do ranking" : undefined}
              >
                {/* Avatar do 1º Colocado com Coroa e Halo Dourado */}
                <div className="relative mb-2 sm:mb-3">
                  <div className="absolute -top-4 sm:-top-6 left-1/2 -translate-x-1/2 text-amber-400 animate-bounce duration-1000">
                    <Crown size={18} className="sm:hidden" />
                    <Crown size={26} className="hidden sm:block" />
                  </div>
                  <div className={`w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 sm:border-4 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.35)] flex items-center justify-center bg-surface ${
                    canViewDetails ? 'group-hover:scale-105 transition-transform' : ''
                  }`}>
                    {top1.fotoPerfil ? (
                      <img src={top1.fotoPerfil} alt={top1.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-amber-300">
                        <User size={26} className="sm:hidden" />
                        <User size={38} className="hidden sm:block" />
                      </div>
                    )}
                  </div>
                  <span className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center border-2 border-surface shadow-md">
                    1º
                  </span>
                </div>

                <div className="mb-1.5 sm:mb-2 w-full px-1 sm:px-2">
                  <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-block">
                    Líder
                  </span>
                  <p className={`font-black text-xs sm:text-base text-light-text-main dark:text-text-main transition-colors truncate mt-0.5 sm:mt-1 ${
                    canViewDetails ? 'group-hover:text-amber-400' : ''
                  }`}>
                    {toTitleCase(top1.name)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-amber-400/90 font-medium truncate mt-0.5">
                    {top1.base}
                  </p>
                  <p className="text-sm sm:text-xl font-black text-amber-300 mt-0.5 sm:mt-1">
                    {top1.score.toFixed(1)} <span className="text-[9px] sm:text-xs text-text-muted font-normal">pts</span>
                  </p>
                </div>

                {/* Pedestal Ouro */}
                <div className="w-full h-32 sm:h-48 md:h-56 rounded-t-xl sm:rounded-t-2xl bg-gradient-to-t from-amber-500/25 via-amber-500/15 to-amber-500/5 border-t-2 border-x-2 border-amber-400/60 flex flex-col items-center justify-center shadow-lg p-2 sm:p-4">
                  <span className="text-2xl sm:text-3xl mb-0.5 sm:mb-1 filter drop-shadow-md">🥇</span>
                  <span className="text-[10px] sm:text-sm font-black text-amber-300 uppercase tracking-widest">
                    Campeão
                  </span>
                  <span className="text-[9px] sm:text-xs text-text-main font-semibold mt-0.5 sm:mt-1 hidden xs:inline-block">
                    SLA: {top1.percentualSla.toFixed(1)}%
                  </span>
                  <span className="text-[8px] sm:text-[10px] text-emerald-400 font-bold mt-0.5 hidden xs:inline-block">
                    Peças: {top1.percentualEficienciaPecas.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* ----------------------------------------------------------------- */}
            {/* 3º LUGAR (Direita - Bronze)                                       */}
            {/* ----------------------------------------------------------------- */}
            {top3 && (
              <div 
                onClick={() => canViewDetails && setSelectedTecnico(top3)}
                className={`flex flex-col items-center text-center order-3 ${
                  canViewDetails ? 'cursor-pointer group transition-transform hover:-translate-y-1' : ''
                }`}
                title={canViewDetails ? "Clique para ver o desempenho de 3º lugar" : undefined}
              >
                {/* Avatar do 3º Colocado */}
                <div className="relative mb-2 sm:mb-3">
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-orange-400 shadow-lg flex items-center justify-center bg-surface ${
                    canViewDetails ? 'group-hover:scale-105 transition-transform' : ''
                  }`}>
                    {top3.fotoPerfil ? (
                      <img src={top3.fotoPerfil} alt={top3.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-orange-400">
                        <User size={22} className="sm:hidden" />
                        <User size={30} className="hidden sm:block" />
                      </div>
                    )}
                  </div>
                  <span className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-1 w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-orange-500 text-white font-black text-[10px] sm:text-xs flex items-center justify-center border-2 border-surface shadow-md">
                    3º
                  </span>
                </div>

                <div className="mb-1.5 sm:mb-2 w-full px-1 sm:px-2">
                  <p className={`font-bold text-xs sm:text-sm text-light-text-main dark:text-text-main transition-colors truncate ${
                    canViewDetails ? 'group-hover:text-primary' : ''
                  }`}>
                    {toTitleCase(top3.name)}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-primary font-medium truncate mt-0.5">
                    {top3.base}
                  </p>
                  <p className="text-xs sm:text-base font-black text-text-main mt-0.5 sm:mt-1">
                    {top3.score.toFixed(1)} <span className="text-[9px] sm:text-[10px] text-text-muted font-normal">pts</span>
                  </p>
                </div>

                {/* Pedestal Bronze */}
                <div className="w-full h-18 sm:h-28 md:h-36 rounded-t-xl sm:rounded-t-2xl bg-gradient-to-t from-orange-500/20 via-orange-500/10 to-orange-500/5 border-t-2 border-x-2 border-orange-500/40 flex flex-col items-center justify-center shadow-lg p-1.5 sm:p-3">
                  <span className="text-lg sm:text-2xl mb-0.5 sm:mb-1">🥉</span>
                  <span className="text-[10px] sm:text-xs font-black text-orange-300 uppercase tracking-wider">
                    3º Lugar
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-text-muted mt-0.5 hidden xs:inline-block">
                    SLA: {top3.percentualSla.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

          </div>
        </BentoCard>
      )}

      {/* ========================================================================= */}
      {/* 3. LISTA DE COLOCAÇÕES (PAGINADA & NO PADRÃO CYBER CIANO POSITIVO)        */}
      {/* ========================================================================= */}
      <BentoCard className="p-5 md:p-6 shadow-xl space-y-4">
        
        {/* Cabeçalho da Tabela e Busca */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-light-borderStrong/60 dark:border-border/60">
          <div>
            <h3 className="text-lg font-black text-light-text-main dark:text-text-main tracking-tight flex items-center gap-2">
              <Medal size={20} className="text-primary" />
              Classificação Completa dos Colaboradores
            </h3>
            <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5">
              {canViewDetails 
                ? "Consulte a colocação de qualquer técnico e audite os 6 KPIs oficiais" 
                : "Consulte a classificação geral e acompanhe o ranking oficial da campanha"}
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar técnico, matrícula ou base..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full glass-bento border border-light-border/60 dark:border-white/10 text-light-text-main dark:text-text-main text-xs font-semibold rounded-full pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner placeholder:text-light-text-muted dark:placeholder:text-text-muted/60"
            />
          </div>
        </div>

        {/* Tabela de Ranking */}
        <div className="overflow-x-auto scrollbar-hide rounded-2xl border border-light-borderStrong dark:border-border">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-light-background dark:bg-input-bg text-text-muted text-[11px] font-bold uppercase tracking-wider border-b border-light-borderStrong dark:border-border">
                <th className="py-3 px-4 text-center w-16">#</th>
                <th className="py-3 px-4">Técnico</th>
                <th className="py-3 px-4 text-center">Pontos Total</th>
                <th className="py-3 px-4 text-center">SLA</th>
                <th className="py-3 px-4 text-center">Eficiência Peças</th>
                <th className="py-3 px-4 text-center">Status</th>
                {canViewDetails && <th className="py-3 px-4 text-right">Ação</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-light-borderStrong/60 dark:divide-border/60 text-xs">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={canViewDetails ? 7 : 6} className="py-12 text-center text-text-muted">
                    <p className="text-sm font-semibold">Nenhum técnico encontrado.</p>
                    <p className="text-xs text-text-muted mt-1">Verifique o termo digitado na busca.</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((usr, index) => {
                  const rankPos = usr.posicaoRanking || ((currentPage - 1) * itemsPerPage + index + 1);
                  
                  return (
                    <tr
                      key={usr.id + '-' + index}
                      onClick={() => canViewDetails && setSelectedTecnico(usr)}
                      className={`transition-colors ${
                        canViewDetails ? 'hover:bg-primary/5 cursor-pointer group' : ''
                      } ${usr.isMe ? 'bg-primary/10 font-bold relative' : ''}`}
                    >
                      {/* Posição */}
                      <td className="py-3 px-4 text-center">
                        <span className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center mx-auto border ${
                          rankPos === 1 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                          rankPos === 2 ? 'bg-surface-elevated/40 text-text-main border-border' :
                          rankPos === 3 ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
                          usr.isMe ? 'bg-primary/20 text-primary-light border-primary/40' :
                          'bg-surface text-text-muted border-border'
                        }`}>
                          {rankPos === 1 ? '🥇' : rankPos === 2 ? '🥈' : rankPos === 3 ? '🥉' : rankPos}
                        </span>
                      </td>

                      {/* Foto / Bonequinho Vazio + Nome + Base */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden border border-border bg-surface shrink-0 flex items-center justify-center text-text-muted">
                            {usr.fotoPerfil ? (
                              <img src={usr.fotoPerfil} alt={usr.name} className="w-full h-full object-cover" />
                            ) : (
                              <User size={18} />
                            )}
                          </div>
                          <div className="truncate max-w-xs sm:max-w-md">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-light-text-main dark:text-text-main group-hover:text-primary transition-colors truncate">
                                {toTitleCase(usr.name)}
                              </p>
                              {usr.isMe && (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/20 text-primary-light border border-primary/30 shrink-0">
                                  Você
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-text-muted mt-0.5 truncate">
                              {usr.base}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Pontos Total */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-black text-sm text-light-text-main dark:text-text-main">
                          {typeof usr.score === 'number' ? usr.score.toFixed(1) : usr.score}
                        </span>
                        <span className="text-[10px] text-text-muted font-normal ml-1">pts</span>
                      </td>

                      {/* SLA */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          usr.percentualSla >= 90.0 
                            ? 'bg-primary/15 text-primary border border-primary/30' 
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}>
                          {usr.percentualSla?.toFixed(1)}%
                        </span>
                      </td>

                      {/* Peças */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          usr.percentualEficienciaPecas >= 85.0 
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}>
                          {usr.percentualEficienciaPecas?.toFixed(1)}%
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {usr.elegivel ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 size={11} /> Elegível
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <XCircle size={11} /> Inelegível
                          </span>
                        )}
                      </td>

                      {/* Ação */}
                      {canViewDetails && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-light group-hover:translate-x-0.5 transition-transform"
                          >
                            Detalhes
                            <ArrowUpRight size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-text-muted">
            <p>
              Exibindo <span className="font-bold text-text-main">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-bold text-text-main">{Math.min(currentPage * itemsPerPage, filteredRanking.length)}</span> de <span className="font-bold text-text-main">{filteredRanking.length}</span> técnicos
            </p>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-xl bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-border text-light-text-muted dark:text-text-muted hover:border-light-borderHover dark:hover:border-borderHover hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover hover:text-light-textHover dark:hover:text-textHover disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                title="Página Anterior"
              >
                <ChevronLeft size={16} />
              </button>
              
              <div className="px-3 py-1 font-bold text-light-text-main dark:text-text-main bg-light-surface/60 dark:bg-surface-elevated border border-light-border dark:border-border rounded-xl">
                {currentPage} / {totalPages}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-border text-light-text-muted dark:text-text-muted hover:border-light-borderHover dark:hover:border-borderHover hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover hover:text-light-textHover dark:hover:text-textHover disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                title="Próxima Página"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

      </BentoCard>

      {/* ========================================================================= */}
      {/* 4. MODAL OFICIAL DE DESEMPENHO DO TÉCNICO                                 */}
      {/* ========================================================================= */}
      {canViewDetails && selectedTecnico && (
        <div className="fixed inset-0 lg:left-64 z-30 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
          <div className="glass-bento border rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-light-border dark:border-border flex justify-between items-center bg-light-background/60 dark:bg-input-bg/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-light-border dark:border-border bg-surface flex items-center justify-center text-text-muted">
                  {selectedTecnico.fotoPerfil ? (
                    <img src={selectedTecnico.fotoPerfil} alt={selectedTecnico.name} className="w-full h-full object-cover" />
                  ) : (
                    <User size={20} />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-light-text-main dark:text-text-main flex items-center gap-2">
                    Desempenho de {toTitleCase(selectedTecnico.name)}
                  </h2>
                  <p className="text-xs text-light-text-muted dark:text-text-muted">
                    Base: {selectedTecnico.base} • Posição: {selectedTecnico.posicaoRanking || '--'}º Lugar
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTecnico(null)} 
                className="p-2 rounded-xl bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-white/10 text-light-text-muted dark:text-text-muted hover:border-light-borderStrong dark:hover:border-white/20 hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover hover:text-light-text-main dark:hover:text-text-main transition-all cursor-pointer"
                title="Fechar"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 overflow-x-auto overflow-y-auto max-h-[70vh] scrollbar-hide">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="bg-light-surface/60 dark:bg-surface-elevated/60 text-text-muted text-xs font-bold uppercase tracking-wider border-b border-light-border dark:border-border">
                    <th className="p-3">Mês</th>
                    <th className="p-3 text-center">SLA</th>
                    <th className="p-3 text-center">Reincidência</th>
                    <th className="p-3 text-center">Peças</th>
                    <th className="p-3 text-center">Perdas</th>
                    <th className="p-3 text-center">Total</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border dark:divide-border/60 text-xs">
                  {selectedTecnico.rawDto?.historico?.map((h: any, i: number) => {
                    const isMedia = h.mes === 'Média Final';
                    return (
                      <tr key={i} className={`hover:bg-primary/5 transition-colors ${isMedia ? 'bg-primary/10 font-bold' : ''}`}>
                        <td className="p-3 font-bold text-light-text-main dark:text-text-main flex items-center gap-2">
                          {isMedia && <TrendingUp size={14} className="text-primary"/>}
                          {h.mes}
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-text-main">{h.percentualSla?.toFixed(1)}%</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-text-main">{h.percentualReincidencia?.toFixed(1)}%</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-text-main">{h.percentualEficienciaPecas?.toFixed(1)}%</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-text-main">{h.percentualPerdidos?.toFixed(1)}%</span>
                        </td>
                        <td className="p-3 text-center font-black text-sm text-primary">
                          {h.pontosTotal}
                        </td>
                        <td className="p-3 text-center">
                          {h.elegivel ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Elegível
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30" title={h.motivoInelegibilidade}>
                              Inelegível
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(!selectedTecnico.rawDto?.historico || selectedTecnico.rawDto.historico.length === 0) && (
                <div className="p-8 text-center text-text-muted">
                  Pontuação consolidada: <span className="font-black text-primary">{selectedTecnico.score.toFixed(1)} pts</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-light-background/60 dark:bg-input-bg/60 border-t border-light-border dark:border-border flex justify-end">
              <button 
                onClick={() => setSelectedTecnico(null)} 
                className="px-6 py-2.5 rounded-xl bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-white/10 text-light-text-muted dark:text-text-muted hover:border-light-borderStrong dark:hover:border-white/20 hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover hover:text-light-text-main dark:hover:text-text-main font-semibold transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
