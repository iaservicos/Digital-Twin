import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSyncStore } from '../../store/syncStore';
import { Loader2, CheckCircle, Clock, X, ArrowRight, Sparkles, DatabaseZap, AlertCircle } from 'lucide-react';


const formatDuration = (totalSeconds?: number | null): string => {
  if (!totalSeconds || totalSeconds <= 0) return '0s';
  const sec = Math.round(totalSeconds);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
};

export default function DatabricksSyncFloatingWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tracker, fetchStatus, tickSeconds, isWidgetDismissed, dismissWidget } = useSyncStore();

  // Ticker de 1 segundo para atualizar a contagem regressiva e buscar status em tempo real
  useEffect(() => {
    fetchStatus();

    let intervalId: any = null;
    if (tracker.status === 'processing') {
      intervalId = setInterval(() => {
        tickSeconds();
        fetchStatus();
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [tracker.status, fetchStatus, tickSeconds]);

  // Se o widget foi fechado manualmente pelo usuário ou está idle, não renderiza nada
  if (isWidgetDismissed || tracker.status === 'idle') {
    return null;
  }

  // O Pop-up Flutuante fica OCULTO dentro da página de Ingestão/Configurações (/configuracoes)
  // e surge automaticamente APENAS quando o usuário navega para fora da tela!
  const isSettingsPage = location.pathname === '/configuracoes';
  if (isSettingsPage) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 max-w-sm w-full animate-in fade-in slide-in-from-bottom-5 duration-300">
      {/* 1. MODO EM PROCESSAMENTO (PROGRESSO % + CONTAGEM REGRESSIVA AO SAIR DA TELA DE INGESTÃO) */}
      {tracker.status === 'processing' && (
        <div className="bg-slate-900/95 dark:bg-[#1e293b]/95 backdrop-blur-md border border-accent-teal/40 rounded-2xl p-4 shadow-2xl shadow-accent-teal/20 text-white space-y-3 relative overflow-hidden group">
          <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-accent-teal to-emerald-400 animate-pulse" style={{ width: `${tracker.progress}%` }}></div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-accent-teal text-xs tracking-wider uppercase">
              <DatabaseZap size={16} className="animate-bounce" />
              Sincronizando / Processando
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-accent-teal bg-accent-teal/10 px-2 py-0.5 rounded">
                {tracker.progress}%
              </span>
              <button 
                onClick={dismissWidget}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="Minimizar pop-up"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <p className="text-xs font-medium text-slate-300 truncate">
            {tracker.step}
          </p>

          {/* Barra de Progresso Minimizada */}
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-accent-teal h-full rounded-full transition-all duration-300"
              style={{ width: `${tracker.progress}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span className="flex items-center gap-1 text-accent-teal font-medium">
              <Clock size={12} className="animate-spin" />
              <strong className="font-mono text-white font-bold">{formatDuration(tracker.estimated_seconds_remaining)} restantes</strong>
            </span>
            <button
              onClick={() => navigate('/configuracoes')}
              className="text-accent-teal hover:underline flex items-center gap-1 font-semibold"
            >
              Ver Detalhes <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* 2. MODO CONCLUÍDO COM SUCESSO (100%) */}
      {tracker.status === 'success' && (
        <div className="bg-slate-900/95 dark:bg-[#0f172a]/95 backdrop-blur-md border border-emerald-500/50 rounded-2xl p-4 shadow-2xl shadow-emerald-500/20 text-white space-y-3 relative overflow-hidden animate-in zoom-in-95 duration-300">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Sparkles size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-400">Processamento Concluído!</h4>
                <p className="text-[11px] text-emerald-200/80">Dados e métricas finalizados com sucesso.</p>
              </div>
            </div>
            <button 
              onClick={dismissWidget}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 bg-slate-800/60 p-2.5 rounded-xl">
            {tracker.total_rows > 0 && <span>Total: <strong className="font-mono text-emerald-400">{tracker.total_rows}</strong></span>}
            <span>Tempo Total: <strong className="font-mono text-emerald-400">{formatDuration(tracker.elapsed_seconds)}</strong></span>
          </div>
        </div>
      )}

      {/* 3. MODO FALHA */}
      {tracker.status === 'failed' && (
        <div className="bg-slate-900/95 dark:bg-[#0f172a]/95 backdrop-blur-md border border-rose-500/50 rounded-2xl p-4 shadow-2xl shadow-rose-500/20 text-white space-y-3 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                <AlertCircle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-rose-400">Falha no Processamento</h4>
                <p className="text-[11px] text-rose-300/80 truncate max-w-[200px]">{tracker.error || 'Erro no servidor'}</p>
              </div>
            </div>
            <button 
              onClick={dismissWidget}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
