import React, { useState, useRef } from 'react';
import { X, Camera, Lock, CheckCircle2, UserCircle2, Search, Calendar } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { useCampanhaStore } from '../../store/campanhaStore';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ModalConfiguracoesProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ModalConfiguracoes({ isOpen, onClose }: ModalConfiguracoesProps) {
  const { user, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'perfil' | 'senha' | 'campanha'>('perfil');
  const { campanhas, selectedCampanha, setSelectedCampanha } = useCampanhaStore();
  
  // Senha States
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [matriculaAlvo, setMatriculaAlvo] = useState(user?.matricula || '');
  const [loadingSenha, setLoadingSenha] = useState(false);
  const [senhaMensagem, setSenhaMensagem] = useState({ tipo: '', texto: '' });

  // Imagem States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImagem, setPreviewImagem] = useState<string | null>(user?.fotoPerfil || null);
  const [loadingImg, setLoadingImg] = useState(false);
  const [imgMensagem, setImgMensagem] = useState({ tipo: '', texto: '' });

  if (!isOpen) return null;

  const isElevado = user?.role === 'ADMINISTRADOR' || user?.role === 'MODERADOR' || user?.cargo === 'Administrador';

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB
      setImgMensagem({ tipo: 'erro', texto: 'A imagem deve ter no máximo 2MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImagem(reader.result as string);
      setImgMensagem({ tipo: '', texto: '' });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveImage = async () => {
    if (!previewImagem) return;
    setLoadingImg(true);
    setImgMensagem({ tipo: '', texto: '' });
    try {
      await api.put(`/foto-perfil/${user?.matricula}`, { foto: previewImagem });
      // Persiste apenas o marcador no store — nunca o base64 (evita estourar o localStorage)
      // O base64 fica em memória no previewImagem para exibição imediata
      await updateUser({ fotoPerfil: '__HAS_FOTO__' });
      setImgMensagem({ tipo: 'sucesso', texto: 'Foto de perfil atualizada!' });
    } catch (error: any) {
      console.error(error);
      const status = error?.response?.status;
      const msg =
        status === 413
          ? 'Imagem muito grande. Use uma imagem com no máximo 5MB.'
          : 'Falha ao salvar a foto. Tente novamente.';
      setImgMensagem({ tipo: 'erro', texto: msg });
    } finally {
      setLoadingImg(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSenhaMensagem({ tipo: '', texto: '' });

    if (!novaSenha || novaSenha !== confirmaSenha) {
      setSenhaMensagem({ tipo: 'erro', texto: 'As senhas não coincidem ou estão vazias.' });
      return;
    }

    if (novaSenha.length < 6) {
      setSenhaMensagem({ tipo: 'erro', texto: 'A senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    setLoadingSenha(true);
    try {
      if (!isElevado) {
        try {
          await api.post('/auth/login', {
            matricula: user?.matricula,
            senha: senhaAtual
          });
        } catch {
          setSenhaMensagem({ tipo: 'erro', texto: 'Senha atual incorreta. Se esqueceu, solicite suporte ao Administrador.' });
          setLoadingSenha(false);
          return;
        }
      }

      await api.post('/auth/change-password', {
        matricula: matriculaAlvo,
        novaSenha: novaSenha
      });
      setSenhaMensagem({ tipo: 'sucesso', texto: `Senha ${matriculaAlvo === user?.matricula ? 'atualizada' : 'de ' + matriculaAlvo + ' alterada'} com sucesso!` });
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmaSenha('');
    } catch (error: any) {
      console.error(error);
      setSenhaMensagem({ tipo: 'erro', texto: error.response?.data || 'Erro ao alterar a senha.' });
    } finally {
      setLoadingSenha(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-light-surface dark:bg-surface rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-light-borderStrong dark:border-border animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-light-borderStrong dark:border-border flex justify-between items-center bg-light-background dark:bg-background/50">
          <h2 className="text-xl font-black text-light-text-main dark:text-text-main">
            Configurações
          </h2>
          <button onClick={onClose} className="text-light-text-muted hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-light-borderStrong dark:border-border px-6">
          <button 
            onClick={() => setActiveTab('perfil')}
            className={`py-4 px-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'perfil' ? 'border-accent-teal text-accent-teal' : 'border-transparent text-light-text-muted hover:text-light-text-secondary'}`}
          >
            Perfil
          </button>
          <button 
            onClick={() => setActiveTab('senha')}
            className={`py-4 px-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'senha' ? 'border-accent-teal text-accent-teal' : 'border-transparent text-light-text-muted hover:text-light-text-secondary'}`}
          >
            Segurança
          </button>
          <button 
            onClick={() => setActiveTab('campanha')}
            className={`py-4 px-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'campanha' ? 'border-accent-teal text-accent-teal' : 'border-transparent text-light-text-muted hover:text-light-text-secondary'}`}
          >
            Histórico de campanhas
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          
          {/* TAB PERFIL */}
          {activeTab === 'perfil' && (
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-100 dark:border-border flex items-center justify-center bg-slate-50 dark:bg-background relative">
                    {previewImagem ? (
                      <img src={previewImagem} alt="Perfil" className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle2 size={64} className="text-slate-300 dark:text-slate-600" />
                    )}
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera size={32} className="text-white" />
                    </div>
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageChange} 
                  accept="image/png, image/jpeg, image/jpg" 
                  className="hidden" 
                />
                
                <div className="text-center">
                  <p className="text-sm text-light-text-secondary dark:text-text-muted">Clique na imagem para alterar</p>
                  <p className="text-xs text-light-text-muted mt-1">Tamanho máximo: 2MB. Formatos: JPG, PNG.</p>
                </div>
              </div>

              {imgMensagem.texto && (
                <div className={`p-3 rounded-lg text-sm font-medium ${imgMensagem.tipo === 'sucesso' ? 'bg-accent-emerald/10 text-accent-emerald' : 'bg-status-danger/10 text-status-danger'}`}>
                  {imgMensagem.texto}
                </div>
              )}

              <button 
                onClick={handleSaveImage}
                disabled={loadingImg || !previewImagem || previewImagem === user?.fotoPerfil}
                className="w-full py-3 bg-accent-teal hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-[#0f172a] font-bold rounded-xl transition-all shadow-md"
              >
                {loadingImg ? 'Salvando...' : 'Salvar Imagem'}
              </button>
            </div>
          )}

          {/* TAB CAMPANHA */}
          {activeTab === 'campanha' && (
            <div className="space-y-6">
              {/* Seção de Seleção de Campanha */}
              <div>
                <label className="block text-xs font-bold text-light-text-secondary dark:text-text-muted mb-2 uppercase tracking-wider">
                  Campanha Selecionada (Histórico)
                </label>
                <div className="flex items-center space-x-3 bg-slate-50 dark:bg-background border border-light-borderStrong dark:border-border rounded-xl p-3">
                  <div className="p-2 bg-slate-200 dark:bg-surface rounded-lg">
                    <Calendar size={20} className="text-light-text-muted dark:text-text-muted" />
                  </div>
                  <div className="flex-1">
                    <select 
                      className="w-full bg-transparent text-sm font-bold text-light-text-main dark:text-text-main outline-none cursor-pointer"
                      value={selectedCampanha?.idCampanha || ''}
                      onChange={(e) => {
                        const camp = campanhas.find(c => c.idCampanha === Number(e.target.value));
                        if (camp) {
                          setSelectedCampanha(camp);
                          window.location.reload(); // Força o refresh da tela com a nova campanha
                        }
                      }}
                    >
                      {campanhas.map(c => (
                        <option key={c.idCampanha} value={c.idCampanha} className="bg-light-surface dark:bg-surface">
                          {format(parseISO(c.dataInicio), 'MMM', { locale: ptBR })} - {format(parseISO(c.dataFim), 'MMM/yy', { locale: ptBR })} {c.ativa ? '(Atual)' : '(Encerrada)'}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5">
                      Altere para visualizar os chamados de meses anteriores.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB SENHA */}
          {activeTab === 'senha' && (
            <form onSubmit={handleSavePassword} className="space-y-5">
              
              <div className="bg-light-surface dark:bg-background p-4 rounded-xl border border-light-borderStrong dark:border-border mb-4">
                <div className="flex items-center gap-3 text-light-text-main dark:text-text-main mb-1">
                  <Lock size={20} className="text-accent-teal" />
                  <h3 className="font-bold text-sm">Alterar Senha</h3>
                </div>
                <p className="text-xs text-light-text-muted">Atualize sua credencial de acesso ao sistema.</p>
                {!isElevado && (
                  <div className="mt-3 p-2.5 bg-accent-teal/10 border border-accent-teal/20 rounded-lg text-xs text-accent-teal">
                    <span className="font-bold">Esqueceu a senha?</span> Solicite suporte ao seu Administrador para redefinir.
                  </div>
                )}
              </div>

              {isElevado && (
                <div>
                  <label className="block text-xs font-bold text-light-text-secondary dark:text-text-muted mb-1.5 uppercase tracking-wider">
                    Matrícula Alvo (Apenas Admins)
                  </label>
                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-muted" />
                    <input 
                      type="text" 
                      value={matriculaAlvo}
                      onChange={(e) => setMatriculaAlvo(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-light-background dark:bg-background border border-light-borderStrong dark:border-border rounded-xl focus:outline-none focus:border-accent-teal text-light-text-main dark:text-text-main text-sm transition-colors"
                      placeholder="Ex: P123456"
                    />
                  </div>
                </div>
              )}

              {!isElevado && (
                <div>
                  <label className="block text-xs font-bold text-light-text-secondary dark:text-text-muted mb-1.5 uppercase tracking-wider">
                    Senha Atual
                  </label>
                  <input 
                    type="password" 
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    className="w-full px-4 py-3 bg-light-background dark:bg-background border border-light-borderStrong dark:border-border rounded-xl focus:outline-none focus:border-accent-teal text-light-text-main dark:text-text-main text-sm transition-colors"
                    placeholder="Sua senha atual"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-light-text-secondary dark:text-text-muted mb-1.5 uppercase tracking-wider">
                  Nova Senha
                </label>
                <input 
                  type="password" 
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="w-full px-4 py-3 bg-light-background dark:bg-background border border-light-borderStrong dark:border-border rounded-xl focus:outline-none focus:border-accent-teal text-light-text-main dark:text-text-main text-sm transition-colors"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-light-text-secondary dark:text-text-muted mb-1.5 uppercase tracking-wider">
                  Confirmar Nova Senha
                </label>
                <input 
                  type="password" 
                  value={confirmaSenha}
                  onChange={(e) => setConfirmaSenha(e.target.value)}
                  className="w-full px-4 py-3 bg-light-background dark:bg-background border border-light-borderStrong dark:border-border rounded-xl focus:outline-none focus:border-accent-teal text-light-text-main dark:text-text-main text-sm transition-colors"
                  placeholder="Repita a senha"
                />
              </div>

              {senhaMensagem.texto && (
                <div className={`p-3 flex items-start gap-2 rounded-lg text-sm font-medium ${senhaMensagem.tipo === 'sucesso' ? 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20' : 'bg-status-danger/10 text-status-danger border border-status-danger/20'}`}>
                  {senhaMensagem.tipo === 'sucesso' && <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
                  <span>{senhaMensagem.texto}</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={loadingSenha}
                className="w-full py-3 mt-4 bg-accent-teal hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-[#0f172a] font-bold rounded-xl transition-all shadow-md"
              >
                {loadingSenha ? 'Alterando...' : 'Salvar Nova Senha'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
