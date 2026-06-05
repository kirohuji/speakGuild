import { create } from 'zustand';
import { getUnreadCount, getUserNotifications, type NotificationItem } from './api';
import {
  connectNotificationSocket,
  disconnectNotificationSocket,
  onNewNotification,
} from './socket';

type TabValue = 'all' | 'unread' | 'read'

interface TabCacheEntry {
  list: NotificationItem[]
  page: number
  hasMore: boolean
}

interface NotificationStore {
  unreadCount: number;
  isLoading: boolean;
  initialized: boolean;
  userId: string | null;

  // Tab 列表缓存
  tabLists: Partial<Record<TabValue, TabCacheEntry>>
  tabLoading: Partial<Record<TabValue, boolean>>
  fetchTabList: (tab: TabValue, page?: number, replace?: boolean) => Promise<void>
  markItemReadInStore: (id: string) => void
  markAllReadInStore: () => void

  fetchUnreadCount: () => Promise<void>;
  initSocket: (userId: string) => void;
  disconnect: () => void;
  incrementUnread: () => void;
  decrementUnread: (n?: number) => void;
  resetUnread: () => void;
}

const PAGE_SIZE = 20

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  unreadCount: 0,
  isLoading: false,
  initialized: false,
  userId: null,

  tabLists: {},
  tabLoading: {},

  async fetchTabList(tab, page = 1, replace = true) {
    const { tabLoading: loading } = get()
    if (loading[tab]) return

    set((s) => ({ tabLoading: { ...s.tabLoading, [tab]: true } }))
    try {
      const isReadParam = tab === 'all' ? undefined : tab === 'read'
      const result = await getUserNotifications({ page, pageSize: PAGE_SIZE, isRead: isReadParam })

      set((s) => {
        const prev = s.tabLists[tab]
        const list = replace
          ? result.list
          : [...(prev?.list ?? []), ...result.list]
        return {
          tabLists: { ...s.tabLists, [tab]: { list, page, hasMore: result.list.length === PAGE_SIZE } },
          tabLoading: { ...s.tabLoading, [tab]: false },
        }
      })
    } catch {
      set((s) => ({ tabLoading: { ...s.tabLoading, [tab]: false } }))
    }
  },

  /** 标记单条已读，更新所有已缓存的 tab 列表 */
  markItemReadInStore(id) {
    set((s) => {
      const updated: typeof s.tabLists = {}
      for (const [key, entry] of Object.entries(s.tabLists)) {
        if (!entry) continue
        updated[key as TabValue] = {
          ...entry,
          list: entry.list.map((n) =>
            n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
          ),
        }
      }
      return { tabLists: { ...s.tabLists, ...updated } }
    })
  },

  /** 当前激活 tab 的全部标记已读 */
  markAllReadInStore() {
    set((s) => {
      const updated: typeof s.tabLists = {}
      for (const [key, entry] of Object.entries(s.tabLists)) {
        if (!entry) continue
        updated[key as TabValue] = {
          ...entry,
          list: entry.list.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
        }
      }
      return { tabLists: { ...s.tabLists, ...updated } }
    })
  },

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
