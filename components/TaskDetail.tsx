
import React, { useState, useEffect, useRef } from 'react';
import { Task, User, Comment, Attachment, TaskStatus, Tag } from '../types';
import { CalendarIcon, PaperclipIcon, SendIcon, TrashIcon, EditIcon, TagIcon, CheckIcon, DownloadIcon, PlusIcon } from './Icons';
import { STATUS_CONFIG } from '../constants';
import { uploadFileToMinio, deleteFileFromMinio } from '../services/storageService';

interface TaskDetailProps {
  task: Task;
  availableTags: Tag[];
  onCreateTag: (name: string, color: string) => Promise<Tag>;
  currentUser: User;
  allProfiles: User[];
  onClose: () => void;
  onAddComment: (taskId: string, comment: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
}

export const TaskDetail: React.FC<TaskDetailProps> = ({ 
  task, availableTags, onCreateTag, currentUser, allProfiles, onClose, onAddComment, onUpdateTask 
}) => {
  const [commentText, setCommentText] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDesc, setEditedDesc] = useState(task.description);
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [task.comments]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) {
        setIsTagMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(task.id, commentText);
    setCommentText('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isImage = (att: Attachment) => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const ext = att.name.split('.').pop()?.toLowerCase() || '';
    return att.type.startsWith('image/') || imageExtensions.includes(ext);
  };

  const handleCopyLink = (e: React.MouseEvent, url: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = async (e: React.MouseEvent, url: string, fileName: string, id: string) => {
    e.stopPropagation();
    setDownloadingId(id);
    
    try {
      // Busca o arquivo como blob para forçar o download pelo navegador
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName; // Força o nome do arquivo no download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Limpa a URL do objeto para liberar memória
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Erro ao baixar arquivo:", error);
      // Fallback: Abre em nova aba se o fetch falhar (ex: CORS)
      window.open(url, '_blank');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      const filesArray = Array.from(e.target.files) as File[];
      try {
        const uploadPromises = filesArray.map(file => uploadFileToMinio(file));
        const newAttachments = await Promise.all(uploadPromises);
        onUpdateTask(task.id, { attachments: [...task.attachments, ...newAttachments] });
      } catch (error) {
        console.error(error);
        alert("Falha ao subir arquivos para o MinIO.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = async (e: React.MouseEvent, attachment: Attachment) => {
    e.stopPropagation();
    if (confirm(`Deseja remover o anexo "${attachment.name}"?`)) {
      const newAttachments = task.attachments.filter(a => a.id !== attachment.id);
      onUpdateTask(task.id, { attachments: newAttachments });
      await deleteFileFromMinio(attachment.url);
    }
  };

  const renderPreview = (attachment: Attachment) => {
    const isImg = isImage(attachment);
    const isCopied = copiedId === attachment.id;
    const isDownloading = downloadingId === attachment.id;
    
    return (
      <div 
        key={attachment.id} 
        className="group relative flex flex-col bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-300"
      >
        <div 
          className="h-32 bg-gray-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden cursor-pointer relative shadow-inner"
          onClick={() => window.open(attachment.url, '_blank')}
        >
          {isImg ? (
            <img 
              src={attachment.url} 
              decoding="async"
              loading="lazy"
              style={{ 
                imageRendering: '-webkit-optimize-contrast',
                backfaceVisibility: 'hidden',
                transform: 'translateZ(0)'
              }}
              className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500 ease-out" 
              alt={attachment.name}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-slate-600">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                <PaperclipIcon />
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider">{attachment.name.split('.').pop()}</span>
            </div>
          )}
          
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 duration-300">
             <div className="flex gap-2 transform scale-75 group-hover:scale-100 transition-transform duration-300">
               <button 
                 onClick={(e) => handleCopyLink(e, attachment.url, attachment.id)}
                 className={`p-2.5 rounded-full shadow-xl transition-all ${isCopied ? 'bg-green-500 text-white' : 'bg-white/95 dark:bg-slate-800/95 text-indigo-600 dark:text-indigo-400 hover:bg-white'}`}
                 title="Copiar Link Público"
               >
                 {isCopied ? <CheckIcon /> : <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>}
               </button>
               <button 
                 onClick={(e) => handleDownload(e, attachment.url, attachment.name, attachment.id)}
                 disabled={isDownloading}
                 className="bg-white/95 dark:bg-slate-800/95 backdrop-blur p-2.5 rounded-full shadow-xl text-indigo-600 dark:text-indigo-400 hover:bg-white transition-all disabled:opacity-50"
                 title="Baixar para o computador"
               >
                 {isDownloading ? (
                   <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                 ) : (
                   <DownloadIcon />
                 )}
               </button>
             </div>
          </div>
        </div>
        
        <div className="p-3 bg-white dark:bg-slate-800 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-gray-700 dark:text-slate-200 truncate flex-1" title={attachment.name}>
              {attachment.name}
            </span>
            <button 
              onClick={(e) => handleRemoveAttachment(e, attachment)} 
              className="text-gray-300 dark:text-slate-600 hover:text-red-500 transition-colors"
            >
              <TrashIcon />
            </button>
          </div>
          <span className="text-[9px] font-medium text-gray-400 dark:text-slate-500">
            {formatFileSize(attachment.size)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col md:flex-row animate-in slide-in-from-bottom-8 duration-500" onClick={(e) => e.stopPropagation()}>
        
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
          <div className="p-8 border-b border-gray-100 dark:border-slate-800 bg-gray-50/20 dark:bg-slate-950/20 flex justify-between items-start">
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-3">
                <select 
                  className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer border-2 transition-all ${STATUS_CONFIG[task.status].color}`} 
                  value={task.status} 
                  onChange={(e) => onUpdateTask(task.id, { status: e.target.value as TaskStatus })}
                >
                  {Object.values(TaskStatus).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                </select>
                <span className="text-[10px] font-bold text-gray-300 dark:text-slate-600 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-lg">ID: {task.id.slice(0, 8)}</span>
              </div>
              
              {isEditingTitle ? (
                <input 
                  autoFocus 
                  className="text-3xl font-black text-gray-900 dark:text-slate-100 w-full bg-white dark:bg-slate-900 border-b-2 border-indigo-500 py-1 outline-none" 
                  value={editedTitle} 
                  onChange={e => setEditedTitle(e.target.value)} 
                  onBlur={() => { onUpdateTask(task.id, { title: editedTitle }); setIsEditingTitle(false); }} 
                  onKeyDown={e => e.key === 'Enter' && (onUpdateTask(task.id, { title: editedTitle }), setIsEditingTitle(false))}
                />
              ) : (
                <h2 onClick={() => setIsEditingTitle(true)} className="text-3xl font-black text-gray-900 dark:text-slate-100 leading-tight flex items-center gap-3 group cursor-pointer">
                  {task.title} 
                  <span className="opacity-0 group-hover:opacity-100 text-indigo-400 transition-opacity"><EditIcon /></span>
                </h2>
              )}

              <div className="flex flex-wrap gap-2">
                {task.tags.map(tag => (
                  <span key={tag.id} className={`${tag.color} text-white text-[9px] font-black px-3 py-1 rounded-full flex items-center gap-2 shadow-sm`}>
                    {tag.name} 
                    <button onClick={() => {
                      const newTags = task.tags.filter(t => t.id !== tag.id);
                      onUpdateTask(task.id, { tags: newTags });
                    }} className="hover:scale-125 transition-transform">×</button>
                  </span>
                ))}
                <div className="relative" ref={tagMenuRef}>
                  <button onClick={() => setIsTagMenuOpen(!isTagMenuOpen)} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-[10px] font-black hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">+ TAG</button>
                  {isTagMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-52 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-2xl z-[60] p-3 animate-in zoom-in-95">
                      <input className="w-full text-xs bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl px-3 py-2 outline-none dark:text-slate-100 mb-2" placeholder="Nova tag..." value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={async e => {
                        if (e.key === 'Enter' && tagInput.trim()) {
                          try {
                            const newTag = await onCreateTag(tagInput, 'bg-indigo-500');
                            onUpdateTask(task.id, { tags: [...task.tags, newTag] });
                            setTagInput('');
                          } catch (err) { console.error(err); }
                        }
                      }} />
                      <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                        {availableTags.map(tag => (
                          <button key={tag.id} onClick={() => {
                            const isAdded = task.tags.some(t => t.id === tag.id);
                            const newTags = isAdded ? task.tags.filter(t => t.id !== tag.id) : [...task.tags, tag];
                            onUpdateTask(task.id, { tags: newTags });
                          }} className={`w-full text-left text-[10px] px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-between ${task.tags.some(t => t.id === tag.id) ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-gray-600 dark:text-slate-400'}`}>
                            <span>{tag.name}</span> 
                            {task.tags.some(t => t.id === tag.id) && <CheckIcon />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <button onClick={onClose} className="p-3 text-gray-400 dark:text-slate-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-2xl transition-all active:scale-90">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
            <div className="grid grid-cols-2 gap-10">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Responsáveis</label>
                <div className="flex flex-wrap gap-2">
                  {task.assignees.map(u => (
                    <div key={u.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 pr-3 pl-1 py-1 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm group hover:border-indigo-200 dark:hover:border-indigo-800 transition-all">
                      <img src={u.avatar} className="w-8 h-8 rounded-xl object-cover" alt={u.name} />
                      <span className="text-[10px] font-bold text-gray-800 dark:text-slate-200">{u.name}</span>
                      <button onClick={() => {
                        const newAssignees = task.assignees.filter(a => a.id !== u.id);
                        onUpdateTask(task.id, { assignees: newAssignees });
                      }} className="opacity-0 group-hover:opacity-100 text-red-400 font-black ml-1 transition-all">×</button>
                    </div>
                  ))}
                  <div className="relative" ref={userMenuRef}>
                    <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="w-10 h-10 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center text-gray-300 dark:text-slate-600 hover:border-indigo-400 hover:text-indigo-400 transition-all active:scale-95">+</button>
                    {isUserMenuOpen && (
                      <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[24px] shadow-2xl z-[60] p-4 animate-in fade-in slide-in-from-top-2">
                        <p className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Convidar Membros</p>
                        <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                          {allProfiles.map(user => {
                            const isSelected = task.assignees.some(u => u.id === user.id);
                            return (
                              <button key={user.id} onClick={() => {
                                onUpdateTask(task.id, { assignees: isSelected ? task.assignees.filter(u => u.id !== user.id) : [...task.assignees, user] });
                              }} className={`w-full flex items-center justify-between text-[11px] px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-all ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-gray-600 dark:text-slate-400'}`}>
                                <div className="flex items-center gap-3">
                                  <img src={user.avatar} className="w-6 h-6 rounded-lg" alt={user.name} /> 
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
              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Prazo Final</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 dark:text-indigo-400">
                    <CalendarIcon />
                  </div>
                  <input 
                    type="date" 
                    className="w-full text-xs font-bold text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 pl-11 pr-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition-all shadow-sm" 
                    value={task.dueDate || ''} 
                    onChange={(e) => onUpdateTask(task.id, { dueDate: e.target.value })} 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex justify-between items-center">
                Descrição
                <button 
                  onClick={() => setIsEditingDesc(!isEditingDesc)} 
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-[10px] font-black uppercase tracking-wider transition-colors"
                >
                  {isEditingDesc ? 'Salvar Descrição' : 'Editar'}
                </button>
              </label>
              {isEditingDesc ? (
                <textarea 
                  autoFocus 
                  className="w-full text-sm leading-relaxed bg-white dark:bg-slate-800 dark:text-slate-200 p-6 rounded-3xl border-2 border-indigo-100 dark:border-indigo-900/50 min-h-[180px] outline-none shadow-inner focus:border-indigo-300 dark:focus:border-indigo-700 transition-all" 
                  value={editedDesc} 
                  onChange={e => setEditedDesc(e.target.value)} 
                  onBlur={() => { onUpdateTask(task.id, { description: editedDesc }); setIsEditingDesc(false); }} 
                />
              ) : (
                <div 
                  onClick={() => setIsEditingDesc(true)} 
                  className="text-sm leading-relaxed text-gray-800 dark:text-slate-300 bg-gray-50/40 dark:bg-slate-950/40 p-6 rounded-[24px] border border-gray-100 dark:border-slate-800 cursor-text min-h-[120px] hover:bg-gray-100/40 dark:hover:bg-slate-900/40 transition-colors"
                >
                  {task.description || <span className="text-gray-400 dark:text-slate-600 italic font-medium">Sem descrição detalhada.</span>}
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-3">
                  Arquivos e Anexos ({task.attachments.length})
                </label>
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isUploading} 
                  className="text-indigo-600 dark:text-indigo-400 flex items-center gap-2 text-[10px] font-black uppercase hover:scale-105 transition-transform disabled:opacity-50"
                >
                  <PlusIcon /> ADICIONAR ARQUIVOS
                </button>
                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />
              </div>

              {task.attachments.length > 0 ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
                  {task.attachments.map(att => renderPreview(att))}
                </div>
              ) : !isUploading ? (
                <div className="py-12 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-[32px] flex flex-col items-center justify-center text-gray-300 dark:text-slate-700 gap-3 group hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-colors">
                  <div className="p-4 bg-gray-50 dark:bg-slate-950 rounded-full group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950 group-hover:text-indigo-300 transition-colors">
                    <PaperclipIcon />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Área de arquivos vazia</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="w-full md:w-[360px] bg-gray-50/50 dark:bg-slate-950/50 flex flex-col overflow-hidden transition-colors">
          <div className="p-8 border-b border-gray-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm">
            <h3 className="text-[11px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
              Atividade da Tarefa
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {task.comments?.map(comment => (
              <div key={comment.id} className="flex gap-4 animate-in slide-in-from-right-2">
                <img src={comment.userAvatar} className="w-8 h-8 rounded-xl flex-shrink-0 object-cover border-2 border-white dark:border-slate-800 shadow-sm" alt={comment.userName} />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-800 dark:text-slate-200">{comment.userName}</span>
                    <span className="text-[8px] font-bold text-gray-400 dark:text-slate-600">{new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none shadow-sm text-[12px] text-gray-700 dark:text-slate-300 leading-relaxed border border-gray-100 dark:border-slate-700">
                    {comment.text}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          
          <div className="p-6 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
            <form onSubmit={handleSendComment} className="relative group">
              <textarea 
                value={commentText} 
                onChange={e => setCommentText(e.target.value)} 
                placeholder="Digite sua mensagem..." 
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-[12px] dark:text-slate-200 font-medium outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:bg-white dark:focus:bg-slate-800 transition-all resize-none pr-14" 
                rows={2} 
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(e); } }} 
              />
              <button 
                type="submit" 
                className="absolute right-3 bottom-3 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-90 transition-all shadow-lg"
              >
                <SendIcon />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
