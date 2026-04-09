/**
 * DocumentRenderer — shared template engine for invoices and quotations.
 * Renders a styled document based on the selected template slug.
 * Used for live preview and PDF export (via html2canvas + jsPDF).
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
  created_at?: string;
}

interface TemplateConfig {
  bg: string;
  headerBg: string;
  headerText: string;
  accent: string;
  tableBg: string;
  tableHeaderBg: string;
  tableHeaderText: string;
  borderColor: string;
  font: string;
}

const TEMPLATE_CONFIGS: Record<string, TemplateConfig> = {
  basic: {
    bg: '#ffffff', headerBg: '#f8fafc', headerText: '#0f172a',
    accent: '#64748b', tableBg: '#ffffff', tableHeaderBg: '#f1f5f9',
    tableHeaderText: '#475569', borderColor: '#e2e8f0', font: 'sans-serif',
  },
  modern: {
    bg: '#ffffff', headerBg: '#6366f1', headerText: '#ffffff',
    accent: '#6366f1', tableBg: '#ffffff', tableHeaderBg: '#eef2ff',
    tableHeaderText: '#4338ca', borderColor: '#e0e7ff', font: 'sans-serif',
  },
  minimal: {
    bg: '#ffffff', headerBg: '#ffffff', headerText: '#0ea5e9',
    accent: '#0ea5e9', tableBg: '#f0f9ff', tableHeaderBg: '#e0f2fe',
    tableHeaderText: '#0369a1', borderColor: '#bae6fd', font: 'sans-serif',
  },
  dark: {
    bg: '#1e293b', headerBg: '#0f172a', headerText: '#f8fafc',
    accent: '#38bdf8', tableBg: '#1e293b', tableHeaderBg: '#0f172a',
    tableHeaderText: '#94a3b8', borderColor: '#334155', font: 'sans-serif',
  },
  corporate: {
    bg: '#ffffff', headerBg: '#0f172a', headerText: '#ffffff',
    accent: '#0f172a', tableBg: '#ffffff', tableHeaderBg: '#f8fafc',
    tableHeaderText: '#0f172a', borderColor: '#cbd5e1', font: 'Georgia, serif',
  },
  premium: {
    bg: '#fffbeb', headerBg: '#92400e', headerText: '#fef3c7',
    accent: '#d97706', tableBg: '#fffbeb', tableHeaderBg: '#fef3c7',
    tableHeaderText: '#92400e', borderColor: '#fde68a', font: 'sans-serif',
  },
  creative: {
    bg: '#fdf4ff', headerBg: '#ec4899', headerText: '#ffffff',
    accent: '#ec4899', tableBg: '#fdf4ff', tableHeaderBg: '#fce7f3',
    tableHeaderText: '#9d174d', borderColor: '#fbcfe8', font: 'sans-serif',
  },
};

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
  } catch { return `${currency} ${amount.toFixed(2)}`; }
}

interface Props {
  data: DocumentData;
  templateSlug?: string;
  showDownload?: boolean;
  compact?: boolean; // for preview panels
}

export function DocumentRenderer({ data, templateSlug = 'basic', showDownload = true, compact = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = React.useState(false);
  const cfg = TEMPLATE_CONFIGS[templateSlug] ?? TEMPLATE_CONFIGS.basic;

  const handleDownload = async () => {
    if (!ref.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, backgroundColor: cfg.bg });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width / 2, canvas.height / 2] });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      const prefix = data.type === 'invoice' ? 'INV' : 'QUO';
      pdf.save(`${prefix}-${data.id.slice(0, 6).toUpperCase()}.pdf`);
    } finally { setDownloading(false); }
  };

  const items = data.items ?? [];
  const subtotal = items.reduce((s, i) => s + (i.amount ?? (i.quantity ?? 1) * (i.unit_price ?? 0)), 0);

  return (
    <div className="space-y-3">
      {showDownload && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
            Download PDF
          </Button>
        </div>
      )}

      {/* The rendered document */}
      <div
        ref={ref}
        style={{ background: cfg.bg, fontFamily: cfg.font, color: cfg.headerText === '#ffffff' ? '#1e293b' : cfg.headerText }}
        className={cn('rounded-xl overflow-hidden shadow-sm border', compact ? 'text-xs' : 'text-sm')}
      >
        {/* Header */}
        <div style={{ background: cfg.headerBg, color: cfg.headerText }} className="p-6">
          <div className="flex items-start justify-between">
            <div>
              {data.org?.logo_url
                ? <img src={data.org.logo_url} alt="logo" className="h-10 mb-2 object-contain" />
                : <div className="text-xl font-bold mb-1">{data.org?.name || 'Your Company'}</div>
              }
              <div className="text-xs opacity-70 space-y-0.5">
                {data.org?.address && <div>{data.org.address}</div>}
                {data.org?.email && <div>{data.org.email}</div>}
                {data.org?.phone && <div>{data.org.phone}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold uppercase tracking-wider">
                {data.type === 'invoice' ? 'Invoice' : (data.title || 'Quotation')}
              </div>
              <div className="text-xs opacity-70 mt-1">
                #{data.id.slice(0, 8).toUpperCase()}
              </div>
              <div className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                style={{ background: cfg.accent, color: '#fff' }}>
                {data.status}
              </div>
            </div>
          </div>
        </div>

        {/* Bill to + dates */}
        <div className="p-6 grid grid-cols-2 gap-6" style={{ borderBottom: `1px solid ${cfg.borderColor}` }}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: cfg.accent }}>Bill To</div>
            <div className="font-semibold">{data.client?.company || data.client?.name || '—'}</div>
            <div className="text-xs opacity-70">{data.client?.name}</div>
            <div className="text-xs opacity-70">{data.client?.email}</div>
          </div>
          <div className="text-right">
            {data.created_at && (
              <div className="text-xs mb-1">
                <span className="opacity-60">Date: </span>
                {new Date(data.created_at).toLocaleDateString()}
              </div>
            )}
            {data.due_date && (
              <div className="text-xs">
                <span className="opacity-60">Due: </span>
                {new Date(data.due_date).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        {/* Items table */}
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
                  <td className="p-2">{item.description}</td>
                  <td className="p-2 text-right">{item.quantity ?? 1}</td>
                  <td className="p-2 text-right">{fmt(item.unit_price ?? 0, data.currency)}</td>
                  <td className="p-2 text-right font-semibold">
                    {fmt(item.amount ?? (item.quantity ?? 1) * (item.unit_price ?? 0), data.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div className="mt-4 flex justify-end">
            <div className="w-48 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="opacity-60">Subtotal</span>
                <span>{fmt(subtotal, data.currency)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1" style={{ borderTop: `2px solid ${cfg.accent}` }}>
                <span>Total</span>
                <span style={{ color: cfg.accent }}>{fmt(data.amount, data.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {data.notes && (
            <div className="mt-6 p-3 rounded text-xs" style={{ background: cfg.tableHeaderBg, borderLeft: `3px solid ${cfg.accent}` }}>
              <div className="font-bold mb-1 opacity-60 uppercase tracking-widest text-[10px]">Notes</div>
              {data.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
