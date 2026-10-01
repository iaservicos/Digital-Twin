import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Sparkles, X } from 'lucide-react';

export interface RankingItem {
  idTecnico?: number;
  matricula: string | number;
  tecnico?: string;
  nomeCompleto?: string;
  pontosTotal?: number;
  localEquipe?: string;
  ctBases?: string[];
  fotoPerfil?: string;
}

interface TechnicianSearchSelectProps {
  ranking: RankingItem[];
  selectedMatricula: string;
  onSelect: (matricula: string) => void;
  defaultMatricula?: string;
  defaultLabel?: string;
  showLabel?: boolean;
  className?: string;
}

const toTitleCase = (str: string) => {
  if (!str) return '';
  return str.toLowerCase().replace(/(?:^|\s)\w/g, (match) => match.toUpperCase());
};

export const TechnicianSearchSelect: React.FC<TechnicianSearchSelectProps> = ({
  ranking,
  selectedMatricula,
  onSelect,
  defaultMatricula,
  defaultLabel,
  showLabel = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ordenação alfabética estrita (A-Z)
  const sortedRanking = useMemo(() => {
    return [...ranking].sort((a, b) => {
      const nameA = (a.tecnico || a.nomeCompleto || '').trim();
      const nameB = (b.tecnico || b.nomeCompleto || '').trim();
      return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
    });
  }, [ranking]);

  // Filtro em tempo real por nome, matrícula ou base
  const filteredTechnicians = useMemo(() => {
    const term = searchQuery
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (!term) return sortedRanking;

    return sortedRanking.filter((tec) => {
      const nome = (tec.tecnico || tec.nomeCompleto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const matricula = String(tec.matricula || '').toLowerCase();
      const base = (tec.localEquipe || (tec.ctBases && tec.ctBases[0]) || '').toLowerCase();

      return nome.includes(term) || matricula.includes(term) || base.includes(term);
    });
  }, [sortedRanking, searchQuery]);

  // Técnico selecionado atualmente
  const currentTecnico = useMemo(() => {
    return ranking.find(
      (r) => String(r.matricula) === String(selectedMatricula)
    ) || null;
  }, [ranking, selectedMatricula]);

  // Identifica se a seleção atual difere da matrícula padrão
  const isSelectedDifferentFromDefault = useMemo(() => {
    if (!defaultMatricula) return false;
    return String(selectedMatricula) !== String(defaultMatricula);
  }, [selectedMatricula, defaultMatricula]);

  // Fechar ao clicar fora ou pressionar ESC
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (mat: string | number) => {
    onSelect(String(mat));
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleReset = () => {
    setSearchQuery('');
    if (defaultMatricula) {
      onSelect(String(defaultMatricula));
    } else if (ranking.length > 0) {
      onSelect(String(ranking[0].matricula));
    }
    setIsOpen(false);
  };

  // Valor exibido no input
  const displayInputValue = isOpen && searchQuery !== ''
    ? searchQuery
    : (currentTecnico ? toTitleCase(currentTecnico.tecnico || currentTecnico.nomeCompleto || '') : '');

  return (
    <div ref={containerRef} className={`w-full sm:w-auto relative ${className}`}>
      {showLabel && (
        <label className="block text-[0.6875rem] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider mb-[0.25rem] ml-[0.25rem] flex items-center justify-between">
          <span>Pesquisar Técnico</span>
          {(searchQuery || isSelectedDifferentFromDefault) && (
            <button
              type="button"
              onClick={handleReset}
              className="text-primary hover:underline lowercase font-medium tracking-normal cursor-pointer"
            >
              limpar
            </button>
          )}
        </label>
      )}

      {/* Input Pill Principal com Ícone de Busca e Chevron/Limpar */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-[0.875rem] top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          placeholder="Nome ou matrícula..."
          value={displayInputValue}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={(e) => {
            setIsOpen(true);
            e.target.select();
          }}
          onClick={() => setIsOpen(true)}
          className="w-full sm:w-[18rem] glass-bento border border-light-border/60 dark:border-white/10 text-light-text-main dark:text-text-main text-[0.75rem] font-semibold rounded-full pl-[2.5rem] pr-[2.25rem] py-[0.625rem] focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner cursor-pointer placeholder:text-light-text-muted dark:placeholder:text-text-muted/60"
        />

        {searchQuery || isSelectedDifferentFromDefault ? (
          <button
            type="button"
            onClick={handleReset}
            className="absolute right-[0.75rem] top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main p-[0.125rem] rounded-full hover:bg-light-surface-elevated dark:hover:bg-surface-elevated transition-colors cursor-pointer"
            title="Limpar seleção e voltar ao perfil padrão"
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown
            size={14}
            className={`absolute right-[0.875rem] top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted pointer-events-none transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-primary' : ''
            }`}
          />
        )}
      </div>

      {/* Dropdown com Resultados em Tempo Real */}
      {isOpen && (
        <div className="absolute right-0 w-full sm:w-[22rem] mt-[0.375rem] bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-[1rem] shadow-2xl z-50 p-[0.5rem] max-h-[18rem] overflow-y-auto scrollbar-hide backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Card de Retorno Rápido: Meu Perfil / Início */}
          <button
            type="button"
            onClick={handleReset}
            className={`w-full text-left px-[0.75rem] py-[0.5rem] rounded-[0.75rem] text-[0.75rem] font-bold transition-all flex items-center justify-between cursor-pointer mb-[0.25rem] ${
              !isSelectedDifferentFromDefault
                ? 'bg-primary/20 text-primary border border-primary/40'
                : 'text-light-text-secondary dark:text-text-muted hover:bg-primary/10 hover:text-primary'
            }`}
          >
            <span className="flex items-center gap-[0.5rem]">
              <Sparkles size={14} className="text-primary" />
              {defaultLabel || '✨ Meu Perfil (Técnico Logado)'}
            </span>
            <span className="text-[0.625rem] text-light-text-muted dark:text-text-muted bg-light-surface-elevated dark:bg-surface-elevated px-[0.5rem] py-[0.125rem] rounded-[0.375rem] font-semibold">
              {ranking.length} tec
            </span>
          </button>

          <div className="border-t border-light-border dark:border-border/60 my-[0.25rem]"></div>

          {filteredTechnicians.length === 0 ? (
            <div className="px-[0.75rem] py-[1rem] text-center text-[0.75rem] text-light-text-muted dark:text-text-muted">
              Nenhum técnico encontrado para esta busca.
            </div>
          ) : (
            filteredTechnicians.map((t) => {
              const isSelected = String(t.matricula) === String(selectedMatricula);
              const nome = t.tecnico || t.nomeCompleto || 'Sem Nome';
              const base = t.localEquipe || (t.ctBases && t.ctBases[0]);

              return (
                <button
                  key={t.matricula || t.idTecnico}
                  type="button"
                  onClick={() => handleSelect(t.matricula)}
                  className={`w-full text-left px-[0.75rem] py-[0.5rem] rounded-[0.75rem] text-[0.75rem] transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-primary/15 text-primary border border-primary/30 font-bold'
                      : 'text-light-text-secondary dark:text-text-muted hover:bg-light-surface-elevated dark:hover:bg-surface-elevated hover:text-light-text-main dark:hover:text-text-main font-medium'
                  }`}
                >
                  <div className="truncate mr-[0.5rem]">
                    <p className="truncate font-semibold">{toTitleCase(nome)}</p>
                    <p className="text-[0.625rem] text-light-text-muted dark:text-text-muted">
                      Mat: {t.matricula || 'S/M'}
                    </p>
                  </div>
                  {base && (
                    <span className="shrink-0 text-[0.625rem] bg-light-surface-elevated dark:bg-surface-elevated text-light-text-muted dark:text-text-muted border border-light-border dark:border-border px-[0.375rem] py-[0.125rem] rounded-[0.25rem]">
                      {base}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
