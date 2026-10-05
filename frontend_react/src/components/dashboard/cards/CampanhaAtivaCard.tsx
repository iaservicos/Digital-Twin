import React from 'react';
import { BentoCard } from '../../ui/BentoCard';
import { Award, Users, Calendar, Clock, ArrowUpRight } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';

export interface CampanhaAtivaCardProps {
  campanhaInfo: {
    nomeCampanha?: string;
    tema?: string;
    totalParticipantes?: number;
    participantesAtivos?: number;
    duracaoDias?: number;
    diasRestantes?: number;
    progressoTempo?: number;
    dataInicio?: string;
    dataFim?: string;
    duracaoMeses?: number;
  } | null;
  campanhaPeriodoFormatado?: string;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  historicoMeses?: { mes: string; mesReferencia?: string }[];
  percentualSla: number;
  pontosTotal?: number;
  elegivel?: boolean;
  onOpenDetailsModal?: () => void;
  onOpenSlaModal?: () => void;
  className?: string;
}

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const CampanhaAtivaCard: React.FC<CampanhaAtivaCardProps> = ({
  campanhaInfo,
  campanhaPeriodoFormatado = '01/09 a 30/09',
  selectedMonth,
  onSelectMonth,
  historicoMeses = [],
  percentualSla,
  pontosTotal,
  elegivel,
  onOpenDetailsModal,
  onOpenSlaModal,
  className = ''
}) => {
  const user = useAuthStore(state => state.user);
  const isSupervisorOrModerator = user?.role === 'ADMIN' || user?.role === 'MODERADOR' || user?.role === 'SUPERVISOR';

  const isCampanhaInteira = selectedMonth === 'Campanha Inteira' || selectedMonth === 'Média Final';
  const selLower = (selectedMonth || '').toLowerCase();

  // Lista dinâmica e sanitizada dos meses pertencentes à campanha ativa
  const mesesCampanha = React.useMemo(() => {
    if (historicoMeses && historicoMeses.length > 0) {
      const limpos = historicoMeses.filter((h) => h.mes && h.mes !== 'Média Final');
      if (campanhaInfo?.dataInicio && campanhaInfo?.dataFim) {
        const dIni = campanhaInfo.dataInicio.substring(0, 7);
        const dFim = campanhaInfo.dataFim.substring(0, 7);
        const filtrados = limpos.filter((h) => {
          if (!h.mesReferencia) return true;
          const ref = h.mesReferencia.substring(0, 7);
          return ref >= dIni && ref <= dFim;
        });
        if (filtrados.length > 0) return filtrados;
      } else {
        return limpos;
      }
    }

    // Se historicoMeses não foi fornecido, deriva a partir dos dados da campanha ativa
    if (campanhaInfo?.dataInicio) {
      try {
        const [anoStr, mesStr] = campanhaInfo.dataInicio.split('-');
        let ano = parseInt(anoStr, 10);
        let mes = parseInt(mesStr, 10);
        const duracao = Math.max(1, campanhaInfo.duracaoMeses || 1);
        const gerados: { mes: string; mesReferencia: string }[] = [];
        for (let i = 0; i < duracao; i++) {
          const nomeMes = MESES_NOMES[mes - 1] || `Mês ${mes}`;
          const mesRefStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
          gerados.push({ mes: nomeMes, mesReferencia: mesRefStr });
          mes++;
          if (mes > 12) {
            mes = 1;
            ano++;
          }
        }
        return gerados;
      } catch {
        // fallback silencioso
      }
    }

    return [{ mes: 'Setembro', mesReferencia: '2026-09-01' }];
  }, [historicoMeses, campanhaInfo]);

  // Se a campanha tiver apenas 1 mês, sincroniza automaticamente a seleção para esse único mês
  React.useEffect(() => {
    if (mesesCampanha.length === 1) {
      const unicoMes = mesesCampanha[0].mes;
      if (selectedMonth === 'Campanha Inteira' || selectedMonth === 'Média Final') {
        onSelectMonth(unicoMes);
      }
    }
  }, [mesesCampanha, selectedMonth, onSelectMonth]);

  const apenasUmMes = mesesCampanha.length <= 1;

  // Análise de status e dinamismo de tempo da campanha
  const isEncerrada = React.useMemo(() => {
    if (campanhaInfo?.diasRestantes !== undefined && campanhaInfo.diasRestantes <= 0) {
      return true;
    }
    if (campanhaInfo?.dataFim) {
      try {
        const dataFim = new Date(campanhaInfo.dataFim + 'T23:59:59');
        const hoje = new Date();
        return hoje > dataFim;
      } catch {
        return false;
      }
    }
    return false;
  }, [campanhaInfo]);

  const percentualProgresso = React.useMemo(() => {
    if (isEncerrada) return 100;
    if (campanhaInfo?.progressoTempo !== undefined) {
      return Math.min(100, Math.max(0, campanhaInfo.progressoTempo));
    }
    return 0;
  }, [isEncerrada, campanhaInfo?.progressoTempo]);

  return (
    <BentoCard
      hoverable
      className={`min-h-[19.5rem] sm:min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between ${className}`}
    >
      {/* Cabeçalho do Card 2 com Pílula 'Campanha ativa', Seletor Alinhado e Botão de Ação */}
      <div className="flex items-center justify-between gap-[0.5rem]">
        <div className="inline-flex items-center px-[0.75rem] py-[0.25rem] rounded-full bg-light-surface-elevated/90 dark:bg-surface-elevated/80 border border-light-border dark:border-white/10 text-[0.75rem] font-bold text-light-text-main dark:text-text-main shadow-xs">
          Campanha ativa
        </div>

        {/* Seletor alinhado no cabeçalho ao lado do título */}
        <div className="flex items-center gap-[0.375rem]">
          <div className="flex items-center p-[0.125rem] rounded-[0.75rem] bg-light-surface-elevated dark:bg-surface border border-light-border dark:border-white/10 text-[0.625rem] font-bold">
            {apenasUmMes ? (
              // Quando for apenas um mês: exibe apenas o nome do mês sem o botão Total
              <button
                type="button"
                onClick={() => onSelectMonth(mesesCampanha[0]?.mes || 'Setembro')}
                className="px-[0.625rem] py-[0.25rem] rounded-[0.5rem] bg-primary text-slate-950 font-black shadow-xs cursor-pointer"
              >
                {mesesCampanha[0]?.mes || 'Setembro'}
              </button>
            ) : (
              // Quando forem vários meses: exibe o botão Total e os meses da campanha
              <>
                <button
                  type="button"
                  onClick={() => onSelectMonth('Campanha Inteira')}
                  className={`px-[0.625rem] py-[0.25rem] rounded-[0.5rem] transition-all cursor-pointer ${
                    isCampanhaInteira
                      ? 'bg-primary text-slate-950 font-black shadow-xs'
                      : 'bg-transparent text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main'
                  }`}
                >
                  Total
                </button>

                {mesesCampanha.map((h, idx) => {
                  const labelMes = h.mes;
                  const isSelected =
                    !isCampanhaInteira &&
                    (selLower === labelMes.toLowerCase() ||
                      selLower === (h.mesReferencia || '').toLowerCase());
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSelectMonth(labelMes)}
                      className={`px-[0.625rem] py-[0.25rem] rounded-[0.5rem] transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-slate-950 font-black shadow-xs'
                          : 'bg-transparent text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main'
                      }`}
                    >
                      {labelMes}
                    </button>
                  );
                })}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenDetailsModal || onOpenSlaModal}
            className="w-[2rem] h-[2rem] rounded-full bg-light-surface-elevated dark:bg-surface-elevated hover:bg-primary/20 text-light-text-muted dark:text-text-muted hover:text-primary flex items-center justify-center transition-colors cursor-pointer border border-light-border dark:border-border"
            title="Ver detalhamento da pontuação oficial da campanha"
          >
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      {/* Corpo do Card 2 com as Informações da Campanha */}
      <div className="grid grid-cols-2 gap-[0.5rem] sm:gap-[0.625rem] my-auto py-[0.25rem]">
        {/* 1. Campanha Atual */}
        <div className="bg-light-surface-elevated/70 dark:bg-surface-elevated/50 border border-light-border dark:border-border/60 rounded-[0.75rem] p-[0.5rem] sm:p-[0.625rem] xl:p-[0.75rem] min-h-[4.75rem] flex flex-col justify-between">
          <div className="flex items-center gap-[0.375rem] text-primary mb-[0.125rem]">
            <Award size={13} />
            <span className="text-[0.625rem] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider">
              Campanha Atual
            </span>
          </div>
          <p
            className="text-[0.75rem] sm:text-[0.8125rem] font-black text-light-text-main dark:text-text-main leading-tight line-clamp-2 break-normal"
            title={campanhaInfo?.nomeCampanha || 'Campanha Setembro 2026'}
          >
            {campanhaInfo?.nomeCampanha || 'Campanha Setembro 2026'}
          </p>
          <span
            className="text-[0.625rem] sm:text-[0.6875rem] text-light-text-muted dark:text-text-muted font-medium block truncate mt-[0.125rem]"
            title={campanhaInfo?.tema || 'Conexão Total'}
          >
            {campanhaInfo?.tema || 'Conexão Total'}
          </span>
        </div>

        {/* 2. Sua Pontuação (Técnico) ou Técnicos na Campanha (Supervisor/Moderador) */}
        {isSupervisorOrModerator ? (
          <div className="bg-light-surface-elevated/70 dark:bg-surface-elevated/50 border border-light-border dark:border-border/60 rounded-[0.75rem] p-[0.5rem] sm:p-[0.625rem] xl:p-[0.75rem] min-h-[4.75rem] flex flex-col justify-between">
            <div className="flex items-center gap-[0.375rem] text-primary mb-[0.125rem]">
              <Users size={13} />
              <span className="text-[0.625rem] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider">
                Técnicos na Campanha
              </span>
            </div>
            <p className="text-[0.75rem] sm:text-[0.875rem] font-black text-light-text-main dark:text-text-main leading-tight">
              {campanhaInfo?.totalParticipantes || 177}{' '}
              <span className="text-[0.625rem] sm:text-[0.6875rem] font-semibold text-light-text-muted dark:text-text-muted">
                técnicos
              </span>
            </p>
            <span className="text-[0.625rem] sm:text-[0.6875rem] text-emerald-500 font-bold block leading-tight mt-[0.125rem]">
              {campanhaInfo?.participantesAtivos || 150} ativos em campo
            </span>
          </div>
        ) : (
          <div className="bg-light-surface-elevated/70 dark:bg-surface-elevated/50 border border-light-border dark:border-border/60 rounded-[0.75rem] p-[0.5rem] sm:p-[0.625rem] xl:p-[0.75rem] min-h-[4.75rem] flex flex-col justify-between">
            <div className="flex items-center gap-[0.375rem] text-primary mb-[0.125rem]">
              <Award size={13} />
              <span className="text-[0.625rem] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider">
                Sua Pontuação
              </span>
            </div>
            <p className="text-[0.8125rem] sm:text-[0.9375rem] font-black text-primary leading-tight">
              {pontosTotal !== undefined && pontosTotal !== null ? Number(pontosTotal).toFixed(1) : '0.0'}{' '}
              <span className="text-[0.625rem] sm:text-[0.6875rem] font-semibold text-light-text-muted dark:text-text-muted">
                / 100 pts
              </span>
            </p>
            <span className={`text-[0.625rem] sm:text-[0.6875rem] font-bold block leading-tight mt-[0.125rem] ${elegivel !== false ? 'text-emerald-500' : 'text-rose-400'}`}>
              {elegivel !== false ? 'Elegível à Premiação' : 'Abaixo da Meta'}
            </span>
          </div>
        )}

        {/* 3. Duração da Campanha */}
        <div className="bg-light-surface-elevated/70 dark:bg-surface-elevated/50 border border-light-border dark:border-border/60 rounded-[0.75rem] p-[0.5rem] sm:p-[0.625rem] xl:p-[0.75rem] min-h-[4.75rem] flex flex-col justify-between">
          <div className="flex items-center gap-[0.375rem] text-primary mb-[0.125rem]">
            <Calendar size={13} />
            <span className="text-[0.625rem] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider">
              Duração
            </span>
          </div>
          <p className="text-[0.75rem] sm:text-[0.875rem] font-black text-light-text-main dark:text-text-main leading-tight">
            {campanhaInfo?.duracaoDias || 30}{' '}
            <span className="text-[0.625rem] sm:text-[0.6875rem] font-semibold text-light-text-muted dark:text-text-muted">
              dias
            </span>
          </p>
          <span className="text-[0.625rem] sm:text-[0.6875rem] text-light-text-muted dark:text-text-muted font-medium block leading-tight mt-[0.125rem]">
            {campanhaPeriodoFormatado}
          </span>
        </div>

        {/* 4. Tempo Restante (Dinâmico: avança no tempo e indica encerramento) */}
        <div className="bg-light-surface-elevated/70 dark:bg-surface-elevated/50 border border-light-border dark:border-border/60 rounded-[0.75rem] p-[0.5rem] sm:p-[0.625rem] xl:p-[0.75rem] min-h-[4.75rem] flex flex-col justify-between">
          <div className="flex items-center gap-[0.375rem] text-primary mb-[0.125rem]">
            <Clock size={13} />
            <span className="text-[0.625rem] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider">
              Tempo Restante
            </span>
          </div>
          <p className="text-[0.75rem] sm:text-[0.875rem] font-black text-light-text-main dark:text-text-main leading-tight">
            {isEncerrada ? (
              <span className="text-amber-500 dark:text-amber-400 font-bold">Encerrada</span>
            ) : campanhaInfo?.diasRestantes && campanhaInfo.diasRestantes > 0 ? (
              `${campanhaInfo.diasRestantes} ${campanhaInfo.diasRestantes === 1 ? 'dia restante' : 'dias restantes'}`
            ) : (
              <span className="text-amber-500 dark:text-amber-400 font-bold">Encerrada</span>
            )}
          </p>
          <div className="w-full bg-light-chart-track dark:bg-chart-track rounded-full h-[0.25rem] mt-[0.25rem] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isEncerrada ? 'bg-amber-500 dark:bg-amber-400' : 'bg-primary'
              }`}
              style={{
                width: `${percentualProgresso}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Rodapé: Resumo de SLA e Meta */}
      <div className="pt-[0.5rem] border-t border-light-border dark:border-border/60 flex items-center justify-between text-[0.75rem]">
        <span className="text-[0.6875rem] text-light-text-secondary dark:text-text-muted">
          SLA Operacional:{' '}
          <b className="text-light-text-main dark:text-text-main">
            {percentualSla.toFixed(1)}%
          </b>
        </span>
        <span
          className={`text-[0.625rem] font-bold px-[0.5rem] py-[0.125rem] rounded-[0.375rem] ${
            percentualSla >= 90.0
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-red-500/10 text-red-500'
          }`}
        >
          {percentualSla >= 90.0 ? 'Meta Atingida' : 'Abaixo da Meta'}
        </span>
      </div>
    </BentoCard>
  );
};
