import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { Pencil, Trash2, KeyRound, Plus, X, Search, Loader2, Users, UserPlus, ChevronDown, Check, ArrowRightLeft, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toTitleCase } from '../../utils/stringFormatters';
import { BentoCard } from '../ui/BentoCard';
import { Button } from '../ui/Button';
import { validatePassword, SENHA_PADRAO_SISTEMA } from '../../utils/passwordValidator';

interface SupervisorOption {
  idSupervisor: number;
  matricula?: string;
  nomeCompleto: string;
}

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
  statusColaborador?: string;
  centroCusto?: string;
  codigoBaseAtp?: string;
  email?: string;
  celularCorporativo?: string;
  idSupervisor?: number;
  nomeSupervisor?: string;
  idSupervisorEmprestimo?: number;
  nomeSupervisorEmprestimo?: string;
  codigoBaseAtpEmprestimo?: string;
}

export default function TecnicosManager() {
  const { token, user } = useAuthStore();
  const isModerador = user?.role === 'MODERADOR' || user?.cargo === 'Moderador';
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [supervisores, setSupervisores] = useState<SupervisorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;
  
  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState<Tecnico | null>(null);
  
  // Form state
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [email, setEmail] = useState('');
  const [celularCorporativo, setCelularCorporativo] = useState('');
  const [ctBasesList, setCtBasesList] = useState<string[]>(['']);
  const [role, setRole] = useState('PADRAO');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [ativo, setAtivo] = useState(true);
  
  // Novos campos cadastrais homologados
  const [statusColaborador, setStatusColaborador] = useState('Ativo');
  const [centroCusto, setCentroCusto] = useState('');
  const [codigoBaseAtp, setCodigoBaseAtp] = useState('');
  const [idSupervisorEmprestimo, setIdSupervisorEmprestimo] = useState<number | ''>('');
  const [codigoBaseAtpEmprestimo, setCodigoBaseAtpEmprestimo] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [autoPassword, setAutoPassword] = useState(true);
  const [createPassword, setCreatePassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTecnicos();
    fetchSupervisores();
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

  const fetchSupervisores = async () => {
    try {
      const response = await api.get('/supervisores');
      setSupervisores(response.data || []);
    } catch (err) {
      console.warn('Erro ao carregar supervisores para empréstimo:', err);
    }
  };

  const openEditModal = (tecnico?: Tecnico) => {
    setError('');
    setIsRoleDropdownOpen(false);
    if (tecnico) {
      setSelectedTecnico(tecnico);
      setNome(tecnico.nomeCompleto || `${tecnico.primeiroNome || ''} ${tecnico.sobrenome || ''}`.trim());
      setMatricula(tecnico.matricula || '');
      setEmail(tecnico.email || '');
      setCelularCorporativo(tecnico.celularCorporativo || '');
      setRole(tecnico.role || 'PADRAO');
      setAtivo(tecnico.ativo ?? true);
      
      const st = tecnico.statusColaborador || (tecnico.ativo ? 'Ativo' : 'Inativo');
      setStatusColaborador(st);
      setCentroCusto(tecnico.centroCusto || '');
      setCodigoBaseAtp(tecnico.codigoBaseAtp || '');
      setIdSupervisorEmprestimo(tecnico.idSupervisorEmprestimo || '');
      setCodigoBaseAtpEmprestimo(tecnico.codigoBaseAtpEmprestimo || '');

      // CT Bases Lista
      if (tecnico.ctBases && tecnico.ctBases.length > 0) {
        setCtBasesList([...tecnico.ctBases]);
      } else {
        setCtBasesList(['']);
      }
    } else {
      setSelectedTecnico(null);
      setNome('');
      setMatricula('');
      setEmail('');
      setCelularCorporativo('');
      setCtBasesList(['']);
      setRole('PADRAO');
      setAtivo(true);
      setStatusColaborador('Ativo');
      setCentroCusto('');
      setCodigoBaseAtp('');
      setIdSupervisorEmprestimo('');
      setCodigoBaseAtpEmprestimo('');
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

    const nameTrimmed = nome.trim();
    const parts = nameTrimmed.split(' ');
    const pNome = parts[0] || '';
    const sNome = parts.slice(1).join(' ') || '';

    const cleanCtBases = ctBasesList.map(b => b.trim()).filter(b => b.length > 0);
    const isAtivoVal = ['Ativo', 'Férias', 'Emprestado'].includes(statusColaborador);

    const payload = {
      primeiroNome: pNome,
      sobrenome: sNome,
      nomeCompleto: nameTrimmed,
      matricula: matricula.trim(),
      email: email.trim() || null,
      celularCorporativo: celularCorporativo.trim() || null,
      ctBases: cleanCtBases,
      role: isModerador ? role : 'PADRAO',
      ativo: isAtivoVal,
      statusColaborador,
      centroCusto: centroCusto.trim() || null,
      codigoBaseAtp: codigoBaseAtp.trim() || null,
      idSupervisorEmprestimo: statusColaborador === 'Emprestado' && idSupervisorEmprestimo ? Number(idSupervisorEmprestimo) : null,
      codigoBaseAtpEmprestimo: statusColaborador === 'Emprestado' && codigoBaseAtpEmprestimo.trim() ? codigoBaseAtpEmprestimo.trim() : null
    };

    try {
      if (selectedTecnico) {
        // Update
        await api.put(`/tecnicos/${selectedTecnico.idTecnico}`, payload);
      } else {
        // Create 
        if (!autoPassword) {
          const val = validatePassword(createPassword);
          if (!val.isValid) {
            setError(`Senha inicial inválida: ${val.errors[0]}`);
            setIsSubmitting(false);
            return;
          }
        }
        await api.post('/tecnicos', {
          ...payload,
          senha: autoPassword ? SENHA_PADRAO_SISTEMA : createPassword 
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

    const val = validatePassword(newPassword);
    if (!val.isValid) {
      setError(`Senha inválida: ${val.errors[0]}`);
      return;
    }
    
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

  const renderStatusBadge = (t: Tecnico) => {
    const st = t.statusColaborador || (t.ativo ? 'Ativo' : 'Inativo');
    switch (st) {
      case 'Ativo':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            Ativo
          </span>
        );
      case 'Férias':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
            Férias
          </span>
        );
      case 'Emprestado':
        return (
          <span 
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
            title={t.nomeSupervisorEmprestimo ? `Emprestado para: ${t.nomeSupervisorEmprestimo}` : 'Emprestado para outra regional'}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-sky-500 dark:bg-sky-400 animate-pulse" />
            Emprestado
          </span>
        );
      case 'Afastado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 dark:bg-orange-400" />
            Afastado
          </span>
        );
      case 'Inativo':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 dark:bg-rose-400" />
            Inativo
          </span>
        );
    }
  };

  const filteredTecnicos = tecnicos.filter(t => 
    t.nomeCompleto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.primeiroNome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.sobrenome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.celularCorporativo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.centroCusto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.codigoBaseAtp?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset para a primeira página sempre que o termo de busca mudar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(filteredTecnicos.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredTecnicos.length);
  const paginatedTecnicos = filteredTecnicos.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('ellipsis-start');
      }
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis-end');
      }
      
      pages.push(totalPages);
    }
    return pages;
  };

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
              Consulte, crie e administre os acessos, centros de custo, bases ATP e status dos colaboradores
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted pointer-events-none" size={15} />
            <input 
              type="text" 
              placeholder="Buscar por nome, matrícula, CC..."
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
        <table className="w-full text-left text-xs border-collapse min-w-[850px]">
          <thead className="bg-light-surface/60 dark:bg-surface-elevated/40 text-light-text-muted dark:text-text-muted text-xs uppercase font-semibold border-b border-light-border dark:border-white/10">
            <tr>
              <th className="px-4 py-3.5">Matrícula</th>
              <th className="px-4 py-3.5">Nome Completo</th>
              <th className="px-4 py-3.5">Centro Custo / Base ATP</th>
              <th className="px-4 py-3.5">Supervisão</th>
              <th className="px-4 py-3.5 text-center">Perfil</th>
              <th className="px-4 py-3.5 text-center">Status</th>
              <th className="px-4 py-3.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-light-border dark:divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-light-text-muted dark:text-text-muted">
                  <Loader2 className="animate-spin mx-auto mb-2 text-primary" size={24} />
                  Carregando usuários...
                </td>
              </tr>
            ) : filteredTecnicos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-light-text-muted dark:text-text-muted">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              paginatedTecnicos.map(t => (
                <tr key={t.idTecnico} className="hover:bg-primary/5 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-light-text-main dark:text-text-main font-mono">{t.matricula || '-'}</td>
                  <td className="px-4 py-3.5 font-bold text-light-text-main dark:text-text-main">
                    <div>{toTitleCase(t.nomeCompleto)}</div>
                    {t.statusColaborador === 'Emprestado' && t.nomeSupervisorEmprestimo && (
                      <div className="flex items-center gap-1 text-[10px] text-sky-500 font-normal mt-0.5">
                        <ArrowRightLeft size={10} /> Emprestado p/ {t.nomeSupervisorEmprestimo}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[11px] text-light-text-secondary dark:text-text-muted">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-light-surface-elevated dark:bg-white/5 px-2 py-0.5 rounded border border-light-border dark:border-white/10" title="Centro de Custo">
                        CC: {t.centroCusto || '-'}
                      </span>
                      <span className="text-light-text-muted dark:text-text-muted">/</span>
                      <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded border border-primary/20" title="Código Base ATP (CT)">
                        Base: {t.codigoBaseAtp || (t.ctBases && t.ctBases[0]) || '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-light-text-secondary dark:text-text-muted text-[11px]">
                    {t.nomeSupervisor || '-'}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                      t.role === 'MODERADOR' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 
                      t.role === 'ADMINISTRADOR' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 
                      'bg-light-buttonBg dark:bg-buttonBg text-light-text-muted dark:text-text-muted border border-light-border dark:border-border'
                    }`}>
                      {t.role}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {renderStatusBadge(t)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
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

      {/* Paginação */}
      {!loading && filteredTecnicos.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-light-text-muted dark:text-text-muted">
          <p>
            Exibindo <span className="font-bold text-light-text-main dark:text-text-main">{startIndex + 1}</span> a{' '}
            <span className="font-bold text-light-text-main dark:text-text-main">{endIndex}</span> de{' '}
            <span className="font-bold text-light-text-main dark:text-text-main">{filteredTecnicos.length}</span> usuários
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-border text-light-text-muted dark:text-text-muted hover:border-primary/50 hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                title="Página Anterior"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, idx) => (
                  typeof page === 'number' ? (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-8 h-8 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                        currentPage === page
                          ? 'bg-primary text-black shadow-sm shadow-primary/30 border border-primary'
                          : 'bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-border text-light-text-muted dark:text-text-muted hover:border-primary/50 hover:bg-primary/10 hover:text-primary'
                      }`}
                    >
                      {page}
                    </button>
                  ) : (
                    <span key={`ellipsis-${idx}`} className="px-1 text-light-text-muted dark:text-text-muted text-xs">
                      •••
                    </span>
                  )
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-border text-light-text-muted dark:text-text-muted hover:border-primary/50 hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                title="Próxima Página"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </BentoCard>

    {/* MODAL CRIAR / EDITAR USUÁRIO */}
    {isEditModalOpen && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 lg:left-64 z-30 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div className="bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
          {/* Header com Ícone e Título */}
          <div className="flex justify-between items-center p-6 border-b border-light-border dark:border-white/10 bg-light-surface/40 dark:bg-surface-elevated/40 sticky top-0 z-10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
                <UserPlus size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-light-text-main dark:text-text-main">
                  {selectedTecnico ? 'Editar Colaborador' : 'Novo Colaborador'}
                </h3>
                <p className="text-xs text-light-text-muted dark:text-text-muted">
                  {selectedTecnico ? 'Atualize as informações cadastrais e alocação' : 'Preencha os dados do novo usuário'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => { setIsEditModalOpen(false); setIsRoleDropdownOpen(false); }}
              className="p-1.5 rounded-xl bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-white/10 text-light-text-muted dark:text-text-muted hover:border-light-borderStrong dark:hover:border-white/20 hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover hover:text-light-text-main dark:hover:text-text-main transition-all cursor-pointer"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
          
          <form onSubmit={handleSave}>
            <div className="p-6 space-y-5">
              {/* Campo Nome Unificado */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Nome</label>
                <input 
                  required
                  type="text" 
                  className="w-full glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-5 py-2.5 text-sm text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: João da Silva"
                />
              </div>

              {/* Matrícula e Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Matrícula</label>
                  <input 
                    required
                    disabled={selectedTecnico?.matricula === '72916'}
                    type="text" 
                    className="w-full glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-5 py-2.5 text-sm font-mono text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                    value={matricula}
                    onChange={e => setMatricula(e.target.value)}
                    placeholder="Ex: 85421"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">
                    Status
                  </label>
                  <select
                    value={statusColaborador}
                    onChange={e => setStatusColaborador(e.target.value)}
                    className="w-full glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-4 py-2.5 text-sm text-light-text-main dark:text-text-main focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner"
                  >
                    <option value="Ativo" className="bg-light-surface dark:bg-surface text-emerald-500 font-bold">🟢 Ativo (Em operação regular)</option>
                    <option value="Férias" className="bg-light-surface dark:bg-surface text-amber-500 font-bold">🟡 Férias (Descanso regulamentar)</option>
                    <option value="Emprestado" className="bg-light-surface dark:bg-surface text-sky-500 font-bold">🔵 Emprestado (Outra Supervisão/Base)</option>
                    <option value="Afastado" className="bg-light-surface dark:bg-surface text-orange-500 font-bold">🟠 Afastado (Saúde / Licença / INSS)</option>
                    <option value="Inativo" className="bg-light-surface dark:bg-surface text-rose-500 font-bold">🔴 Inativo (Desligado da empresa)</option>
                  </select>
                </div>
              </div>

              {/* Contatos: E-mail e Telefone / Celular */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">E-mail</label>
                  <input 
                    type="email" 
                    className="w-full glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-5 py-2.5 text-sm text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Ex: joao.silva@positivo.com.br"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Telefone / Celular</label>
                  <input 
                    type="tel" 
                    className="w-full glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-5 py-2.5 text-sm font-mono text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner"
                    value={celularCorporativo}
                    onChange={e => setCelularCorporativo(e.target.value)}
                    placeholder="Ex: (11) 98765-4321"
                  />
                </div>
              </div>

              {/* Localização Dupla: Centro de Custo + Base ATP (Sem legendas redundantes) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-light-surface-elevated/40 dark:bg-white/5 border border-light-border dark:border-white/10">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 size={13} className="text-primary" /> Centro de custo
                  </label>
                  <input 
                    type="text" 
                    className="w-full glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-4 py-2 text-sm font-mono text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted/60 focus:outline-none focus:border-primary/60 transition-all"
                    value={centroCusto}
                    onChange={e => setCentroCusto(e.target.value)}
                    placeholder="Ex: 1145920"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 size={13} className="text-primary" /> Base ATP
                  </label>
                  <input 
                    type="text" 
                    className="w-full glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-4 py-2 text-sm font-mono text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted/60 focus:outline-none focus:border-primary/60 transition-all"
                    value={codigoBaseAtp}
                    onChange={e => setCodigoBaseAtp(e.target.value)}
                    placeholder="Ex: 2791040"
                  />
                </div>
              </div>

              {/* Bloco Condicional para Colaborador EMPRESTADO */}
              {statusColaborador === 'Emprestado' && (
                <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-2 text-sky-500 font-bold text-xs uppercase tracking-wider">
                    <ArrowRightLeft size={16} /> Destino do Empréstimo Operacional
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-sky-600 dark:text-sky-300">Supervisor de Destino</label>
                      <select
                        value={idSupervisorEmprestimo}
                        onChange={e => setIdSupervisorEmprestimo(e.target.value ? Number(e.target.value) : '')}
                        className="w-full bg-light-surface dark:bg-surface border border-sky-500/30 rounded-xl px-3 py-2 text-xs text-light-text-main dark:text-text-main focus:outline-none focus:border-sky-500"
                      >
                        <option value="">Selecione o supervisor...</option>
                        {supervisores.map(s => (
                          <option key={s.idSupervisor} value={s.idSupervisor}>
                            {s.nomeCompleto}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-sky-600 dark:text-sky-300">Base ATP de Destino (CT)</label>
                      <input 
                        type="text" 
                        value={codigoBaseAtpEmprestimo}
                        onChange={e => setCodigoBaseAtpEmprestimo(e.target.value)}
                        placeholder="Ex: 2791007 (RJ)"
                        className="w-full bg-light-surface dark:bg-surface border border-sky-500/30 rounded-xl px-3 py-2 text-xs font-mono text-light-text-main dark:text-text-main focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-sky-600/80 dark:text-sky-300/80">
                    O colaborador manterá sua supervisão de origem no cadastro mestre, mas pontuará operacionalmente na base de destino.
                  </p>
                </div>
              )}

              {/* CT Bases Dinâmicas */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">
                    Centros de Trabalho Vinculados (CTs)
                  </label>
                  <button 
                    type="button" 
                    onClick={handleAddCtBase}
                    className="text-xs text-primary hover:text-primary/80 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus size={14} /> Adicionar CT
                  </button>
                </div>
                
                <div className="space-y-2 max-h-32 overflow-y-auto p-1 pr-2">
                  {ctBasesList.map((ctBase, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input 
                        type="text" 
                        className="w-full glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-5 py-2 text-sm font-mono text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner"
                        value={ctBase}
                        onChange={e => handleCtBaseChange(index, e.target.value)}
                        placeholder={`Código do CT (ex: 2791001)`}
                      />
                      {ctBasesList.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => handleRemoveCtBase(index)}
                          className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors cursor-pointer shrink-0"
                          title="Remover CT"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Criação de Senha e Role */}
              <div className="pt-2 border-t border-light-border dark:border-white/10 space-y-4">
                {!selectedTecnico && (
                  <div className="space-y-2 p-4 bg-light-surface/40 dark:bg-surface-elevated/40 border border-light-border dark:border-white/10 rounded-2xl">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={autoPassword}
                        onChange={(e) => setAutoPassword(e.target.checked)}
                        className="w-4 h-4 rounded border-light-border dark:border-border text-primary accent-primary focus:ring-primary/30 bg-light-background dark:bg-surface-elevated cursor-pointer"
                      />
                      <span className="text-sm font-medium text-light-text-main dark:text-text-main">
                        Gerar senha padrão automaticamente ({SENHA_PADRAO_SISTEMA})
                      </span>
                    </label>
                    
                    {!autoPassword && (
                      <div className="space-y-1.5 mt-3 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Senha Inicial</label>
                          <span className="text-[11px] text-light-text-secondary dark:text-text-muted">Mínimo 8 dígitos (A-Z, a-z, 0-9, especial)</span>
                        </div>
                        <input 
                          required={!autoPassword}
                          type="text" 
                          className="w-full glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-5 py-2.5 text-sm text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner"
                          value={createPassword}
                          onChange={e => setCreatePassword(e.target.value)}
                          placeholder={`Ex: ${SENHA_PADRAO_SISTEMA}`}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1.5 relative">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Perfil (Role)</label>
                    {!isModerador && (
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                        Restrito a Técnico
                      </span>
                    )}
                  </div>

                  {isRoleDropdownOpen && (
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsRoleDropdownOpen(false)} 
                    />
                  )}

                  <div className="relative z-40">
                    <button 
                      type="button"
                      disabled={!isModerador}
                      onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                      className="w-full flex items-center justify-between glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-5 py-2.5 text-sm text-light-text-main dark:text-text-main focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed shadow-inner"
                    >
                      <span className="font-medium">
                        {role === 'PADRAO' && 'Técnico Padrão'}
                        {role === 'ADMINISTRADOR' && 'Administrador / Supervisor'}
                        {role === 'MODERADOR' && 'Moderador (Acesso Total)'}
                      </span>
                      <ChevronDown 
                        size={16} 
                        className={`text-light-text-muted dark:text-text-muted transition-transform duration-200 ${
                          isRoleDropdownOpen ? 'rotate-180 text-primary' : ''
                        }`} 
                      />
                    </button>

                    {isRoleDropdownOpen && isModerador && (
                      <div className="absolute left-0 right-0 bottom-full mb-2 z-50 bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-white/15 rounded-2xl p-1.5 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-150 space-y-1">
                        {[
                          { value: 'PADRAO', label: 'Técnico Padrão', desc: 'Acesso padrão às metas e métricas' },
                          { value: 'ADMINISTRADOR', label: 'Administrador / Supervisor', desc: 'Gestão de usuários e supervisão' },
                          { value: 'MODERADOR', label: 'Moderador (Acesso Total)', desc: 'Acesso irrestrito a configurações e campanhas' }
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setRole(opt.value);
                              setIsRoleDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                              role === opt.value
                                ? 'bg-primary/20 text-primary font-bold shadow-xs'
                                : 'text-light-text-main dark:text-text-main hover:bg-light-surface-elevated dark:hover:bg-white/5 hover:text-primary'
                            }`}
                          >
                            <div>
                              <p className="text-xs font-bold leading-snug">{opt.label}</p>
                              <p className="text-[10px] text-light-text-muted dark:text-text-muted font-normal mt-0.5">{opt.desc}</p>
                            </div>
                            {role === opt.value && <Check size={16} className="text-primary shrink-0 ml-2" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-rose-400 font-semibold">{error}</p>}
            </div>

            <div className="p-5 border-t border-light-border dark:border-white/10 bg-light-surface/40 dark:bg-surface-elevated/40 flex justify-end gap-3 sticky bottom-0 z-10 backdrop-blur-md">
              <Button 
                variant="secondary"
                size="md"
                type="button"
                onClick={() => { setIsEditModalOpen(false); setIsRoleDropdownOpen(false); }}
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
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Nova Senha Temporária</label>
                  <span className="text-[11px] text-light-text-secondary dark:text-text-muted">Mín. 8 char (A-Z, a-z, 0-9, especial)</span>
                </div>
                <input 
                  required
                  type="text" 
                  className="w-full glass-bento border border-light-border/60 dark:border-white/10 rounded-full px-5 py-2.5 text-sm text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted/60 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-inner"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder={`Ex: ${SENHA_PADRAO_SISTEMA}`}
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
