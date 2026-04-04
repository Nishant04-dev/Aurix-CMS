import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { invoices, clients, projects } from '@/data/mock';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InvoiceStatus } from '@/types';
import { InvoiceFormModal } from '@/components/FormModals';

const statusStyles: Record<InvoiceStatus, string> = {
  paid: 'bg-success/10 text-success',
  pending: 'bg-warning/10 text-warning',
  overdue: 'bg-destructive/10 text-destructive',
};

export default function Invoices() {
  const { user } = useAuth();
  const isClient = user?.role === 'client';
  const clientRecord = isClient ? clients.find(c => c.userId === user?.id) : null;
  const filtered = isClient ? invoices.filter(i => i.clientId === clientRecord?.id) : invoices;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Invoices</h1>
        {!isClient && <InvoiceFormModal />}
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Client</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Due Date</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv, idx) => {
              const client = clients.find(c => c.id === inv.clientId);
              return (
                <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">INV-{String(idx + 1).padStart(3, '0')}</p>
                    <p className="text-xs text-muted-foreground">{inv.items.map(i => i.description).join(', ')}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{client?.company}</td>
                  <td className="px-4 py-3 font-medium text-foreground">${inv.amount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize', statusStyles[inv.status])}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
