"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { ApiError, apiRequest, readApiError } from "../lib/api";
import { DATA_CHANGED_EVENT } from "../lib/live-data";

function redirectToLogin() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL("/login", window.location.origin);
  url.searchParams.set("motivo", "sessao-expirada");
  window.location.assign(url.toString());
}

export function useApiResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(async () => {});

  loadRef.current = async () => {
    setLoading(true);

    try {
      const next = await apiRequest<T>(path);
      startTransition(() => {
        setData(next);
        setError(null);
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && typeof window !== "undefined") {
        redirectToLogin();
        return;
      }

      startTransition(() => {
        setError(readApiError(error));
      });
    } finally {
      startTransition(() => {
        setLoading(false);
      });
    }
  };

  useEffect(() => {
    void loadRef.current();
  }, [path]);

  useEffect(() => {
    const handleDataChanged = () => {
      void loadRef.current();
    };

    window.addEventListener(DATA_CHANGED_EVENT, handleDataChanged);

    return () => {
      window.removeEventListener(DATA_CHANGED_EVENT, handleDataChanged);
    };
  }, [path]);

  return {
    data,
    loading,
    error,
    reload: loadRef.current,
    setData
  };
}
