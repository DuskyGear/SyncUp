
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { AuthState, Workspace, Task, TaskStatus, User, Tag, Attachment, UserRole } from './types';
import { TaskModal } from './components/TaskModal';
import { TaskDetail } from './components/TaskDetail';
import { WorkspaceModal } from './components/WorkspaceModal';
import { ProfileModal } from './components/ProfileModal';
import { InviteModal } from './components/InviteModal';
import { PlusIcon, CalendarIcon, SunIcon, MoonIcon, TagIcon, PaperclipIcon } from './components/Icons';
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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  
  // Filtros
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [filterDueDate, setFilterDueDate] = useState<string>('');

  // Modais
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  
  const activeTaskForDetail = useMemo(() => 
    tasks.find(t => t.id === selectedTaskId) || null, 
  [tasks, selectedTaskId]);

  // Auth State UI
  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authName, setAuthName] = useState('');

  const isGuestUser = useMemo(() => {
    if (isSuperAdmin) return false;
    return currentWorkspace?.role === 'GUEST';
  }, [currentWorkspace, isSuperAdmin]);

  // --- Efeitos de Inicialização ---

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const handleSetSession = useCallback((session: any) => {
    const user: User = {
      id: session.user.id,
      name: session.user.user_metadata.full_name || session.user.email?.split('@')[0],
      email: session.user.email || '',
      avatar: session.user.user_metadata.avatar_url || `https://picsum.photos/seed/${session.user.id}/100`
    };
    setAuth({ isAuthenticated: true, user });
  }, []);

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
    if (auth.isAuthenticated) {
        fetchInitialData();
    }
  }, [auth.isAuthenticated]);

  // --- Lógica de Dados ---

  const processTasksData = useCallback((data: any[]) => {
    const formattedTasks: Task[] = (data || []).map((t: any) => ({
      ...t,
      status: (t.status as TaskStatus) || TaskStatus.TODO,
      dueDate: t.duedate,
      createdAt: t.createdat,
      workspaceId: t.workspaceid,
      
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
        attachments: c.attachments || [],
        timestamp: c.created_at ? new Date(c.created_at).getTime() : Date.now()
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
      .eq('workspaceid', currentWorkspace.id)
      .order('createdat', { ascending: false });

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
    if (!auth.user) return;
    setLoadError(null);
    try {
      let userIsSuperAdmin = false;
      try {
        const { data: profileData } = await supabase.from('profiles').select('is_super_admin').eq('id', auth.user.id).single();
        userIsSuperAdmin = !!profileData?.is_super_admin;
      } catch (err) { console.warn(err); }
      
      setIsSuperAdmin(userIsSuperAdmin);

      let myWorkspaces: Workspace[] = [];

      if (userIsSuperAdmin) {
        const { data: allWorkspaces, error: wsError } = await supabase.from('workspaces').select('*').order('created_at', { ascending: false });
        if (wsError) throw wsError;
        myWorkspaces = allWorkspaces.map((ws: any) => ({ ...ws, role: 'ADMIN' as UserRole }));
      } else {
        const { data: members, error: memberError } = await supabase.from('workspace_members').select('workspace_id, role, workspaces(*)').eq('user_id', auth.user.id);
        if (memberError) throw memberError;
        myWorkspaces = members.map((m: any) => ({ ...m.workspaces, role: m.role as UserRole })).filter((w: any) => w.id);
        
        // Carregar Workspaces GUEST (onde tem tarefa mas não é membro)
        const { data: assignedTasks } = await supabase.from('task_assignees').select('tasks(workspaceid)').eq('user_id', auth.user.id);
        if (assignedTasks) {
            const guestIds = [...new Set(assignedTasks.map((t:any) => t.tasks?.workspaceid).filter(Boolean))];
            const newGuestIds = guestIds.filter(id => !myWorkspaces.find(mw => mw.id === id));
            if (newGuestIds.length > 0) {
                const { data: gw } = await supabase.from('workspaces').select('*').in('id', newGuestIds);
                if (gw) myWorkspaces.push(...gw.map(w => ({ ...w, role: 'GUEST' as UserRole })));
            }
        }
      }
      
      setWorkspaces(myWorkspaces);
      
      if (!currentWorkspace && myWorkspaces.length > 0) {
        setCurrentWorkspace(myWorkspaces[0]);
      } else if (currentWorkspace && !myWorkspaces.find(w => w.id === currentWorkspace.id)) {
        setCurrentWorkspace(myWorkspaces.length > 0 ? myWorkspaces[0] : null);
      }

      const { data: tagData } = await supabase.from('tags').select('*');
      if (tagData) setAvailableTags(tagData);

      const { data: profData } = await supabase.from('profiles').select('*');
      if (profData) {
        setAllProfiles(profData.map(p => ({
          id: p.id,
          name: p.name || 'Usuário',
          email: p.email || '',
          avatar: p.avatar_url || `https://picsum.photos/seed/${p.id}/100`
        })));
      }

    } catch (error: any) {
      console.error('Erro ao carregar dados iniciais:', error);
      // Se for erro 406 (Not Acceptable) no primeiro acesso, ignoramos pois é esperado quando está vazio
      if (error.code !== '406') {
          setLoadError(`Erro: ${error.message || 'Falha na conexão'}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [auth.user, currentWorkspace]);

  // --- Realtime ---

  useEffect(() => {
    if (auth.isAuthenticated && currentWorkspace) {
      fetchTasks();
      const channel = supabase
        .channel(`room-${currentWorkspace.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `workspaceid=eq.${currentWorkspace.id}` }, 
          (payload) => fetchTasks((payload.new as any)?.id || (payload.old as any)?.id)
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => fetchTasks())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments' }, () => fetchTasks())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, () => fetchTasks())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_tags' }, () => fetchTasks())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [currentWorkspace?.id, auth.isAuthenticated]);

  // --- Actions ---

  const handleCreateWorkspace = async (workspaceData: Omit<Workspace, 'id'>) => {
    if (!auth.user) return;
    try {
      // 1. Criar Workspace
      const { data: newWS, error: wsError } = await supabase
        .from('workspaces')
        .insert(workspaceData)
        .select()
        .single();
        
      if (wsError) throw wsError;

      // 2. Vincular Criador como ADMIN
      // A policy no banco permite INSERT se auth.uid() == user_id, garantindo que o criador possa se adicionar
      const { error: memError } = await supabase.from('workspace_members').insert({
          workspace_id: newWS.id,
          user_id: auth.user.id,
          role: 'ADMIN'
      });
      
      if (memError && !isSuperAdmin) {
          console.error("Erro ao vincular membro:", memError);
          // Não lançamos erro fatal aqui pois o workspace já foi criado. 
          // O usuário pode atualizar a página e o Super Admin verá de qualquer forma.
      }

      const wsWithRole = { ...newWS, role: 'ADMIN' as UserRole };
      setWorkspaces(prev => [wsWithRole, ...prev]);
      setCurrentWorkspace(wsWithRole);
      setIsWorkspaceModalOpen(false);
    } catch (err: any) {
      alert(`Erro ao criar workspace: ${err.message}`);
    }
  };

  const handleSaveTask = async (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    try {
      const taskId = editingTask ? editingTask.id : crypto.randomUUID();
      const dbPayload = {
        id: taskId,
        title: taskData.title,
        description: taskData.description,
        status: taskData.status,
        duedate: taskData.dueDate || null,
        workspaceid: currentWorkspace?.id,
        created_by: auth.user?.id
      };
      
      const { error } = await supabase.from('tasks').upsert(dbPayload);
      if (error) throw error;
      
      if (taskData.assignees) {
        await supabase.from('task_assignees').delete().eq('task_id', taskId);
        if (taskData.assignees.length > 0) {
          await supabase.from('task_assignees').insert(taskData.assignees.map(u => ({ task_id: taskId, user_id: u.id })));
        }
      }
      if (taskData.tags) {
        await supabase.from('task_tags').delete().eq('task_id', taskId);
        if (taskData.tags.length > 0) {
          await supabase.from('task_tags').insert(taskData.tags.map(t => ({ task_id: taskId, tag_id: t.id })));
        }
      }
      if (taskData.attachments && taskData.attachments.length > 0 && !editingTask) {
         await supabase.from('attachments').insert(taskData.attachments.map(att => ({
             id: att.id, task_id: taskId, name: att.name, size: att.size, type: att.type, url: att.url
         })));
      }
      setIsTaskModalOpen(false);
      fetchTasks(taskId);
    } catch (err: any) { alert(`Erro ao salvar: ${err.message}`); }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, ...updates } : task));
    try {
      const { assignees, tags, dueDate, workspaceId, attachments, comments, createdAt, ...simpleUpdates } = updates;
      const dbUpdates: any = { ...simpleUpdates };
      if (dueDate !== undefined) dbUpdates.duedate = dueDate;
      if (Object.keys(dbUpdates).length > 0) await supabase.from('tasks').update(dbUpdates).eq('id', taskId);
      
      if (assignees !== undefined) {
        await supabase.from('task_assignees').delete().eq('task_id', taskId);
        if (assignees.length > 0) await supabase.from('task_assignees').insert(assignees.map(u => ({ task_id: taskId, user_id: u.id })));
      }
      if (tags !== undefined) {
        await supabase.from('task_tags').delete().eq('task_id', taskId);
        if (tags.length > 0) await supabase.from('task_tags').insert(tags.map(t => ({ task_id: taskId, tag_id: t.id })));
      }
    } catch (err: any) { console.error(err); fetchTasks(); }
  };

  const handleAddComment = async (taskId: string, text: string, attachments: Attachment[] = []) => {
    if (!auth.user) return;
    try {
      const { error } = await supabase.from('comments').insert({ task_id: taskId, userid: auth.user.id, text });
      if (error) throw error;
      if (attachments.length > 0) {
        await supabase.from('attachments').insert(attachments.map(att => ({
            id: att.id, task_id: taskId, name: att.name, size: att.size, type: att.type, url: att.url
        })));
      }
    } catch (e: any) { alert(`Erro: ${e.message}`); }
  };

  const handleCreateTag = async (name: string, color: string): Promise<Tag> => {
      const { data, error } = await supabase.from('tags').insert({ name, color }).select().single();
      if (error) throw error;
      setAvailableTags(prev => [...prev, data]);
      return data;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPass });
    if (error) { alert(error.message); setIsLoading(false); }
  };
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true);
    const { error } = await supabase.auth.signUp({ email: authEmail, password: authPass, options: { data: { full_name: authName } } });
    if (error) alert(error.message); else alert('Confirme seu e-mail!');
    setIsLoading(false);
  };
  const handleLogout = () => supabase.auth.signOut();

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (selectedAssigneeIds.length > 0) result = result.filter(task => task.assignees.some(assignee => selectedAssigneeIds.includes(assignee.id)));
    if (selectedTagIds.length > 0) result = result.filter(task => task.tags.some(tag => selectedTagIds.includes(tag.id)));
    if (filterDueDate) result = result.filter(task => task.dueDate && task.dueDate <= filterDueDate);
    return result;
  }, [tasks, selectedAssigneeIds, selectedTagIds, filterDueDate]);

  const toggleFilter = (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) => {
    setter(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // --- Views ---

  if (loadError && auth.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl text-center max-w-md">
          <p className="text-red-500 mb-4 font-bold">{loadError}</p>
          <button onClick={() => fetchInitialData()} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold">Tentar Novamente</button>
        </div>
      </div>
    );
  }

  if (isLoading && !auth.isAuthenticated) return <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-[32px] shadow-2xl p-8 w-full max-w-md animate-in zoom-in-95 duration-300">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-indigo-600 mb-2">SyncUp</h1>
            <p className="text-gray-400 font-medium">Produtividade redefinida.</p>
          </div>
          <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
            {isSignUp && <input className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-700" placeholder="Seu Nome" value={authName} onChange={e => setAuthName(e.target.value)} required />}
            <input type="email" className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-700" placeholder="seu@email.com" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required />
            <input type="password" className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-700" placeholder="Senha segura" value={authPass} onChange={e => setAuthPass(e.target.value)} required />
            <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95">{isSignUp ? 'Criar Conta Grátis' : 'Acessar Workspace'}</button>
          </form>
          <button onClick={() => setIsSignUp(!isSignUp)} className="w-full mt-6 text-xs font-bold text-gray-400 hover:text-indigo-600 uppercase tracking-widest">{isSignUp ? 'Já tenho conta' : 'Não tenho cadastro'}</button>
        </div>
      </div>
    );
  }

  // --- TELA DE ONBOARDING (PRIMEIRO ACESSO) ---
  if (workspaces.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4 font-sans transition-colors duration-300">
        <div className="max-w-2xl w-full text-center space-y-8 animate-in slide-in-from-bottom-8 duration-500">
          <div className="w-24 h-24 bg-indigo-600 rounded-[32px] flex items-center justify-center mx-auto shadow-2xl shadow-indigo-200 dark:shadow-indigo-900/20">
            <span className="text-4xl text-white font-black">S</span>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Bem-vindo ao SyncUp!</h1>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
              Sua jornada de produtividade começa aqui. Para iniciar, precisamos criar seu primeiro <strong>Workspace</strong> (Espaço de Trabalho).
            </p>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-8 rounded-[32px] shadow-xl border border-gray-100 dark:border-slate-700 max-w-md mx-auto">
             <div className="flex items-center gap-4 mb-6 text-left">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center"><PlusIcon /></div>
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">Criar Workspace</h3>
                  <p className="text-xs text-gray-400">Ex: Marketing, Desenvolvimento...</p>
                </div>
             </div>
             <button 
               onClick={() => setIsWorkspaceModalOpen(true)}
               className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95 uppercase tracking-widest text-xs"
             >
               Começar Agora
             </button>
          </div>
          
          <div className="flex justify-center gap-4 text-xs font-bold text-gray-400">
            <button onClick={handleLogout} className="hover:text-red-500 transition-colors">Sair da conta</button>
            <span>•</span>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="hover:text-indigo-500 transition-colors">Alternar Tema</button>
          </div>
        </div>
        {isWorkspaceModalOpen && <WorkspaceModal onClose={() => setIsWorkspaceModalOpen(false)} onSave={handleCreateWorkspace} />}
      </div>
    );
  }

  // --- LAYOUT PADRÃO (QUANDO HÁ DADOS) ---
  return (
    <div className="flex h-screen bg-white dark:bg-slate-900 transition-colors duration-300 overflow-hidden font-sans">
      <aside className="w-64 bg-gray-50 dark:bg-slate-950 border-r border-gray-200 dark:border-slate-800 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-black text-indigo-600 flex items-center gap-2 tracking-tight"><span className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-sm shadow-lg">S</span> SyncUp</h1>
        </div>
        <nav className="flex-1 px-4 py-2 overflow-y-auto space-y-1 custom-scrollbar">
          <div className="flex items-center justify-between mb-3 px-2">
            <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Workspaces</span>
            <button onClick={() => setIsWorkspaceModalOpen(true)} className="text-indigo-600 p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded"><PlusIcon /></button>
          </div>
          {workspaces.map(ws => (
              <button key={ws.id} onClick={() => setCurrentWorkspace(ws)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${currentWorkspace?.id === ws.id ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm ring-1 ring-gray-100 dark:ring-slate-700' : 'text-gray-500 hover:bg-gray-200/50 dark:hover:bg-slate-900'}`}>
                <span className="text-lg">{ws.icon}</span><span className="truncate flex-1 text-left">{ws.name}</span>
                {ws.role === 'GUEST' && <span className="text-[8px] bg-amber-100 text-amber-600 px-1.5 rounded font-black">GUEST</span>}
                {isSuperAdmin && ws.role === 'ADMIN' && <span className="text-[8px] bg-indigo-100 text-indigo-600 px-1.5 rounded font-black">SUPER</span>}
              </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-slate-800 space-y-2">
           <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-200/50 dark:hover:bg-slate-900 transition-all text-gray-500">{isDarkMode ? <SunIcon /> : <MoonIcon />} <span className="text-xs font-bold">Tema {isDarkMode ? 'Claro' : 'Escuro'}</span></button>
           <div onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-200/50 dark:hover:bg-slate-900 cursor-pointer"><img src={auth.user?.avatar} className="w-8 h-8 rounded-lg bg-gray-300 object-cover" /><div className="flex-1 min-w-0 text-left"><p className="text-xs font-bold text-gray-700 dark:text-slate-200 truncate">{auth.user?.name}</p><button onClick={(e) => {e.stopPropagation(); handleLogout()}} className="text-[10px] text-red-500 font-bold hover:underline">Sair</button></div></div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 transition-colors">
        {currentWorkspace ? (
          <>
            <header className="h-16 px-8 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur z-10">
               <div className="flex items-center gap-4"><div className={`w-10 h-10 ${currentWorkspace.color} rounded-xl flex items-center justify-center text-white text-xl shadow-lg`}>{currentWorkspace.icon}</div><div><h2 className="text-lg font-black text-gray-800 dark:text-slate-100">{currentWorkspace.name}</h2>{isGuestUser && <span className="text-[10px] font-bold text-amber-500">Modo Leitura</span>}</div></div>
               <div className="flex gap-3">
                 {!isGuestUser && (
                   <><button onClick={() => setIsInviteModalOpen(true)} className="px-4 py-2 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Convidar</button>
                   <button onClick={() => { setEditingTask(undefined); setIsTaskModalOpen(true); }} className="px-6 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95">Nova Tarefa</button></>
                 )}
               </div>
            </header>
            <div className="px-8 py-4 flex flex-col gap-4 border-b border-gray-100 dark:border-slate-800">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4"><span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Filtros:</span><div className="flex -space-x-2">{allProfiles.map(p => (<button key={p.id} onClick={() => toggleFilter(setSelectedAssigneeIds, p.id)} className={`w-8 h-8 rounded-full border-2 ${selectedAssigneeIds.includes(p.id) ? 'border-indigo-500 z-10 scale-110' : 'border-white dark:border-slate-900'} overflow-hidden transition-all`} title={p.name}><img src={p.avatar} className="w-full h-full object-cover" /></button>))}</div></div>
                 {(selectedAssigneeIds.length > 0 || selectedTagIds.length > 0 || filterDueDate) && (<button onClick={() => { setSelectedAssigneeIds([]); setSelectedTagIds([]); setFilterDueDate('') }} className="text-[10px] font-bold text-red-500 hover:underline">Limpar Filtros</button>)}
               </div>
               <div className="flex gap-4 items-center">
                  <div className="flex items-center gap-2 text-gray-400 dark:text-slate-500"><TagIcon /><div className="flex gap-2">{availableTags.map(tag => (<button key={tag.id} onClick={() => toggleFilter(setSelectedTagIds, tag.id)} className={`px-2 py-1 rounded-md text-[10px] font-bold border ${selectedTagIds.includes(tag.id) ? `${tag.color} text-white border-transparent` : 'bg-transparent border-gray-200 dark:border-slate-700'}`}>{tag.name}</button>))}</div></div>
                  <div className="w-px h-4 bg-gray-200 dark:bg-slate-800"></div>
                  <div className="flex items-center gap-2 text-gray-400 dark:text-slate-500"><CalendarIcon /><input type="date" value={filterDueDate} onChange={e => setFilterDueDate(e.target.value)} className="bg-transparent text-xs font-bold outline-none dark:text-slate-300" /></div>
               </div>
            </div>
            <div className="flex-1 overflow-x-auto p-8 flex gap-8 bg-gray-50/30 dark:bg-slate-950/30">
              {Object.values(TaskStatus).map(status => {
                const colTasks = filteredTasks.filter(t => t.status === status);
                return (
                  <div key={status} className="w-80 flex-shrink-0 flex flex-col" onDragOver={e => !isGuestUser && e.preventDefault()} onDrop={e => { if(isGuestUser) return; e.preventDefault(); const id = e.dataTransfer.getData('taskId'); handleUpdateTask(id, { status }); }}>
                    <div className={`mb-4 flex items-center justify-between px-1 border-b-2 pb-2 ${STATUS_CONFIG[status].color.split(' ')[0].replace('bg-', 'border-')}`}><span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-slate-400">{STATUS_CONFIG[status].label}</span><span className="text-xs font-bold text-gray-400">{colTasks.length}</span></div>
                    <div className="flex-1 space-y-3">
                      {colTasks.map(task => (
                        <div key={task.id} draggable={!isGuestUser} onDragStart={e => e.dataTransfer.setData('taskId', task.id)} onClick={() => setSelectedTaskId(task.id)} className={`bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all group ${lastUpdatedTaskId === task.id ? 'ring-2 ring-indigo-500' : ''}`}>
                          <div className="flex justify-between items-start mb-2"><div className="flex flex-wrap gap-1">{task.tags.map(tag => <div key={tag.id} className={`w-8 h-1.5 rounded-full ${tag.color}`}></div>)}</div>{task.attachments.length > 0 && <span className="text-gray-400"><PaperclipIcon /></span>}</div>
                          <h4 className="font-bold text-gray-800 dark:text-slate-200 text-sm mb-3 line-clamp-2">{task.title}</h4>
                          <div className="flex justify-between items-center mt-auto pt-3 border-t border-gray-50 dark:border-slate-700/50"><div className="flex -space-x-1.5">{task.assignees.map(u => <img key={u.id} src={u.avatar} className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-800" title={u.name} />)}</div>{task.dueDate && (<span className={`text-[10px] font-bold ${new Date(task.dueDate) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>{new Date(task.dueDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</span>)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-slate-950 transition-colors">
             <div className="w-24 h-24 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-sm"><div className="text-4xl text-gray-400 dark:text-slate-500">📂</div></div>
             <h2 className="text-2xl font-black text-gray-800 dark:text-slate-200 mb-3">Selecione um Workspace</h2>
             <p className="text-sm font-medium text-gray-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed">Seus workspaces estão na barra lateral.</p>
          </div>
        )}
      </main>

      {isWorkspaceModalOpen && <WorkspaceModal onClose={() => setIsWorkspaceModalOpen(false)} onSave={handleCreateWorkspace} />}
      {isProfileModalOpen && auth.user && <ProfileModal user={auth.user} onClose={() => setIsProfileModalOpen(false)} onSave={async (u) => { const { error } = await supabase.from('profiles').update({ name: u.name, avatar_url: u.avatar }).eq('id', u.id); if(!error) { setAuth(prev => ({...prev, user: u})); setAllProfiles(prev => prev.map(p => p.id === u.id ? u : p)); } }} />}
      {isTaskModalOpen && currentWorkspace && !isGuestUser && <TaskModal workspaceId={currentWorkspace.id} availableTags={availableTags} onCreateTag={handleCreateTag} currentUser={auth.user} allProfiles={allProfiles} initialTask={editingTask} onClose={() => setIsTaskModalOpen(false)} onSave={handleSaveTask} />}
      {isInviteModalOpen && currentWorkspace && !isGuestUser && <InviteModal workspace={currentWorkspace} onClose={() => setIsInviteModalOpen(false)} />}
      
      {activeTaskForDetail && auth.user && (
        <TaskDetail task={activeTaskForDetail} availableTags={availableTags} onCreateTag={handleCreateTag} currentUser={auth.user} allProfiles={allProfiles} onClose={() => setSelectedTaskId(null)} onAddComment={handleAddComment} onUpdateTask={isGuestUser ? () => {} : handleUpdateTask} />
      )}
    </div>
  );
};

export default App;
