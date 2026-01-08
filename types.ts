
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE'
}

export type UserRole = 'ADMIN' | 'MEMBER' | 'GUEST';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  email: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: number;
  attachments?: Attachment[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignees: User[];
  attachments: Attachment[];
  tags: Tag[];
  workspaceId: string;
  createdAt: number;
  dueDate?: string; // Formato YYYY-MM-DD
  comments?: Comment[];
}

export interface Workspace {
  id: string;
  name: string;
  color: string;
  icon: string;
  role?: UserRole; // Role do usuário atual neste workspace
  ownerId?: string;
}

export interface WorkspaceMember {
  id: string; // ID da relação
  userId: string;
  workspaceId: string;
  role: UserRole;
  user: User;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}
