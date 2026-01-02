
import React, { useState, useEffect, useRef } from 'react';
import { Task, User, TaskStatus, Attachment, Tag } from '../types';
import { PlusIcon, PaperclipIcon, CheckIcon, TagIcon } from './Icons';
import { uploadFileToMinio } from '../services/storageService';

interface TaskModalProps {
  workspaceId: string;
  availableTags: Tag[];
  onCreateTag: (name: string, color: string) => Promise<Tag>;
  currentUser: User | null;
  allProfiles: User[];
  initialTask?: Task;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id' | 'createdAt'>) => void;
}

const TAG_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-slate-500'];

export const TaskModal: React.FC<TaskModalProps> = ({ 
  workspaceId, availableTags, onCreateTag, currentUser, allProfiles, initialTask, onClose, onSave 
}) => {
  const [title, setTitle] = useState(initialTask?.title || '');
  const [description, setDescription] = useState(initialTask?.description || '');
  const [assignees, setAssignees] = useState<User[]>(initialTask?.assignees || []);
  const [status, setStatus] = useState<TaskStatus>(initialTask?.status || TaskStatus.TODO);
  const [dueDate, setDueDate] = useState(initialTask?.dueDate || '');
  const [attachments, setAttachments] = useState<Attachment[]>(initialTask?.attachments || []);
  const [taskTags, setTaskTags] = useState<Tag[]>(initialTask?.tags || []);
  const [isUploading, setIsUploading] = useState(false);
  
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [tagSearchQuery, setTagSearchQuery] = useState('');

  const userMenuRef = useRef<HTMLDivElement>(null);
  const tagMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) {
        setIsTagMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      const filesArray = Array.from(e.target.files) as File[];
      try {
        const uploadPromises = filesArray.map(file => uploadFileToMinio(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        setAttachments(prev => [...prev, ...uploadedAttachments]);
      } catch (error) {
        alert("Erro ao fazer upload de arquivos.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const toggleAssignee = (user: User) => {
    setAssignees(prev => prev.find(u => u.id === user.id) ? prev.filter(u => u.id !== user.id) : [...prev, user]);
  };

  const toggleTag = (tag: Tag) => {
    setTaskTags(prev => prev.find(t => t.id === tag.id) ? prev.filter(t => t.id !== tag.id) : [...prev, tag]);
  };

  const handleCreateAndAddTag = async () => {
    if (!tagSearchQuery.trim()) return;
    const randomColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    try {
      const newTag = await onCreateTag(tagSearchQuery.trim(), randomColor);
      setTaskTags(prev => [...prev, newTag]);
      setTagSearchQuery('');
    } catch (err) {
      alert("Erro ao criar tag.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isUploading) return;
    onSave({ title, description, status, assignees, attachments, tags: taskTags, workspaceId, dueDate: dueDate || undefined });
    onClose();
  };

  const filteredUsers = allProfiles.filter(user => 
    user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const filteredAvailableTags = availableTags.filter(tag => 
    tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
  );

  const showCreateTagOption = tagSearchQuery.trim() !== '' && !availableTags.some(t => t.name.toLowerCase() === tagSearchQuery.toLowerCase());

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-950/50">
          <h2 className="text-xl font-black text-gray-800 dark:text-slate-100 uppercase tracking-tight">{initialTask ? 'Editar Tarefa' : 'Criar Nova Tarefa'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {/* Título */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Título da Tarefa</label>
            <input autoFocus className="w-full px-6 py-4 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all font-bold text-gray-800 dark:text-slate-100 placeholder:text-gray-300 dark:placeholder:text-slate-600 shadow-inner" placeholder="O que precisa ser feito?" value={title} onChange={e => setTitle(e.target.value)} required />
          </div>

          {/* Descrição */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Descrição</label>
            </div>
            <textarea className="w-full px-6 py-4 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:bg-white dark:focus:bg-slate-800 outline-none h-32 resize-none transition-all font-medium text-gray-700 dark:text-slate-300 placeholder:text-gray-300 dark:placeholder:text-slate-600 shadow-inner" placeholder="Detalhes da tarefa..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {/* Datas e Status */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Prazo Final</label>
              <input type="date" className="w-full px-5 py-3.5 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all font-bold text-gray-700 dark:text-slate-200" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Status Inicial</label>
              <select className="w-full px-5 py-3.5 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all font-bold text-gray-700 dark:text-slate-200 appearance-none cursor-pointer" value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>
                <option value={TaskStatus.TODO}>A Fazer</option>
                <option value={TaskStatus.IN_PROGRESS}>Em Progresso</option>
                <option value={TaskStatus.REVIEW}>Revisão</option>
                <option value={TaskStatus.DONE}>Concluído</option>
              </select>
            </div>
          </div>

          {/* Responsáveis e Tags */}
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Responsáveis</label>
              <div className="flex flex-wrap gap-2">
                {assignees.map(u => (
                  <div key={u.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 pr-3 pl-1 py-1 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm group hover:border-indigo-200 dark:hover:border-indigo-800 transition-all">
                    <img src={u.avatar} className="w-7 h-7 rounded-xl object-cover" alt={u.name} />
                    <span className="text-[9px] font-bold text-gray-800 dark:text-slate-200">{u.name}</span>
                    <button type="button" onClick={() => toggleAssignee(u)} className="text-red-400 font-black ml-1">×</button>
                  </div>
                ))}
                <div className="relative" ref={userMenuRef}>
                  <button type="button" onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="w-9 h-9 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center text-gray-300 dark:text-slate-600 hover:border-indigo-400 hover:text-indigo-400 transition-all active:scale-95">+</button>
                  {isUserMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[24px] shadow-2xl z-[60] p-3 animate-in fade-in slide-in-from-top-2">
                      <input type="text" placeholder="Buscar..." className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl text-[10px] mb-2 outline-none dark:text-slate-200" value={userSearchQuery} onChange={e => setUserSearchQuery(e.target.value)} />
                      <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                        {filteredUsers.map(user => {
                          const isSelected = assignees.some(u => u.id === user.id);
                          return (
                            <button key={user.id} type="button" onClick={() => toggleAssignee(user)} className={`w-full flex items-center justify-between text-[10px] px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-gray-600 dark:text-slate-400'}`}>
                              <div className="flex items-center gap-2">
                                <img src={user.avatar} className="w-5 h-5 rounded-md" alt={user.name} /> 
                                <span>{user.name}</span>
                              </div>
                              {isSelected && <CheckIcon />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Tags</label>
              <div className="flex flex-wrap gap-2">
                {taskTags.map(tag => (
                  <span key={tag.id} className={`${tag.color} text-white text-[9px] font-black px-2.5 py-1 rounded-full flex items-center gap-2 shadow-sm`}>
                    {tag.name} <button type="button" onClick={() => toggleTag(tag)} className="hover:scale-125 transition-transform">×</button>
                  </span>
                ))}
                <div className="relative" ref={tagMenuRef}>
                  <button type="button" onClick={() => setIsTagMenuOpen(!isTagMenuOpen)} className="w-9 h-9 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center text-gray-300 dark:text-slate-600 hover:border-indigo-400 hover:text-indigo-400 transition-all active:scale-95">
                    <TagIcon />
                  </button>
                  {isTagMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[24px] shadow-2xl z-[60] p-3 animate-in fade-in slide-in-from-top-2">
                      <input type="text" placeholder="Tag ou nova..." className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl text-[10px] mb-2 outline-none dark:text-slate-200" value={tagSearchQuery} onChange={e => setTagSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateAndAddTag())} />
                      <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                        {filteredAvailableTags.map(tag => {
                          const isSelected = taskTags.some(t => t.id === tag.id);
                          return (
                            <button key={tag.id} type="button" onClick={() => toggleTag(tag)} className={`w-full flex items-center justify-between text-[10px] px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-gray-600 dark:text-slate-400'}`}>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${tag.color}`}></div>
                                <span>{tag.name}</span>
                              </div>
                              {isSelected && <CheckIcon />}
                            </button>
                          );
                        })}
                        {showCreateTagOption && (
                          <button type="button" onClick={handleCreateAndAddTag} className="w-full text-left text-[10px] px-2 py-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black flex items-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/50">
                            <PlusIcon /> CRIAR "{tagSearchQuery.toUpperCase()}"
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Anexos */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">Anexos {isUploading && <span className="text-[10px] text-indigo-500 lowercase font-bold">(Subindo para MinIO...)</span>}</label>
            <div className="flex flex-col gap-3">
              <label className={`cursor-pointer bg-white dark:bg-slate-800 border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 px-6 py-8 rounded-[32px] flex flex-col items-center justify-center gap-3 text-sm font-bold text-gray-400 dark:text-slate-500 transition-all ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-full group-hover:bg-white dark:group-hover:bg-slate-800">
                  <PaperclipIcon />
                </div>
                <span>{isUploading ? 'Aguarde...' : 'Anexar documentos'}</span>
                <input type="file" multiple className="hidden" onChange={handleFileChange} disabled={isUploading} />
              </label>
              <div className="flex flex-wrap gap-2">
                {attachments.map(file => (
                  <div key={file.id} className="bg-white dark:bg-slate-800 px-4 py-2 rounded-xl flex items-center gap-3 text-[10px] font-bold text-gray-700 dark:text-slate-300 border border-gray-100 dark:border-slate-700 shadow-sm">
                    <span className="max-w-[120px] truncate">{file.name}</span>
                    <button type="button" onClick={() => setAttachments(prev => prev.filter(f => f.id !== file.id))} className="text-gray-300 hover:text-red-500 transition-colors">×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>

        <div className="p-8 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950/50 flex justify-end gap-4">
          <button type="button" onClick={onClose} className="px-8 py-4 text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest hover:bg-white dark:hover:bg-slate-800 rounded-2xl transition-all">Cancelar</button>
          <button 
            onClick={handleSubmit} 
            disabled={isUploading || !title.trim()}
            className={`px-10 py-4 text-xs font-black uppercase tracking-widest text-white rounded-2xl shadow-xl transition-all active:scale-95 ${isUploading || !title.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}
          >
            {isUploading ? 'Sincronizando...' : 'Salvar Tarefa'}
          </button>
        </div>
      </div>
    </div>
  );
};
