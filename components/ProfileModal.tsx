
import React, { useState, useRef } from 'react';
import { User } from '../types';
import { uploadFileToMinio } from '../services/storageService';

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onSave: (updatedUser: User) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ user, onClose, onSave }) => {
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Feedback visual imediato com Blob local
      const localPreview = URL.createObjectURL(file);
      setAvatar(localPreview);
      
      setIsUploading(true);
      try {
        const attachment = await uploadFileToMinio(file);
        setAvatar(attachment.url);
      } catch (error) {
        alert("Falha ao processar imagem no MinIO. Usando preview local temporário.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isUploading || isSaving) return;
    
    setIsSaving(true);
    try {
      await onSave({ ...user, name, avatar });
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Editar Perfil</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-white rounded-xl">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-10">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-6">
            <div 
              className="relative group cursor-pointer" 
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <div className="w-32 h-32 rounded-[40px] border-4 border-indigo-50 overflow-hidden shadow-2xl relative">
                <img 
                  src={avatar} 
                  className={`w-full h-full object-cover transition-all duration-500 ${isUploading ? 'opacity-30 blur-sm' : 'group-hover:scale-110'}`} 
                  alt="Profile"
                />
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg width="28" height="28" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <span className="text-[10px] text-white font-black uppercase mt-2 tracking-widest">Alterar</span>
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange} 
              />
            </div>
            <div className="text-center">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">{user.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Seu Nome de Exibição</label>
            <input 
              autoFocus
              className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:bg-white outline-none transition-all font-black text-gray-800 placeholder:text-gray-300 shadow-inner"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Como quer ser chamado?"
              required
            />
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <button 
              type="submit" 
              disabled={isUploading || isSaving}
              className={`w-full py-5 text-xs font-black uppercase tracking-widest text-white rounded-2xl shadow-xl transition-all active:scale-95 ${isUploading || isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}
            >
              {isSaving ? 'Sincronizando...' : 'Salvar Alterações'}
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              className="w-full py-4 text-xs font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 rounded-2xl transition-all"
            >
              Manter Original
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
