import React, { useEffect, useState } from 'react';
import { Medal, Trophy, Star, XCircle, Award, TrendingUp, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function RankingScreen() {
  const { user } = useAuthStore();
  const [rankingData, setRankingData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myPos, setMyPos] = useState<number | string>('--');
  const [selectedTecnico, setSelectedTecnico] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const fetchRanking = async () => {
      try {
        const response = await api.get('/dashboard/ranking');
        if (mounted) {
          const normalize = (str: string) => str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
          
          let myPosition: number | string = '--';
          const mappedData = response.data.map((r: any) => {
            const isMe = (user?.nomeCompleto && r.tecnico && normalize(r.tecnico) === normalize(user.nomeCompleto)) ||
                         (user?.matricula && r.matricula && String(r.matricula) === String(user.matricula));
            
            if (isMe) myPosition = r.posicaoRanking;
            
            return {
              id: r.matricula || r.tecnico || Math.random().toString(),
              name: r.tecnico,
              score: r.pontosTotal,
              base: '', // Base ATP não está disponível no provisório
              isMe: isMe,
              posicaoRanking: r.posicaoRanking,
              rawDto: r
            };
          });
          
          setRankingData(mappedData);
          setMyPos(myPosition);
        }
      } catch (error) {
        console.error('Erro ao buscar ranking:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    fetchRanking();
    
    return () => { mounted = false; };
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-teal"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="bg-light-surface p-6 rounded-positivo-lg shadow-sm border border-light-border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-light-text-main flex items-center">
            <Trophy className="text-brilhamais-gold mr-2" size={24} />
            Ranking Geral
          </h2>
          <p className="text-sm text-light-text-muted mt-1">Sua posição atual é a {myPos}ª</p>
        </div>
        <div className="bg-positivo-primary text-text-main w-14 h-14 rounded-full flex items-center justify-center font-bold text-2xl shadow-md border-4 border-light-background">
          {myPos}º
        </div>
      </div>

      <div className="bg-light-surface rounded-positivo-lg shadow-sm border border-light-border overflow-hidden">
        <ul className="divide-y divide-light-border">
          {rankingData.map((usr, index) => (
            <li 
              key={usr.id + '-' + index} 
              onClick={() => setSelectedTecnico(usr)}
              className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${
                usr.isMe ? 'bg-amber-50/50 relative' : ''
              }`}
            >
              {usr.isMe && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-brilhamais-gold"></div>
              )}
              
              <div className="flex items-center space-x-4">
                <div className="font-bold text-light-text-muted w-6 text-center">
                  {usr.posicaoRanking}
                </div>
                
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  index === 0 ? 'bg-yellow-100 text-yellow-600' :
                  index === 1 ? 'bg-light-borderStrong text-light-text-muted' :
                  index === 2 && !usr.isMe ? 'bg-orange-100 text-orange-600' :
                  'bg-positivo-secondary text-text-main'
                }`}>
                  {index < 3 ? <Medal size={20} /> : <Star size={16} />}
                </div>
                
                <div>
                  <p className={`font-semibold ${usr.isMe ? 'text-light-text-main' : 'text-light-text-secondary'}`}>
                    {usr.name}
                  </p>
                  <p className="text-xs text-light-text-muted">{usr.base}</p>
                </div>
              </div>
              
              <div className="font-bold text-light-text-main">
                {typeof usr.score === 'number' ? usr.score.toFixed(1) : usr.score} <span className="text-xs text-light-text-muted font-normal">pts</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {selectedTecnico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-light-surface dark:bg-surface rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden border border-light-borderStrong dark:border-border animate-in zoom-in-95">
            <div className="p-6 border-b border-light-borderStrong dark:border-border flex justify-between items-center bg-light-background dark:bg-background/50">
              <h2 className="text-xl font-bold text-light-text-main dark:text-text-main flex items-center gap-2">
                <Award className="text-accent-teal" /> Desempenho de {selectedTecnico.name}
              </h2>
              <button onClick={() => setSelectedTecnico(null)} className="text-light-text-muted hover:text-slate-600 transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            <div className="p-6 overflow-x-auto overflow-y-auto max-h-[70vh] scrollbar-hide">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-100 dark:bg-background text-slate-600 dark:text-text-muted text-sm font-bold uppercase tracking-wider">
                    <th className="p-4 border-b border-light-borderStrong dark:border-border rounded-tl-lg">Mês</th>
                    <th className="p-4 border-b border-light-borderStrong dark:border-border text-center">SLA</th>
                    <th className="p-4 border-b border-light-borderStrong dark:border-border text-center">Reinc. (Eqp)</th>
                    <th className="p-4 border-b border-light-borderStrong dark:border-border text-center">Reinc. (Ind)</th>
                    <th className="p-4 border-b border-light-borderStrong dark:border-border text-center">Perdas</th>
                    <th className="p-4 border-b border-light-borderStrong dark:border-border text-center">NPS</th>
                    <th className="p-4 border-b border-light-borderStrong dark:border-border text-center">Peças</th>
                    <th className="p-4 border-b border-light-borderStrong dark:border-border text-center">Total</th>
                    <th className="p-4 border-b border-light-borderStrong dark:border-border text-center rounded-tr-lg">Elegibilidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-border/50 bg-light-surface dark:bg-surface">
                  {selectedTecnico.rawDto?.historico?.map((h: any, i: number) => {
                    const isMedia = h.mes === 'Média Final';
                    return (
                      <tr key={i} className={`hover:bg-light-background dark:hover:bg-background/50 transition-colors ${isMedia ? 'bg-light-background dark:bg-background/30' : ''}`}>
                        <td className="p-4 font-bold text-light-text-main dark:text-text-main flex items-center gap-2">
                          {isMedia && <TrendingUp size={16} className="text-accent-teal"/>}
                          {h.mes}
                        </td>
                        <td className="p-4 text-center">
                          <div className="font-bold text-light-text-secondary">{h.percentualSla?.toFixed(2)}%</div>
                          <div className="text-xs font-medium text-accent-teal bg-accent-teal/10 px-2 py-0.5 rounded-full inline-block mt-1">{h.pontosSla} pts</div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="font-bold text-light-text-secondary">{h.percentualReincidenciaEquipe?.toFixed(2)}%</div>
                          <div className="text-xs font-medium text-accent-teal bg-accent-teal/10 px-2 py-0.5 rounded-full inline-block mt-1">{h.pontosReincidenciaEquipe} pts</div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="font-bold text-light-text-secondary">{h.percentualReincidencia?.toFixed(2)}%</div>
                          <div className="text-xs font-medium text-accent-teal bg-accent-teal/10 px-2 py-0.5 rounded-full inline-block mt-1">{h.pontosReincidencia} pts</div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="font-bold text-light-text-secondary">{h.percentualPerdidos?.toFixed(2)}%</div>
                          <div className="text-xs font-medium text-accent-teal bg-accent-teal/10 px-2 py-0.5 rounded-full inline-block mt-1">{h.pontosPerdidos} pts</div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="font-bold text-light-text-secondary">{h.npsScore?.toFixed(2)}%</div>
                          <div className="text-xs font-medium text-accent-teal bg-accent-teal/10 px-2 py-0.5 rounded-full inline-block mt-1">{h.pontosNps} pts</div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="font-bold text-light-text-secondary">{h.percentualEficienciaPecas?.toFixed(2)}%</div>
                          <div className="text-xs font-medium text-accent-teal bg-accent-teal/10 px-2 py-0.5 rounded-full inline-block mt-1">{h.pontosPecas} pts</div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="text-2xl font-black text-light-text-main">{h.pontosTotal}</div>
                        </td>
                        <td className="p-4 text-center">
                          {h.elegivel ? (
                            <span className="bg-accent-emerald text-text-main text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1 shadow-sm"><CheckCircle2 size={14}/> Elegível</span>
                          ) : (
                            <span className="bg-status-danger text-text-main text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1 shadow-sm" title={h.motivoInelegibilidade}><XCircle size={14}/> Inelegível</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(!selectedTecnico.rawDto?.historico || selectedTecnico.rawDto.historico.length === 0) && (
                <div className="p-8 text-center text-light-text-muted">Nenhum detalhamento disponível.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
