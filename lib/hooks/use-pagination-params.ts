"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface PaginationParams {
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export function usePaginationParams(defaultPageSize = 20): PaginationParams {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = parseInt(
    searchParams.get("pageSize") || String(defaultPageSize),
    10
  );

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        params.set(key, value);
      });
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const setPage = useCallback(
    (p: number) => updateParams({ page: String(p) }),
    [updateParams]
  );

  const setPageSize = useCallback(
    (size: number) => updateParams({ page: "1", pageSize: String(size) }),
    [updateParams]
  );

  return { page, pageSize, setPage, setPageSize };
}
