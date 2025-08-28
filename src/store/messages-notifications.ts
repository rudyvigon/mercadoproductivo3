import { create } from "zustand";

export type NotificationItem = {
  id: string;
  created_at?: string;
  seller_id: string;
  sender_name: string;
  subject: string;
  body?: string;
};

type State = {
  unreadCount: number;
  recent: NotificationItem[];
};

type Actions = {
  setUnreadCount: (n: number) => void;
  bumpUnread: (delta?: number) => void;
  setRecent: (list: NotificationItem[]) => void;
  prependRecent: (item: NotificationItem, max?: number) => void;
};

export const useMessagesNotifications = create<State & Actions>((set, get) => ({
  unreadCount: 0,
  recent: [],
  setUnreadCount: (n) => set({ unreadCount: Math.max(0, Number(n) || 0) }),
  bumpUnread: (delta = 1) => set({ unreadCount: Math.max(0, get().unreadCount + delta) }),
  setRecent: (list) => set({ recent: [...(list || [])] }),
  prependRecent: (item, max = 5) => {
    const curr = get().recent;
    const next = [item, ...curr.filter((x) => x.id !== item.id)].slice(0, max);
    set({ recent: next });
  },
}));
