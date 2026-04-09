import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgCurrency } from '@/hooks/use-org-currency';
import { usePlan } from '@/hooks/use-plan';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, MoreHorizontal, ArrowRight, Trash2, Send, Lock, Eye, Mail, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { DocumentRenderer, type DocumentData } from '@/components/DocumentRenderer';

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-600 border-slate-200',
  sent:      'bg-blue-50 text-blue-600 border-blue-200',
  accepted:  'bg-emerald-50 text-emerald-600 border-emerald-200',
  rejected:  'bg-rose-50 text-rose-600 border-rose-200',
  converted: 'bg-violet-50 text-violet-600 border-violet-200',
};

interface Template { id: string; name: string; slug: string; plan_required: string; preview_color: string; locked: boolean; }
interface Client   { id: string; name: string; company: string; }
interface QuotationItem { description: string; quantity: number; unit_price: number; }

export default function Quotations() {
  const { user } = useAuth();
  const { fmt } = useOrgCurrency();
  const { can: planCan } = usePlan();
  const { toast } = useToast();
  const qc = useQueryClient();

  const canManage = ['admin', 'super_admin', 'manager'].includes(user?.role ?? '');

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => api.get<any[]>('/quotations'),
  });

  // Free plan: count this month's quotations
  const { plan } = usePlan();
  const thisMonthCount = (quotations as any[]).filter(q => {
    const d = new Date(q.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const freeLimitReached = plan === 'free' && thisMonthCount >= 2;

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<Template[]>('/templates'),
    enabled: canManage,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-quotation'],
    queryFn: () => api.get<Client[]>('/clients'),
    enabled: canManage,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-quotation'],
    queryFn: () => api.get<any[]>('/projects'),
    enabled: canManage,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmConvert, setConfirmConvert] = useState<string | null>(null);
  const [previewQuotation, setPreviewQuotation] = useState<any | null>(null);

  // Form state
  const [form, setForm] = useState({ client_id: '', template_id: '', project_id: 'none', title: 'Quotation', due_date: '', notes: '' });
  const [items, setItems] = useState<QuotationItem[]>([{ description: '', quantity: 1, unit_price: 0 }]);

  const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/quotations', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast({ title: 'Quotation created' });
      setShowCreate(false);
      setForm({ client_id: '', template_id: '', project_id: 'none', title: 'Quotation', due_date: '', notes: '' });
      setItems([{ description: '', quantity: 1, unit_price: 0 }]);
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/quotations/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
    onError: (err: any) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => api.post<any>(`/quotations/${id}/convert`, {}),
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast({
        title: 'Converted to invoice',
        description: (
          <span>
            Invoice created.{' '}
            <a href="/invoices" className="underline font-semibold">View Invoices →</a>
          </span>
        ) as any,
      });
      setConfirmConvert(null);
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quotations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotations'] }); setConfirmDelete(null); },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const handleCreate = () => {
    if (!form.client_id) return toast({ variant: 'destructive', title: 'Select a client' });
    if (items.some(i => !i.description)) return toast({ variant: 'destructive', title: 'All items need a description' });
    createMutation.mutate({ ...form, template_id: form.template_id || null, project_id: form.project_id === 'none' ? null : (form.project_id || null), items });
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotations</h1>
          <p className="text-muted-foreground mt-1 text-sm">Create and manage client quotations.</p>
          {plan === 'free' && (
            <p className={cn('mt-1 text-xs font-semibold', freeLimitReached ? 'text-destructive' : 'text-muted-foreground')}>
              {thisMonthCount} / 2 quotations used this month
              {freeLimitReached && ' — Upgrade to Pro for unlimited'}
            </p>
          )}
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowCreate(true)} disabled={freeLimitReached}>
            <Plus className="h-4 w-4 mr-1.5" /> New Quotation
          </Button>
        )}
      </div>

      {/* Quotation list */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              {['Title','Client','Amount','Status','Due Date','Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {quotations.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No quotations yet.</td></tr>
            )}
            {quotations.map((q: any) => (
              <tr key={q.id} className="hover:bg-accent/20 transition-colors">
                <td className="px-4 py-3 font-medium">{q.title}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{q.client_id}</td>
                <td className="px-4 py-3 font-mono font-bold">{fmt(Number(q.amount))}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase', STATUS_STYLES[q.status] || STATUS_STYLES.draft)}>
                    {q.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {q.due_date ? new Date(q.due_date).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setPreviewQuotation(q)}>
                          <Eye className="h-3.5 w-3.5 mr-2" /> Preview / PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => {
                          try {
                            await api.post(`/quotations/${q.id}/send`, {});
                            toast({ title: 'Email sent', description: 'Quotation delivered to client.' });
                            qc.invalidateQueries({ queryKey: ['quotations'] });
                          } catch (err: any) {
                            toast({ variant: 'destructive', title: 'Email failed', description: err.message });
                          }
                        }}>
                          <Mail className="h-3.5 w-3.5 mr-2" /> Send to Client
                        </DropdownMenuItem>
                        {q.status === 'draft' && (
                          <DropdownMenuItem onClick={() => updateMutation.mutate({ id: q.id, status: 'sent' })}>
                            <Send className="h-3.5 w-3.5 mr-2" /> Mark as Sent
                          </DropdownMenuItem>
                        )}
                        {['sent','accepted'].includes(q.status) && (
                          <DropdownMenuItem onClick={() => setConfirmConvert(q.id)}>
                            <ArrowRight className="h-3.5 w-3.5 mr-2" /> Convert to Invoice
                          </DropdownMenuItem>
                        )}
                        {q.status === 'converted' && q.invoice_id && (
                          <DropdownMenuItem asChild>
                            <a href="/invoices"><ExternalLink className="h-3.5 w-3.5 mr-2" /> View Invoice</a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(q.id)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Quotation</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c: Client) => <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Link to Project <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {(projects as any[]).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Template</Label>
              <div className="grid grid-cols-4 gap-2">
                {templates.map((t: Template) => (
                  <button
                    key={t.id}
                    onClick={() => !t.locked && setForm(f => ({ ...f, template_id: f.template_id === t.id ? '' : t.id }))}
                    className={cn(
                      'relative rounded-lg border-2 p-3 text-left transition-all',
                      form.template_id === t.id ? 'border-primary' : 'border-border/50 hover:border-border',
                      t.locked && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="h-8 rounded mb-2" style={{ background: t.preview_color }} />
                    <p className="text-xs font-semibold truncate">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{t.plan_required}</p>
                    {t.locked && <Lock className="absolute top-2 right-2 h-3 w-3 text-muted-foreground" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <Label>Items</Label>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-6" placeholder="Description" value={item.description}
                    onChange={e => setItems(prev => prev.map((i, n) => n === idx ? { ...i, description: e.target.value } : i))} />
                  <Input className="col-span-2" type="number" placeholder="Qty" value={item.quantity}
                    onChange={e => setItems(prev => prev.map((i, n) => n === idx ? { ...i, quantity: Number(e.target.value) } : i))} />
                  <Input className="col-span-3" type="number" placeholder="Unit price" value={item.unit_price}
                    onChange={e => setItems(prev => prev.map((i, n) => n === idx ? { ...i, unit_price: Number(e.target.value) } : i))} />
                  <Button variant="ghost" size="icon" className="col-span-1 h-8 w-8 text-destructive"
                    onClick={() => items.length > 1 && setItems(prev => prev.filter((_, n) => n !== idx))}>
                    ×
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0 }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
              </Button>
              <div className="text-right text-sm font-bold">Total: {fmt(total)}</div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Quotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert confirmation */}
      <AlertDialog open={!!confirmConvert} onOpenChange={() => setConfirmConvert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to Invoice?</AlertDialogTitle>
            <AlertDialogDescription>This will create an invoice from this quotation and mark it as converted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmConvert && convertMutation.mutate(confirmConvert)}>
              Convert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quotation?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground"
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview / PDF dialog */}
      <Dialog open={!!previewQuotation} onOpenChange={() => setPreviewQuotation(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Quotation Preview</DialogTitle></DialogHeader>
          {previewQuotation && (
            <DocumentRenderer
              templateSlug={templates.find((t: Template) => t.id === previewQuotation.template_id)?.slug || 'basic'}
              data={{
                type: 'quotation',
                id: previewQuotation.id,
                title: previewQuotation.title,
                status: previewQuotation.status,
                amount: Number(previewQuotation.amount),
                currency: previewQuotation.currency || 'INR',
                due_date: previewQuotation.due_date,
                notes: previewQuotation.notes,
                items: previewQuotation.quotation_items ?? [],
                created_at: previewQuotation.created_at,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
