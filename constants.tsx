
import React from 'react';
import { User, Workspace, TaskStatus } from './types';

export const DEFAULT_USERS: User[] = [
  { id: '1', name: 'Alex Rivera', email: 'alex@syncup.com', avatar: 'https://picsum.photos/seed/alex/100' },
  { id: '2', name: 'Sarah Chen', email: 'sarah@syncup.com', avatar: 'https://picsum.photos/seed/sarah/100' },
  { id: '3', name: 'Marcus Miller', email: 'marcus@syncup.com', avatar: 'https://picsum.photos/seed/marcus/100' },
  { id: '4', name: 'Elena Gomez', email: 'elena@syncup.com', avatar: 'https://picsum.photos/seed/elena/100' },
];

export const STATUS_CONFIG = {
  [TaskStatus.TODO]: { label: 'To Do', color: 'bg-gray-100 text-gray-700', border: 'border-gray-200' },
  [TaskStatus.IN_PROGRESS]: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', border: 'border-blue-200' },
  [TaskStatus.REVIEW]: { label: 'In Review', color: 'bg-purple-100 text-purple-700', border: 'border-purple-200' },
  [TaskStatus.DONE]: { label: 'Completed', color: 'bg-green-100 text-green-700', border: 'border-green-200' },
};
