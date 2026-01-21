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
  | "statuses";

/**
 * Permission matrix based on PRD
 *
 * | Resource | Admin | Quartermaster | Finance | Inventory | Proposal | Frontline | Requester |
 * |----------|-------|---------------|---------|-----------|----------|-----------|-----------|
 * | Users | CRUD | R | - | - | - | - | - |
 * | QMRL | CRUD | CRUD | R | R | RU | RU | CR (own) |
 * | QMHQ | CRUD | CRUD | RU | RU | CRUD | R | R (own) |
 * | Financial Trans. | CRUD | R | CRUD | R | R | - | - |
 * | Inventory Trans. | CRUD | CRUD | R | CRUD | R | - | - |
 * | POs | CRUD | CRUD | CRUD | R | CRUD | - | - |
 * | Invoices | CRUD | CRUD | CRUD | RU | R | - | - |
 * | Items | CRUD | CRUD | R | CRUD | R | R | R |
 * | Warehouses | CRUD | CRUD | R | CRUD | R | - | - |
 * | Suppliers | CRUD | CRUD | CRUD | R | CRUD | R | R |
 * | Contact Persons | CRUD | CRUD | R | R | CRUD | CRUD | R |
 */

type PermissionMatrix = {
  [resource in PermissionResource]: {
    [role in UserRole]: PermissionAction[];
  };
};

const permissionMatrix: PermissionMatrix = {
  users: {
    admin: ["create", "read", "update", "delete"],
    quartermaster: ["read"],
    finance: [],
    inventory: [],
    proposal: [],
    frontline: [],
    requester: [],
  },
  qmrl: {
    admin: ["create", "read", "update", "delete"],
    quartermaster: ["create", "read", "update", "delete"],
    finance: ["read"],
    inventory: ["read"],
    proposal: ["read", "update"],
    frontline: ["read", "update"],
    requester: ["create", "read"], // own only - handled separately
  },
  qmhq: {
    admin: ["create", "read", "update", "delete"],
    quartermaster: ["create", "read", "update", "delete"],
    finance: ["read", "update"],
    inventory: ["read", "update"],
    proposal: ["create", "read", "update", "delete"],
    frontline: ["read"],
    requester: ["read"], // own only - handled separately
  },
  financial_transactions: {
    admin: ["create", "read", "update", "delete"],
    quartermaster: ["read"],
    finance: ["create", "read", "update", "delete"],
    inventory: ["read"],
    proposal: ["read"],
    frontline: [],
    requester: [],
  },
  inventory_transactions: {
    admin: ["create", "read", "update", "delete"],
    quartermaster: ["create", "read", "update", "delete"],
    finance: ["read"],
    inventory: ["create", "read", "update", "delete"],
    proposal: ["read"],
    frontline: [],
    requester: [],
  },
  purchase_orders: {
    admin: ["create", "read", "update", "delete"],
    quartermaster: ["create", "read", "update", "delete"],
    finance: ["create", "read", "update", "delete"],
    inventory: ["read"],
    proposal: ["create", "read", "update", "delete"],
    frontline: [],
    requester: [],
  },
  invoices: {
    admin: ["create", "read", "update", "delete"],
    quartermaster: ["create", "read", "update", "delete"],
    finance: ["create", "read", "update", "delete"],
    inventory: ["read", "update"],
    proposal: ["read"],
    frontline: [],
    requester: [],
  },
  items: {
    admin: ["create", "read", "update", "delete"],
    quartermaster: ["create", "read", "update", "delete"],
    finance: ["read"],
    inventory: ["create", "read", "update", "delete"],
    proposal: ["read"],
    frontline: ["read"],
    requester: ["read"],
  },
  warehouses: {
    admin: ["create", "read", "update", "delete"],
    quartermaster: ["create", "read", "update", "delete"],
    finance: ["read"],
    inventory: ["create", "read", "update", "delete"],
    proposal: ["read"],
    frontline: [],
    requester: [],
  },
  suppliers: {
    admin: ["create", "read", "update", "delete"],
    quartermaster: ["create", "read", "update", "delete"],
    finance: ["create", "read", "update", "delete"],
    inventory: ["read"],
    proposal: ["create", "read", "update", "delete"],
    frontline: ["read"],
    requester: ["read"],
  },
  contact_persons: {
    admin: ["create", "read", "update", "delete"],
    quartermaster: ["create", "read", "update", "delete"],
    finance: ["read"],
    inventory: ["read"],
    proposal: ["create", "read", "update", "delete"],
    frontline: ["create", "read", "update", "delete"],
    requester: ["read"],
  },
  departments: {
    admin: ["create", "read", "update", "delete"],
    quartermaster: ["read"],
    finance: ["read"],
    inventory: ["read"],
    proposal: ["read"],
    frontline: ["read"],
    requester: ["read"],
  },
  categories: {
    admin: ["create", "read", "update", "delete"],
    quartermaster: ["create", "read", "update", "delete"],
    finance: ["read"],
    inventory: ["read"],
    proposal: ["create", "read"],
    frontline: ["read"],
    requester: ["read"],
  },
  statuses: {
    admin: ["create", "read", "update", "delete"],
    quartermaster: ["create", "read", "update", "delete"],
    finance: ["read"],
    inventory: ["read"],
    proposal: ["create", "read"],
    frontline: ["read"],
    requester: ["read"],
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
    isQuartermaster: role === "quartermaster",
    isFinance: role === "finance",
    isInventory: role === "inventory",
    isProposal: role === "proposal",
    isFrontline: role === "frontline",
    isRequester: role === "requester",
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
    "/warehouse",
    "/item",
    "/admin",
  ],
  quartermaster: [
    "/dashboard",
    "/qmrl",
    "/qmhq",
    "/po",
    "/invoice",
    "/inventory",
    "/warehouse",
    "/item",
  ],
  finance: [
    "/dashboard",
    "/qmrl",
    "/qmhq",
    "/po",
    "/invoice",
    "/item",
  ],
  inventory: [
    "/dashboard",
    "/qmrl",
    "/qmhq",
    "/invoice",
    "/inventory",
    "/warehouse",
    "/item",
  ],
  proposal: [
    "/dashboard",
    "/qmrl",
    "/qmhq",
    "/po",
    "/invoice",
    "/item",
  ],
  frontline: [
    "/dashboard",
    "/qmrl",
    "/qmhq",
    "/item",
  ],
  requester: [
    "/dashboard",
    "/qmrl",
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
