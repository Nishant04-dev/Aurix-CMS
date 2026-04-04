import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { clients, projects, invoices, tasks, notifications } from '@/data/mock';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, FolderKanban, CreditCard, CheckSquare, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

function StatCard({ title, value, icon: Icon, accent }: { title: string; value: string | number; icon: React.ElementType; accent?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', accent || 'bg-primary/10 text-primary')}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminDashboard() {
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'overdue');
  const activeProjects = projects.filter(p => p.status === 'in_progress');
  const recentNotifications = notifications.filter(n => n.userId === 'u1').slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} accent="bg-success/10 text-success" />
        <StatCard title="Active Clients" value={clients.length} icon={Users} />
        <StatCard title="Active Projects" value={activeProjects.length} icon={FolderKanban} />
        <StatCard title="Pending Invoices" value={pendingInvoices.length} icon={CreditCard} accent="bg-warning/10 text-warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Projects */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground">Active Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeProjects.map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{clients.find(c => c.id === p.clientId)?.company}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${p.progress}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{p.progress}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentNotifications.map(n => (
              <div key={n.id} className="flex items-start gap-3">
                <div className={cn('mt-0.5 h-2 w-2 rounded-full shrink-0', n.read ? 'bg-muted-foreground/30' : 'bg-primary')} />
                <div>
                  <p className="text-sm text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ClientDashboard({ userId }: { userId: string }) {
  const client = clients.find(c => c.userId === userId);
  const myProjects = client ? projects.filter(p => p.clientId === client.id) : [];
  const myInvoices = client ? invoices.filter(i => i.clientId === client.id) : [];
  const pendingInvoices = myInvoices.filter(i => i.status !== 'paid');

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Welcome back{client ? `, ${client.name}` : ''}</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="My Projects" value={myProjects.length} icon={FolderKanban} />
        <StatCard title="Pending Invoices" value={pendingInvoices.length} icon={CreditCard} accent="bg-warning/10 text-warning" />
        <StatCard title="Tasks" value={tasks.filter(t => myProjects.some(p => p.id === t.projectId)).length} icon={CheckSquare} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-foreground">Project Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {myProjects.map(p => (
            <div key={p.id}>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-foreground">{p.title}</span>
                <span className="text-xs text-muted-foreground">{p.progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${p.progress}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'client' ? <ClientDashboard userId={user.id} /> : <AdminDashboard />;
}
