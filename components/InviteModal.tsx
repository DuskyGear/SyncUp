
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Workspace, UserRole } from '../types';
import { CheckIcon } from './Icons';

interface InviteModalProps {
  workspace: Workspace;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ workspace, onClose }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('MEMBER');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [inviteLink] = useState(`${window.location.origin}/join/${workspace.id}`);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setMessage(null);

    try {
      // 1. Buscar usuário pelo email
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email.trim())
        .single();

      if (profileError || !profiles) {
        throw new Error("Usuário não encontrado. Peça para ele se cadastrar no SyncUp primeiro.");
      }

      // 2. Adicionar à tabela workspace_members
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspace.id,
          user_id: profiles.id,
          role: role // Usa o role selecionado no estado
        });

      if (memberError) {
        if (memberError.code === '23505') throw new Error("Usuário já é membro deste workspace.");
        if (memberError.code === '42501') throw new Error("Você não tem permissão de Admin para convidar.");
        throw memberError;
      }

      setMessage({ type: 'success', text: `${profiles.name || email} adicionado como ${role}!` });
      setEmail('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950/50 flex justify-between items-center">
          <h2 className="text-lg font-black text-gray-800 dark:text-slate-100 uppercase tracking-tight">Convidar Pessoas</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </div>

        <div className="p-8 space-y-8">
          {/* Link Section */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Link de Convite (Copiável)</label>
            <div className="flex gap-2">
              <input readOnly value={inviteLink} className="flex-1 px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs text-gray-600 dark:text-slate-400 outline-none" />
              <button onClick={handleCopyLink} className="px-4 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                {copied ? <CheckIcon /> : 'Copiar'}
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100 dark:border-slate-800"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-slate-900 px-2 text-gray-300 dark:text-slate-600 font-black">OU POR E-MAIL</span></div>
          </div>

          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">E-mail do Usuário</label>
              <input 
                type="email" 
                autoFocus
                placeholder="colega@empresa.com" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 outline-none transition-all font-bold text-gray-800 dark:text-slate-100"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Cargo / Permissões</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('MEMBER')}
                  className={`py-3 rounded-xl text-xs font-bold border-2 transition-all ${role === 'MEMBER' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:border-indigo-200'}`}
                >
                  MEMBRO
                </button>
                <button
                  type="button"
                  onClick={() => setRole('ADMIN')}
                  className={`py-3 rounded-xl text-xs font-bold border-2 transition-all ${role === 'ADMIN' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:border-indigo-200'}`}
                >
                  ADMIN
                </button>
              </div>
            </div>

            {message && (
              <div className={`p-3 rounded-xl text-xs font-bold ${message.type === 'success' ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400'}`}>
                {message.text}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading || !email.trim()} 
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50 transition-all"
            >
              {isLoading ? 'Enviando...' : `Adicionar como ${role === 'ADMIN' ? 'Administrador' : 'Membro'}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
