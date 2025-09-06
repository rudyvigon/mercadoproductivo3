// Store de notificaciones sin dependencias externas (reemplaza Zustand)
// Implementada con useSyncExternalStore para suscripción eficiente y mínimas re-renderizaciones.
import { useMemo, useSyncExternalStore } from "react";

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

// Estado y listeners a nivel de módulo
let state: State = {
  unreadCount: 0,
  recent: [],
};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {}
  });
}

// Acciones (identidad estable)
const setUnreadCount: Actions["setUnreadCount"] = (n) => {
  const value = Math.max(0, Number(n) || 0);
  if (value === state.unreadCount) return;
  state = { ...state, unreadCount: value };
  emit();
};

const bumpUnread: Actions["bumpUnread"] = (delta = 1) => {
  const next = Math.max(0, (Number(state.unreadCount) || 0) + delta);
  if (next === state.unreadCount) return;
  state = { ...state, unreadCount: next };
  emit();
};

const setRecent: Actions["setRecent"] = (list) => {
  const next = [...(list || [])];
  state = { ...state, recent: next };
  emit();
};

const prependRecent: Actions["prependRecent"] = (item, max = 5) => {
  const curr = state.recent || [];
  const next = [item, ...curr.filter((x) => x.id !== item.id)].slice(0, max);
  state = { ...state, recent: next };
  emit();
};

// Suscripción externa
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// getSnapshot DEBE devolver una referencia estable si no cambió el estado
function getSnapshot(): State {
  return state;
}

// Snapshot usado durante SSR: valores por defecto (referencia estable)
const serverSnapshot: State = {
  unreadCount: 0,
  recent: [],
};
function getServerSnapshot(): State {
  return serverSnapshot;
}

// Tipado del hook con propiedad estática `getState` para uso fuera de React
type UseMessagesNotificationsHook = {
  (): State & Actions;
  getState: () => State & Actions;
};

// Implementación base que solo devuelve el estado (para identidad estable)
const useMessagesNotificationsImpl = (): State =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

// Hook público: compone estado + acciones (acciones con identidad estable)
const useMessagesNotificationsHook = (): State & Actions => {
  const s = useMessagesNotificationsImpl();
  return useMemo(
    () => ({
      ...s,
      setUnreadCount,
      bumpUnread,
      setRecent,
      prependRecent,
    }),
    [s]
  );
};

export const useMessagesNotifications: UseMessagesNotificationsHook = Object.assign(
  useMessagesNotificationsHook,
  {
    getState: () => ({
      ...state,
      setUnreadCount,
      bumpUnread,
      setRecent,
      prependRecent,
    }),
  }
);

// Helpers de depuración (solo en desarrollo): exponen setters en window
// para facilitar pruebas manuales del badge de no leídos sin backend.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const w = window as any;
  try {
    w.__mpSetUnreadCount = setUnreadCount;
    w.__mpBumpUnread = bumpUnread;
    w.__mpGetUnread = () => useMessagesNotifications.getState().unreadCount;
    w.__mpSetRecent = setRecent;
  } catch {}
}
