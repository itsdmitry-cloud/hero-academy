'use client';

import { ReactNode, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
  children: ReactNode;
}

// Client-only guard для portal: на сервере `mounted === false`, на клиенте
// после гидратации — `true`. Используем useSyncExternalStore вместо
// useEffect + setState(true), иначе линтер `react-hooks/set-state-in-effect`
// справедливо ругается на cascading render после монтирования.
const noopSubscribe = () => () => {};
const useIsMounted = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,    // client snapshot
    () => false,   // server snapshot
  );

export function Modal({ isOpen, onClose, title, size = 'md', children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const mounted = useIsMounted();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className={styles.overlay}
      ref={overlayRef}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className={`${styles.modal} ${styles[size]}`}>
        {title && (
          <div className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            <button className={styles.close} onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        )}
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
