"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

/**
 * Debounced search hook
 * Returns debounced value that updates after the specified delay
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Search hook with debouncing
 */
export function useSearch(initialValue: string = "", delay: number = 300) {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const debouncedSearchTerm = useDebouncedValue(searchTerm, delay);

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm("");
  }, []);

  return {
    searchTerm,
    debouncedSearchTerm,
    handleSearch,
    clearSearch,
    isSearching: searchTerm !== debouncedSearchTerm,
  };
}

/**
 * Filter items based on search term
 */
export function useFilteredItems<T>(
  items: T[],
  searchTerm: string,
  searchKeys: (keyof T)[]
): T[] {
  return useMemo(() => {
    if (!searchTerm.trim()) {
      return items;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();

    return items.filter((item) =>
      searchKeys.some((key) => {
        const value = item[key];
        if (typeof value === "string") {
          return value.toLowerCase().includes(lowerSearchTerm);
        }
        if (typeof value === "number") {
          return value.toString().includes(lowerSearchTerm);
        }
        return false;
      })
    );
  }, [items, searchTerm, searchKeys]);
}

/**
 * Pagination hook
 */
export function usePagination(totalItems: number, itemsPerPage: number = 10) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const goToPage = useCallback(
    (page: number) => {
      const validPage = Math.max(1, Math.min(page, totalPages));
      setCurrentPage(validPage);
    },
    [totalPages]
  );

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const firstPage = useCallback(() => {
    goToPage(1);
  }, [goToPage]);

  const lastPage = useCallback(() => {
    goToPage(totalPages);
  }, [goToPage, totalPages]);

  // Reset to first page when total items changes significantly
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  return {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    itemsPerPage,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}

/**
 * Combined search and pagination hook
 */
export function useSearchWithPagination<T>(
  items: T[],
  searchKeys: (keyof T)[],
  itemsPerPage: number = 10,
  searchDelay: number = 300
) {
  const { searchTerm, debouncedSearchTerm, handleSearch, clearSearch, isSearching } =
    useSearch("", searchDelay);

  const filteredItems = useFilteredItems(items, debouncedSearchTerm, searchKeys);

  const pagination = usePagination(filteredItems.length, itemsPerPage);

  // Reset to first page when search changes
  useEffect(() => {
    pagination.goToPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  const paginatedItems = useMemo(() => {
    return filteredItems.slice(pagination.startIndex, pagination.endIndex);
  }, [filteredItems, pagination.startIndex, pagination.endIndex]);

  return {
    // Search
    searchTerm,
    handleSearch,
    clearSearch,
    isSearching,
    // Filtered data
    filteredItems,
    paginatedItems,
    totalFilteredCount: filteredItems.length,
    // Pagination
    ...pagination,
  };
}
