'use client';

import { useToastStore, ToastType } from '@/lib/store/toastStore';
import styles from './ToastContainer.module.css';

const DEFAULT_ICONS: Record<ToastType, string> = {
  xp: '⚡',
  gold: '💰',
  damage: '💔',
  heal: '💚',
  levelup: '🎉',
  artifact: '✨',
  streak: '🔥',
  death: '💀',
  royal: '👑',
  info: 'ℹ️',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}
          onClick={() => removeToast(toast.id)}
          role="alert"
        >
          <div className={styles.iconBox}>
            {toast.icon || DEFAULT_ICONS[toast.type]}
          </div>
          <div className={styles.body}>
            <div className={styles.title}>{toast.title}</div>
            <div className={styles.message}>{toast.message}</div>
          </div>
          <button className={styles.close} onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}>✕</button>
          <div
            className={`${styles.progressBar} ${styles[`progressBar_${toast.type}`]}`}
            style={{ animationDuration: `${(toast.duration || 4000)}ms` }}
          />
        </div>
      ))}
    </div>
  );
}
