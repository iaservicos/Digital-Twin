import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ChamadoItem } from './ChamadoItem';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface ChamadosHistoryCardProps {
  tecnicoId: number;
}

export default function ChamadosHistoryCard({ tecnicoId }: ChamadosHistoryCardProps) {
  const [chamados, setChamados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  const [dataFiltro, setDataFiltro] = useState('');

  const fetchChamados = async (pageNumber: number) => {
    if (!tecnicoId || tecnicoId === 0) return;

    try {
      setLoading(true);
      const params: any = { page: pageNumber, size: 3 };
      
      if (dataFiltro) {
        params.dataInicio = dataFiltro;
        params.dataFim = dataFiltro;
      }
      
      const response = await api.get(`/dashboard/tecnico/${tecnicoId}/chamados`, { params });
      if (response.data) {
        setChamados(response.data.content || []);
        setTotalPages(response.data.totalPages || 0);
      }
    } catch (error) {
      console.error('Erro ao buscar chamados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tecnicoId && tecnicoId !== 0) {
      fetchChamados(0);
      setPage(0);
    }
  }, [tecnicoId]);

  const handlePesquisar = () => {
    fetchChamados(0);
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
    <div className="bg-light-surface dark:bg-surface p-6 rounded-positivo-lg shadow-sm border border-light-border dark:border-border h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <h3 className="text-base font-bold text-light-text-main dark:text-text-main">Histórico de Chamados</h3>
        
        <div className="flex items-center gap-2 text-sm bg-slate-100 dark:bg-background rounded-positivo-md p-1 border border-light-borderStrong dark:border-border/50">
          <Calendar size={14} className="text-light-text-muted ml-2" />
          <input 
            type="date" 
            value={dataFiltro}
            onChange={(e) => setDataFiltro(e.target.value)}
            className="bg-transparent border-none text-light-text-main dark:text-text-main text-xs focus:ring-0 outline-none w-auto"
            title="Data Específica"
          />
          <button 
            onClick={handlePesquisar}
            className="bg-accent-teal text-white px-2 py-1 rounded text-xs font-medium hover:bg-teal-500 transition-colors"
          >
            Filtrar
          </button>
        </div>
      </div>

      <div className="space-y-3 flex-grow">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-teal"></div>
          </div>
        ) : chamados.length > 0 ? (
          chamados.map((item: any) => (
            <ChamadoItem key={item.id} item={item} />
          ))
        ) : (
          <div className="text-center text-light-text-muted dark:text-text-muted py-8 text-sm">
            Nenhum chamado encontrado.
          </div>
        )}
      </div>

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-light-borderStrong dark:border-border/50">
          <button 
            onClick={handlePrevious} 
            disabled={page === 0}
            className="flex items-center text-xs font-medium text-light-text-main dark:text-text-main disabled:opacity-30 disabled:cursor-not-allowed hover:text-accent-teal"
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
            className="flex items-center text-xs font-medium text-light-text-main dark:text-text-main disabled:opacity-30 disabled:cursor-not-allowed hover:text-accent-teal"
          >
            Próxima
            <ChevronRight size={16} className="ml-1" />
          </button>
        </div>
      )}
    </div>
  );
}
