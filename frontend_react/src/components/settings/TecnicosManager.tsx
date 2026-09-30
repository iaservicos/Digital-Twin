import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { Pencil, Trash2, KeyRound, Plus, X, Search, Loader2, Users, UserPlus } from 'lucide-react';
import { toTitleCase } from '../../utils/stringFormatters';
import { BentoCard } from '../ui/BentoCard';
import { Button } from '../ui/Button';

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
  const { token, user } = useAuthStore();
  const isModerador = user?.role === 'MODERADOR' || user?.cargo === 'Moderador';
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
    const tecToDelete = tecnicos.find(t => t.idTecnico === id);
    if (tecToDelete?.matricula === '72916' || tecToDelete?.role === 'MODERADOR') {
      alert('Operação não permitida: contas com perfil de Moderador não podem ser excluídas.');
      return;
    }
    if (!isModerador && tecToDelete?.role !== 'PADRAO') {
      alert('Operação não permitida: Supervisores só podem gerenciar técnicos com perfil padrão.');
      return;
    }
    if (!window.confirm(`Tem certeza que deseja excluir o usuário ${tecToDelete?.nomeCompleto || ''}? Esta ação é irreversível e pode afetar históricos.`)) return;
    
    try {
      await api.delete(`/tecnicos/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTecnicos(tecnicos.filter(t => t.idTecnico !== id));
    } catch (err: any) {
      console.error('Erro ao deletar', err);
      alert(err.response?.data?.message || 'Erro ao excluir usuário.');
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
      role: isModerador ? role : 'PADRAO',
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
    <>
      <BentoCard className="p-6 space-y-6">
      {/* Header com Ícone, Título, Busca e Botão de Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-light-border dark:border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
            <Users size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-light-text-main dark:text-text-main tracking-tight flex items-center gap-2">
              Gestão de Usuários e Técnicos
            </h3>
            <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5">
              Consulte, crie e administre os acessos e bases dos colaboradores
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted pointer-events-none" size={15} />
            <input 
              type="text" 
              placeholder="Buscar por nome, matrícula..."
              className="w-full glass-bento border border-light-border/60 dark:border-white/10 text-light-text-main dark:text-text-main text-xs font-semibold rounded-full pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner placeholder:text-light-text-muted dark:placeholder:text-text-muted/60"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Button 
            variant="primary"
            size="sm"
            onClick={() => openEditModal()}
            icon={<Plus size={16} />}
            className="shrink-0"
          >
            Criar usuário
          </Button>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="overflow-x-auto scrollbar-hide rounded-2xl border border-light-border dark:border-white/10">
        <table className="w-full text-left text-xs border-collapse min-w-[750px]">
          <thead className="bg-light-surface/60 dark:bg-surface-elevated/40 text-light-text-muted dark:text-text-muted text-xs uppercase font-semibold border-b border-light-border dark:border-white/10">
            <tr>
              <th className="px-5 py-3.5">Matrícula</th>
              <th className="px-5 py-3.5">Nome Completo</th>
              <th className="px-5 py-3.5">Bases ATP</th>
              <th className="px-5 py-3.5 text-center">Perfil</th>
              <th className="px-5 py-3.5 text-center">Status</th>
              <th className="px-5 py-3.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-light-border dark:divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-light-text-muted dark:text-text-muted">
                  <Loader2 className="animate-spin mx-auto mb-2 text-primary" size={24} />
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
                <tr key={t.idTecnico} className="hover:bg-primary/5 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-light-text-main dark:text-text-main font-mono">{t.matricula || '-'}</td>
                  <td className="px-5 py-3.5 font-bold text-light-text-main dark:text-text-main">{toTitleCase(t.nomeCompleto)}</td>
                  <td className="px-5 py-3.5 text-light-text-secondary dark:text-text-muted">
                    {t.ctBases && t.ctBases.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {t.ctBases.map((b, idx) => (
                          <span key={idx} className="bg-primary/10 border border-primary/20 text-primary text-[11px] px-2.5 py-0.5 rounded-lg font-mono font-bold">
                            {b}
                          </span>
                        ))}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                      t.role === 'MODERADOR' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 
                      t.role === 'ADMINISTRADOR' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 
                      'bg-light-buttonBg dark:bg-buttonBg text-light-text-muted dark:text-text-muted border border-light-border dark:border-border'
                    }`}>
                      {t.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      t.ativo 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${t.ativo ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-rose-500 dark:bg-rose-400'}`} />
                      {t.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {(!isModerador && t.role !== 'PADRAO') ? (
                      <span className="text-[11px] text-light-text-muted dark:text-text-muted italic px-2">Acesso restrito</span>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => openEditModal(t)} 
                          className="p-1.5 rounded-xl bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-white/10 text-light-text-muted dark:text-text-muted hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-all cursor-pointer" 
                          title="Editar Usuário"
                        >
                          <Pencil size={15} />
                        </button>
                        <button 
                          onClick={() => openPasswordModal(t)} 
                          className="p-1.5 rounded-xl bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-white/10 text-light-text-muted dark:text-text-muted hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-400 transition-all cursor-pointer" 
                          title="Redefinir Senha"
                        >
                          <KeyRound size={15} />
                        </button>
                        <button 
                          onClick={() => handleDelete(t.idTecnico)} 
                          disabled={t.matricula === '72916' || t.role === 'MODERADOR'}
                          className="p-1.5 rounded-xl bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-white/10 text-light-text-muted dark:text-text-muted hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" 
                          title="Excluir Usuário"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </BentoCard>

    {/* MODAL CRIAR / EDITAR USUÁRIO */}
    {isEditModalOpen && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 lg:left-64 z-30 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div className="bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-white/10 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
          {/* Header com Ícone e Título */}
          <div className="flex justify-between items-center p-6 border-b border-light-border dark:border-white/10 bg-light-surface/40 dark:bg-surface-elevated/40">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
                <UserPlus size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-light-text-main dark:text-text-main">
                  {selectedTecnico ? 'Editar Usuário' : 'Criar Novo Usuário'}
                </h3>
                <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5">
                  {selectedTecnico ? 'Atualize as informações cadastrais e bases' : 'Cadastre um novo colaborador no sistema Brilha+'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsEditModalOpen(false)} 
              className="p-2 rounded-xl bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-white/10 text-light-text-muted dark:text-text-muted hover:border-light-borderStrong dark:hover:border-white/20 hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover hover:text-light-text-main dark:hover:text-text-main transition-all cursor-pointer"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
          
          <form onSubmit={handleSave}>
            <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto scrollbar-hide">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* PRIMEIRO NOME */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Primeiro Nome</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: João"
                    className="w-full glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-5 py-2.5 text-sm text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner"
                    value={primeiroNome}
                    onChange={e => setPrimeiroNome(e.target.value)}
                  />
                </div>

                {/* SOBRENOME */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Sobrenome</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: Silva Ramos"
                    className="w-full glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-5 py-2.5 text-sm text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner"
                    value={sobrenome}
                    onChange={e => setSobrenome(e.target.value)}
                  />
                </div>

                {/* MATRÍCULA */}
                <div className="space-y-1.5 col-span-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Matrícula</label>
                  <input 
                    type="text" 
                    placeholder="Ex: 74233"
                    className="w-full glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-5 py-2.5 text-sm text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner"
                    value={matricula}
                    onChange={e => setMatricula(e.target.value)}
                  />
                </div>

                {/* CT BASES DINÂMICAS COM BOTÃO + */}
                <div className="space-y-2.5 col-span-1 sm:col-span-2 bg-light-surface/40 dark:bg-surface-elevated/40 p-4 rounded-2xl border border-light-borderStrong/40 dark:border-white/5">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Bases ATP (CT Base)</label>
                    <button
                      type="button"
                      onClick={handleAddCtBase}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-light bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
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
                        className="flex-grow glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-5 py-2.5 text-sm text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner"
                        value={ctCode}
                        onChange={e => handleCtBaseChange(index, e.target.value)}
                      />
                      {ctBasesList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCtBase(index)}
                          className="p-2.5 rounded-full bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-white/10 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all cursor-pointer"
                          title="Remover Base"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {!selectedTecnico && (
                  <div className="col-span-1 sm:col-span-2 p-4 bg-light-surface/40 dark:bg-surface-elevated/40 border border-light-borderStrong/40 dark:border-white/5 rounded-2xl space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={autoPassword}
                        onChange={(e) => setAutoPassword(e.target.checked)}
                        className="w-4 h-4 rounded border-light-border dark:border-border text-primary accent-primary focus:ring-primary/30 bg-light-background dark:bg-surface-elevated cursor-pointer"
                      />
                      <span className="text-sm font-medium text-light-text-main dark:text-text-main">
                        Gerar senha padrão automaticamente (brilha123)
                      </span>
                    </label>
                    
                    {!autoPassword && (
                      <div className="space-y-1.5 mt-3 animate-in fade-in slide-in-from-top-2">
                        <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Senha Inicial</label>
                        <input 
                          required={!autoPassword}
                          type="text" 
                          className="w-full glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-5 py-2.5 text-sm text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner"
                          value={createPassword}
                          onChange={e => setCreatePassword(e.target.value)}
                          placeholder="Digite a senha..."
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Perfil (Role)</label>
                    {!isModerador && (
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                        Restrito a Técnico
                      </span>
                    )}
                  </div>
                  <select 
                    disabled={!isModerador}
                    className="w-full glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-5 py-2.5 text-sm text-light-text-main dark:text-text-main focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed shadow-inner"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                  >
                    <option value="PADRAO">Técnico Padrão</option>
                    {isModerador && <option value="ADMINISTRADOR">Administrador / Supervisor</option>}
                    {isModerador && <option value="MODERADOR">Moderador (Acesso Total)</option>}
                  </select>
                </div>

                <div className="space-y-1.5 flex items-center mt-6">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded bg-light-background dark:bg-surface-elevated border-light-border dark:border-border text-primary accent-primary focus:ring-primary/30 cursor-pointer"
                      checked={ativo}
                      onChange={e => setAtivo(e.target.checked)}
                    />
                    <span className="text-sm font-semibold text-light-text-main dark:text-text-main">Usuário Ativo no Sistema</span>
                  </label>
                </div>
              </div>
              {error && <p className="text-sm text-rose-400 font-semibold">{error}</p>}
            </div>

            <div className="p-5 border-t border-light-border dark:border-white/10 bg-light-surface/40 dark:bg-surface-elevated/40 flex justify-end gap-3">
              <Button 
                variant="secondary"
                size="md"
                type="button"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                variant="primary"
                size="md"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    )}

    {/* MODAL SENHA */}
    {isPasswordModalOpen && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 lg:left-64 z-30 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div className="bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center p-5 border-b border-light-border dark:border-white/10 bg-light-surface/40 dark:bg-surface-elevated/40">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 dark:text-amber-400">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-light-text-main dark:text-text-main">
                  Redefinir Senha
                </h3>
                <p className="text-xs text-light-text-muted dark:text-text-muted">
                  Defina uma nova credencial para o colaborador
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsPasswordModalOpen(false)} 
              className="p-1.5 rounded-xl bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-white/10 text-light-text-muted dark:text-text-muted hover:border-light-borderStrong dark:hover:border-white/20 hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover hover:text-light-text-main dark:hover:text-text-main transition-all cursor-pointer"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
          
          <form onSubmit={handleResetPassword}>
            <div className="p-5 space-y-4">
              <p className="text-xs text-light-text-secondary dark:text-text-muted leading-relaxed">
                Defina uma nova senha para <strong className="text-light-text-main dark:text-text-main">{selectedTecnico?.nomeCompleto}</strong>. 
                O usuário precisará utilizar essa senha no próximo login.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Nova Senha Temporária</label>
                <input 
                  required
                  type="text" 
                  className="w-full glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-5 py-2.5 text-sm text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted/60 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-inner"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Ex: Temp@2025"
                />
              </div>
              {error && <p className="text-sm text-rose-500 dark:text-rose-400 font-semibold">{error}</p>}
            </div>

            <div className="p-5 border-t border-light-border dark:border-white/10 bg-light-surface/40 dark:bg-surface-elevated/40 flex justify-end gap-3">
              <Button 
                variant="secondary"
                size="md"
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
              >
                Cancelar
              </Button>
              <button 
                type="submit"
                disabled={isSubmitting || !newPassword}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:brightness-110 active:scale-[0.98] text-slate-950 font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-amber-500/20 border border-amber-500/50"
              >
                {isSubmitting ? 'Redefinindo...' : 'Confirmar Senha'}
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    )}
  </>
);

}
