import React from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'neon' | 'primary' | 'ghost' | 'danger' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

/**
 * Componente Primitivo de Botão (Padrão Oficial Brilha+).
 * Suporta variantes declarativas, incluindo a variante 'neon' para uploads e destaques.
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className,
  ...props
}) => {
  const baseClasses = "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-base",
  };

  const variantClasses = {
    neon: "bg-primary/20 text-primary-light border-2 border-primary/80 font-bold shadow-md shadow-primary/25 hover:bg-primary/30 hover:border-primary hover:shadow-lg hover:shadow-primary/30 transition-all duration-200",
    primary: "bg-primary hover:bg-primary-dark text-slate-950 shadow-md shadow-primary/20",
    secondary: "bg-surface-elevated hover:bg-surface-hover text-text-main border border-border",
    ghost: "bg-transparent hover:bg-white/10 dark:hover:bg-surface/40 text-light-text-main dark:text-text-main",
    danger: "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 shadow-sm shadow-red-500/10",
  };

  return (
    <button
      className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

export default Button;
