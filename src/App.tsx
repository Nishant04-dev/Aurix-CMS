import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/use-permissions";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import Projects from "@/pages/Projects";
import Tasks from "@/pages/Tasks";
import Messages from "@/pages/Messages";
import Invoices from "@/pages/Invoices";
import Files from "@/pages/Files";
import Team from "@/pages/Team";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Roles from "@/pages/Roles";
import Profile from "@/pages/Profile";
import AuditLogs from "@/pages/AuditLogs";
import Chat from "@/pages/Chat";
import Billing from "@/pages/Billing";
import Settings from "@/pages/Settings";
import Invitations from "@/pages/Invitations";
import Onboarding from "@/pages/Onboarding";
import Platform from "@/pages/Platform";
import WaitingApproval from "@/pages/WaitingApproval";
import Support from "@/pages/Support";
import PlatformLayout from "@/components/PlatformLayout";
import PlatformOverview from "@/pages/platform/Overview";
import PlatformOrganizations from "@/pages/platform/Organizations";
import PlatformUsers from "@/pages/platform/Users";
import PlatformSubscriptions from "@/pages/platform/Subscriptions";
import PlatformRevenue from "@/pages/platform/Revenue";
import PlatformFeatures from "@/pages/platform/Features";
import PlatformTeam from "@/pages/platform/Team";
import PlatformSupport from "@/pages/platform/Support";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!['admin', 'super_admin'].includes(user?.role ?? '')) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, orgId, orgStatus, isPlatformOwner, accountType, loading } = useAuth();
  const { can, isAdmin, isClient: isClientRole } = usePermissions();

  // Show spinner while auth is initializing OR while real profile is still loading
  if (loading || (user && (user as any).role === 'loading')) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest animate-pulse">Initializing Portal</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  // Only business users without an org need onboarding
  if (!isPlatformOwner && accountType === 'business' && !orgId) return <Onboarding />;

  // Business users with an org that isn't approved yet → waiting page
  // Never block super_admin or platform owner
  if (accountType === 'business' && orgId && !isPlatformOwner && user.role !== 'super_admin' && orgStatus !== 'approved') return <WaitingApproval />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />

        {/* Permission-gated routes */}
        <Route path="/clients"  element={can('view_client')   ? <Clients />  : <Navigate to="/" replace />} />
        <Route path="/team"     element={can('invite_user')   ? <Team />     : <Navigate to="/" replace />} />
        <Route path="/roles"    element={can('manage_roles')  ? <Roles />    : <Navigate to="/" replace />} />
        <Route path="/projects" element={isClientRole || can('view_project')  ? <Projects /> : <Navigate to="/" replace />} />
        <Route path="/tasks"    element={isClientRole || can('view_project')  ? <Tasks />    : <Navigate to="/" replace />} />
        <Route path="/invoices" element={isClientRole || can('view_invoices') ? <Invoices /> : <Navigate to="/" replace />} />
        <Route path="/messages" element={isClientRole || can('view_project')  ? <Messages /> : <Navigate to="/" replace />} />
        <Route path="/files"    element={isClientRole || can('view_file')     ? <Files />    : <Navigate to="/" replace />} />

        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={isClientRole ? <Navigate to="/" replace /> : <Settings />} />
        <Route path="/invitations" element={<Invitations />} />
        <Route path="/support" element={<Support />} />
        <Route path="/org/audit-logs" element={<RequireAdmin><AuditLogs /></RequireAdmin>} />
        <Route path="/org/chat" element={<Chat />} />
        <Route path="/settings/billing" element={(isAdmin || isPlatformOwner) ? <Billing /> : <Navigate to="/" replace />} />

        {/* Platform routes — wrapped in PlatformLayout */}
        <Route path="/platform" element={isPlatformOwner ? <Navigate to="/platform/overview" replace /> : <Navigate to="/" replace />} />
        <Route path="/platform/*" element={
          isPlatformOwner ? (
            <PlatformLayout>
              <Routes>
                <Route path="overview"       element={<PlatformOverview />} />
                <Route path="organizations"  element={<PlatformOrganizations />} />
                <Route path="users"          element={<PlatformUsers />} />
                <Route path="subscriptions"  element={<PlatformSubscriptions />} />
                <Route path="revenue"        element={<PlatformRevenue />} />
                <Route path="features"       element={<PlatformFeatures />} />
                <Route path="team"           element={<PlatformTeam />} />
                <Route path="support"        element={<PlatformSupport />} />
              </Routes>
            </PlatformLayout>
          ) : <Navigate to="/" replace />
        } />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
