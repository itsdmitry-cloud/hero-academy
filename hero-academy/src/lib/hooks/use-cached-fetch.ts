'use client';

import { useCallback, useEffect, useState } from 'react';

// Stale-while-revalidate кэш на уровне модуля. Переход между вкладками
// показывает данные мгновенно из кэша, фоном идёт refetch.
// Кэш сбрасывается при перезагрузке страницы — этого достаточно для UX.

interface CacheEntry<T> {
  data: T;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export function getCached<T>(key: string): T | undefined {
  return cache.get(key)?.data as T | undefined;
}

export function setCached<T>(key: string, data: T): void {
  cache.set(key, { data });
}

export function invalidateCached(key: string): void {
  cache.delete(key);
}

async function runFetch<T>(currentKey: string, fetcher: () => Promise<T>): Promise<T> {
  let promise = inflight.get(currentKey) as Promise<T> | undefined;
  if (!promise) {
    promise = fetcher();
    inflight.set(currentKey, promise);
    promise.finally(() => {
      if (inflight.get(currentKey) === promise) inflight.delete(currentKey);
    });
  }
  const fresh = await promise;
  setCached(currentKey, fresh);
  return fresh;
}

/**
 * useCachedFetch — отдаёт кэш мгновенно, фоном перезапрашивает.
 *
 * @param key — null/undefined откладывает запрос (например, ждём profile.id)
 * @param fetcher — async-функция, возвращающая свежие данные.
 *   Передавай через useCallback, иначе effect будет дёргаться на каждый рендер.
 */
export function useCachedFetch<T>(
  key: string | null | undefined,
  fetcher: () => Promise<T>,
): {
  data: T | undefined;
  loading: boolean;
  refetch: () => Promise<void>;
  mutate: (updater: (prev: T | undefined) => T) => void;
} {
  const [data, setData] = useState<T | undefined>(() =>
    key ? getCached<T>(key) : undefined,
  );
  const [loading, setLoading] = useState<boolean>(() =>
    key ? getCached<T>(key) === undefined : false,
  );

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const cached = getCached<T>(key);
    // Если кэша нет (например, key поменялся на новый scope) — сразу показываем loading.
    // setState внутри effect здесь намеренный, поэтому игнорируем React Compiler warning.
    if (cached === undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
    } else {
      setData(cached);
    }
    runFetch(key, fetcher)
      .then((fresh) => {
        if (cancelled) return;
        setData(fresh);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [key, fetcher]);

  const refetch = useCallback(async () => {
    if (!key) return;
    inflight.delete(key);
    const fresh = await runFetch(key, fetcher);
    setData(fresh);
  }, [key, fetcher]);

  // mutate — оптимистичное обновление: мгновенно меняет UI и кэш.
  // Используй вместе с refetch() в catch, если серверный апдейт упал.
  const mutate = useCallback((updater: (prev: T | undefined) => T) => {
    if (!key) return;
    const next = updater(getCached<T>(key));
    setCached(key, next);
    setData(next);
  }, [key]);

  return { data, loading, refetch, mutate };
}
