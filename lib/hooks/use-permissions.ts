"use client";

import { useMemo } from "react";
import { useUserRole, useUserPermissions } from "@/components/providers/auth-provider";
// Kept local after UserRole was removed from types/database.ts in Phase 62
type UserRole = "admin" | "qmrl" | "qmhq";
// Import DB permission types under distinct names to avoid collision with the
// legacy PermissionResource type defined below in this file.
import type {
  PermissionResource as DbPermissionResource,
  PermissionLevel as DbPermissionLevel,
} from "@/types";

/**
 * Permission actions
 */
export type PermissionAction = "create" | "read" | "update" | "delete";

/**
 * Resources that can be permission-controlled
 */
export type PermissionResource =
  | "users"
  | "qmrl"
  | "qmhq"
  | "financial_transactions"
  | "inventory_transactions"
  | "purchase_orders"
  | "invoices"
  | "items"
  | "warehouses"
  | "suppliers"
  | "contact_persons"
  | "departments"
  | "categories"
  | "statuses"
  | "stock_out_requests";

/**
 * Permission matrix based on 3-role RBAC model
 *
 * | Resource | Admin | QMRL | QMHQ |
 * |----------|-------|------|------|
 * | Users | CRUD | - | - |
 * | QMRL | CRUD | CRU | R |
 * | QMHQ | CRUD | - | CRUD |
 * | Financial Trans. | CRUD | - | R (view in QMHQ tabs only) |
 * | Inventory Trans. | CRUD | - | R |
 * | POs | CRUD | - | R (view in QMHQ tabs only) |
 * | Invoices | CRUD | - | R (view in QMHQ tabs only) |
 * | Items | CRUD | R | RU |
 * | Warehouses | CRUD | - | R (view in QMHQ tabs only) |
 * | Suppliers | CRUD | - | R |
 * | Contact Persons | CRUD | CRU | CRUD |
 * | Departments | CRUD | R | R |
 * | Categories | CRUD | R | CR |
 * | Statuses | CRUD | R | CR |
 * | Stock-Out Requests | CRUD | - | R |
 */

type PermissionMatrix = {
  [resource in PermissionResource]: {
    [role in UserRole]: PermissionAction[];
  };
};

const permissionMatrix: PermissionMatrix = {
  users: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [],
    qmhq: [],
  },
  qmrl: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["create", "read", "update"],
    qmhq: ["read"],
  },
  qmhq: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [],
    qmhq: ["create", "read", "update", "delete"],
  },
  financial_transactions: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [],
    qmhq: ["read"],
  },
  inventory_transactions: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [],
    qmhq: ["read"],
  },
  purchase_orders: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [],
    qmhq: ["read"],
  },
  invoices: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [],
    qmhq: ["read"],
  },
  items: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"],
    qmhq: ["read", "update"],
  },
  warehouses: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [],
    qmhq: ["read"],
  },
  suppliers: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [],
    qmhq: ["read"],
  },
  contact_persons: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["create", "read", "update"],
    qmhq: ["create", "read", "update", "delete"],
  },
  departments: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"],
    qmhq: ["read"],
  },
  categories: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"],
    qmhq: ["create", "read"],
  },
  statuses: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"],
    qmhq: ["create", "read"],
  },
  stock_out_requests: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [],
    qmhq: ["read"],
  },
};

/**
 * Check if a role has permission for an action on a resource
 */
export function hasPermission(
  role: UserRole | null,
  action: PermissionAction,
  resource: PermissionResource
): boolean {
  if (!role) return false;
  return permissionMatrix[resource][role].includes(action);
}

/**
 * Get all permissions for a role on a resource
 */
export function getPermissions(
  role: UserRole | null,
  resource: PermissionResource
): PermissionAction[] {
  if (!role) return [];
  return permissionMatrix[resource][role];
}

/**
 * Hook for checking permissions
 * @deprecated Use useResourcePermissions() instead — this uses the old role matrix which is always null since Phase 60.
 */
export function usePermissions() {
  const role = useUserRole();

  const can = useMemo(() => {
    return (action: PermissionAction, resource: PermissionResource): boolean => {
      return hasPermission(role, action, resource);
    };
  }, [role]);

  const canAny = useMemo(() => {
    return (actions: PermissionAction[], resource: PermissionResource): boolean => {
      return actions.some((action) => hasPermission(role, action, resource));
    };
  }, [role]);

  const canAll = useMemo(() => {
    return (actions: PermissionAction[], resource: PermissionResource): boolean => {
      return actions.every((action) => hasPermission(role, action, resource));
    };
  }, [role]);

  const permissions = useMemo(() => {
    return (resource: PermissionResource): PermissionAction[] => {
      return getPermissions(role, resource);
    };
  }, [role]);

  return {
    role,
    can,
    canAny,
    canAll,
    permissions,
    isAdmin: role === "admin",
    isQmrl: role === "qmrl",
    isQmhq: role === "qmhq",
  };
}

/**
 * Navigation items visible to each role
 */
export const roleNavigation: Record<UserRole, string[]> = {
  admin: [
    "/dashboard",
    "/qmrl",
    "/qmhq",
    "/po",
    "/invoice",
    "/inventory",
    "/inventory/stock-out-requests",
    "/warehouse",
    "/item",
    "/admin",
  ],
  qmrl: [
    "/dashboard",
    "/qmrl",
    "/item",
  ],
  qmhq: [
    "/dashboard",
    "/qmrl",
    "/qmhq",
    "/item",
  ],
};

/**
 * Check if a role can access a route
 * @deprecated Use useResourcePermission() instead — this uses the old role system.
 */
export function canAccessRoute(role: UserRole | null, path: string): boolean {
  if (!role) return false;

  const allowedRoutes = roleNavigation[role];

  // Check if the path starts with any allowed route
  return allowedRoutes.some((route) => {
    if (route === path) return true;
    if (path.startsWith(route + "/")) return true;
    return false;
  });
}

// ============================================
// NEW: DB-backed permission hooks (Phase 62)
// These replace the legacy role-matrix system.
// ============================================

/**
 * Maps URL path prefixes to their controlling PermissionResource.
 * Ordered by specificity (longest prefix first) for correct matching.
 * Used by middleware (server) and page guards (client).
 */
export const ROUTE_RESOURCE_MAP: { prefix: string; resource: DbPermissionResource }[] = [
  { prefix: '/inventory/stock-in', resource: 'stock_in' },
  { prefix: '/inventory/stock-out-requests', resource: 'sor' },
  { prefix: '/inventory/stock-out', resource: 'sor' },
  { prefix: '/inventory', resource: 'inventory_dashboard' },
  { prefix: '/dashboard', resource: 'system_dashboard' },
  { prefix: '/qmrl', resource: 'qmrl' },
  { prefix: '/qmhq', resource: 'qmhq' },
  { prefix: '/po', resource: 'po' },
  { prefix: '/invoice', resource: 'invoice' },
  { prefix: '/warehouse', resource: 'warehouse' },
  { prefix: '/item', resource: 'item' },
  { prefix: '/admin', resource: 'admin' },
];

/**
 * Find the permission resource controlling a given URL path.
 * Returns undefined if no route matches (unprotected page).
 */
export function getResourceForRoute(pathname: string): DbPermissionResource | undefined {
  const match = ROUTE_RESOURCE_MAP.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(entry.prefix + '/')
  );
  return match?.resource;
}

/**
 * Returns the current user's permission level for a given resource.
 * Returns 'block' when not loaded or resource not found (fail closed).
 */
export function useResourcePermission(resource: DbPermissionResource): DbPermissionLevel {
  const perms = useUserPermissions();
  return perms[resource] ?? 'block';
}

/**
 * Returns true if the current user has at least 'view' access to the resource.
 * edit >= view > block
 */
export function useCanView(resource: DbPermissionResource): boolean {
  const level = useResourcePermission(resource);
  return level === 'view' || level === 'edit';
}

/**
 * Returns true if the current user has 'edit' access to the resource.
 */
export function useCanEdit(resource: DbPermissionResource): boolean {
  const level = useResourcePermission(resource);
  return level === 'edit';
}

/**
 * Hook that provides DB-backed permission checks for all resources.
 * Used by the sidebar and any component that needs to gate visibility
 * based on the user_permissions table (not the old role matrix).
 */
export function useResourcePermissions() {
  const perms = useUserPermissions();

  const getLevel = useMemo(() => {
    return (resource: DbPermissionResource): DbPermissionLevel => {
      return perms[resource] ?? 'block';
    };
  }, [perms]);

  const canView = useMemo(() => {
    return (resource: DbPermissionResource): boolean => {
      const level = perms[resource] ?? 'block';
      return level === 'view' || level === 'edit';
    };
  }, [perms]);

  const canEdit = useMemo(() => {
    return (resource: DbPermissionResource): boolean => {
      return (perms[resource] ?? 'block') === 'edit';
    };
  }, [perms]);

  const isAdmin = useMemo(() => {
    return (perms['admin'] ?? 'block') === 'edit';
  }, [perms]);

  return { getLevel, canView, canEdit, isAdmin, permissions: perms };
}
