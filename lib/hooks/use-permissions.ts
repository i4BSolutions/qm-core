"use client";

import { useMemo } from "react";
import { useUserRole } from "@/components/providers/auth-provider";
import type { UserRole } from "@/types";

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
 * | Financial Trans. | CRUD | - | CRUD |
 * | Inventory Trans. | CRUD | - | R |
 * | POs | CRUD | - | CRUD |
 * | Invoices | CRUD | - | CRUD |
 * | Items | CRUD | R | RU |
 * | Warehouses | CRUD | R | RU |
 * | Suppliers | CRUD | R | CRUD |
 * | Contact Persons | CRUD | CRU | CRUD |
 * | Departments | CRUD | R | R |
 * | Categories | CRUD | R | CR |
 * | Statuses | CRUD | R | CR |
 * | Stock-Out Requests | CRUD | R | CR |
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
    qmhq: ["create", "read", "update", "delete"],
  },
  inventory_transactions: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [],
    qmhq: ["read"],
  },
  purchase_orders: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [],
    qmhq: ["create", "read", "update", "delete"],
  },
  invoices: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [],
    qmhq: ["create", "read", "update", "delete"],
  },
  items: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"],
    qmhq: ["read", "update"],
  },
  warehouses: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"],
    qmhq: ["read", "update"],
  },
  suppliers: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"],
    qmhq: ["create", "read", "update", "delete"],
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
    qmrl: ["read"],
    qmhq: ["create", "read"],
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
    "/po",
    "/invoice",
    "/inventory/stock-out-requests",
    "/warehouse",
    "/item",
  ],
};

/**
 * Check if a role can access a route
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
