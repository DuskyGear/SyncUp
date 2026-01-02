import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { AuthState, Workspace, Task, TaskStatus, User, Comment, Tag, Attachment } from './types';
import { TaskModal } from './components/TaskModal';
import { TaskDetail } from './components/TaskDetail';
import { WorkspaceModal } from './components/WorkspaceModal';
import { ProfileModal } from './components/ProfileModal';
import { PlusIcon, CalendarIcon, PaperclipIcon, SunIcon, MoonIcon, TagIcon } from './components/Icons';
import { STATUS_CONFIG } from './constants';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false, user: null });
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [allProfiles, setAllProfiles] = useState<User[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdatedTaskId, setLastUpdatedTaskId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [filterDueDate, setFilterDueDate] = useState<string>('');

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  
  const activeTaskForDetail = useMemo(() => 
    tasks.find(t => t.id === selectedTaskId) || null, 
  [tasks, selectedTaskId]);

  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authName, setAuthName] = useState('');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const processTasksData = useCallback((data: any[]) => {
    const formattedTasks: Task[] = (data || []).map((t: any) => ({
      ...t,
      status: (t.status as TaskStatus) || TaskStatus.TODO,
      dueDate: t.duedate || t.dueDate,
      createdAt: t.createdat || t.createdAt,
      workspaceId: t.workspaceid || t.workspaceId,
      tags: t.task_tags?.map((tt: any) => tt.tags).filter(Boolean) || [],
      assignees: t.task_assignees?.map((ta: any) => ({
        id: ta.profiles?.id,
        name: ta.profiles?.name,
        avatar: ta.profiles?.avatar_url,
        email: ta.profiles?.email
      })).filter((u: any) => u.id) || [],
      comments: t.comments?.map((c: any) => ({
        id: c.id,
        userId: c.userid,
        userName: c.profiles?.name || 'Usuário',
        userAvatar: c.profiles?.avatar_url || `https://picsum.photos/seed/${c.userid}/100`,
        text: c.text,
        timestamp: Number(c.timestamp)
      })).sort((a: any, b: any) => a.timestamp - b.timestamp) || [],
      attachments: (t.attachments || []).map((att: any) => ({
        id: att.id,
        name: att.name,
        size: Number(att.size),
        type: att.type,
        url: att.url
      }))
    }));
    setTasks(formattedTasks);
  }, []);

  const fetchTasks = useCallback(async (triggeredByRealtimeId?: string) => {
    if (!currentWorkspace) return;
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *, 
        task_tags(tag_id, tags(*)), 
        task_assignees(user_id, profiles(*)), 
        comments(*, profiles:userid(*)), 
        attachments(*)
      `)
      .eq('workspaceid', currentWorkspace.id);

    if (error) {
      console.error("Erro ao buscar tarefas:", error);
      return;
    }
    
    if (triggeredByRealtimeId) {
      setLastUpdatedTaskId(triggeredByRealtimeId);
      setTimeout(() => setLastUpdatedTaskId(null), 2000);
    }
    
    processTasksData(data);
  }, [currentWorkspace, processTasksData]);

  const fetchInitialData = useCallback(async () => {
    setLoadError(null);
    try {
      const { data: wsData, error: wsError } = await supabase.from('workspaces').select('*');
      if (wsError) throw wsError;
      
      if (wsData && wsData.length > 0) {
        setWorkspaces(wsData);
        if (!currentWorkspace) setCurrentWorkspace(wsData[0]);
      }

      const { data: tagData } = await supabase.from('tags').select('*');
      if (tagData) setAvailableTags(tagData);

      const { data: profData, error: profError } = await supabase.from('profiles').select('*');
      if (profError) throw profError;
      if (profData) {
        setAllProfiles(profData.map(p => ({
          id: p.id,
          name: p.name || 'Usuário sem nome',
          email: p.email || '',
          avatar: p.avatar_url || `https://picsum.photos/seed/${p.id}/100`
        })));
      }

    } catch (error: any) {
      console.error('Erro detalhado:', error);
      setLoadError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace]);

  const handleSetSession = useCallback((session: any) => {
    const user: User = {
      id: session.user.id,
      name: session.user.user_metadata.full_name || session.user.email?.split('@')[0],
      email: session.user.email || '',
      avatar: session.user.user_metadata.avatar_url || `https://picsum.photos/seed/${session.user.id}/100`
    };
    setAuth({ isAuthenticated: true, user });
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) handleSetSession(session);
      else setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) handleSetSession(session);
      else {
        setAuth({ isAuthenticated: false, user: null });
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [handleSetSession]);

  useEffect(() => {
    if (auth.isAuthenticated && currentWorkspace) {
      fetchTasks();

      const channel = supabase
        .channel(`syncup-ws-${currentWorkspace.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'comments' },
          (payload) => {
            const newRecord = payload.new as any;
            const oldRecord = payload.old as any;
            const taskId = newRecord?.task_id || oldRecord?.task_id;
            fetchTasks(taskId);
          }
        )
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'tasks',
            filter: `workspaceid=eq.${currentWorkspace.id}`
          },
          (payload) => {
            const newRecord = payload.new as any;
            const oldRecord = payload.old as any;
            fetchTasks(newRecord?.id || oldRecord?.id);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attachments' },
          (payload) => {
            const newRecord = payload.new as any;
            const oldRecord = payload.old as any;
            const taskId = newRecord?.task_id || oldRecord?.task_id;
            fetchTasks(taskId);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentWorkspace, auth.isAuthenticated, fetchTasks]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (selectedAssigneeIds.length > 0) {
      result = result.filter(task => 
        task.assignees.some(assignee => selectedAssigneeIds.includes(assignee.id))
      );
    }
    if (selectedTagIds.length > 0) {
      result = result.filter(task => 
        task.tags.some(tag => selectedTagIds.includes(tag.id))
      );
    }
    if (filterDueDate) {
      result = result.filter(task => task.dueDate && task.dueDate <= filterDueDate);
    }
    return result;
  }, [tasks, selectedAssigneeIds, selectedTagIds, filterDueDate]);

  const toggleAssigneeFilter = (userId: string) => {
    setSelectedAssigneeIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const clearAllFilters = () => {
    setSelectedAssigneeIds([]);
    setSelectedTagIds([]);
    setFilterDueDate('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPass });
    if (error) { alert(`Erro no login: ${error.message}`); setIsLoading(false); }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPass,
      options: { data: { full_name: authName } }
    });
    if (error) { 
      alert(`Erro no cadastro: ${error.message}`); 
    } else {
      alert('Cadastro realizado com sucesso! Verifique seu e-mail.');
    }
    setIsLoading(false);
  };

  const handleLogout = async () => await supabase.auth.signOut();

  const handleUpdateProfile = async (updatedUser: User) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: updatedUser.name, avatar_url: updatedUser.avatar })
        .eq('id', updatedUser.id);
      
      if (error) throw error;
      setAuth(prev => ({ ...prev, user: updatedUser }));
      setAllProfiles(prev => prev.map(p => p.id === updatedUser.id ? updatedUser : p));
      await supabase.auth.updateUser({
        data: { full_name: updatedUser.name, avatar_url: updatedUser.avatar }
      });
      alert('Perfil atualizado com sucesso!');
    } catch (err: any) {
      alert(`Erro ao atualizar perfil: ${err.message}`);
    }
  };

  const handleCreateWorkspace = async (workspaceData: Omit<Workspace, 'id'>) => {
    try {
      const newId = crypto.randomUUID();
      const newWS = { id: newId, ...workspaceData };
      const { error } = await supabase.from('workspaces').insert(newWS);
      if (error) throw error;
      setWorkspaces(prev => [...prev, newWS]);
      setCurrentWorkspace(newWS);
    } catch (err: any) {
      alert(`Erro ao criar workspace: ${err.message}`);
    }
  };

  const handleCreateTag = async (name: string, color: string): Promise<Tag> => {
    try {
      const newTag = { id: crypto.randomUUID(), name, color };
      const { error } = await supabase.from('tags').insert(newTag);
      if (error) throw error;
      setAvailableTags(prev => [...prev, newTag]);
      return newTag;
    } catch (err: any) {
      console.error("Erro ao criar tag:", err);
      throw err;
    }
  };

  const handleSaveTask = async (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    try {
      const taskId = editingTask ? editingTask.id : crypto.randomUUID();
      const payload: any = {
        id: taskId, title: taskData.title, description: taskData.description,
        status: taskData.status, duedate: taskData.dueDate || null,
        created_by: auth.user?.id, workspaceid: currentWorkspace?.id
      };
      
      const { error } = await supabase.from('tasks').upsert(payload);
      if (error) throw error;
      
      await supabase.from('task_assignees').delete().eq('task_id', taskId);
      if (taskData.assignees.length > 0) {
        await supabase.from('task_assignees').insert(taskData.assignees.map(u => ({ task_id: taskId, user_id: u.id })));
      }

      await supabase.from('task_tags').delete().eq('task_id', taskId);
      if (taskData.tags.length > 0) {
        await supabase.from('task_tags').insert(taskData.tags.map(t => ({ task_id: taskId, tag_id: t.id })));
      }

      setIsTaskModalOpen(false);
      fetchTasks(taskId);
    } catch (err: any) { 
      alert(`Erro ao salvar: ${err.message}`); 
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    // Atualização otimista imediata na UI local
    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, ...updates } : task));
    
    try {
      const { assignees, tags, dueDate, workspaceId, attachments, ...directUpdates } = updates;
      const dbPayload: any = { ...directUpdates };
      
      if (dueDate !== undefined) dbPayload.duedate = dueDate;
      if (workspaceId !== undefined) dbPayload.workspaceid = workspaceId;
      
      if (Object.keys(dbPayload).length > 0) {
        await supabase.from('tasks').update(dbPayload).eq('id', taskId);
      }
      
      if (assignees !== undefined) {
        await supabase.from('task_assignees').delete().eq('task_id', taskId);
        if (assignees.length > 0) await supabase.from('task_assignees').insert(assignees.map(u => ({ task_id: taskId, user_id: u.id })));
      }
      if (tags !== undefined) {
        await supabase.from('task_tags').delete().eq('task_id', taskId);
        if (tags.length > 0) await supabase.from('task_tags').insert(tags.map(t => ({ task_id: taskId, tag_id: t.id })));
      }
      
      // Re-fetch para confirmar estado do banco
      fetchTasks(taskId);
    } catch (err: any) { 
      console.error("Erro ao atualizar tarefa:", err);
      fetchTasks(); 
    }
  };

  const handleAddComment = async (taskId: string, text: string) => {
    if (!auth.user) return;
    try {
      const { error } = await supabase.from('comments').insert({ 
        task_id: taskId, 
        userid: auth.user.id, 
        text,
        timestamp: Date.now() 
      });
      if (error) throw error;
    } catch (e: any) { 
      console.error("Erro ao salvar comentário:", e);
      alert("Falha ao enviar comentário.");
      fetchTasks(); 
    }
  };

  if (loadError && auth.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4 transition-colors duration-300">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 text-center border border-gray-100 dark:border-slate-700">
          <h2 className="text-xl font-black text-gray-800 dark:text-slate-100 mb-2">Falha na Conexão</h2>
          <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">{loadError}</p>
          <button onClick={() => fetchInitialData()} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg">Tentar Novamente</button>
        </div>
      </div>
    );
  }

  if (isLoading && !auth.isAuthenticated) return <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-900 transition-colors duration-300"><div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div><p className="text-gray-500 dark:text-slate-400 font-medium">Sincronizando...</p></div>;

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center p-4 transition-colors duration-300">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-indigo-600 mb-2">SyncUp</h1>
            <p className="text-gray-500">{isSignUp ? 'Crie sua conta' : 'Acesse seu painel'}</p>
          </div>
          <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
            {isSignUp && <input type="text" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="Nome Completo" value={authName} onChange={e => setAuthName(e.target.value)} required />}
            <input type="email" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="E-mail" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required />
            <input type="password" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="Senha" value={authPass} onChange={e => setAuthPass(e.target.value)} required />
            <button className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">{isSignUp ? 'Cadastrar' : 'Entrar'}</button>
          </form>
          <button onClick={() => setIsSignUp(!isSignUp)} className="w-full mt-6 text-sm font-semibold text-indigo-600 hover:underline">{isSignUp ? 'Já tem conta? Faça Login' : 'Não tem conta? Cadastre-se'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-slate-900 transition-colors duration-300 overflow-hidden">
      <aside className="w-64 bg-gray-50 dark:bg-slate-950 border-r border-gray-200 dark:border-slate-800 flex flex-col transition-colors duration-300">
        <div className="p-6">
          <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-sm shadow-inner">S</div> SyncUp
          </h1>
        </div>
        <nav className="flex-1 px-4 py-2 overflow-y-auto space-y-1 custom-scrollbar">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Workspaces</div>
            <button onClick={() => setIsWorkspaceModalOpen(true)} className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 p-1 rounded-md transition-colors" title="Novo Workspace"><PlusIcon /></button>
          </div>
          {workspaces.map(ws => (
            <button key={ws.id} onClick={() => setCurrentWorkspace(ws)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${currentWorkspace?.id === ws.id ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-200/50 dark:hover:bg-slate-900/50'}`}>
              <div className={`w-6 h-6 rounded-lg ${ws.color} flex items-center justify-center text-[10px] text-white shadow-sm font-normal`}>{ws.icon}</div>
              <span className="truncate">{ws.name}</span>
            </button>
          ))}
        </nav>
        
        <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-800">
           <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-slate-900 transition-all text-gray-500 dark:text-slate-400">
             <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
               {isDarkMode ? <SunIcon /> : <MoonIcon />}
             </div>
             <span className="text-xs font-bold uppercase tracking-wider">{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
           </button>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-slate-800">
          <div onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-indigo-50/20 cursor-pointer transition-all group">
            <img src={auth.user?.avatar} className="w-9 h-9 rounded-xl border-2 border-indigo-50 dark:border-slate-700 group-hover:scale-110 transition-transform" alt="User" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-gray-800 dark:text-slate-200 truncate">{auth.user?.name}</p>
              <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} className="text-[10px] text-red-500 font-black hover:underline">Sair</button>
            </div>
          </div>
        </div>

        {/* ASSINATURA NO FOOTER DA SIDEBAR */}
        <div className="p-4 border-t border-gray-50 dark:border-slate-800/50 text-center">
          <p className="text-[8px] font-black text-gray-400 dark:text-slate-600 uppercase tracking-widest leading-relaxed">
            Desenvolvido por<br/>
            <span className="text-indigo-500/70 dark:text-indigo-400/50">Pedro Henrique</span> em 2025<br/>
            Viva Revveilon
          </p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 transition-colors duration-300 overflow-hidden">
        <header className="h-16 px-8 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shadow-sm z-10 transition-colors duration-300 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 ${currentWorkspace?.color || 'bg-gray-200'} rounded-xl flex items-center justify-center text-white text-xl shadow-md`}>{currentWorkspace?.icon || '📁'}</div>
            <h2 className="text-lg font-black text-gray-900 dark:text-slate-100">{currentWorkspace?.name}</h2>
          </div>
          <button onClick={() => { setEditingTask(undefined); setIsTaskModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95">Nova Tarefa</button>
        </header>

        <div className="px-8 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex flex-col gap-4 transition-colors duration-300 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Responsáveis:</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedAssigneeIds([])} className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${selectedAssigneeIds.length === 0 ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'}`}>Tudo</button>
                <div className="flex -space-x-1.5 overflow-hidden p-1">
                  {allProfiles.map(profile => {
                    const isActive = selectedAssigneeIds.includes(profile.id);
                    return (
                      <button key={profile.id} onClick={() => toggleAssigneeFilter(profile.id)} title={profile.name} className={`relative w-8 h-8 rounded-lg border-2 transition-all group ${isActive ? 'border-indigo-500 z-10 scale-110 shadow-lg' : 'border-white dark:border-slate-900 hover:z-10 hover:scale-105'}`}>
                        <img src={profile.avatar} className="w-full h-full rounded-[6px] object-cover" alt={profile.name} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {(selectedAssigneeIds.length > 0 || selectedTagIds.length > 0 || filterDueDate) && (
              <button onClick={clearAllFilters} className="text-[10px] font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-xl transition-all border border-red-100 dark:border-red-900/30">LIMPAR FILTROS</button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1"><TagIcon /> Tags:</span>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => {
                  const isActive = selectedTagIds.includes(tag.id);
                  return (
                    <button key={tag.id} onClick={() => toggleTagFilter(tag.id)} className={`px-3 py-1 rounded-full text-[9px] font-black transition-all border-2 ${isActive ? `${tag.color} text-white border-white dark:border-slate-800 shadow-md scale-105` : `bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:border-indigo-200`}`}>{tag.name.toUpperCase()}</button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1"><CalendarIcon /> Vencimento até:</span>
              <div className="relative group">
                <input type="date" value={filterDueDate} onChange={(e) => setFilterDueDate(e.target.value)} className="bg-gray-100 dark:bg-slate-800 border-none rounded-xl px-4 py-1.5 text-[10px] font-black text-gray-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer" />
                {filterDueDate && <button onClick={() => setFilterDueDate('')} className="absolute -right-2 -top-2 w-5 h-5 bg-white dark:bg-slate-700 rounded-full shadow-md text-gray-400 flex items-center justify-center text-xs font-black hover:text-red-500 transition-colors">×</button>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto px-8 py-6 flex bg-gray-50/50 dark:bg-slate-900/50 custom-scrollbar transition-colors duration-300">
          {Object.values(TaskStatus).map((status, index) => {
            const isLast = index === Object.values(TaskStatus).length - 1;
            const columnTasks = filteredTasks.filter(t => t.status === status);
            return (
              <div key={status} className={`w-80 flex-shrink-0 flex flex-col ${!isLast ? 'border-r-2 border-dashed border-gray-200 dark:border-slate-800 pr-6 mr-6' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const taskId = e.dataTransfer.getData('taskId'); handleUpdateTask(taskId, { status }); }}>
                <div className="flex items-center gap-2 mb-6 px-2">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${STATUS_CONFIG[status].color}`}>{STATUS_CONFIG[status].label}</span>
                  <span className="text-xs font-black text-gray-300 dark:text-slate-600 ml-auto">{columnTasks.length}</span>
                </div>
                <div className="flex-1 space-y-4 p-2 rounded-3xl border-2 border-transparent">
                  {columnTasks.map(task => {
                    const isUpdated = lastUpdatedTaskId === task.id;
                    const attachmentCount = task.attachments?.length || 0;
                    return (
                      <div key={task.id} draggable onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)} onClick={() => setSelectedTaskId(task.id)} className={`bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border ${isUpdated ? 'border-indigo-500 ring-4 ring-indigo-500/20' : 'border-gray-100 dark:border-slate-700'} cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-2xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-2`}>
                        <div className="flex justify-between items-start mb-2">
                           {task.tags && task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {task.tags.map(tag => <span key={tag.id} className={`${tag.color} text-white text-[8px] font-black px-1.5 py-0.5 rounded-md shadow-sm uppercase tracking-tighter`}>{tag.name}</span>)}
                            </div>
                          )}
                          {/* MARCADOR DE ANEXOS */}
                          {attachmentCount > 0 && (
                            <div className="flex items-center gap-1 text-[8px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/50 ml-auto" title={`${attachmentCount} anexos`}>
                              <PaperclipIcon />
                              <span>{attachmentCount}</span>
                            </div>
                          )}
                        </div>
                        <h4 className="font-black text-gray-800 dark:text-slate-100 mb-3 leading-snug">{task.title}</h4>
                        <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-slate-700">
                          <div className="flex -space-x-2">
                            {task.assignees.map(u => <img key={u.id} src={u.avatar} className="w-7 h-7 rounded-lg border-2 border-white dark:border-slate-800 shadow-sm" title={u.name} alt={u.name} />)}
                          </div>
                          <div className={`text-[9px] font-black uppercase tracking-tighter ${task.dueDate && new Date(task.dueDate) < new Date() ? 'text-red-500' : 'text-gray-400 dark:text-slate-500'}`}>
                            {/* FIX: Adicionando sufixo de hora para evitar distorção de dia pelo Timezone */}
                            {task.dueDate ? new Date(task.dueDate + 'T00:00:00').toLocaleDateString() : 'Sem prazo'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {isWorkspaceModalOpen && <WorkspaceModal onClose={() => setIsWorkspaceModalOpen(false)} onSave={handleCreateWorkspace} />}
      {isProfileModalOpen && auth.user && <ProfileModal user={auth.user} onClose={() => setIsProfileModalOpen(false)} onSave={handleUpdateProfile} />}
      {isTaskModalOpen && currentWorkspace && <TaskModal workspaceId={currentWorkspace.id} availableTags={availableTags} onCreateTag={handleCreateTag} currentUser={auth.user} allProfiles={allProfiles} initialTask={editingTask} onClose={() => setIsTaskModalOpen(false)} onSave={handleSaveTask} />}
      {activeTaskForDetail && auth.user && <TaskDetail task={activeTaskForDetail} availableTags={availableTags} onCreateTag={handleCreateTag} currentUser={auth.user} allProfiles={allProfiles} onClose={() => setSelectedTaskId(null)} onAddComment={handleAddComment} onUpdateTask={handleUpdateTask} />}
    </div>
  );
};

export default App;