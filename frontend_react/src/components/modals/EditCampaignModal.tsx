import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Save, Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';

interface FaixaPontuacao {
  idFaixa: number;
  valorMinimo: number;
  valorMaximo: number;
  pontosObtidos: number;
}

interface RegraKpi {
  idRegra: number;
  nomeIndicador: string;
  descricao: string;
  classe: string;
  pesoPercentual: number;
  metaPercentual: number;
}

interface Campanha {
  idCampanha?: number;
  dataInicio: string;
  dataFim: string;
  duracaoMeses: number;
  ativa: boolean;
}

interface EditCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProcessarMes: () => void;
  isProcessing: boolean;
}

export const EditCampaignModal: React.FC<EditCampaignModalProps> = ({
  isOpen,
  onClose,
  onProcessarMes,
  isProcessing
}) => {
  const [regras, setRegras] = useState<RegraKpi[]>([]);
  const [faixas, setFaixas] = useState<Record<number, FaixaPontuacao[]>>({});
  const [campanha, setCampanha] = useState<Campanha | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [savingCampanha, setSavingCampanha] = useState(false);

  const sumMaxPoints = React.useMemo(() => {
    let sum = 0;
    for (const regra of regras) {
      const faixasRegra = faixas[regra.idRegra] || [];
      if (faixasRegra.length > 0) {
        const maxPoints = Math.max(...faixasRegra.map(f => Number(f.pontosObtidos) || 0));
        sum += maxPoints;
      }
    }
    return sum;
  }, [regras, faixas]);

  useEffect(() => {
    if (isOpen) {
      carregarRegras();
    }
  }, [isOpen]);

  const carregarRegras = async () => {
    setLoading(true);
    try {
      const [resRegras, resCampanha] = await Promise.all([
        api.get('/regras'),
        api.get('/campanha/ativa').catch(() => ({ data: null }))
      ]);

      setRegras(resRegras.data);
      if (resCampanha.data) {
        setCampanha(resCampanha.data);
      } else {
        // Default if not found
        setCampanha({
          dataInicio: new Date().toISOString().split('T')[0],
          dataFim: '',
          duracaoMeses: 3,
          ativa: true
        });
      }
      
      const faixasMap: Record<number, FaixaPontuacao[]> = {};
      for (const regra of resRegras.data) {
        const faixasRes = await api.get(`/regras/${regra.idRegra}/faixas`);
        // Convert fetched decimal values to percentage for UI state
        faixasMap[regra.idRegra] = faixasRes.data.map((f: FaixaPontuacao) => ({
          ...f,
          valorMinimo: typeof f.valorMinimo === 'number' ? Math.round(f.valorMinimo * 100 * 100) / 100 : f.valorMinimo,
          valorMaximo: typeof f.valorMaximo === 'number' ? Math.round(f.valorMaximo * 100 * 100) / 100 : f.valorMaximo
        }));
      }
      setFaixas(faixasMap);
    } catch (error) {
      console.error('Erro ao carregar regras:', error);
      alert('Erro ao carregar configurações da campanha.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCampanha = async () => {
    if (!campanha) return;
    setSavingCampanha(true);
    try {
      const res = await api.post('/campanha/ativa', {
        dataInicio: campanha.dataInicio,
        duracaoMeses: campanha.duracaoMeses
      });
      setCampanha(res.data);
      alert('Configurações da campanha salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar campanha:', error);
      alert('Erro ao salvar a campanha.');
    } finally {
      setSavingCampanha(false);
    }
  };

  const handleUpdateFaixa = (idRegra: number, index: number, field: keyof FaixaPontuacao, value: string) => {
    const newFaixas = { ...faixas };
    let parsedValue = parseFloat(value) || 0;
    
    // Cap at 100% and prevent negative
    if (field === 'valorMinimo' || field === 'valorMaximo') {
      if (parsedValue > 100) parsedValue = 100;
      if (parsedValue < 0) parsedValue = 0;
    }

    // We allow storing the raw value (or float) directly because state now holds percentages
    newFaixas[idRegra][index] = {
      ...newFaixas[idRegra][index],
      [field]: parsedValue
    };
    setFaixas(newFaixas);
  };

  const handleSaveFaixa = async (idRegra: number, faixa: FaixaPontuacao) => {
    setSaving(faixa.idFaixa || -1); // use -1 for unsaved rows
    try {
      // Convert UI percentage back to decimal for backend
      const payload = {
        ...faixa,
        valorMinimo: faixa.valorMinimo / 100,
        valorMaximo: faixa.valorMaximo / 100
      };

      if (faixa.idFaixa) {
        await api.put(`/regras/faixas/${faixa.idFaixa}`, payload);
      } else {
        const res = await api.post(`/regras/${idRegra}/faixas`, payload);
        // Update temporary ID with real ID
        const newFaixas = { ...faixas };
        const index = newFaixas[idRegra].findIndex(f => f.idFaixa === 0);
        if (index >= 0) {
            // Convert backend decimal back to percentage for UI
            const savedFaixa = res.data;
            savedFaixa.valorMinimo = savedFaixa.valorMinimo * 100;
            savedFaixa.valorMaximo = savedFaixa.valorMaximo * 100;
            newFaixas[idRegra][index] = savedFaixa;
        }
        setFaixas(newFaixas);
      }
      alert('Faixa salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar faixa:', error);
      alert('Erro ao salvar faixa.');
    } finally {
      setSaving(null);
    }
  };

  const handleAddFaixa = (idRegra: number) => {
    const newFaixas = { ...faixas };
    newFaixas[idRegra] = [...(newFaixas[idRegra] || []), {
      idFaixa: 0,
      valorMinimo: 0,
      valorMaximo: 0,
      pontosObtidos: 0
    }];
    setFaixas(newFaixas);
  };

  const handleDeleteFaixa = async (idRegra: number, idFaixa: number, index: number) => {
    if (!confirm('Deseja realmente remover esta faixa?')) return;
    
    try {
      if (idFaixa !== 0) {
        await api.delete(`/regras/faixas/${idFaixa}`);
      }
      const newFaixas = { ...faixas };
      newFaixas[idRegra].splice(index, 1);
      setFaixas(newFaixas);
    } catch (error) {
      console.error('Erro ao deletar faixa:', error);
      alert('Erro ao deletar faixa.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-light-surface dark:bg-surface rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-light-borderStrong dark:border-border mt-10">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-light-borderStrong dark:border-border">
          <div>
            <h2 className="text-xl font-bold text-light-text-main dark:text-text-main">
              Editar Configurações da Campanha
            </h2>
            <p className="text-sm text-light-text-muted dark:text-text-muted mt-1">
              Ajuste as datas da campanha e defina as faixas de pontuação (Valores em %).
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-light-text-muted dark:text-text-muted hover:bg-light-background dark:hover:bg-background rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center p-8">
              <RefreshCw className="animate-spin text-accent-teal" size={32} />
            </div>
          ) : (
            <div className="space-y-8">
              
              {/* Configurações Gerais da Campanha */}
              {campanha && (
                <div className="bg-light-background dark:bg-background p-5 rounded-xl border border-light-border dark:border-border shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-light-text-main dark:text-text-main text-base">Período da Campanha</h3>
                      <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5">Defina a data de início e a duração em meses</p>
                    </div>
                    <button
                      onClick={handleSaveCampanha}
                      disabled={savingCampanha}
                      className="text-sm flex items-center gap-1.5 bg-accent-teal text-white px-3 py-1.5 rounded-lg hover:bg-accent-teal/90 transition-colors disabled:opacity-50 font-medium"
                    >
                      {savingCampanha ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />} 
                      Salvar Período
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-light-text-muted dark:text-text-muted mb-1 ml-1 uppercase tracking-wider">
                        Data de Início
                      </label>
                      <input 
                        type="date"
                        value={campanha.dataInicio}
                        onChange={(e) => setCampanha({ ...campanha, dataInicio: e.target.value })}
                        className="w-full bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-lg px-3 py-2 text-sm text-light-text-main dark:text-text-main focus:outline-none focus:ring-1 focus:ring-accent-teal transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-light-text-muted dark:text-text-muted mb-1 ml-1 uppercase tracking-wider">
                        Duração (Meses)
                      </label>
                      <input 
                        type="number"
                        min="1"
                        max="12"
                        value={campanha.duracaoMeses}
                        onChange={(e) => setCampanha({ ...campanha, duracaoMeses: parseInt(e.target.value) || 3 })}
                        className="w-full bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-lg px-3 py-2 text-sm text-light-text-main dark:text-text-main focus:outline-none focus:ring-1 focus:ring-accent-teal transition-shadow"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Regras e Faixas */}
              {regras.map((regra) => (
                <div key={regra.idRegra} className="bg-light-background dark:bg-background p-5 rounded-xl border border-light-border dark:border-border shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="font-semibold text-light-text-main dark:text-text-main">{regra.nomeIndicador}</h3>
                      <p className="text-xs text-light-text-muted dark:text-text-muted">{regra.descricao}</p>
                    </div>
                    <button
                      onClick={() => handleAddFaixa(regra.idRegra)}
                      className="text-xs flex items-center gap-1 bg-accent-teal/10 text-accent-teal px-2 py-1 rounded hover:bg-accent-teal/20 transition-colors"
                    >
                      <Plus size={14} /> Adicionar Faixa
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-light-text-muted dark:text-text-muted px-2 uppercase tracking-wider">
                      <div className="col-span-3">Mínimo (%)</div>
                      <div className="col-span-3">Máximo (%)</div>
                      <div className="col-span-3">Pontos</div>
                      <div className="col-span-3 text-center">Ações</div>
                    </div>
                    
                    {(faixas[regra.idRegra] || []).map((faixa, index) => {
                      return (
                      <div key={faixa.idFaixa || index} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3 relative">
                          <input 
                            type="number"
                            min="0"
                            max="100"
                            value={faixa.valorMinimo}
                            onChange={(e) => handleUpdateFaixa(regra.idRegra, index, 'valorMinimo', e.target.value)}
                            className="w-full bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-lg pl-3 pr-6 py-2 text-sm text-light-text-main dark:text-text-main focus:outline-none focus:ring-1 focus:ring-accent-teal transition-shadow"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted text-xs">%</span>
                        </div>
                        <div className="col-span-3 relative">
                          <input 
                            type="number"
                            min="0"
                            max="100"
                            value={faixa.valorMaximo}
                            onChange={(e) => handleUpdateFaixa(regra.idRegra, index, 'valorMaximo', e.target.value)}
                            className="w-full bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-lg pl-3 pr-6 py-2 text-sm text-light-text-main dark:text-text-main focus:outline-none focus:ring-1 focus:ring-accent-teal transition-shadow"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted text-xs">%</span>
                        </div>
                        <div className="col-span-3">
                          <input 
                            type="number"
                            step="0.5"
                            value={faixa.pontosObtidos}
                            onChange={(e) => handleUpdateFaixa(regra.idRegra, index, 'pontosObtidos', e.target.value)}
                            className="w-full bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-lg px-3 py-2 text-sm text-light-text-main dark:text-text-main focus:outline-none focus:ring-1 focus:ring-accent-teal transition-shadow"
                          />
                        </div>
                        <div className="col-span-3 flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleSaveFaixa(regra.idRegra, faixa)}
                            disabled={saving === faixa.idFaixa || (saving === -1 && faixa.idFaixa === 0)}
                            className="p-1.5 text-accent-teal hover:bg-accent-teal/10 rounded transition-colors disabled:opacity-50"
                            title="Salvar"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteFaixa(regra.idRegra, faixa.idFaixa, index)}
                            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                            title="Remover"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )})}
                    {(faixas[regra.idRegra] || []).length === 0 && (
                      <p className="text-xs text-light-text-muted dark:text-text-muted text-center py-2 italic">
                        Nenhuma faixa configurada para este indicador.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-light-borderStrong dark:border-border bg-light-background dark:bg-background/50 flex justify-between items-center rounded-b-xl">
          <div className="flex flex-col gap-1">
            <div className={`text-sm font-semibold flex items-center gap-2 ${sumMaxPoints === 100 ? 'text-accent-teal' : 'text-red-500'}`}>
              Distribuição Total: {sumMaxPoints.toFixed(1)} / 100 Pontos
              {sumMaxPoints !== 100 && (
                <span className="text-xs font-normal bg-red-500/10 px-2 py-0.5 rounded text-red-500">
                  A soma máxima deve ser exatamente 100
                </span>
              )}
            </div>
            <p className="text-xs text-light-text-muted dark:text-text-muted max-w-sm mt-1">
              Após editar e salvar as faixas, verifique se a distribuição atinge os 100 pontos para recalcular.
            </p>
          </div>
          <button
            onClick={onProcessarMes}
            disabled={isProcessing || sumMaxPoints !== 100}
            className="flex items-center gap-2 bg-accent-teal hover:bg-accent-teal/90 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={18} className={isProcessing ? 'animate-spin' : ''} />
            {isProcessing ? 'Processando Mês...' : 'Processar Mês'}
          </button>
        </div>
      </div>
    </div>
  );
};
