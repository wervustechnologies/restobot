import { useEffect, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';

/**
 * Subscribe to a lightweight RTDB invalidation node and invoke `onInvalidate`
 * (debounced) whenever it changes. This replaces setInterval polling: the
 * backend bumps the node on every state change, so listeners refetch their own
 * REST endpoint only when something actually changed.
 *
 * Pass a falsy `path` to keep the listener inactive (e.g. until the restaurant
 * id is known). The callback is held in a ref, so callers may pass an inline
 * function without forcing a resubscribe on every render.
 */
export function useInvalidation(path, onInvalidate, { debounceMs = 200 } = {}) {
  const cbRef = useRef(onInvalidate);

  // Keep the latest callback in the ref without forcing a resubscribe. Written
  // in an effect (not during render) to satisfy react-hooks/refs.
  useEffect(() => {
    cbRef.current = onInvalidate;
  });

  useEffect(() => {
    if (!path) return undefined;

    let timer = null;
    let mounted = true;

    const unsubscribe = onValue(ref(db, path), () => {
      if (!mounted) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (mounted && typeof cbRef.current === 'function') cbRef.current();
      }, debounceMs);
    });

    return () => {
      mounted = false;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [path, debounceMs]);
}
