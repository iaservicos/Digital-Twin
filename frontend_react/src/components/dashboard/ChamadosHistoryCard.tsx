import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ChamadoItem } from './ChamadoItem';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { BentoCard } from '../ui/BentoCard';

interface ChamadosHistoryCardProps {
  tecnicoId: number;
  initialDate?: string;
}

export default function ChamadosHistoryCard({ tecnicoId, initialDate = '' }: ChamadosHistoryCardProps) {
  const [chamados, setChamados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  
  const [dataFiltro, setDataFiltro] = useState(initialDate);

  const fetchChamados = async (pageNumber: number, filterDate?: string) => {
    if (tecnicoId === undefined || tecnicoId === null) return;

    try {
      setLoading(true);
      const params: any = { page: pageNumber, size: 6 };
      
      const activeDate = filterDate !== undefined ? filterDate : dataFiltro;
      if (activeDate) {
        params.data = activeDate;
        params.dataInicio = activeDate;
        params.dataFim = activeDate;
      }
      
      const response = await api.get(`/dashboard/tecnico/${tecnicoId}/chamados`, { params });
      if (response.data) {
        setChamados(response.data.content || []);
        setTotalPages(response.data.totalPages || 0);
        setTotalElements(response.data.totalElements || 0);
      }
    } catch (error) {
      console.error('Erro ao buscar chamados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tecnicoId !== undefined && tecnicoId !== null) {
      const dateToUse = initialDate || '';
      setDataFiltro(dateToUse);
      fetchChamados(0, dateToUse);
      setPage(0);
    }
  }, [tecnicoId, initialDate]);

  const handlePesquisar = () => {
    fetchChamados(0);
    setPage(0);
  };

  const handleLimparFiltro = () => {
    setDataFiltro('');
    fetchChamados(0, '');
    setPage(0);
  };

  const handlePrevious = () => {
    if (page > 0) {
      setPage(page - 1);
      fetchChamados(page - 1);
    }
  };

  const handleNext = () => {
    if (page < totalPages - 1) {
      setPage(page + 1);
      fetchChamados(page + 1);
    }
  };

  return (
    <BentoCard className="p-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-light-text-main dark:text-text-main">
            Histórico de Chamados
          </h3>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            {totalElements} {totalElements === 1 ? 'chamado' : 'chamados'}
          </span>
        </div>
        
        <div className="flex items-center gap-2 text-sm bg-light-border/30 dark:bg-background rounded-positivo-md p-1 border border-light-borderStrong dark:border-border/50 flex-wrap">
          <Calendar size={14} className="text-light-text-muted ml-2" />
          <input 
            type="date" 
            value={dataFiltro}
            onChange={(e) => setDataFiltro(e.target.value)}
            className="bg-transparent border-none text-light-text-main dark:text-text-main text-xs focus:ring-0 outline-none w-auto cursor-pointer"
            title="Data Específica"
          />
          <button 
            onClick={handlePesquisar}
            className="bg-primary text-black dark:text-black px-2.5 py-1 rounded text-xs font-bold hover:bg-primary-light transition-colors cursor-pointer"
          >
            Filtrar
          </button>
          {dataFiltro && (
            <button 
              onClick={handleLimparFiltro}
              className="text-xs text-light-text-muted hover:text-light-text-main dark:text-text-muted dark:hover:text-text-main px-1.5 py-1 transition-colors cursor-pointer"
              title="Ver todos os dias"
            >
              Todos
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2.5 flex-grow">
        {loading ? (
          <div className="flex justify-center items-center h-36">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : chamados.length > 0 ? (
          chamados.map((item: any, idx: number) => (
            <ChamadoItem key={item.chamado || item.id || idx} item={item} />
          ))
        ) : (
          <div className="text-center text-light-text-muted dark:text-text-muted py-12 text-xs">
            Nenhum chamado encontrado para os critérios selecionados.
          </div>
        )}
      </div>

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-light-borderStrong dark:border-border/50">
          <button 
            onClick={handlePrevious} 
            disabled={page === 0}
            className="flex items-center text-xs font-medium text-light-text-main dark:text-text-main disabled:opacity-30 disabled:cursor-not-allowed hover:text-primary cursor-pointer"
          >
            <ChevronLeft size={16} className="mr-1" />
            Anterior
          </button>
          
          <span className="text-xs text-light-text-muted">
            Página {page + 1} de {totalPages}
          </span>
          
          <button 
            onClick={handleNext} 
            disabled={page >= totalPages - 1}
            className="flex items-center text-xs font-medium text-light-text-main dark:text-text-main disabled:opacity-30 disabled:cursor-not-allowed hover:text-primary cursor-pointer"
          >
            Próxima
            <ChevronRight size={16} className="ml-1" />
          </button>
        </div>
      )}
    </BentoCard>
  );
}
