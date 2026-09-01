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
  UserCheck
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
  percentualPerdidos = 0
}: ModalChamadosPerdasProps) {
  const [chamados, setChamados] = useState<ChamadoPerda[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClassificacao, setSelectedClassificacao] = useState<string>('TODOS');
  const [expandedChamado, setExpandedChamado] = useState<string | null>(null);
  
  // Para supervisores/moderadores: alternador entre ver apenas o técnico atual ou toda a base
  const [visaoFiltro, setVisaoFiltro] = useState<'INDIVIDUAL' | 'BASE'>('INDIVIDUAL');
  
  const { user } = useAuthStore();
  const isSupervisorOrAdmin = user?.role === 'SUPERVISOR' || user?.role === 'MODERADOR' || user?.role === 'ADMINISTRADOR' || user?.cargo === 'Administrador' || user?.cargo === 'Super Administrador';

  useEffect(() => {
    if (!isOpen || !tecnicoId) return;

    const fetchChamadosPerdas = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string> = {};
        if (selectedMonth && selectedMonth !== 'Campanha Inteira' && selectedMonth !== 'Média Final') {
          params.mesAno = selectedMonth;
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
  }, [isOpen, tecnicoId, selectedMonth]);

  // Se a visão for individual, filtra somente pelo nome do técnico atual
  const chamadosEscopo = useMemo(() => {
    if (!isSupervisorOrAdmin || visaoFiltro === 'INDIVIDUAL') {
      const nomeAlvo = (tecnicoNome || user?.nomeCompleto || '').trim().toLowerCase();
      if (!nomeAlvo) return chamados;
      return chamados.filter(c => {
        const tec = (c.tecnicoNome || '').trim().toLowerCase();
        return tec === nomeAlvo || tec.includes(nomeAlvo) || nomeAlvo.includes(tec);
      });
    }
    return chamados;
  }, [chamados, isSupervisorOrAdmin, visaoFiltro, tecnicoNome, user]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="relative px-6 py-5 border-b border-slate-800 bg-slate-950/60 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                <AlertTriangle size={12} />
                {visaoFiltro === 'INDIVIDUAL' ? 'SUAS PERDAS DE PERFORMANCE' : 'PERDAS DA EQUIPE (BASE COMPLETA)'}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                • {periodoLabel}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              Perdas por Falha de Gestão & Transferência entre Bases
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {isSupervisorOrAdmin && (
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setVisaoFiltro('INDIVIDUAL')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    visaoFiltro === 'INDIVIDUAL' 
                      ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Ver apenas as perdas deste técnico"
                >
                  <UserCheck size={13} />
                  <span>Individual</span>
                </button>
                <button
                  onClick={() => setVisaoFiltro('BASE')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    visaoFiltro === 'BASE' 
                      ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold' 
                      : 'text-slate-400 hover:text-white'
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
              className="p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Fechar modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* MINI DASHBOARD DE MÉTRICAS NO TOPO */}
        <div className="px-6 py-4 bg-slate-950/40 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              Taxa de Perdas (Equipe)
              <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-semibold">Meta ≤ 1%</span>
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-2xl font-black ${percentualPerdidos <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {percentualPerdidos.toFixed(1)}%
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {percentualPerdidos <= 1.0 ? '✓ Dentro da Meta' : '⚠ Acima da Meta'}
              </span>
            </div>
          </div>

          <div 
            onClick={() => setSelectedClassificacao('FALHA_GESTAO')}
            className={`bg-slate-900/90 border rounded-xl p-3 flex flex-col cursor-pointer transition-all ${
              selectedClassificacao === 'FALHA_GESTAO' ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Falhas de Gestão
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{stats.falhaGestao}</span>
              <span className="text-[11px] text-slate-500">chamados</span>
            </div>
          </div>

          <div 
            onClick={() => setSelectedClassificacao('TRANSFERENCIA')}
            className={`bg-slate-900/90 border rounded-xl p-3 flex flex-col cursor-pointer transition-all ${
              selectedClassificacao === 'TRANSFERENCIA' ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Transferência de Bases
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{stats.transferenciaBases}</span>
              <span className="text-[11px] text-slate-500">chamados</span>
            </div>
          </div>

          <div 
            onClick={() => setSelectedClassificacao('TODOS')}
            className={`bg-slate-900/90 border rounded-xl p-3 flex flex-col cursor-pointer transition-all ${
              selectedClassificacao === 'TODOS' ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total de Ocorrências
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{stats.total}</span>
              <span className="text-[11px] text-slate-500">{visaoFiltro === 'INDIVIDUAL' ? 'do técnico' : 'na base'}</span>
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS E BUSCA */}
        <div className="px-6 py-3 bg-slate-900/80 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={isSupervisorOrAdmin ? "Buscar por chamados ou nome do técnico..." : "Buscar por chamado..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              onClick={() => setSelectedClassificacao('TODOS')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedClassificacao === 'TODOS'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              Todos ({stats.total})
            </button>
            <button
              onClick={() => setSelectedClassificacao('FALHA_GESTAO')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedClassificacao === 'FALHA_GESTAO'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              Falha Gestão ({stats.falhaGestao})
            </button>
            <button
              onClick={() => setSelectedClassificacao('TRANSFERENCIA')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedClassificacao === 'TRANSFERENCIA'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              Transferência ({stats.transferenciaBases})
            </button>
          </div>
        </div>

        {/* LISTA DE CHAMADOS DE PERDAS */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-slate-400">Carregando chamados de perdas...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-400 text-xs">
              <p>{error}</p>
            </div>
          ) : filteredChamados.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 size={30} />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={18} className="text-amber-400 animate-pulse" />
                <h3 className="text-lg font-black text-white">
                  Parabéns! Nenhuma Perda Registrada
                </h3>
                <Sparkles size={18} className="text-amber-400 animate-pulse" />
              </div>
              <p className="text-xs text-slate-400 max-w-md mt-1 leading-relaxed">
                {visaoFiltro === 'INDIVIDUAL'
                  ? <>Excelente trabalho! O técnico <strong className="text-emerald-400">{tecnicoNome}</strong> não possui registros de falhas de gestão ou transferência de bases neste período.</>
                  : <>Excelente trabalho de equipe! Não há registros de falhas de gestão ou transferência de bases para toda a base ATP no período apurado.</>
                }
              </p>
            </div>
          ) : (
            filteredChamados.map((item) => {
              const isExpanded = expandedChamado === item.chamado;
              const isFalhaGestao = item.causaPerda?.toUpperCase().includes('FALHA GESTAO');

              return (
                <div
                  key={item.chamado}
                  className={`bg-slate-950/60 border rounded-xl p-4 transition-all ${
                    isExpanded ? 'border-cyan-500/50 bg-slate-950' : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-lg border shrink-0 mt-0.5 ${
                        isFalhaGestao 
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                          : 'bg-orange-500/10 border-cyan-500/30 text-cyan-400'
                      }`}>
                        <AlertTriangle size={18} />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-sm font-black text-white">
                            OS #{item.chamado}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isFalhaGestao
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-orange-500/10 text-cyan-400 border-cyan-500/30'
                          }`}>
                            {item.causaPerda}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <User size={13} className="text-slate-500" />
                            <strong className="text-slate-300">Técnico:</strong> {item.tecnicoNome || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Cpu size={13} className="text-slate-500" />
                            <strong className="text-slate-300">Equip:</strong> {item.equipamento || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-slate-500" />
                            <strong className="text-slate-300">Data FT:</strong> {item.ft ? new Date(item.ft).toLocaleDateString('pt-BR') : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedChamado(isExpanded ? null : item.chamado)}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-white rounded-lg flex items-center gap-1.5 transition-all self-end sm:self-center"
                    >
                      <span>{isExpanded ? 'Ocultar Laudo' : 'Ver Laudo Técnico'}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {/* LAUDO TÉCNICO EXPANSÍVEL */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 bg-slate-900/50 p-3 rounded-lg">
                      <div className="flex items-center gap-1.5 text-cyan-400 font-bold mb-1.5">
                        <FileText size={14} />
                        <span>Texto de Encerramento / Laudo Técnico:</span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed text-slate-300">
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
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Info size={14} className="text-cyan-400" />
            <span>O indicador de Perdas afeta a pontuação geral da equipe caso ultrapasse a meta de 1.0%.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
