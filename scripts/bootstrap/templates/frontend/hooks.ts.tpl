/**
 * Stale-while-revalidate data hooks for ${pascal_name} entities.
 *
 * Pattern per entity:
 *
 * 1. On mount, the hook reads the cached rows from Dexie and renders
 *    them immediately (empty array on first visit; cached payload
 *    afterwards).
 * 2. A second effect kicks off the API fetch in the background and
 *    writes the result back into Dexie + state. The UI swaps the
 *    stale rows for fresh ones once the request settles.
 *
 * Mutations call ``api.<entity>.xxx`` then ``refresh()``.
 */

import {useCallback, useEffect, useState} from "react";

import {api} from "../api/client";
import {db, refreshTable} from "../db/schema";
import type {${type_import_list}} from "../types/${name}";

interface CachedResult<T> {
    data: T[];
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
}

interface CachedSingle<T> {
    data: T | undefined;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
}

function useCachedCollection<T extends {id: number}>(
    loadCached: () => Promise<T[]>,
    fetchFresh: () => Promise<T[]>,
): CachedResult<T> {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const fresh = await fetchFresh();
            setData(fresh);
        } catch (e) {
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    }, [fetchFresh]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const cached = await loadCached();
                if (!cancelled && cached.length > 0) {
                    setData(cached);
                }
            } catch {
                // Cache misses are fine; the fresh fetch below populates state.
            }
            try {
                const fresh = await fetchFresh();
                if (!cancelled) {
                    setData(fresh);
                    setError(null);
                }
            } catch (e) {
                if (!cancelled) setError(e as Error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [loadCached, fetchFresh]);

    return {data, loading, error, refresh};
}

function useCachedSingle<T extends {id: number}>(
    id: number | null,
    loadCached: (id: number) => Promise<T | undefined>,
    fetchFresh: (id: number) => Promise<T>,
    persist: (row: T) => Promise<unknown>,
): CachedSingle<T> {
    const [data, setData] = useState<T | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        if (id === null) {
            setData(undefined);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const fresh = await fetchFresh(id);
            await persist(fresh);
            setData(fresh);
        } catch (e) {
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    }, [id, fetchFresh, persist]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (id === null) {
                setLoading(false);
                return;
            }
            const cached = await loadCached(id);
            if (!cancelled && cached) setData(cached);
            try {
                const fresh = await fetchFresh(id);
                if (!cancelled) {
                    setData(fresh);
                    await persist(fresh);
                }
            } catch (e) {
                if (!cancelled) setError(e as Error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id, loadCached, fetchFresh, persist]);

    return {data, loading, error, refresh};
}

${refresh_functions}

/** Refresh every cached table in one shot. */
export async function refreshAll(): Promise<void> {
    await Promise.all([${refresh_all_calls}]);
}

${entity_hooks}
