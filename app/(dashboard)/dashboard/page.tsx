/**
 * Dashboard Page
 *
 * Server component that provides role-based access control for the management dashboard.
 * Admin users see the live dashboard.
 * Other roles are redirected to their primary workflow page.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDashboardData } from '@/lib/actions/dashboard';
import { DashboardClient } from './components/dashboard-client';

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // TODO Phase 62: replace role-based redirect with permission check (has_permission('admin', 'edit'))
  // users.role column dropped in Phase 60 — role-based redirect disabled until Phase 62
  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single();

  // Fetch dashboard data for management users
  const dashboardData = await getDashboardData();

  return (
    <DashboardClient
      initialData={dashboardData}
      userName={profile?.full_name || 'User'}
    />
  );
}
