import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

// ── Types ──────────────────────────────────────────────────────────────────

type InvoiceStatus = 'pending' | 'analyzing' | 'reviewed' | 'validated' | 'error';

interface Ingredient {
  id: number;
  name: string;
  unit: string;
}

interface InvoiceItem {
  id: number;
  rawName: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  isConfirmed: boolean;
  ingredientId: number | null;
  ingredient: Ingredient | null;
  matchScore: number | null;
  matchMethod: string | null;
}

interface Invoice {
  id: number;
  supplierName: string | null;
  invoiceDate: string | null;
  totalAmount: number | null;
  status: InvoiceStatus;
  fileType: string | null;
  createdAt: string;
  items: InvoiceItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmt(n: number | null, dec = 2): string {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(dec).replace('.', ',');
}

// ── Status badge ───────────────────────────────────────────────────────────

const STATUS_CLS: Record<InvoiceStatus, string> = {
  pending:   'bg-stone-100 text-stone-500',
  analyzing: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200',
  reviewed:  'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  validated: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  error:     'bg-red-50 text-red-600 ring-1 ring-red-200',
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLS[status]}`}>
      {status === 'analyzing' && (
        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-500" />
      )}
      {t(`invoices.status.${status}`)}
    </span>
  );
}

// ── Modal shell ────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-12 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <div className={`w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} rounded-2xl border border-stone-200 bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            ✕
          </button>
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
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      setStatusMsg(t('invoices.upload.sent'));
      setTimeout(() => {
        setProgress(null);
        setStatusMsg('');
        onUploaded();
      }, 1500);
    } catch (err: any) {
      console.error('[InvoicesPage] upload', err);
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
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-stone-700">{t('invoices.upload.title')}</h2>
        <p className="mt-0.5 text-xs text-stone-400">{t('invoices.upload.formats')}</p>
      </div>
      <div className="p-5">
        {/* Drop area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !busy && inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors
            ${busy ? 'cursor-default' : 'hover:border-emerald-400 hover:bg-emerald-50/50'}
            ${dragging ? 'border-emerald-400 bg-emerald-50' : 'border-stone-300 bg-stone-50'}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {busy ? (
            <div className="w-full max-w-xs space-y-3">
              <p className="text-sm font-medium text-stone-700">{statusMsg}</p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-stone-400">{progress}%</p>
            </div>
          ) : (
            <>
              <span className="text-4xl">🧾</span>
              <p className="mt-3 text-sm font-medium text-stone-700">
                {t('invoices.upload.dropLabel')}{' '}
                <span className="text-emerald-600 underline underline-offset-2">{t('invoices.upload.browse')}</span>
              </p>
              <p className="mt-1 text-xs text-stone-400">
                {t('invoices.upload.aiDesc')}
              </p>
            </>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}

// ── Match badge ────────────────────────────────────────────────────────────

function MatchBadge({ method, score }: { method: string | null; score: number | null }) {
  if (method === 'auto' || method === 'memory') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
        ✅ {method === 'memory' ? 'mémorisé' : `auto ${score !== null ? Math.round(score * 100) : '—'}%`}
      </span>
    );
  }
  if (method === 'suggestion') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
        ⚠️ suggestion {score !== null ? Math.round(score * 100) : '—'}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-red-200">
      ❓ non reconnu
    </span>
  );
}

function itemRowClass(method: string | null) {
  if (method === 'auto' || method === 'memory') return 'border-emerald-100 bg-emerald-50/40';
  if (method === 'suggestion') return 'border-amber-100 bg-amber-50/40';
  return 'border-red-100 bg-red-50/30';
}

// ── Validation modal ───────────────────────────────────────────────────────

function ValidationModal({
  invoice,
  ingredients,
  onClose,
  onValidated,
}: {
  invoice: Invoice;
  ingredients: Ingredient[];
  onClose: () => void;
  onValidated: () => void;
}) {
  const { t } = useTranslation();
  const [selections, setSelections] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const item of invoice.items) {
      init[item.id] = item.ingredientId ? String(item.ingredientId) : '';
    }
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ updated: number; created: number; ignored: number } | null>(null);

  const unconfirmed = invoice.items.filter((i) => !i.isConfirmed);

  async function handleValidate() {
    setError('');
    setSubmitting(true);
    try {
      // Mémorise les correspondances manuelles (suggestion ou none)
      const toMemorize = unconfirmed.filter((item) => {
        const sel = selections[item.id];
        const isManual = item.matchMethod === 'suggestion' || item.matchMethod === 'none';
        const changed = sel && parseInt(sel) !== item.ingredientId;
        return isManual && sel && (changed || item.matchMethod === 'none');
      });
      await Promise.allSettled(
        toMemorize.map((item) =>
          api.post('/invoices/remember-match', {
            rawName: item.rawName,
            ingredientId: parseInt(selections[item.id]),
          }),
        ),
      );

      const items = unconfirmed.map((item) => ({
        itemId: item.id,
        ingredientId: selections[item.id] ? parseInt(selections[item.id]) : null,
      }));
      const res = await api.post<{ updated: number; created: number; ignored: number }>(
        `/invoices/${invoice.id}/validate-items`, { items }
      );
      setResult(res.data);
      onValidated();
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      console.error('[InvoicesPage] validate-items', err);
      setError(err.response?.data?.message ?? t('invoices.validation.error'));
    } finally {
      setSubmitting(false);
    }
  }

  const supplierLabel = invoice.supplierName ?? `Facture #${invoice.id}`;

  return (
    <Modal title={t('invoices.validation.title', { supplier: supplierLabel })} wide onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-stone-500">
          {t('invoices.validation.desc')}
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
        )}

        {result && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            ✅ {result.updated} prix mis à jour · {result.created} nouveau{result.created !== 1 ? 'x' : ''} ingrédient{result.created !== 1 ? 's' : ''} créé{result.created !== 1 ? 's' : ''}
          </div>
        )}

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_70px_80px_130px_1fr] gap-2 border-b border-stone-100 pb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
          <span>{t('invoices.validation.colExtracted')}</span>
          <span className="text-right">{t('invoices.validation.colQty')}</span>
          <span className="text-right">{t('invoices.validation.colUnitPrice')}</span>
          <span>Confiance</span>
          <span>{t('invoices.validation.colLink')}</span>
        </div>

        {/* Items */}
        <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {unconfirmed.length === 0 ? (
            <li className="py-4 text-center text-sm text-stone-400">
              {t('invoices.validation.allConfirmed')}
            </li>
          ) : (
            unconfirmed.map((item) => (
              <li
                key={item.id}
                className={`grid grid-cols-[1fr_70px_80px_130px_1fr] items-center gap-2 rounded-lg border px-3 py-2.5 ${itemRowClass(item.matchMethod)}`}
              >
                {/* Raw name */}
                <span
                  className="text-sm font-medium text-stone-800"
                  title={item.rawName}
                  style={{ wordBreak: 'break-word', whiteSpace: 'normal', maxWidth: '200px', display: 'block' }}
                >
                  {item.rawName}
                  {item.unit && (
                    <span className="ml-1 text-xs text-stone-400">({item.unit})</span>
                  )}
                </span>

                {/* Quantity */}
                <span className="text-right text-sm text-stone-600">
                  {item.quantity !== null ? fmt(item.quantity, 3).replace(/,?0+$/, '') : '—'}
                </span>

                {/* Unit price */}
                <span className="text-right text-sm text-stone-600">
                  {item.unitPrice !== null ? `${fmt(item.unitPrice)} €` : '—'}
                </span>

                {/* Match badge */}
                <MatchBadge method={item.matchMethod} score={item.matchScore} />

                {/* Ingredient selector */}
                <select
                  value={selections[item.id] ?? ''}
                  onChange={(e) =>
                    setSelections((s) => ({ ...s, [item.id]: e.target.value }))
                  }
                  className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs text-stone-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">{t('invoices.validation.ignore')}</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
              </li>
            ))
          )}
        </ul>

        {/* Already confirmed */}
        {invoice.items.some((i) => i.isConfirmed) && (
          <p className="text-xs text-stone-400">
            {t('invoices.validation.alreadyConfirmed', {
              count: invoice.items.filter((i) => i.isConfirmed).length,
            })}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleValidate}
            disabled={submitting || unconfirmed.length === 0}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting
              ? t('invoices.validation.confirming')
              : t('invoices.validation.confirm', { count: unconfirmed.length })}
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

type ActiveModal =
  | { type: 'validate'; invoice: Invoice }
  | { type: 'delete'; invoice: Invoice };

export function InvoicesPage() {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ActiveModal | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Filter & sort state ──
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvStatusFilter>('all');
  const [period, setPeriod] = useState<InvPeriod>(0);
  const [sortDir, setSortDir] = useState<InvSortDir>('desc');

  const load = useCallback(async (silent = false) => {
    try {
      const [invRes, ingRes] = await Promise.all([
        api.get<Invoice[]>('/invoices'),
        api.get<Ingredient[]>('/ingredients'),
      ]);
      setInvoices(invRes.data);
      setIngredients(ingRes.data);
    } catch (err: any) {
      console.error('[InvoicesPage] load', err);
      if (!silent) setError(err.response?.data?.message ?? t('invoices.loadError'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll every 4s while any invoice is analyzing
  useEffect(() => {
    const hasAnalyzing = invoices.some(
      (inv) => inv.status === 'pending' || inv.status === 'analyzing',
    );

    if (hasAnalyzing && !pollRef.current) {
      pollRef.current = setInterval(() => load(true), 4000);
    } else if (!hasAnalyzing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [invoices, load]);

  async function handleAnalyze(invoice: Invoice) {
    try {
      await api.post(`/invoices/${invoice.id}/analyze`);
      await load(true);
    } catch (err: any) {
      console.error('[InvoicesPage] analyze', err);
    }
  }

  async function handleDelete(invoice: Invoice) {
    try {
      await api.delete(`/invoices/${invoice.id}`);
      setModal(null);
      await load(true);
    } catch (err: any) {
      console.error('[InvoicesPage] delete', err);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const validated = invoices.filter((i) => i.status === 'validated').length;
  const toReview  = invoices.filter((i) => i.status === 'reviewed').length;

  // ── Filtered + sorted invoices ──
  const now = Date.now();
  let filtered = invoices;
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter((inv) => (inv.supplierName ?? '').toLowerCase().includes(q));
  }
  if (statusFilter !== 'all') {
    filtered = filtered.filter((inv) => inv.status === statusFilter);
  }
  if (period > 0) {
    const cutoff = now - period * 24 * 60 * 60 * 1000;
    filtered = filtered.filter((inv) => new Date(inv.createdAt).getTime() >= cutoff);
  }
  filtered = [...filtered].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return sortDir === 'desc' ? -diff : diff;
  });

  const selectCls = 'rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white';

  return (
    <>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-stone-900">{t('invoices.title')}</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              {t('invoices.subtitle', { count: invoices.length })}
              {toReview > 0 && (
                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {t('invoices.toValidate', { count: toReview })}
                </span>
              )}
            </p>
          </div>
          {invoices.length > 0 && (
            <div className="flex gap-4 text-right">
              <div>
                <p className="text-xs text-stone-400">{t('invoices.validated')}</p>
                <p className="text-lg font-semibold text-emerald-600">{validated}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400">{t('invoices.totalImported')}</p>
                <p className="text-lg font-semibold text-stone-800">{invoices.length}</p>
              </div>
            </div>
          )}
        </div>

        {/* Upload zone */}
        <UploadZone onUploaded={() => load(true)} />

        {/* Invoice list */}
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white py-12 text-center dark:border-gray-700 dark:bg-gray-800">
            <span className="text-4xl">📂</span>
            <p className="mt-3 text-sm font-medium text-stone-700 dark:text-gray-200">{t('invoices.empty.title')}</p>
            <p className="mt-1 text-xs text-stone-400 dark:text-gray-500">{t('invoices.empty.desc')}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            {/* ── Filter bar ── */}
            <div className="border-b border-stone-100 p-4 dark:border-gray-700 space-y-3">
              <div className="flex flex-wrap gap-3">
                {/* Search */}
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('invoices.filters.searchPlaceholder')}
                  className={`flex-1 min-w-[180px] ${selectCls}`}
                />
                {/* Status */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as InvStatusFilter)}
                  className={selectCls}
                >
                  <option value="all">{t('invoices.filters.allStatuses')}</option>
                  {INV_STATUSES.filter((s) => s !== 'all').map((s) => (
                    <option key={s} value={s}>{t(`invoices.status.${s}`)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Period buttons */}
                {INV_PERIODS.map((p) => {
                  const label = p === 0 ? t('invoices.filters.periodAll')
                    : p === 7 ? t('invoices.filters.period7')
                    : p === 30 ? t('invoices.filters.period30')
                    : t('invoices.filters.period90');
                  return (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        period === p
                          ? 'bg-emerald-600 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                {/* Sort toggle */}
                <button
                  onClick={() => setSortDir((d) => d === 'desc' ? 'asc' : 'desc')}
                  className="rounded-full px-3 py-1 text-xs font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {sortDir === 'desc' ? t('invoices.filters.sortNewest') : t('invoices.filters.sortOldest')} {sortDir === 'desc' ? '↓' : '↑'}
                </button>
                <span className="ml-auto text-xs text-stone-400 dark:text-gray-500">
                  {t('invoices.filters.displayed', { count: filtered.length })}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-medium uppercase tracking-wide text-stone-400 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-500">
                    <th className="px-5 py-3">{t('invoices.table.supplier')}</th>
                    <th className="px-5 py-3">{t('invoices.table.invoiceDate')}</th>
                    <th className="px-5 py-3">{t('invoices.table.importedOn')}</th>
                    <th className="px-5 py-3 text-right">{t('invoices.table.amount')}</th>
                    <th className="px-5 py-3 text-center">{t('invoices.table.lines')}</th>
                    <th className="px-5 py-3">{t('invoices.table.status')}</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-stone-400 dark:text-gray-500">
                        <span className="block text-2xl mb-2">🔍</span>
                        {t('invoices.filters.noResults')}
                      </td>
                    </tr>
                  ) : filtered.map((inv) => (
                    <tr key={inv.id} className="group hover:bg-stone-50">
                      {/* Supplier */}
                      <td className="px-5 py-3">
                        <span className="font-medium text-stone-800">
                          {inv.supplierName ?? (
                            <span className="text-stone-400 italic">{t('invoices.table.analyzing')}</span>
                          )}
                        </span>
                      </td>

                      {/* Invoice date */}
                      <td className="px-5 py-3 text-stone-500">{fmtDate(inv.invoiceDate)}</td>

                      {/* Import date */}
                      <td className="px-5 py-3 text-xs text-stone-400">{fmtDate(inv.createdAt)}</td>

                      {/* Total */}
                      <td className="px-5 py-3 text-right font-semibold text-stone-800">
                        {inv.totalAmount !== null ? `${fmt(inv.totalAmount)} €` : '—'}
                      </td>

                      {/* Item count */}
                      <td className="px-5 py-3 text-center">
                        {inv.items.length > 0 ? (
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                            {inv.items.length}
                          </span>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3">
                        <StatusBadge status={inv.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                          {inv.status === 'reviewed' && (
                            <button
                              onClick={() => setModal({ type: 'validate', invoice: inv })}
                              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                            >
                              {t('common.validate')}
                            </button>
                          )}
                          {inv.status === 'error' && (
                            <button
                              onClick={() => handleAnalyze(inv)}
                              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50"
                            >
                              {t('invoices.reanalyze')}
                            </button>
                          )}
                          <button
                            onClick={() => setModal({ type: 'delete', invoice: inv })}
                            disabled={inv.status === 'analyzing'}
                            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-30"
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

      {/* ── Modals ── */}
      {modal?.type === 'validate' && (
        <ValidationModal
          invoice={modal.invoice}
          ingredients={ingredients}
          onClose={() => setModal(null)}
          onValidated={() => load(true)}
        />
      )}

      {modal?.type === 'delete' && (
        <Modal title={t('common.confirmDelete')} onClose={() => setModal(null)}>
          <p className="text-sm text-stone-600">
            {t('invoices.delete.message', {
              name: modal.invoice.supplierName ?? `#${modal.invoice.id}`,
            })}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setModal(null)}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-50"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={() => handleDelete(modal.invoice)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              {t('common.deleteForever')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
