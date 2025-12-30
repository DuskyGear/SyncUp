
import React, { useState } from 'react';
import { Workspace } from '../types';

interface WorkspaceModalProps {
  onClose: () => void;
  onSave: (workspace: Omit<Workspace, 'id'>) => void;
}

const COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 
  'bg-teal-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 
  'bg-pink-500', 'bg-slate-500'
];

const ICONS = ['📁', '🚀', '🛠️', '🎨', '📊', '💡', '🔥', '🏢', '🏠', '🌍', '🎮', '🎧'];

export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[6]); // Indigo default
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]); // Folder default

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      color: selectedColor,
      icon: selectedIcon
    });
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Novo Workspace</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-white rounded-xl transition-all">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Preview do Workspace */}
          <div className="flex flex-col items-center gap-4">
            <div className={`w-20 h-20 ${selectedColor} rounded-3xl flex items-center justify-center text-4xl shadow-xl shadow-${selectedColor.split('-')[1]}-200 text-white transform transition-transform duration-500 hover:rotate-6`}>
              {selectedIcon}
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Visualização</p>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Nome do Espaço</label>
            <input 
              autoFocus
              className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:bg-white outline-none transition-all font-bold text-gray-800 placeholder:text-gray-300 shadow-inner"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Marketing, Desenvolvimento..."
              required
            />
          </div>

          <div className="space-y-4">
            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Cor de Identificação</label>
            <div className="grid grid-cols-5 gap-3">
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`h-8 rounded-lg transition-all transform hover:scale-110 ${color} ${selectedColor === color ? 'ring-4 ring-offset-2 ring-indigo-200 scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'}`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Ícone</label>
            <div className="grid grid-cols-6 gap-2">
              {ICONS.map(icon => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setSelectedIcon(icon)}
                  className={`h-10 text-xl flex items-center justify-center rounded-xl transition-all ${selectedIcon === icon ? 'bg-indigo-50 border-2 border-indigo-200 scale-110 shadow-sm' : 'bg-gray-50 hover:bg-white border border-transparent'}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-4 text-xs font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 rounded-2xl transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="flex-[2] py-4 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
            >
              Criar Workspace
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
