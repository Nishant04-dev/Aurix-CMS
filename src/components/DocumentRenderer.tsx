/**
 * DocumentRenderer — single source of truth for invoice + quotation rendering.
 * Used for live preview and PDF export (html2canvas + jsPDF).
 */
import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DocumentData {
  type: 'invoice' | 'quotation';
  id: string;
  title?: string;
  status: string;
  amount: number;
  currency: string;
  due_date?: string | null;
  notes?: string | null;
  items?: { description: string; quantity?: number; unit_price?: number; amount?: number }[];
  org?: { name?: string; logo_url?: string; address?: string; phone?: string; email?: string };
  client?: { name?: string; company?: string; email?: string; phone?: string };
  project?: { id?: string; title?: string } | null;
  created_at?: string;
}

interface TemplateConfig {
  bg: string; headerBg: string; headerText: string; accent: string;
  tableHeaderBg: string; tableHeaderText: string; borderColor: string; font: string;
}

const TEMPLATES: Record<string, TemplateConfig> = {
  basic:     { bg: '#ffffff', headerBg: '#f8fafc', headerText: '#0f172a', accent: '#64748b',  tableHeaderBg: '#f1f5f9', tableHeaderText: '#475569', borderColor: '#e2e8f0', font: 'sans-serif' },
  modern:    { bg: '#ffffff', headerBg: '#6366f1', headerText: '#ffffff', accent: '#6366f1',  tableHeaderBg: '#eef2ff', tableHeaderText: '#4338ca', borderColor: '#e0e7ff', font: 'sans-serif' },
  minimal:   { bg: '#ffffff', headerBg: '#ffffff', headerText: '#0ea5e9', accent: '#0ea5e9',  tableHeaderBg: '#e0f2fe', tableHeaderText: '#0369a1', borderColor: '#bae6fd', font: 'sans-serif' },
  dark:      { bg: '#1e293b', headerBg: '#0f172a', headerText: '#f8fafc', accent: '#38bdf8',  tableHeaderBg: '#0f172a', tableHeaderText: '#94a3b8', borderColor: '#334155', font: 'sans-serif' },
  corporate: { bg: '#ffffff', headerBg: '#0f172a', headerText: '#ffffff', accent: '#0f172a',  tableHeaderBg: '#f8fafc', tableHeaderText: '#0f172a', borderColor: '#cbd5e1', font: 'Georgia, serif' },
  premium:   { bg: '#fffbeb', headerBg: '#92400e', headerText: '#fef3c7', accent: '#d97706',  tableHeaderBg: '#fef3c7', tableHeaderText: '#92400e', borderColor: '#fde68a', font: 'sans-serif' },
  creative:  { bg: '#fdf4ff', headerBg: '#ec4899', headerText: '#ffffff', accent: '#ec4899',  tableHeaderBg: '#fce7f3', tableHeaderText: '#9d174d', borderColor: '#fbcfe8', font: 'sans-serif' },
};

function fmt(amount: number, currency: string) {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${Number(amount).toFixed(2)}`; }
}

function safeDate(val?: string | null): string {
  if (!val) return '—';
  try { const d = new Date(val); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(); }
  catch { return '—'; }
}

interface Props {
  data: DocumentData;
  templateSlug?: string;
  showDownload?: boolean;
  compact?: boolean;
}

export function DocumentRenderer({ data, templateSlug = 'basic', showDownload = true, compact = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = React.useState(false);
  const cfg = TEMPLATES[templateSlug] ?? TEMPLATES.basic;

  // Resolve org + client from all possible field paths
  const orgData = data.org ?? (data as any).organization ?? null;
  const clientData = data.client ?? (data as any).customer ?? null;

  const orgName    = orgData?.name ?? orgData?.organization_name ?? orgData?.company ?? null;
  const orgLogo    = orgData?.logo_url ?? null;
  const orgAddress = orgData?.address ?? null;
  const orgPhone   = orgData?.phone ?? null;
  const orgEmail   = orgData?.email ?? null;

  const clientCompany = clientData?.company ?? null;
  const clientName    = clientData?.name ?? null;
  const clientEmail   = clientData?.email ?? null;

  // Debug — remove once confirmed working in production
  console.log('DocumentRenderer — org:', orgData, '| client:', clientData);

  const items = data.items ?? [];
  const subtotal = items.reduce((s, i) => s + (i.amount ?? (i.quantity ?? 1) * (i.unit_price ?? 0)), 0);

  const handleDownload = async () => {
    if (!ref.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, backgroundColor: cfg.bg });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth  = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth   = pageWidth;
      const imgHeight  = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position   = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      const prefix = data.type === 'invoice' ? 'INV' : 'QUO';
      pdf.save(`${prefix}-${data.id.slice(0, 6).toUpperCase()}.pdf`);
    } finally { setDownloading(false); }
  };

  return (
    <div className="space-y-3">
      {showDownload && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
            {downloading
              ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              : <Download className="h-4 w-4 mr-1.5" />}
            Download PDF
          </Button>
        </div>
      )}

      {/* Horizontal scroll so 794px doc never gets clipped by modal max-width */}
      <div className="overflow-x-auto">
        {/* ── Document root — this is what html2canvas captures ── */}
        <div
          ref={ref}
          id="document-render"
          style={{
            background: cfg.bg,
            fontFamily: cfg.font,
            color:      cfg.bg === '#1e293b' ? '#f8fafc' : '#1e293b',
            width:      '794px',
            minHeight:  '1123px',
            opacity:    1,
            filter:     'none',
          }}
          className={cn('rounded-xl shadow-sm border', compact ? 'text-xs' : 'text-sm')}
        >
          {/* ── Header ── */}
          <div style={{ background: cfg.headerBg, color: cfg.headerText }} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                {orgLogo
                  ? <img src={orgLogo} alt="logo" className="h-10 mb-2 object-contain" />
                  : <div className="text-xl font-bold mb-1">{orgName || 'Your Company'}</div>
                }
                <div className="text-xs space-y-0.5" style={{ color: cfg.headerText, opacity: 0.85 }}>
                  {orgAddress && <div>{orgAddress}</div>}
                  {orgEmail   && <div>{orgEmail}</div>}
                  {orgPhone   && <div>{orgPhone}</div>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold uppercase tracking-wider">
                  {data.type === 'invoice' ? 'Invoice' : (data.title || 'Quotation')}
                </div>
                <div className="text-xs mt-1" style={{ color: cfg.headerText, opacity: 0.75 }}>
                  #{data.id.slice(0, 8).toUpperCase()}
                </div>
                <div
                  className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                  style={{ background: cfg.accent, color: '#fff' }}
                >
                  {data.status}
                </div>
              </div>
            </div>
          </div>

          {/* ── Bill To + Dates ── */}
          <div
            className="p-6 grid grid-cols-2 gap-6"
            style={{ borderBottom: `1px solid ${cfg.borderColor}` }}
          >
            <div>
              <div
                className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: cfg.accent }}
              >
                Bill To
              </div>
              <div className="font-semibold">{clientCompany || clientName || '—'}</div>
              {clientCompany && clientName && (
                <div className="text-xs text-gray-500">{clientName}</div>
              )}
              {clientEmail && (
                <div className="text-xs text-gray-500">{clientEmail}</div>
              )}
              {data.project?.title && (
                <div className="text-xs text-gray-400 mt-1">
                  Project: {data.project.title}
                </div>
              )}
            </div>
            <div className="text-right text-xs text-gray-500">
              {data.created_at && (
                <div className="mb-1">
                  <span className="text-gray-400">Date: </span>
                  {safeDate(data.created_at)}
                </div>
              )}
              {data.due_date && (
                <div>
                  <span className="text-gray-400">Due: </span>
                  {safeDate(data.due_date)}
                </div>
              )}
            </div>
          </div>

          {/* ── Items Table ── */}
          <div className="p-6">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: cfg.tableHeaderBg, color: cfg.tableHeaderText }}>
                  <th className="text-left p-2 font-bold">Description</th>
                  <th className="text-right p-2 font-bold">Qty</th>
                  <th className="text-right p-2 font-bold">Unit Price</th>
                  <th className="text-right p-2 font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${cfg.borderColor}` }}>
                    <td className="p-2">{item.description || 'No description'}</td>
                    <td className="p-2 text-right">{item.quantity ?? 1}</td>
                    <td className="p-2 text-right">{fmt(item.unit_price ?? 0, data.currency)}</td>
                    <td className="p-2 text-right font-semibold">
                      {fmt(item.amount ?? (item.quantity ?? 1) * (item.unit_price ?? 0), data.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="w-48 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Subtotal</span>
                  <span>{fmt(subtotal, data.currency)}</span>
                </div>
                <div
                  className="flex justify-between font-bold text-sm pt-1"
                  style={{ borderTop: `2px solid ${cfg.accent}` }}
                >
                  <span>Total</span>
                  <span style={{ color: cfg.accent }}>{fmt(data.amount, data.currency)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {data.notes && (
              <div
                className="mt-6 p-3 rounded text-xs"
                style={{ background: cfg.tableHeaderBg, borderLeft: `3px solid ${cfg.accent}` }}
              >
                <div className="font-bold mb-1 uppercase tracking-widest text-[10px] text-gray-400">
                  Notes
                </div>
                {data.notes}
              </div>
            )}
          </div>
        </div>
        {/* ── end document root ── */}
      </div>
      {/* ── end scroll wrapper ── */}
    </div>
  );
}
