"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, type Pagination } from "./api";

/** Fetch a (paginated) admin list; refetches whenever `query` changes or `reload()` is called. */
export function useApiList<T>(path: string, query: Record<string, string | number | boolean | undefined | null> = {}) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(query);

  useEffect(() => {
    let cancelled = false;
    api<T[]>(path, { query: JSON.parse(key) as typeof query })
      .then((r) => {
        if (cancelled) return;
        setRows(r.data);
        setPagination(r.meta?.pagination ?? null);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [path, key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { rows, pagination, error, reload };
}

/** Fetch one admin resource. */
export function useApiResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api<T>(path)
      .then((r) => !cancelled && (setData(r.data), setError(null)))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [path, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, reload, setData };
}
