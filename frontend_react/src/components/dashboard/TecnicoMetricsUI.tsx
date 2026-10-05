import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { ModalDetalhesPontuacao } from './ModalDetalhesPontuacao';
import { ModalExplicacaoSla } from './ModalExplicacaoSla';
import { ModalElegivel } from './ModalElegivel';
import { ModalInelegivel } from './ModalInelegivel';
import ModalChamadosReincidentes from './ModalChamadosReincidentes';
import ModalChamadosSlaPerdidos from './ModalChamadosSlaPerdidos';
import ModalChamadosPerdas from './ModalChamadosPerdas';
import ModalChamadosPecas from './ModalChamadosPecas';
import { ModalHistoricoChamados } from './ModalHistoricoChamados';
import { DashboardBentoDesktop } from './DashboardBentoDesktop';
import { SegmentoType } from '../common/SegmentoFilterPill';

interface TecnicoMetricsUIProps {
  metricas: any;
  displayMetricas: any;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedSegmento?: SegmentoType;
  setSelectedSegmento?: (seg: SegmentoType) => void;
}

export const TecnicoMetricsUI: React.FC<TecnicoMetricsUIProps> = ({
  metricas,
  displayMetricas,
  selectedMonth,
  setSelectedMonth,
  selectedSegmento = 'Total',
  setSelectedSegmento
}) => {
  const user = useAuthStore(state => state.user);
  const isSupervisorOrAdmin = ['SUPERVISOR', 'MODERADOR', 'ADMIN', 'ROLE_SUPERVISOR', 'ROLE_MODERADOR', 'ROLE_ADMIN'].includes((user?.role || '').toUpperCase());

  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [isSlaExplicacaoModalOpen, setIsSlaExplicacaoModalOpen] = useState(false);
  const [isReincidentesModalOpen, setIsReincidentesModalOpen] = useState(false);
  const [isSlaModalOpen, setIsSlaModalOpen] = useState(false);
  const [isPerdasModalOpen, setIsPerdasModalOpen] = useState(false);
  const [isPecasModalOpen, setIsPecasModalOpen] = useState(false);
  const [isElegivelModalOpen, setIsElegivelModalOpen] = useState(false);
  const [isInelegivelModalOpen, setIsInelegivelModalOpen] = useState(false);
  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
  const [historicoInitialDate, setHistoricoInitialDate] = useState<string>('');

  if (!displayMetricas) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <span className="mt-3 text-xs text-light-text-secondary dark:text-text-muted font-medium">
          Carregando dados do técnico...
        </span>
      </div>
    );
  }

  const percentualConsumo = displayMetricas.percentualEficienciaPecas || 0;
  const percentualSla = displayMetricas.percentualSla || 0;
  const percentualReincidencia = displayMetricas.percentualReincidencia || 0;
  const pontuacaoTotal = displayMetricas.pontosTotal || 0;

  const selLower = (selectedMonth || '').trim().toLowerCase();
  const isCampanhaInteira = !selLower || selLower === 'campanha inteira' || selLower === 'média final' || selLower.includes('final') || selLower.includes('campanha');

  return (
    <div className="w-full">
      {/* Bento Grid V2 Unificado e 100% Responsivo (Mobile, Tablet e Desktop) */}
      <DashboardBentoDesktop 
        metricas={metricas}
        displayMetricas={displayMetricas}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedSegmento={selectedSegmento}
        setSelectedSegmento={setSelectedSegmento}
        onOpenDetailsModal={() => setDetailsModalOpen(true)}
        onOpenSlaExplicacaoModal={() => setIsSlaExplicacaoModalOpen(true)}
        onOpenSlaModal={() => setIsSlaModalOpen(true)}
        onOpenReincidentesModal={() => setIsReincidentesModalOpen(true)}
        onOpenPecasModal={() => setIsPecasModalOpen(true)}
        onOpenPerdasModal={() => setIsPerdasModalOpen(true)}
        onOpenHistoricoModal={(date?: string) => {
          setHistoricoInitialDate(date || '');
          setIsHistoricoModalOpen(true);
        }}
        onOpenElegivelModal={() => setIsElegivelModalOpen(true)}
        onOpenInelegivelModal={() => setIsInelegivelModalOpen(true)}
      />

      {/* MODAL DE CHAMADOS REINCIDENTES COM ANÁLISE DE FALHAS */}
      <ModalChamadosReincidentes
        isOpen={isReincidentesModalOpen}
        onClose={() => setIsReincidentesModalOpen(false)}
        tecnicoId={displayMetricas.idTecnico || (displayMetricas as any).id || (user as any)?.idTecnico || (user as any)?.id}
        tecnicoNome={displayMetricas.tecnico || displayMetricas.nomeCompleto || user?.nomeCompleto}
        selectedMonth={selectedMonth}
        percentualReincidencia={percentualReincidencia}
        pontosReincidencia={displayMetricas.pontosReincidencia || 0}
      />

      {/* MODAL DE CHAMADOS PERDIDOS DE SLA E CAUSAS */}
      <ModalChamadosSlaPerdidos
        isOpen={isSlaModalOpen}
        onClose={() => setIsSlaModalOpen(false)}
        tecnicoId={displayMetricas.idTecnico || (displayMetricas as any).id || (user as any)?.idTecnico || (user as any)?.id}
        tecnicoNome={displayMetricas.tecnico || displayMetricas.nomeCompleto || user?.nomeCompleto}
        selectedMonth={selectedMonth}
        percentualSla={percentualSla}
        pontosSla={displayMetricas.pontosSla || 0}
        initialTipo="equipe"
      />

      {/* MODAL DE PERDAS (FALHAS DE GESTÃO & TRANSFERÊNCIA ENTRE BASES) */}
      <ModalChamadosPerdas
        isOpen={isPerdasModalOpen}
        onClose={() => setIsPerdasModalOpen(false)}
        tecnicoId={displayMetricas.idTecnico || (displayMetricas as any).id || (user as any)?.idTecnico || (user as any)?.id}
        tecnicoNome={displayMetricas.tecnico || displayMetricas.nomeCompleto || user?.nomeCompleto}
        selectedMonth={selectedMonth}
        percentualPerdidos={displayMetricas.percentualPerdidos || 0}
      />

      {/* MODAL DE DETALHAMENTO DE PEÇAS APLICADAS */}
      <ModalChamadosPecas
        isOpen={isPecasModalOpen}
        onClose={() => setIsPecasModalOpen(false)}
        tecnicoId={displayMetricas.idTecnico || (displayMetricas as any).id || (user as any)?.idTecnico || (user as any)?.id}
        tecnicoNome={displayMetricas.tecnico || displayMetricas.nomeCompleto || user?.nomeCompleto}
        selectedMonth={selectedMonth}
        percentualConsumo={percentualConsumo}
        pontosPecas={displayMetricas.pontosPecas || 12.5}
      />

      <ModalDetalhesPontuacao 
        isOpen={detailsModalOpen} 
        onClose={() => setDetailsModalOpen(false)} 
        metricas={displayMetricas}
      />

      {/* MODAL EXPLICATIVO DE SLA & REGRAS DE PONTUAÇÃO (CARD 1) */}
      <ModalExplicacaoSla
        isOpen={isSlaExplicacaoModalOpen}
        onClose={() => setIsSlaExplicacaoModalOpen(false)}
      />
      
      <ModalElegivel 
        isOpen={isElegivelModalOpen} 
        onClose={() => setIsElegivelModalOpen(false)} 
        premioAtual={getPremioInfo(pontuacaoTotal)}
        pontuacaoTotal={pontuacaoTotal}
      />
      
      <ModalInelegivel 
        isOpen={isInelegivelModalOpen} 
        onClose={() => setIsInelegivelModalOpen(false)} 
        motivoInelegibilidade={displayMetricas.motivoInelegibilidade || "Não atingiu os critérios mínimos do mês."}
      />

      {/* MODAL DE HISTÓRICO E AUDITORIA DE CHAMADOS (CARD 3 DESKTOP) */}
      <ModalHistoricoChamados 
        isOpen={isHistoricoModalOpen} 
        onClose={() => setIsHistoricoModalOpen(false)} 
        tecnicoId={displayMetricas.idTecnico || (displayMetricas as any).id || (user as any)?.idTecnico || (user as any)?.id || 0}
        initialDate={historicoInitialDate}
      />
    </div>
  );
};

function getPremioInfo(pontos: number) {
  if (pontos >= 90) return { titulo: '1º Prêmio', valor: 'R$ 300,00' };
  if (pontos >= 80) return { titulo: '2º Prêmio', valor: 'R$ 200,00' };
  if (pontos >= 70) return { titulo: '3º Prêmio', valor: 'R$ 100,00' };
  return null;
}
