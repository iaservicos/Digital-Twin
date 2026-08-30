import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { Pencil, Trash2, KeyRound, Plus, X, Search, Loader2 } from 'lucide-react';
import { toTitleCase } from '../../utils/stringFormatters';

interface Tecnico {
  idTecnico: number;
  matricula: string;
  nomeCompleto: string;
  primeiroNome?: string;
  sobrenome?: string;
  ctBases: string[];
  cargo: string;
  ativo: boolean;
  role: string;
}

export default function TecnicosManager() {
  const { token } = useAuthStore();
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState<Tecnico | null>(null);
  
  // Form state
  const [primeiroNome, setPrimeiroNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [ctBasesList, setCtBasesList] = useState<string[]>(['']);
  const [role, setRole] = useState('PADRAO');
  const [ativo, setAtivo] = useState(true);
  
  const [newPassword, setNewPassword] = useState('');
  const [autoPassword, setAutoPassword] = useState(true);
  const [createPassword, setCreatePassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTecnicos();
  }, []);

  const fetchTecnicos = async () => {
    try {
      setLoading(true);
            const response = await api.get('/tecnicos');
      setTecnicos(response.data);
    } catch (err) {
      console.error('Erro ao buscar usuários', err);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (tecnico?: Tecnico) => {
    setError('');
    if (tecnico) {
      setSelectedTecnico(tecnico);
      setMatricula(tecnico.matricula || '');
      setRole(tecnico.role || 'PADRAO');
      setAtivo(tecnico.ativo ?? true);
      
      // Separar Primeiro Nome e Sobrenome
      if (tecnico.primeiroNome) {
        setPrimeiroNome(tecnico.primeiroNome);
        setSobrenome(tecnico.sobrenome || '');
      } else if (tecnico.nomeCompleto) {
        const parts = tecnico.nomeCompleto.trim().split(' ');
        setPrimeiroNome(parts[0] || '');
        setSobrenome(parts.slice(1).join(' ') || '');
      } else {
        setPrimeiroNome('');
        setSobrenome('');
      }

      // CT Bases Lista
      if (tecnico.ctBases && tecnico.ctBases.length > 0) {
        setCtBasesList([...tecnico.ctBases]);
      } else {
        setCtBasesList(['']);
      }
    } else {
      setSelectedTecnico(null);
      setPrimeiroNome('');
      setSobrenome('');
      setMatricula('');
      setCtBasesList(['']);
      setRole('PADRAO');
      setAtivo(true);
      setAutoPassword(true);
      setCreatePassword('');
    }
    setIsEditModalOpen(true);
  };

  const openPasswordModal = (tecnico: Tecnico) => {
    setError('');
    setSelectedTecnico(tecnico);
    setNewPassword('');
    setIsPasswordModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário? Esta ação é irreversível e pode afetar históricos.')) return;
    
    try {
            await api.delete(`/tecnicos/${id}`);
      setTecnicos(tecnicos.filter(t => t.idTecnico !== id));
    } catch (err) {
      console.error('Erro ao deletar', err);
      alert('Erro ao excluir usuário.');
    }
  };

  // Funções de manipulação dinâmica das CT Bases
  const handleCtBaseChange = (index: number, value: string) => {
    const newList = [...ctBasesList];
    newList[index] = value;
    setCtBasesList(newList);
  };

  const handleAddCtBase = () => {
    setCtBasesList([...ctBasesList, '']);
  };

  const handleRemoveCtBase = (index: number) => {
    if (ctBasesList.length === 1) {
      setCtBasesList(['']);
    } else {
      setCtBasesList(ctBasesList.filter((_, i) => i !== index));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const nomeCompletoFormatted = `${primeiroNome.trim()} ${sobrenome.trim()}`.trim();
    const cleanCtBases = ctBasesList.map(b => b.trim()).filter(b => b.length > 0);

    const payload = {
      primeiroNome: primeiroNome.trim(),
      sobrenome: sobrenome.trim(),
      nomeCompleto: nomeCompletoFormatted,
      matricula: matricula.trim(),
      ctBases: cleanCtBases,
      role,
      ativo
    };

    try {
            
      if (selectedTecnico) {
        // Update
        await api.put(`/tecnicos/${selectedTecnico.idTecnico}`, payload);
      } else {
        // Create 
        await api.post('/tecnicos', {
          ...payload,
          senha: autoPassword ? 'brilha123' : createPassword 
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      await fetchTecnicos();
      setIsEditModalOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar os dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTecnico || !newPassword) return;
    
    setIsSubmitting(true);
    setError('');

    try {
      await api.put(`/tecnicos/${selectedTecnico.idTecnico}/reset-senha`, 
        { novaSenha: newPassword }, 
        { headers: { Authorization: `Bearer ${token}` } });
      
      setIsPasswordModalOpen(false);
      alert('Senha redefinida com sucesso!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao redefinir a senha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTecnicos = tecnicos.filter(t => 
    t.nomeCompleto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.primeiroNome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.sobrenome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-light-surface dark:bg-[#1e293b] p-4 rounded-2xl border border-light-borderStrong dark:border-border">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome, sobrenome ou matrícula..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-surface border border-light-borderStrong dark:border-border rounded-xl text-sm focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-light-text-main dark:text-slate-200 placeholder-light-text-muted dark:placeholder-slate-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <button 
          onClick={() => openEditModal()}
          className="w-full sm:w-auto bg-accent-teal text-[#0f172a] hover:bg-emerald-400 px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Plus size={18} />
          Criar usuário
        </button>
      </div>

      <div className="bg-light-surface dark:bg-[#1e293b] border border-light-borderStrong dark:border-border rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 dark:bg-surface/50 text-light-text-muted dark:text-text-muted text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Matrícula</th>
                <th className="px-6 py-4">Nome Completo</th>
                <th className="px-6 py-4">Bases ATP</th>
                <th className="px-6 py-4">Perfil</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-borderStrong dark:divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-light-text-muted dark:text-text-muted">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                    Carregando usuários...
                  </td>
                </tr>
              ) : filteredTecnicos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-light-text-muted dark:text-text-muted">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filteredTecnicos.map(t => (
                  <tr key={t.idTecnico} className="hover:bg-slate-50 dark:hover:bg-surface/30 transition-colors">
                    <td className="px-6 py-3 font-medium text-light-text-main dark:text-slate-300">{t.matricula || '-'}</td>
                    <td className="px-6 py-3 text-light-text-main dark:text-slate-300">{toTitleCase(t.nomeCompleto)}</td>
                    <td className="px-6 py-3 text-light-text-secondary dark:text-slate-400">
                      {t.ctBases && t.ctBases.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {t.ctBases.map((b, idx) => (
                            <span key={idx} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs px-2 py-0.5 rounded-md font-mono">
                              {b}
                            </span>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider ${
                        t.role === 'MODERADOR' ? 'bg-amber-500/20 text-amber-400' : 
                        t.role === 'ADMINISTRADOR' ? 'bg-purple-500/20 text-purple-400' : 
                        'bg-slate-200 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300'
                      }`}>
                        {t.role}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`flex items-center gap-1.5 text-xs font-semibold ${t.ativo ? 'text-emerald-400' : 'text-rose-400'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${t.ativo ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                        {t.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEditModal(t)} className="p-2 hover:bg-accent-teal/10 hover:text-accent-teal text-light-text-muted dark:text-slate-400 rounded-lg transition-colors cursor-pointer" title="Editar">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => openPasswordModal(t)} className="p-2 hover:bg-amber-500/10 hover:text-amber-400 text-light-text-muted dark:text-slate-400 rounded-lg transition-colors cursor-pointer" title="Redefinir Senha">
                          <KeyRound size={16} />
                        </button>
                        <button onClick={() => handleDelete(t.idTecnico)} className="p-2 hover:bg-rose-500/10 hover:text-rose-400 text-light-text-muted dark:text-slate-400 rounded-lg transition-colors cursor-pointer" title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CRIAR / EDITAR USUÁRIO */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-light-surface dark:bg-[#1e293b] border border-light-borderStrong dark:border-border rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-light-borderStrong dark:border-border">
              <h3 className="text-xl font-bold text-light-text-main dark:text-slate-200">
                {selectedTecnico ? 'Editar usuário' : 'Criar usuário'}
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-light-text-muted dark:text-slate-400 hover:text-light-text-main dark:hover:text-white transition-colors cursor-pointer">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSave}>
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* PRIMEIRO NOME */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase">Primeiro Nome</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: João"
                      className="w-full bg-slate-50 dark:bg-surface border border-light-borderStrong dark:border-border rounded-xl p-2.5 text-light-text-main dark:text-slate-200 focus:outline-none focus:border-accent-teal"
                      value={primeiroNome}
                      onChange={e => setPrimeiroNome(e.target.value)}
                    />
                  </div>

                  {/* SOBRENOME */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase">Sobrenome</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: Silva Ramos"
                      className="w-full bg-slate-50 dark:bg-surface border border-light-borderStrong dark:border-border rounded-xl p-2.5 text-light-text-main dark:text-slate-200 focus:outline-none focus:border-accent-teal"
                      value={sobrenome}
                      onChange={e => setSobrenome(e.target.value)}
                    />
                  </div>

                  {/* MATRÍCULA */}
                  <div className="space-y-1 col-span-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase">Matrícula</label>
                    <input 
                      type="text" 
                      placeholder="Ex: 74233"
                      className="w-full bg-slate-50 dark:bg-surface border border-light-borderStrong dark:border-border rounded-xl p-2.5 text-light-text-main dark:text-slate-200 focus:outline-none focus:border-accent-teal"
                      value={matricula}
                      onChange={e => setMatricula(e.target.value)}
                    />
                  </div>

                  {/* CT BASES DINÂMICAS COM BOTÃO + */}
                  <div className="space-y-2 col-span-1 sm:col-span-2 bg-slate-100 dark:bg-surface/40 p-4 rounded-xl border border-light-borderStrong dark:border-border/50">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase">Bases ATP (CT Base)</label>
                      <button
                        type="button"
                        onClick={handleAddCtBase}
                        className="text-xs font-bold text-accent-teal hover:text-emerald-400 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus size={14} />
                        Adicionar mais uma base
                      </button>
                    </div>

                    {ctBasesList.map((ctCode, index) => (
                      <div key={index} className="flex items-center gap-2 animate-in fade-in duration-150">
                        <input 
                          type="text"
                          placeholder="Ex: 8788711"
                          className="flex-grow bg-slate-50 dark:bg-surface border border-light-borderStrong dark:border-border rounded-xl p-2.5 text-sm text-light-text-main dark:text-slate-200 focus:outline-none focus:border-accent-teal"
                          value={ctCode}
                          onChange={e => handleCtBaseChange(index, e.target.value)}
                        />
                        {ctBasesList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCtBase(index)}
                            className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Remover Base"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {!selectedTecnico && (
                    <div className="col-span-1 sm:col-span-2 space-y-3 p-4 bg-slate-100 dark:bg-surface/50 border border-light-borderStrong dark:border-border/50 rounded-xl">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={autoPassword}
                          onChange={(e) => setAutoPassword(e.target.checked)}
                          className="w-4 h-4 rounded border-light-borderStrong dark:border-border text-accent-teal focus:ring-accent-teal/30 bg-slate-50 dark:bg-surface"
                        />
                        <span className="text-sm font-medium text-light-text-main dark:text-slate-300">
                          Gerar senha padrão automaticamente (brilha123)
                        </span>
                      </label>
                      
                      {!autoPassword && (
                        <div className="space-y-1 mt-3 animate-in fade-in slide-in-from-top-2">
                          <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase">Senha Inicial</label>
                          <input 
                            required={!autoPassword}
                            type="text" 
                            className="w-full bg-slate-50 dark:bg-surface border border-light-borderStrong dark:border-border rounded-xl p-2.5 text-light-text-main dark:text-slate-200 focus:outline-none focus:border-accent-teal"
                            value={createPassword}
                            onChange={e => setCreatePassword(e.target.value)}
                            placeholder="Digite a senha..."
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase">Perfil (Role)</label>
                    <select 
                      className="w-full bg-slate-50 dark:bg-surface border border-light-borderStrong dark:border-border rounded-xl p-2.5 text-light-text-main dark:text-slate-200 focus:outline-none focus:border-accent-teal"
                      value={role}
                      onChange={e => setRole(e.target.value)}
                    >
                      <option value="PADRAO">Técnico Padrão</option>
                      <option value="ADMINISTRADOR">Administrador / Supervisor</option>
                      <option value="MODERADOR">Moderador (Acesso Total)</option>
                    </select>
                  </div>

                  <div className="space-y-1 flex items-center mt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded bg-slate-50 dark:bg-surface border-light-borderStrong dark:border-border text-accent-teal focus:ring-accent-teal"
                        checked={ativo}
                        onChange={e => setAtivo(e.target.checked)}
                      />
                      <span className="text-sm font-semibold text-light-text-main dark:text-slate-300">Usuário Ativo no Sistema</span>
                    </label>
                  </div>
                </div>
                {error && <p className="text-sm text-rose-400 font-semibold">{error}</p>}
              </div>

              <div className="p-6 border-t border-light-borderStrong dark:border-border bg-slate-100 dark:bg-[#162032] flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2 rounded-xl text-light-text-secondary dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-surface transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-xl bg-accent-teal hover:bg-emerald-400 text-[#0f172a] font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SENHA */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1e293b] border border-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-border">
              <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <KeyRound size={20} className="text-amber-400" />
                Redefinir Senha
              </h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleResetPassword}>
              <div className="p-5 space-y-4">
                <p className="text-sm text-text-muted">
                  Defina uma nova senha para <strong>{selectedTecnico?.nomeCompleto}</strong>. 
                  O usuário precisará trocar essa senha no próximo login.
                </p>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-muted uppercase">Nova Senha Temporária</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-surface border border-border rounded-xl p-3 text-slate-200 focus:outline-none focus:border-amber-400"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Ex: Temp@2025"
                  />
                </div>
                {error && <p className="text-sm text-rose-400 font-semibold">{error}</p>}
              </div>

              <div className="p-5 border-t border-border bg-[#162032] flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 font-semibold hover:bg-surface transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting || !newPassword}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Redefinindo...' : 'Confirmar Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
