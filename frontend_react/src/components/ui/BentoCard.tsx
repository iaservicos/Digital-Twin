import React from 'react';
import { cn } from '../../utils/cn';

export interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hoverable?: boolean;
  className?: string;
}

/**
 * Componente Primitivo de Card Bento (Padrão Oficial Brilha+).
 *
 * Consome tokens diretamente do tailwind.config.js:
 *   - rounded-bento → borderRadius.bento
 *   - backdrop-blur-bento → backdropBlur.bento
 *   - bg-surface/40 → cores do tema
 *   - p-6 → espaçamento interno padrão de cartões Bento
 *
 * Para alterar qualquer propriedade visual dos cards,
 * edite APENAS o tailwind.config.js.
 */
export const BentoCard: React.FC<BentoCardProps> = ({
  children,
  hoverable = false,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        // Fundo com translucidez + blur calibrado (tokens do tailwind.config.js)
        "bg-light-surface/80 dark:bg-surface/40",
        "backdrop-blur-bento",
        // Borda elegante com reflexo de luz sutil
        "border border-light-borderStrong/70 dark:border-white/10",
        // Raio de curvatura oficial dos bentos (token do tailwind.config.js)
        "rounded-bento",
        // Padding interno oficial (restaura o espaçamento perfeito)
        "p-6",
        // Layout, sombra e contexto group para micro-interações internas
        "shadow-lg relative overflow-hidden group",
        // Transição suave
        "transition-all duration-300 ease-in-out",
        // Hover interativo com brilho na cor primária oficial
        hoverable && "cursor-pointer hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default BentoCard;
