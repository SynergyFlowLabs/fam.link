import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Small data-loading hook: no cache, no global store, explicit reload. */
export function useAsync<T>(loader: () => Promise<T>, dependencies: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const run = latest.current + 1;
    latest.current = run;
    setLoading(true);
    loader()
      .then((result) => {
        if (latest.current !== run) return;
        setData(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (latest.current !== run) return;
        setError(cause instanceof Error ? cause.message : 'Something went wrong.');
      })
      .finally(() => {
        if (latest.current === run) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, error, loading, reload };
}

export function useRoute(): { path: string[]; navigate: (path: string) => void } {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#\/?/, ''));

  useEffect(() => {
    const onChange = () => setHash(window.location.hash.replace(/^#\/?/, ''));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const path = hash.split('/').filter(Boolean);
  const navigate = useCallback((next: string) => {
    window.location.hash = `#/${next.replace(/^#?\/?/, '')}`;
  }, []);
  return { path, navigate };
}
