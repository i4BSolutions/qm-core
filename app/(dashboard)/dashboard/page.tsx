import { FileText, ClipboardList, ShoppingCart, Package, TrendingUp, Clock, Radio, Target, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// Placeholder stats - will be replaced with real data
const stats = [
  {
    label: "Open Requests",
    value: "12",
    change: "+2 from last week",
    changeType: "increase" as const,
    icon: FileText,
    colorClass: "from-blue-600 to-blue-700 border-blue-500/30",
    iconBg: "bg-blue-500/20 text-blue-400",
  },
  {
    label: "Active QMHQ",
    value: "8",
    change: "3 pending approval",
    changeType: "neutral" as const,
    icon: ClipboardList,
    colorClass: "from-violet-600 to-violet-700 border-violet-500/30",
    iconBg: "bg-violet-500/20 text-violet-400",
  },
  {
    label: "Open POs",
    value: "5",
    change: "2 awaiting delivery",
    changeType: "neutral" as const,
    icon: ShoppingCart,
    colorClass: "from-amber-600 to-amber-700 border-amber-500/30",
    iconBg: "bg-amber-500/20 text-amber-400",
  },
  {
    label: "Low Stock Items",
    value: "3",
    change: "Requires attention",
    changeType: "decrease" as const,
    icon: Package,
    colorClass: "from-red-600 to-red-700 border-red-500/30",
    iconBg: "bg-red-500/20 text-red-400",
  },
];

const recentActivity = [
  {
    id: 1,
    type: "qmrl",
    action: "created",
    title: "Request for field equipment - Unit A",
    user: "John Doe",
    time: "2 hours ago",
  },
  {
    id: 2,
    type: "qmhq",
    action: "status_change",
    title: "Laptop procurement",
    user: "Jane Smith",
    time: "4 hours ago",
    details: "Draft → Processing",
  },
  {
    id: 3,
    type: "po",
    action: "created",
    title: "PO-2025-00001",
    user: "Admin",
    time: "1 day ago",
  },
  {
    id: 4,
    type: "invoice",
    action: "received",
    title: "INV-2025-00001",
    user: "Finance Team",
    time: "2 days ago",
  },
];

const typeConfig: Record<string, { bg: string; text: string; label: string }> = {
  qmrl: { bg: "bg-blue-500/20", text: "text-blue-400", label: "RL" },
  qmhq: { bg: "bg-violet-500/20", text: "text-violet-400", label: "HQ" },
  po: { bg: "bg-amber-500/20", text: "text-amber-400", label: "PO" },
  invoice: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "IN" },
};

function StatCard({
  stat,
  index,
}: {
  stat: (typeof stats)[0];
  index: number;
}) {
  const Icon = stat.icon;
  return (
    <div
      className="tactical-card corner-accents p-5 animate-slide-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="scan-overlay" />

      <div className="relative flex items-start justify-between">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-lg", stat.iconBg)}>
          <Icon className="h-6 w-6" />
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wider",
            stat.changeType === "increase" && "text-emerald-400",
            stat.changeType === "decrease" && "text-red-400",
            stat.changeType === "neutral" && "text-slate-500"
          )}
        >
          {stat.changeType === "increase" && <TrendingUp className="h-3 w-3" />}
          {stat.changeType === "decrease" && <AlertCircle className="h-3 w-3" />}
          {stat.change}
        </span>
      </div>
      <div className="relative mt-4">
        <p className="text-3xl font-bold text-white font-mono">{stat.value}</p>
        <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-amber-500/10 border border-amber-500/20">
            <Radio className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-500">
              Command Center
            </span>
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Operations Dashboard
        </h1>
        <p className="mt-1 text-slate-400 font-mono text-sm">
          {/* REAL-TIME SYSTEM OVERVIEW */}
          REAL-TIME SYSTEM OVERVIEW
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard key={stat.label} stat={stat} index={index} />
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div
          className="command-panel corner-accents lg:col-span-2 animate-slide-up"
          style={{ animationDelay: "400ms" }}
        >
          <div className="section-header mb-0 pb-4">
            <Clock className="h-4 w-4 text-amber-500" />
            <h2>Recent Activity</h2>
          </div>

          <div className="divide-y divide-slate-800">
            {recentActivity.map((activity, index) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 py-4 transition-colors duration-200 hover:bg-slate-800/30 -mx-6 px-6"
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold border",
                    typeConfig[activity.type]?.bg,
                    typeConfig[activity.type]?.text,
                    `border-${activity.type === 'qmrl' ? 'blue' : activity.type === 'qmhq' ? 'violet' : activity.type === 'po' ? 'amber' : 'emerald'}-500/30`
                  )}
                >
                  {typeConfig[activity.type]?.label}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200">
                    {activity.title}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {activity.action === "created" && "Created by "}
                    {activity.action === "status_change" && "Status changed by "}
                    {activity.action === "received" && "Received by "}
                    <span className="text-slate-400">{activity.user}</span>
                    {activity.details && (
                      <span className="ml-2 text-amber-400 font-mono text-xs">
                        ({activity.details})
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-600 font-mono">
                  <Clock className="h-3 w-3" />
                  {activity.time}
                </div>
              </div>
            ))}
          </div>

          <div className="divider-accent mt-4" />
          <button className="mt-4 text-sm font-medium text-amber-400 hover:text-amber-300 font-mono uppercase tracking-wider">
            View all activity →
          </button>
        </div>

        {/* Quick Actions */}
        <div
          className="command-panel corner-accents animate-slide-up"
          style={{ animationDelay: "500ms" }}
        >
          <div className="section-header mb-0 pb-4">
            <Target className="h-4 w-4 text-amber-500" />
            <h2>Quick Actions</h2>
          </div>

          <div className="space-y-3">
            <Link href="/qmrl/new">
              <button
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-4 py-3.5",
                  "bg-gradient-to-r from-amber-600 to-amber-500 text-white",
                  "transition-all duration-200 font-medium",
                  "hover:from-amber-500 hover:to-amber-400 hover:shadow-lg hover:shadow-amber-500/20"
                )}
              >
                <FileText className="h-5 w-5" />
                <span>New Request (QMRL)</span>
              </button>
            </Link>
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border border-slate-700 px-4 py-3.5",
                "text-slate-300 transition-all duration-200",
                "hover:bg-slate-800 hover:border-amber-500/30 hover:text-amber-400"
              )}
            >
              <ClipboardList className="h-5 w-5" />
              <span>Create QMHQ</span>
            </button>
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border border-slate-700 px-4 py-3.5",
                "text-slate-300 transition-all duration-200",
                "hover:bg-slate-800 hover:border-amber-500/30 hover:text-amber-400"
              )}
            >
              <ShoppingCart className="h-5 w-5" />
              <span>New Purchase Order</span>
            </button>
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border border-slate-700 px-4 py-3.5",
                "text-slate-300 transition-all duration-200",
                "hover:bg-slate-800 hover:border-amber-500/30 hover:text-amber-400"
              )}
            >
              <Package className="h-5 w-5" />
              <span>Stock In</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
