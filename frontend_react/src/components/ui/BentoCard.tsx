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
 * Consome o efeito glass centralizado diretamente do tailwind.config.js:
 *   - glass-bento → utilitário oficial (surfaceGlass, borderGlass, blur 16px)
 *   - rounded-bento → borderRadius.bento
 *   - p-6 → espaçamento interno padrão de cartões Bento
 *
 * Para calibrar a transparência, cor do vidro ou intensidade do blur,
 * edite APENAS as variáveis surfaceGlass e borderGlass no tailwind.config.js.
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
        // Efeito Glassmorphism oficial centralizado no tailwind.config.js
        "glass-bento border",
        // Raio de curvatura oficial dos bentos (token do tailwind.config.js)
        "rounded-bento",
        // Padding interno oficial (restaura o espaçamento perfeito)
        "p-6",
        // Layout e contexto group para micro-interações internas
        "relative overflow-hidden group",
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
