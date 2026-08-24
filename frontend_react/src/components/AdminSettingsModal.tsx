import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Calendar, Save, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminSettingsModal({ isOpen, onClose }: AdminSettingsModalProps) {
  const { user } = useAuthStore();
  const isAdmin = user?.cargo === 'Administrador' || user?.cargo === 'Admin' || user?.cargo === 'Super Administrador';

  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro', texto: string } | null>(null);

  useEffect(() => {
    if (isOpen && isAdmin) {
      setMensagem(null);
      carregarCampanhaAtiva();
    }
  }, [isOpen, isAdmin]);

  const carregarCampanhaAtiva = async () => {
    setLoading(true);
    try {
      const response = await api.get('/campanha/ativa');
      if (response.data) {
        setDataInicio(response.data.dataInicio);
        setDataFim(response.data.dataFim);
      }
    } catch (error) {
      console.error('Erro ao carregar campanha:', error);
    } finally {
      setLoading(false);
    }
  };

  const salvarCampanha = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMensagem(null);

    try {
      await api.post('/campanha/ativa', {
        dataInicio,
        dataFim
      });
      setMensagem({ tipo: 'sucesso', texto: 'Período atualizado! O dashboard de todos já está usando as novas datas.' });
      
      // Opcional: fechar após salvar ou deixar aberto para mostrar mensagem
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Erro ao salvar campanha:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar o período da campanha.' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !isAdmin) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-light-surface dark:bg-surface rounded-positivo-xl shadow-xl w-full max-w-lg overflow-hidden border border-light-borderStrong dark:border-border animate-in zoom-in-95 duration-200">
        
        {/* Header do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-light-border dark:border-border bg-light-background dark:bg-surface/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-positivo-primary/10 rounded-lg text-positivo-primary">
              <Calendar size={20} />
            </div>
            <h2 className="text-lg font-bold text-light-text-main dark:text-text-main">Período de Apuração</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-light-text-muted hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 overflow-y-auto max-h-[70vh] scrollbar-hide">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-teal"></div>
            </div>
          ) : (
            <>
              {mensagem && (
                <div className={`mb-6 p-4 rounded-md flex items-start space-x-3 ${
                  mensagem.tipo === 'sucesso' 
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                    : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
                }`}>
                  {mensagem.tipo === 'sucesso' ? <CheckCircle size={20} className="mt-0.5" /> : <AlertCircle size={20} className="mt-0.5" />}
                  <p className="text-sm font-medium">{mensagem.texto}</p>
                </div>
              )}

              <form onSubmit={salvarCampanha} className="space-y-5">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="dataInicio" className="block text-sm font-bold text-light-text-secondary dark:text-text-main mb-1.5">
                      Data de Início
                    </label>
                    <input
                      type="date"
                      id="dataInicio"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 border border-light-borderStrong dark:border-border rounded-lg shadow-sm focus:ring-2 focus:ring-positivo-primary focus:border-positivo-primary bg-light-surface dark:bg-background text-light-text-main dark:text-text-main"
                    />
                  </div>

                  <div>
                    <label htmlFor="dataFim" className="block text-sm font-bold text-light-text-secondary dark:text-text-main mb-1.5">
                      Data de Fim
                    </label>
                    <input
                      type="date"
                      id="dataFim"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 border border-light-borderStrong dark:border-border rounded-lg shadow-sm focus:ring-2 focus:ring-positivo-primary focus:border-positivo-primary bg-light-surface dark:bg-background text-light-text-main dark:text-text-main"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving || !dataInicio || !dataFim}
                    className="w-full flex justify-center items-center px-4 py-2.5 bg-positivo-primary text-text-main rounded-lg font-bold hover:bg-positivo-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-positivo-primary disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {saving ? (
                      <span className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                        Aplicando...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <Save size={18} className="mr-2" />
                        Salvar e Recalcular
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
