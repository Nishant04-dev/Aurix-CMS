import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/use-permissions";
import { canAccess, normalizeRole } from "@/lib/accessControl";
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
import Quotations from "@/pages/Quotations";
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
  const n = normalizeRole(user?.role);
  if (n !== 'super_admin' && n !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

// When role is 'unknown' the backend was unreachable — show a retry prompt
// instead of redirecting to dashboard (which causes the nav loop)
function UnknownRoleGate({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();
  const [retrying, setRetrying] = React.useState(false);

  if (user?.role === 'unknown') {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-muted-foreground">
        <p className="text-sm">Could not load your account role. Backend may be unreachable.</p>
        <button
          className="text-xs text-primary underline underline-offset-2"
          disabled={retrying}
          onClick={async () => { setRetrying(true); await refreshUser(); setRetrying(false); }}
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    );
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { user, orgId, orgStatus, isPlatformOwner, accountType, loading } = useAuth();
  const { can, isClient: isClientRole } = usePermissions();
  const role = user?.role ?? 'client';
  const normalized = normalizeRole(role);
  const isOwner = normalized === 'super_admin' || isPlatformOwner;

  // Show spinner while auth is initializing
  if (loading) {
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
  if (!isPlatformOwner && normalized !== 'super_admin' && accountType === 'business' && !orgId) return <Onboarding />;

  // Business users with an org that isn't approved yet → waiting page
  if (accountType === 'business' && orgId && !isPlatformOwner && normalized !== 'super_admin' && orgStatus !== 'approved') return <WaitingApproval />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />

        {/* Permission-gated routes — use canAccess for structural role checks */}
        <Route path="/clients"  element={<UnknownRoleGate>{canAccess(role,'clients')   ? <Clients />  : <Navigate to="/" replace />}</UnknownRoleGate>} />
        <Route path="/team"     element={<UnknownRoleGate>{canAccess(role,'team')      ? <Team />     : <Navigate to="/" replace />}</UnknownRoleGate>} />
        <Route path="/roles"    element={<UnknownRoleGate>{canAccess(role,'roles')     ? <Roles />    : <Navigate to="/" replace />}</UnknownRoleGate>} />
        <Route path="/projects" element={<UnknownRoleGate>{canAccess(role,'projects')  ? <Projects /> : <Navigate to="/" replace />}</UnknownRoleGate>} />
        <Route path="/tasks"    element={<UnknownRoleGate>{canAccess(role,'tasks')     ? <Tasks />    : <Navigate to="/" replace />}</UnknownRoleGate>} />
        <Route path="/invoices" element={<UnknownRoleGate>{canAccess(role,'invoices')  ? <Invoices /> : <Navigate to="/" replace />}</UnknownRoleGate>} />
        <Route path="/messages" element={<UnknownRoleGate>{<Messages />}</UnknownRoleGate>} />
        <Route path="/files"    element={<UnknownRoleGate>{canAccess(role,'files')     ? <Files />    : <Navigate to="/" replace />}</UnknownRoleGate>} />
        <Route path="/quotations" element={<UnknownRoleGate>{canAccess(role,'quotations') ? <Quotations /> : <Navigate to="/" replace />}</UnknownRoleGate>} />

        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={canAccess(role,'settings') ? <Settings /> : <Navigate to="/" replace />} />
        <Route path="/invitations" element={<Invitations />} />
        <Route path="/support" element={<Support />} />
        <Route path="/org/audit-logs" element={<RequireAdmin><AuditLogs /></RequireAdmin>} />
        <Route path="/org/chat" element={<Chat />} />
        <Route path="/settings/billing" element={(isOwner || isPlatformOwner) ? <Billing /> : <Navigate to="/" replace />} />

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
