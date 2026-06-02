import { create } from 'zustand';
import { getUnreadCount } from './api';
import {
  connectNotificationSocket,
  disconnectNotificationSocket,
  onNewNotification,
} from './socket';

interface NotificationStore {
  unreadCount: number;
  isLoading: boolean;
  initialized: boolean;
  userId: string | null;
  fetchUnreadCount: () => Promise<void>;
  initSocket: (userId: string) => void;
  disconnect: () => void;
  incrementUnread: () => void;
  decrementUnread: (n?: number) => void;
  resetUnread: () => void;
}

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  unreadCount: 0,
  isLoading: false,
  initialized: false,
  userId: null,

  fetchUnreadCount: async () => {
    try {
      set({ isLoading: true });
      const { count } = await getUnreadCount();
      set({ unreadCount: count, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  initSocket: (userId: string) => {
    const state = get();
    if (state.initialized && state.userId === userId) return;
    if (state.initialized) disconnectNotificationSocket();
    set({ initialized: true, userId });

    connectNotificationSocket();
    onNewNotification(() => {
      set((s) => ({ unreadCount: s.unreadCount + 1 }));
    });
  },

  disconnect: () => {
    disconnectNotificationSocket();
    set({ initialized: false, userId: null, unreadCount: 0, isLoading: false });
  },

  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  decrementUnread: (n = 1) =>
    set((s) => ({ unreadCount: Math.max(0, s.unreadCount - n) })),
  resetUnread: () => set({ unreadCount: 0 }),
}));
