/**
 * Dashboard Page
 *
 * Server component that provides permission-based access control for the management dashboard.
 * Users with system_dashboard access see the live dashboard.
 * Users with Block permission on system_dashboard are redirected to /qmrl.
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

  // Check permission for system_dashboard resource
  const { data: perm } = await supabase
    .from('user_permissions')
    .select('level')
    .eq('user_id', user.id)
    .eq('resource', 'system_dashboard')
    .single();

  if (!perm || perm.level === 'block') {
    redirect('/qmrl');
  }

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
