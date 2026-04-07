import { create } from 'zustand';
import { ReactNode } from 'react';

export type ToastType = 'xp' | 'gold' | 'damage' | 'heal' | 'levelup' | 'artifact' | 'streak' | 'death' | 'royal' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  icon?: ReactNode;
  duration?: number; // ms, default 4000
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const newToast: Toast = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    // Auto-dismiss
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, toast.duration || 4000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}));
