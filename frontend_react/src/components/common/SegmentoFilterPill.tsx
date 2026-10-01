import React from 'react';

export type SegmentoType = 'Total' | 'Gov' | 'Corp';

interface SegmentoFilterPillProps {
  value: SegmentoType;
  onChange: (seg: SegmentoType) => void;
  className?: string;
}

export const SegmentoFilterPill: React.FC<SegmentoFilterPillProps> = ({
  value,
  onChange,
  className = ''
}) => {
  const segmentos: SegmentoType[] = ['Total', 'Gov', 'Corp'];

  return (
    <div
      className={`inline-flex items-center p-[0.1875rem] rounded-full bg-light-surface-elevated/90 dark:bg-surface border border-light-border dark:border-white/10 shadow-xs ${className}`}
    >
      {segmentos.map((seg) => {
        const isSelected = value === seg;
        return (
          <button
            key={seg}
            type="button"
            onClick={() => onChange(seg)}
            className={`px-[0.75rem] py-[0.25rem] rounded-full text-[0.6875rem] font-bold transition-all cursor-pointer ${
              isSelected
                ? 'bg-primary text-slate-950 font-black shadow-xs'
                : 'bg-transparent text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main'
            }`}
          >
            {seg}
          </button>
        );
      })}
    </div>
  );
};
