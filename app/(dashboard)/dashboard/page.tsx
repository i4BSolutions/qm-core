/**
 * Dashboard Page
 *
 * Server component that provides role-based access control for the management dashboard.
 * Admin and Quartermaster users see the live dashboard.
 * Other roles are redirected to their primary workflow page.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDashboardData } from '@/lib/actions/dashboard';
import { DashboardClient } from './components/dashboard-client';

// Map non-management roles to their primary page
const roleRedirectMap: Record<string, string> = {
  finance: '/po',
  inventory: '/inventory',
  proposal: '/qmhq',
  frontline: '/qmrl',
  requester: '/qmrl',
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch user profile with role
  const { data: profile } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  // Redirect non-management roles to their primary page
  if (profile?.role && profile.role !== 'admin' && profile.role !== 'quartermaster') {
    const redirectTo = roleRedirectMap[profile.role] || '/qmrl';
    redirect(redirectTo);
  }

  // Fetch dashboard data for management users
  const dashboardData = await getDashboardData();

  return (
    <DashboardClient
      initialData={dashboardData}
      userName={profile?.full_name || 'User'}
    />
  );
}
