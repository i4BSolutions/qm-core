/**
 * Search and filter utilities
 */

/**
 * Simple text search - checks if any of the searchable fields contain the query
 */
export function matchesSearchQuery<T extends Record<string, unknown>>(
  item: T,
  query: string,
  searchableFields: (keyof T)[]
): boolean {
  if (!query.trim()) {
    return true;
  }

  const lowerQuery = query.toLowerCase();

  return searchableFields.some((field) => {
    const value = item[field];
    if (typeof value === "string") {
      return value.toLowerCase().includes(lowerQuery);
    }
    if (typeof value === "number") {
      return value.toString().includes(lowerQuery);
    }
    return false;
  });
}

/**
 * Filter items by search query
 */
export function filterBySearch<T extends Record<string, unknown>>(
  items: T[],
  query: string,
  searchableFields: (keyof T)[]
): T[] {
  return items.filter((item) =>
    matchesSearchQuery(item, query, searchableFields)
  );
}

/**
 * Highlight matching text in a string
 */
export function highlightMatches(text: string, query: string): string {
  if (!query.trim()) {
    return text;
  }

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");

  return text.replace(regex, "<mark>$1</mark>");
}

/**
 * Sort items by field
 */
export function sortByField<T>(
  items: T[],
  field: keyof T,
  direction: "asc" | "desc" = "asc"
): T[] {
  return [...items].sort((a, b) => {
    const aValue = a[field];
    const bValue = b[field];

    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    let comparison = 0;

    if (typeof aValue === "string" && typeof bValue === "string") {
      comparison = aValue.localeCompare(bValue);
    } else if (typeof aValue === "number" && typeof bValue === "number") {
      comparison = aValue - bValue;
    } else if (aValue instanceof Date && bValue instanceof Date) {
      comparison = aValue.getTime() - bValue.getTime();
    } else {
      comparison = String(aValue).localeCompare(String(bValue));
    }

    return direction === "desc" ? -comparison : comparison;
  });
}

/**
 * Paginate items
 */
export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number
): {
  items: T[];
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
} {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    items: items.slice(startIndex, endIndex),
    totalPages,
    totalItems,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Create a search filter function for Supabase queries
 */
export function createSupabaseSearchFilter(
  query: string,
  searchableColumns: string[]
): string | null {
  if (!query.trim()) {
    return null;
  }

  // Create OR conditions for each searchable column
  const conditions = searchableColumns
    .map((column) => `${column}.ilike.%${query}%`)
    .join(",");

  return `or(${conditions})`;
}

/**
 * Format search results count text
 */
export function formatResultsCount(
  total: number,
  filtered: number,
  query: string
): string {
  if (!query.trim()) {
    return `${total} item${total !== 1 ? "s" : ""}`;
  }

  if (filtered === 0) {
    return `No results for "${query}"`;
  }

  return `${filtered} of ${total} item${total !== 1 ? "s" : ""} matching "${query}"`;
}
