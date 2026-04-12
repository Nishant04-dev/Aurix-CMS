import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInvoices, useClients } from '@/hooks/use-database';
import { formatDate } from '@/lib/date';
import { useOrgCurrency } from '@/hooks/use-org-currency';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  Loader2, 
  CreditCard, 
  Receipt, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  MoreHorizontal, 
  Edit3, 
  CheckCircle, 
  PauseCircle, 
  XCircle, 
  RefreshCcw,
  Trash2,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InvoiceStatus } from '@/types';
import { InvoiceFormModal, InvoiceDetailsModal } from '@/components/FormModals';
import { Card, CardContent } from '@/components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusStyles: Record<InvoiceStatus, { bg: string; text: string; icon: any }> = {
  paid: { bg: 'bg-emerald-50 text-emerald-600 border-emerald-100', text: 'Paid', icon: CheckCircle2 },
  pending: { bg: 'bg-amber-50 text-amber-600 border-amber-100', text: 'Pending', icon: Clock },
  overdue: { bg: 'bg-rose-50 text-rose-600 border-rose-100', text: 'Overdue', icon: AlertCircle },
  on_hold: { bg: 'bg-orange-50 text-orange-600 border-orange-100', text: 'On Hold', icon: PauseCircle },
  cancelled: { bg: 'bg-slate-50 text-slate-600 border-slate-100', text: 'Cancelled', icon: XCircle },
};

export default function Invoices() {
  const { user } = useAuth();
  const { data: invoices, isLoading, refetch } = useInvoices();
  const { data: clients } = useClients();
  const { fmt } = useOrgCurrency();
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<{ id: string, status: InvoiceStatus, type?: 'status' | 'delete' } | null>(null);
  
  const isClient = user?.role === 'client';
  const canManage = ['admin', 'super_admin', 'manager'].includes(user?.role ?? '') || user?.isPlatformOwner;
  const canDelete = ['admin', 'super_admin'].includes(user?.role ?? '') || user?.isPlatformOwner;

  const updateStatus = async (id: string, status: InvoiceStatus) => {
    try {
      await api.patch(`/invoices/${id}`, { status });
      toast({ title: 'Status Updated', description: `Invoice is now ${statusStyles[status].text}.` });
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleSendEmail = async (id: string) => {
    try {
      await api.post(`/invoices/${id}/send`, {});
      toast({ title: 'Invoice sent', description: 'Email delivered to client.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Email failed', description: err.message });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/invoices/${id}`);
      toast({ title: 'Invoice deleted' });
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  const totalOutstanding = invoices?.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((s, i) => s + Number(i.amount), 0) || 0;
  const paidCount = invoices?.filter(i => i.status === 'paid').length || 0;
  const activeInvoices = invoices?.filter(i => i.status !== 'cancelled') || [];
  const cancelledInvoices = invoices?.filter(i => i.status === 'cancelled') || [];

  const InvoiceActions = ({ invoice }: { invoice: any }) => {
    if (!canManage) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 transition-colors">
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <InvoiceFormModal
            initialData={invoice}
            onSuccess={() => refetch()}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                <Edit3 className="h-4 w-4 mr-2" /> Edit Invoice
              </DropdownMenuItem>
            }
          />
          <DropdownMenuItem onClick={() => handleSendEmail(invoice.id)}>
            <Mail className="h-4 w-4 mr-2" /> Send to Client
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => updateStatus(invoice.id, 'paid')} disabled={invoice.status === 'paid'}>
            <CheckCircle className="h-4 w-4 mr-2" /> Mark as Paid
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateStatus(invoice.id, 'pending')} disabled={invoice.status === 'pending'}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Mark as Pending
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateStatus(invoice.id, 'on_hold')} disabled={invoice.status === 'on_hold' || invoice.status === 'paid'}>
            <PauseCircle className="h-4 w-4 mr-2" /> Put on Hold
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setConfirmAction({ id: invoice.id, status: 'cancelled', type: 'status' })}
            disabled={invoice.status === 'cancelled'}
          >
            <XCircle className="h-4 w-4 mr-2" /> Cancel Invoice
          </DropdownMenuItem>
          {canDelete && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setConfirmAction({ id: invoice.id, status: 'cancelled', type: 'delete' })}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete Invoice
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{isClient ? 'My Payments' : 'Invoices'}</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Manage financial records and billing status.</p>
        </div>
        {!isClient && <InvoiceFormModal onSuccess={() => refetch()} />}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border/50 shadow-sm bg-card overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Outstanding</p>
                <p className="text-2xl font-bold text-foreground font-mono">{fmt(totalOutstanding)}</p>
              </div>
            </div>
          </CardContent>
          <div className="h-1 w-full bg-primary/20">
             <div className="h-full bg-primary transition-all duration-1000" style={{ width: '60%' }} />
          </div>
        </Card>
        
        <Card className="border-border/50 shadow-sm bg-card overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Paid Status</p>
                <p className="text-2xl font-bold text-foreground font-mono">{paidCount} <span className="text-xs text-muted-foreground font-sans font-normal uppercase">Settled</span></p>
              </div>
            </div>
          </CardContent>
          <div className="h-1 w-full bg-emerald-100">
             <div className="h-full bg-emerald-600 transition-all duration-1000" style={{ width: '85%' }} />
          </div>
        </Card>
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Reference</th>
                {!isClient && <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Client</th>}
                <th className="text-right px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Amount</th>
                <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Status</th>
                <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Due Date</th>
                <th className="text-right px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {(!activeInvoices || activeInvoices.length === 0) && (
                <tr>
                  <td colSpan={isClient ? 5 : 6} className="px-6 py-12 text-center text-muted-foreground">
                    No invoices recorded yet.
                  </td>
                </tr>
              )}
              {activeInvoices.map((inv) => {
                // Use embedded client from API join, fall back to client list lookup
                const client = (inv as any).client || clients?.find(c => c.id === (inv as any).client_id || c.id === inv.clientId);
                const status = statusStyles[inv.status] || statusStyles.pending;
                const StatusIcon = status.icon;
                
                return (
                  <tr key={inv.id} className="group hover:bg-accent/30 transition-all duration-200">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground font-mono">#INV-{inv.id.substring(0, 4).toUpperCase()}</span>
                        <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                           {inv.items?.map((item: any) => item.description).join(', ') || 'No items listed'}
                        </span>
                      </div>
                    </td>
                    {!isClient && (
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-foreground">{client?.company || 'Internal Billing'}</span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <p className="font-bold text-foreground font-mono">{fmt(Number(inv.amount))}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border', status.bg)}>
                        <StatusIcon className="h-3 w-3" />
                        {status.text}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-0.5">
                         <span className="text-xs font-semibold text-muted-foreground">{inv.dueDate ? formatDate(inv.dueDate) : inv.due_date ? formatDate(inv.due_date) : 'No Due Date'}</span>
                         {inv.status === 'overdue' && <span className="text-[10px] text-rose-500 font-bold uppercase tracking-tight">Overdue</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <InvoiceDetailsModal 
                          invoice={inv} 
                          client={client}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary transition-colors">
                              <Download className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <InvoiceDetailsModal 
                          invoice={inv} 
                          client={client}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8 transition-colors">
                              <ArrowUpRight className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <InvoiceActions invoice={inv} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.type === 'delete' ? 'Delete Invoice?' : 'Cancel Invoice?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'delete'
                ? 'This will permanently delete the invoice and all its line items. This cannot be undone.'
                : 'This will mark the invoice as cancelled. This should only be used for errors or voided transactions.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmAction) {
                  if (confirmAction.type === 'delete') {
                    handleDelete(confirmAction.id);
                  } else {
                    updateStatus(confirmAction.id, confirmAction.status);
                  }
                  setConfirmAction(null);
                }
              }}
            >
              {confirmAction?.type === 'delete' ? 'Delete Permanently' : 'Confirm Cancellation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancelled Invoices Section */}
      {cancelledInvoices.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pt-2">
            <XCircle className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-600">Cancelled Invoices</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
              {cancelledInvoices.length}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/50">
                    <th className="text-left px-6 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Reference</th>
                    {!isClient && <th className="text-left px-6 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Client</th>}
                    <th className="text-right px-6 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Amount</th>
                    <th className="text-left px-6 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50">
                  {cancelledInvoices.map((inv) => {
                    const client = (inv as any).client || clients?.find(c => c.id === (inv as any).client_id || c.id === inv.clientId);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-100/50 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-500 font-mono line-through">#INV-{inv.id.substring(0, 4).toUpperCase()}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500 uppercase tracking-widest">Cancelled</span>
                          </div>
                        </td>
                        {!isClient && (
                          <td className="px-6 py-3 text-slate-500">{client?.company || 'Internal Billing'}</td>
                        )}
                        <td className="px-6 py-3 text-right font-mono text-slate-500 line-through">{fmt(Number(inv.amount))}</td>
                        <td className="px-6 py-3 text-slate-400 text-xs">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
