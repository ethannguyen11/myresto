import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { conversionFactor } from '../lib/units';
import { PriceImpactTable, type PriceImpactRow } from '../components/PriceImpactTable';

type InvoiceStatus = 'pending' | 'analyzing' | 'reviewed' | 'validated' | 'error';

interface Ingredient { id: number; name: string; unit: string; }
interface InvoiceItem {
  id: number; rawName: string; quantity: number | null; unit: string | null;
  unitPrice: number | null; totalPrice: number | null; isConfirmed: boolean;
  ingredientId: number | null; ingredient: Ingredient | null;
  matchScore: number | null; matchMethod: string | null;
  conversionFactor: number | null;
}
interface ValidationResult {
  updated: number; created: number; ignored: number;
  needsConversion: { itemId: number; rawName: string; invoiceUnit: string | null; ingredientName: string; ingredientUnit: string }[];
  impact: PriceImpactRow[];
}
interface Invoice {
  id: number; supplierName: string | null; invoiceDate: string | null;
  totalAmount: number | null; status: InvoiceStatus; fileType: string | null;
  createdAt: string; items: InvoiceItem[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmt(n: number | null, dec = 2): string {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(dec).replace('.', ',');
}

// ── Status badge ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<InvoiceStatus, { bg: string; color: string }> = {
  pending:   { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)' },
  analyzing: { bg: 'rgba(245,158,11,0.15)', color: 'var(--amber)' },
  reviewed:  { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  validated: { bg: 'rgba(16,185,129,0.15)', color: 'var(--green)' },
  error:     { bg: 'rgba(239,68,68,0.15)', color: 'var(--red)' },
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation();
  const s = STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {status === 'analyzing' && <span className="h-1.5 w-1.5 animate-ping rounded-full" style={{ background: 'var(--amber)' }} />}
      {t(`invoices.status.${status}`)}
    </span>
  );
}

// ── Modal shell ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-12 backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onMouseDown={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <div
        className={`w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} rounded-2xl shadow-xl`}
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--bg-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 transition-colors" style={{ color: 'var(--text-tertiary)' }}>✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Upload zone ────────────────────────────────────────────────────────────

function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError('');
    setProgress(0);
    setStatusMsg(t('invoices.upload.uploading'));
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/invoices/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => { if (e.total) setProgress(Math.round((e.loaded / e.total) * 100)); },
      });
      setStatusMsg(t('invoices.upload.sent'));
      setTimeout(() => { setProgress(null); setStatusMsg(''); onUploaded(); }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.message ?? t('invoices.upload.failed'));
      setProgress(null);
      setStatusMsg('');
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0];
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type) && !/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) {
      setError(t('invoices.upload.invalidFormat'));
      return;
    }
    upload(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  const busy = progress !== null;

  return (
    <div className="rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--bg-border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('invoices.upload.title')}</h2>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('invoices.upload.formats')}</p>
      </div>
      <div className="p-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !busy && inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors"
          style={{
            borderColor: dragging ? 'var(--accent)' : 'var(--bg-border)',
            background: dragging ? 'var(--accent-bg)' : 'var(--bg-tertiary)',
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          {busy ? (
            <div className="w-full max-w-xs space-y-3">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{statusMsg}</p>
              <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--bg-border)' }}>
                <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{progress}%</p>
            </div>
          ) : (
            <>
              <span className="text-4xl" style={{ color: 'var(--accent)' }}>🧾</span>
              <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t('invoices.upload.dropLabel')}{' '}
                <span style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{t('invoices.upload.browse')}</span>
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('invoices.upload.aiDesc')}</p>
            </>
          )}
        </div>
        {error && <p className="mt-3 text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
      </div>
    </div>
  );
}

// ── Match badge ────────────────────────────────────────────────────────────

function MatchBadge({ method, score }: { method: string | null; score: number | null }) {
  if (method === 'auto' || method === 'memory') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--green)' }}>
        ✅ {method === 'memory' ? 'mémorisé' : `auto ${score !== null ? Math.round(score * 100) : '—'}%`}
      </span>
    );
  }
  if (method === 'suggestion') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--amber)' }}>
        ⚠️ suggestion {score !== null ? Math.round(score * 100) : '—'}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--red)' }}>
      ❓ non reconnu
    </span>
  );
}

function itemRowBg(method: string | null): string {
  if (method === 'auto' || method === 'memory') return 'rgba(16,185,129,0.05)';
  if (method === 'suggestion') return 'rgba(245,158,11,0.05)';
  return 'rgba(239,68,68,0.05)';
}

// ── Validation modal ───────────────────────────────────────────────────────

function ValidationModal({ invoice, ingredients, onClose, onValidated }: {
  invoice: Invoice; ingredients: Ingredient[];
  onClose: () => void; onValidated: () => void;
}) {
  const { t } = useTranslation();
  const [selections, setSelections] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const item of invoice.items) init[item.id] = item.ingredientId ? String(item.ingredientId) : '';
    return init;
  });
  // Facteur saisi par ligne : combien d'unités de l'ingrédient dans 1 unité de la facture
  const [factors, setFactors] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const item of invoice.items) if (item.conversionFactor) init[item.id] = String(Number(item.conversionFactor));
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  // Lignes encore à traiter : au départ les non confirmées, ensuite celles qui attendent une conversion
  const [pendingIds, setPendingIds] = useState<Set<number>>(
    () => new Set(invoice.items.filter((i) => !i.isConfirmed).map((i) => i.id)),
  );
  const unconfirmed = invoice.items.filter((i) => pendingIds.has(i.id));
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  /** Vrai si l'unité de la facture ne se convertit pas seule vers celle de l'ingrédient choisi */
  function needsFactor(item: InvoiceItem): Ingredient | null {
    const ing = ingredientById.get(parseInt(selections[item.id]));
    if (!ing || !item.unit) return null;
    return conversionFactor(item.unit, ing.unit) === null ? ing : null;
  }

  async function handleValidate() {
    setError('');
    setSubmitting(true);
    try {
      const toMemorize = unconfirmed.filter((item) => {
        const sel = selections[item.id];
        const isManual = item.matchMethod === 'suggestion' || item.matchMethod === 'none';
        const changed = sel && parseInt(sel) !== item.ingredientId;
        return isManual && sel && (changed || item.matchMethod === 'none');
      });
      await Promise.allSettled(
        toMemorize.map((item) => api.post('/invoices/remember-match', { rawName: item.rawName, ingredientId: parseInt(selections[item.id]) })),
      );
      const items = unconfirmed.map((item) => {
        const factor = parseFloat(factors[item.id]);
        return {
          itemId: item.id,
          ingredientId: selections[item.id] ? parseInt(selections[item.id]) : null,
          ...(needsFactor(item) && factor > 0 ? { conversionFactor: factor } : {}),
        };
      });
      const res = await api.post<ValidationResult>(`/invoices/${invoice.id}/validate-items`, { items });
      // Cumule avec un passage précédent (lignes converties après coup)
      setResult((prev) => prev ? {
        ...res.data,
        updated: prev.updated + res.data.updated,
        created: prev.created + res.data.created,
        impact: [...prev.impact.filter((r) => !res.data.impact.some((n) => n.recipeId === r.recipeId)), ...res.data.impact],
      } : res.data);
      setPendingIds(new Set(res.data.needsConversion.map((n) => n.itemId)));
      onValidated();
      if (res.data.needsConversion.length === 0 && res.data.impact.length === 0) {
        setTimeout(() => onClose(), 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message ?? t('invoices.validation.error'));
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--bg-border)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '6px 8px',
    fontSize: 12,
    outline: 'none',
  };

  return (
    <Modal title={t('invoices.validation.title', { supplier: invoice.supplierName ?? `Facture #${invoice.id}` })} wide onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('invoices.validation.desc')}</p>
        {error && <div className="rounded-lg px-4 py-2.5 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)' }}>{error}</div>}
        {result && (
          <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.2)' }}>
            ✅ {result.updated} prix mis à jour · {result.created} ingrédient{result.created !== 1 ? 's' : ''} créé{result.created !== 1 ? 's' : ''}
          </div>
        )}
        {result && result.needsConversion.length > 0 && (
          <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.25)' }}>
            {t('invoices.conversion.pending', { count: result.needsConversion.length })}
          </div>
        )}
        {result && result.impact.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{t('impact.title')}</p>
            <PriceImpactTable rows={result.impact} />
          </div>
        )}
        <div
          className="grid grid-cols-[1fr_70px_80px_130px_1fr] gap-2 pb-2 text-xs font-medium uppercase tracking-wide"
          style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-tertiary)' }}
        >
          <span>{t('invoices.validation.colExtracted')}</span>
          <span className="text-right">{t('invoices.validation.colQty')}</span>
          <span className="text-right">{t('invoices.validation.colUnitPrice')}</span>
          <span>Confiance</span>
          <span>{t('invoices.validation.colLink')}</span>
        </div>
        <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {unconfirmed.length === 0 ? (
            <li className="py-4 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('invoices.validation.allConfirmed')}</li>
          ) : (
            unconfirmed.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-[1fr_70px_80px_130px_1fr] items-center gap-2 rounded-lg px-3 py-2.5"
                style={{ background: itemRowBg(item.matchMethod), border: '1px solid var(--bg-border)' }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)', wordBreak: 'break-word', whiteSpace: 'normal', maxWidth: '200px', display: 'block' }}>
                  {item.rawName}
                  {item.unit && <span className="ml-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>({item.unit})</span>}
                </span>
                <span className="text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {item.quantity !== null ? fmt(item.quantity, 3).replace(/,?0+$/, '') : '—'}
                </span>
                <span className="text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {item.unitPrice !== null ? `${fmt(item.unitPrice)} €` : '—'}
                </span>
                <MatchBadge method={item.matchMethod} score={item.matchScore} />
                <select
                  value={selections[item.id] ?? ''}
                  onChange={(e) => setSelections((s) => ({ ...s, [item.id]: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">{t('invoices.validation.ignore')}</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                  ))}
                </select>
                {(() => {
                  const ing = needsFactor(item);
                  if (!ing) return null;
                  return (
                    <div className="col-span-5 flex flex-wrap items-center justify-end gap-2 text-xs" style={{ color: 'var(--amber)' }}>
                      <span>{t('invoices.conversion.label', { invoiceUnit: item.unit, ingredient: ing.name })}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>1 {item.unit} =</span>
                      <input
                        type="number" min="0" step="0.001"
                        value={factors[item.id] ?? ''}
                        onChange={(e) => setFactors((f) => ({ ...f, [item.id]: e.target.value }))}
                        placeholder="5"
                        style={{ ...inputStyle, width: 80 }}
                      />
                      <span style={{ color: 'var(--text-secondary)' }}>{ing.unit}</span>
                    </div>
                  );
                })()}
              </li>
            ))
          )}
        </ul>
        {invoice.items.some((i) => i.isConfirmed) && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('invoices.validation.alreadyConfirmed', { count: invoice.items.filter((i) => i.isConfirmed).length })}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-4" style={{ borderTop: '1px solid var(--bg-border)' }}>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm" style={{ border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
            {t('common.cancel')}
          </button>
          <button
            onClick={handleValidate}
            disabled={submitting || unconfirmed.length === 0}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            {submitting ? t('invoices.validation.confirming') : t('invoices.validation.confirm', { count: unconfirmed.length })}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type InvSortDir = 'asc' | 'desc';
type InvPeriod  = 0 | 7 | 30 | 90;
type InvStatusFilter = InvoiceStatus | 'all';
const INV_STATUSES: InvStatusFilter[] = ['all', 'pending', 'analyzing', 'reviewed', 'validated', 'error'];
const INV_PERIODS: InvPeriod[] = [0, 7, 30, 90];

type ActiveModal = { type: 'validate'; invoice: Invoice } | { type: 'delete'; invoice: Invoice };

export function InvoicesPage() {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ActiveModal | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvStatusFilter>('all');
  const [period, setPeriod] = useState<InvPeriod>(0);
  const [sortDir, setSortDir] = useState<InvSortDir>('desc');

  const load = useCallback(async (silent = false) => {
    try {
      const [invRes, ingRes] = await Promise.all([api.get<Invoice[]>('/invoices'), api.get<Ingredient[]>('/ingredients')]);
      setInvoices(invRes.data);
      setIngredients(ingRes.data);
    } catch (err: any) {
      if (!silent) setError(err.response?.data?.message ?? t('invoices.loadError'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const hasAnalyzing = invoices.some((inv) => inv.status === 'pending' || inv.status === 'analyzing');
    if (hasAnalyzing && !pollRef.current) {
      pollRef.current = setInterval(() => load(true), 4000);
    } else if (!hasAnalyzing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [invoices, load]);

  async function handleAnalyze(invoice: Invoice) {
    try { await api.post(`/invoices/${invoice.id}/analyze`); await load(true); } catch {}
  }
  async function handleDelete(invoice: Invoice) {
    try { await api.delete(`/invoices/${invoice.id}`); setModal(null); await load(true); } catch {}
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  );

  if (error) return (
    <div className="rounded-xl px-6 py-5 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}>
      {error}
    </div>
  );

  const validated = invoices.filter((i) => i.status === 'validated').length;
  const toReview  = invoices.filter((i) => i.status === 'reviewed').length;
  const now = Date.now();
  let filtered = invoices;
  if (search.trim()) filtered = filtered.filter((inv) => (inv.supplierName ?? '').toLowerCase().includes(search.toLowerCase()));
  if (statusFilter !== 'all') filtered = filtered.filter((inv) => inv.status === statusFilter);
  if (period > 0) filtered = filtered.filter((inv) => new Date(inv.createdAt).getTime() >= now - period * 24 * 60 * 60 * 1000);
  filtered = [...filtered].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return sortDir === 'desc' ? -diff : diff;
  });

  const inputStyle = {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--bg-border)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 14,
    outline: 'none',
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('invoices.title')}</h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('invoices.subtitle', { count: invoices.length })}
              {toReview > 0 && (
                <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                  {t('invoices.toValidate', { count: toReview })}
                </span>
              )}
            </p>
          </div>
          {invoices.length > 0 && (
            <div className="flex gap-4 text-right">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('invoices.validated')}</p>
                <p className="text-lg font-semibold" style={{ color: 'var(--green)' }}>{validated}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('invoices.totalImported')}</p>
                <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{invoices.length}</p>
              </div>
            </div>
          )}
        </div>

        <UploadZone onUploaded={() => load(true)} />

        {invoices.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-xl border-dashed py-12 text-center"
            style={{ border: '2px dashed var(--bg-border)', background: 'var(--bg-secondary)' }}
          >
            <span className="text-4xl">📂</span>
            <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('invoices.empty.title')}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('invoices.empty.desc')}</p>
          </div>
        ) : (
          <div className="rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
            {/* Filter bar */}
            <div className="p-4 space-y-3" style={{ borderBottom: '1px solid var(--bg-border)' }}>
              <div className="flex flex-wrap gap-3">
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('invoices.filters.searchPlaceholder')} className="flex-1 min-w-[180px]" style={inputStyle} />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InvStatusFilter)} style={inputStyle}>
                  <option value="all">{t('invoices.filters.allStatuses')}</option>
                  {INV_STATUSES.filter((s) => s !== 'all').map((s) => (
                    <option key={s} value={s}>{t(`invoices.status.${s}`)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {INV_PERIODS.map((p) => {
                  const label = p === 0 ? t('invoices.filters.periodAll') : p === 7 ? t('invoices.filters.period7') : p === 30 ? t('invoices.filters.period30') : t('invoices.filters.period90');
                  return (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                      style={{ background: period === p ? 'var(--accent)' : 'var(--bg-tertiary)', color: period === p ? '#000' : 'var(--text-secondary)' }}
                    >
                      {label}
                    </button>
                  );
                })}
                <button
                  onClick={() => setSortDir((d) => d === 'desc' ? 'asc' : 'desc')}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                  {sortDir === 'desc' ? t('invoices.filters.sortNewest') : t('invoices.filters.sortOldest')} {sortDir === 'desc' ? '↓' : '↑'}
                </button>
                <span className="ml-auto text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('invoices.filters.displayed', { count: filtered.length })}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--bg-border)' }}>
                    {[t('invoices.table.supplier'), t('invoices.table.invoiceDate'), t('invoices.table.importedOn'), t('invoices.table.amount'), t('invoices.table.lines'), t('invoices.table.status'), ''].map((h, i) => (
                      <th
                        key={i}
                        className={`px-5 py-3 text-xs font-medium uppercase tracking-wide text-left${i === 3 ? ' text-right' : i === 4 ? ' text-center' : ''}`}
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        <span className="block text-2xl mb-2">🔍</span>
                        {t('invoices.filters.noResults')}
                      </td>
                    </tr>
                  ) : filtered.map((inv) => (
                    <tr
                      key={inv.id}
                      className="group transition-colors"
                      style={{ borderBottom: '1px solid var(--bg-border)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <td className="px-5 py-3">
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {inv.supplierName ?? <span className="italic" style={{ color: 'var(--text-tertiary)' }}>{t('invoices.table.analyzing')}</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>{fmtDate(inv.invoiceDate)}</td>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmtDate(inv.createdAt)}</td>
                      <td className="px-5 py-3 text-right font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {inv.totalAmount !== null ? `${fmt(inv.totalAmount)} €` : '—'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {inv.items.length > 0 ? (
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                            {inv.items.length}
                          </span>
                        ) : <span style={{ color: 'var(--bg-border)' }}>—</span>}
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={inv.status} /></td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {inv.status === 'reviewed' && (
                            <button onClick={() => setModal({ type: 'validate', invoice: inv })} className="rounded-md px-2.5 py-1.5 text-xs font-medium" style={{ color: '#60a5fa' }}>
                              {t('common.validate')}
                            </button>
                          )}
                          {inv.status === 'error' && (
                            <button onClick={() => handleAnalyze(inv)} className="rounded-md px-2.5 py-1.5 text-xs font-medium" style={{ color: 'var(--amber)' }}>
                              {t('invoices.reanalyze')}
                            </button>
                          )}
                          <button
                            onClick={() => setModal({ type: 'delete', invoice: inv })}
                            disabled={inv.status === 'analyzing'}
                            className="rounded-md px-2.5 py-1.5 text-xs font-medium disabled:opacity-30"
                            style={{ color: 'var(--red)' }}
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modal?.type === 'validate' && (
        <ValidationModal invoice={modal.invoice} ingredients={ingredients} onClose={() => setModal(null)} onValidated={() => load(true)} />
      )}
      {modal?.type === 'delete' && (
        <Modal title={t('common.confirmDelete')} onClose={() => setModal(null)}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('invoices.delete.message', { name: modal.invoice.supplierName ?? `#${modal.invoice.id}` })}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="rounded-lg px-4 py-2 text-sm" style={{ border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
              {t('common.cancel')}
            </button>
            <button onClick={() => handleDelete(modal.invoice)} className="rounded-lg px-4 py-2 text-sm font-medium" style={{ background: 'var(--red)', color: '#fff' }}>
              {t('common.deleteForever')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
