/**
 * Type Definitions Index
 *
 * Re-export all types from this file for easy imports:
 * import { User, Department, StatusConfig } from "@/types";
 */

// Database types - main export
export * from "./database";

// Re-export commonly used types for convenience
export type {
  Database,
  Department,
  User,
  StatusConfig,
  Category,
  UserRole,
  StatusGroup,
  EntityType,
  PriorityLevel,
  RouteType,
  POStatus,
  InvoiceStatus,
  MovementType,
  StockOutReason,
  TransactionType,
  ItemCategory,
  ContactPerson,
  Supplier,
  Item,
  Warehouse,
  QMRL,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
} from "./database";

// Financial types
export interface FinancialAmount {
  amount: number;
  currency: string;
  exchange_rate: number;
  amount_eusd: number;
}

// Common entity fields
export interface AuditFields {
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// API response types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Form state types
export interface FormState {
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
}

// Search and filter types
export interface SearchParams {
  query?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// Select option type for dropdowns
export interface SelectOption<T = string> {
  value: T;
  label: string;
  description?: string;
  color?: string;
  disabled?: boolean;
}
