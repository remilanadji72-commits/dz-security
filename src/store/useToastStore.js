import { create } from 'zustand';

let nextId = 1;

export const useToastStore = create((set, get) => ({
  toasts: [],

  _add(message, type, duration = 4000) {
    const id = nextId++;
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get()._remove(id), duration);
    return id;
  },

  _remove(id) {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
  },

  // API objet — usage dans composants React : const { addToast } = useToastStore();
  addToast({ type = 'info', message = '', duration } = {}) {
    return get()._add(message, type, duration);
  },

  toast: {
    success: (msg, duration) => useToastStore.getState()._add(msg, 'success', duration),
    error:   (msg, duration) => useToastStore.getState()._add(msg, 'error',   duration),
    info:    (msg, duration) => useToastStore.getState()._add(msg, 'info',    duration),
    warning: (msg, duration) => useToastStore.getState()._add(msg, 'warning', duration),
  },
}));

// Raccourci importable sans hook React — usage dans stores/utils async
// import { toast } from '../store/useToastStore';
// toast.success('Sauvegardé.');
export const toast = {
  success: (msg, duration) => useToastStore.getState()._add(msg, 'success', duration),
  error:   (msg, duration) => useToastStore.getState()._add(msg, 'error',   duration),
  info:    (msg, duration) => useToastStore.getState()._add(msg, 'info',    duration),
  warning: (msg, duration) => useToastStore.getState()._add(msg, 'warning', duration),
};
