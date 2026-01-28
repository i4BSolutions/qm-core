'use client';

/**
 * DashboardClient Component
 *
 * Client component that renders the full management dashboard layout
 * with personalized greeting, KPI cards, alerts, and timelines.
 * Auto-refreshes data every 60 seconds using the useInterval hook.
 */

import { useState } from 'react';
import { getDashboardData, DashboardData } from '@/lib/actions/dashboard';
import { useInterval } from '@/lib/hooks/use-interval';
import { format, formatDistanceToNow } from 'date-fns';
import { FileText, ClipboardList } from 'lucide-react';
import { KPICard } from './kpi-card';
import { AlertList } from './alert-list';
import { ActivityTimeline } from './activity-timeline';
import { StockTimeline } from './stock-timeline';

interface DashboardClientProps {
  initialData: DashboardData;
  userName: string;
}

export function DashboardClient({ initialData, userName }: DashboardClientProps) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh every 60 seconds
  useInterval(async () => {
    try {
      setIsRefreshing(true);
      const freshData = await getDashboardData();
      setData(freshData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to refresh dashboard data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, 60000);

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          {greeting}, {userName}
        </h1>
        <p className="text-slate-400 mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Last updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
          {isRefreshing && <span className="ml-2 text-blue-400">Refreshing...</span>}
        </p>
      </div>

      {/* KPI cards row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <KPICard
          title="QMRL Requests"
          stats={data.qmrlStats}
          href="/qmrl"
          icon={FileText}
        />
        <KPICard
          title="QMHQ Orders"
          stats={data.qmhqStats}
          href="/qmhq"
          icon={ClipboardList}
        />
      </div>

      {/* Two-column section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left column: Alerts */}
        <AlertList alerts={data.lowStockAlerts} />

        {/* Right column: Timelines */}
        <div className="space-y-6">
          <ActivityTimeline entries={data.recentAudits} />
          <StockTimeline movements={data.recentStockMovements} />
        </div>
      </div>
    </div>
  );
}
