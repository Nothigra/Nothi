/** Lets a pushed screen put a dynamic title in the app bar (e.g. the person you're chatting with). */
import { useEffect, useSyncExternalStore } from 'react';

let current = { path: null, title: '' };
const listeners = new Set();

export function useScreenTitle(path, title) {
  useEffect(() => {
    current = { path, title };
    listeners.forEach((l) => l());
    return () => {
      if (current.path === path) { current = { path: null, title: '' }; listeners.forEach((l) => l()); }
    };
  }, [path, title]);
}

export function useScreenTitleFor(path) {
  const snap = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => current);
  return snap.path === path ? snap.title : null;
}
