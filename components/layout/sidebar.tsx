"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUser } from "@/components/providers/auth-provider";
import { canAccessRoute } from "@/lib/hooks/use-permissions";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  ShoppingCart,
  FileSpreadsheet,
  Package,
  Warehouse,
  Box,
  Settings,
  ChevronDown,
  Radio,
  Shield,
} from "lucide-react";
import { useState, useMemo } from "react";
import type { UserRole } from "@/types";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
  // Optional: specify which roles can see this item
  roles?: UserRole[];
}

const allNavigation: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "QMRL",
    href: "/qmrl",
    icon: FileText,
  },
  {
    label: "QMHQ",
    href: "/qmhq",
    icon: ClipboardList,
    roles: ["admin", "qmhq"],
  },
  {
    label: "Purchase Orders",
    href: "/po",
    icon: ShoppingCart,
    roles: ["admin"],
  },
  {
    label: "Invoices",
    href: "/invoice",
    icon: FileSpreadsheet,
    roles: ["admin"],
  },
  {
    label: "Inventory",
    icon: Package,
    roles: ["admin"],
    children: [
      { label: "Dashboard", href: "/inventory" },
      { label: "Stock In", href: "/inventory/stock-in" },
      { label: "Execution Queue", href: "/inventory/stock-out" },
      { label: "Stock-Out Requests", href: "/inventory/stock-out-requests" },
    ],
  },
  {
    label: "Warehouses",
    href: "/warehouse",
    icon: Warehouse,
    roles: ["admin"],
  },
  {
    label: "Items",
    href: "/item",
    icon: Box,
  },
];

const adminNavigation: NavItem[] = [
  {
    label: "Admin",
    icon: Settings,
    roles: ["admin"],
    children: [
      { label: "Users", href: "/admin/users" },
      { label: "Departments", href: "/admin/departments" },
      { label: "Suppliers", href: "/admin/suppliers" },
      { label: "Contacts", href: "/admin/contacts" },
      { label: "Categories", href: "/admin/categories" },
      { label: "Statuses", href: "/admin/statuses" },
      { label: "Standard Units", href: "/admin/standard-units" },
      { label: "Flow Tracking", href: "/admin/flow-tracking" },
    ],
  },
];

function NavItemComponent({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const Icon = item.icon;

  const isActive = item.href
    ? pathname === item.href || pathname.startsWith(item.href + "/")
    : item.children?.some(
        (child) => pathname === child.href || pathname.startsWith(child.href + "/")
      );

  // Auto-expand if a child is active
  const shouldAutoExpand = item.children?.some(
    (child) => pathname === child.href || pathname.startsWith(child.href + "/")
  );

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
            isActive
              ? "bg-amber-500/10 text-amber-400 border-l-2 border-amber-500"
              : "text-sidebar-muted hover:bg-slate-800/50 hover:text-sidebar-foreground border-l-2 border-transparent"
          )}
        >
          <Icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-amber-500")} />
          <span className="flex-1 text-left tracking-wide">{item.label}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              (isOpen || shouldAutoExpand) && "rotate-180"
            )}
          />
        </button>
        {(isOpen || shouldAutoExpand) && (
          <div className="mt-1 space-y-0.5 ml-4 pl-4 border-l border-slate-800">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm transition-all duration-200",
                  pathname === child.href
                    ? "bg-amber-500/10 text-amber-400 font-medium"
                    : "text-sidebar-muted hover:bg-slate-800/50 hover:text-sidebar-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    pathname === child.href ? "bg-amber-500" : "bg-slate-700"
                  )} />
                  {child.label}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-amber-500/10 text-amber-400 border-l-2 border-amber-500"
          : "text-sidebar-muted hover:bg-slate-800/50 hover:text-sidebar-foreground border-l-2 border-transparent"
      )}
    >
      <Icon className={cn("h-5 w-5 flex-shrink-0 transition-colors", isActive ? "text-amber-500" : "group-hover:text-amber-500/70")} />
      <span className="tracking-wide">{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const { user } = useUser();
  const userRole = user?.role ?? null;

  // Filter navigation items based on user role
  const visibleNavigation = useMemo(() => {
    return allNavigation.filter((item) => {
      // If no roles specified, show to everyone
      if (!item.roles) return true;
      // If user has no role, hide role-restricted items
      if (!userRole) return false;
      // Check if user's role is in the allowed roles
      return item.roles.includes(userRole);
    });
  }, [userRole]);

  const visibleAdminNavigation = useMemo(() => {
    return adminNavigation.filter((item) => {
      if (!item.roles) return true;
      if (!userRole) return false;
      return item.roles.includes(userRole);
    });
  }, [userRole]);

  return (
    <aside className="flex w-64 flex-col border-r border-slate-800 bg-slate-950">
      {/* Logo Header */}
      <div className="relative flex h-16 items-center gap-3 border-b border-slate-800 px-4 overflow-hidden">
        {/* Subtle scan line */}
        <div className="absolute inset-0 scan-overlay opacity-30" />

        <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-600 to-amber-700 shadow-lg shadow-amber-500/20 border border-amber-500/30">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-wider text-white">QM SYSTEM</h1>
            <Radio className="h-3 w-3 text-amber-500 animate-pulse" />
          </div>
          <code className="text-xs text-slate-500 font-mono">v0.3.0</code>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-hide">
        {/* Operations Section */}
        <div className="mb-2">
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
            Operations
          </p>
          {visibleNavigation.map((item) => (
            <NavItemComponent key={item.label} item={item} />
          ))}
        </div>

        {/* Admin section (only show divider if there are admin items) */}
        {visibleAdminNavigation.length > 0 && (
          <div className="pt-4 mt-4 border-t border-slate-800">
            <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
              Administration
            </p>
            {visibleAdminNavigation.map((item) => (
              <NavItemComponent key={item.label} item={item} />
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 p-4 bg-slate-950/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="status-dot status-dot-done scale-75" />
          <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">Online</span>
        </div>
        <p className="text-xs text-slate-600 font-mono">SINGLE SOURCE OF TRUTH</p>
        {user && (
          <p className="mt-1 text-xs text-amber-500/70 font-mono uppercase">
            OPERATOR: {user.role}
          </p>
        )}
      </div>
    </aside>
  );
}
