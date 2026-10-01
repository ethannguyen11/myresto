import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { OrderSheetModal } from '../components/OrderSheetModal';
import { LibraryModal } from '../components/LibraryModal';
import { PriceImpactTable, type PriceImpactRow } from '../components/PriceImpactTable';

// ── Types ──────────────────────────────────────────────────────────────────

interface PriceHistory {
  id: number;
  price: number;
  source: string;
  recordedAt: string;
}

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  currentPrice: number;
  category: string | null;
  updatedAt: string;
  priceHistory: PriceHistory[];
}

interface FormState {
  name: string;
  unit: string;
  currentPrice: string;
  category: string;
}

const EMPTY_FORM: FormState = { name: '', unit: '', currentPrice: '', category: '' };

// ── Category helpers ───────────────────────────────────────────────────────

function categoryIcon(cat: string | null): string {
  if (!cat) return '📦';
  const key = cat.toLowerCase();
  if (key.includes('viande') || key.includes('bœuf') || key.includes('porc') || key.includes('volaille')) return '🥩';
  if (key.includes('poisson') || key.includes('fruit de mer')) return '🐟';
  if (key.includes('légume') || key.includes('legume')) return '🥬';
  if (key.includes('laitier') || key.includes('beurre') || key.includes('fromage') || key.includes('crème')) return '🧈';
  if (key.includes('épicerie') || key.includes('epicerie') || key.includes('conserve')) return '🫙';
  if (key.includes('condiment') || key.includes('sauce') || key.includes('épice')) return '🧂';
  if (key.includes('fruit')) return '🍎';
  if (key.includes('boisson')) return '🍷';
  return '📦';
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Modal shell ────────────────────────────────────────────────────────────

function Modal({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: React.ReactNode }) {
  const backdropRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl shadow-xl`}
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--bg-border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Ingredient form ────────────────────────────────────────────────────────

function IngredientForm({ initial, ingredientId, onSave, onCancel }: {
  initial: FormState;
  /** Renseigné en édition : permet de prévisualiser l'impact d'un nouveau prix */
  ingredientId?: number;
  onSave: (data: FormState) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PriceImpactRow[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const newPrice = parseFloat(form.currentPrice);
  const priceChanged = ingredientId != null && newPrice >= 0 && newPrice !== parseFloat(initial.currentPrice);

  async function loadPreview() {
    setPreviewLoading(true);
    try {
      const res = await api.post<PriceImpactRow[]>('/recipes/price-impact', {
        prices: [{ ingredientId, price: newPrice }],
      });
      setPreview(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? t('common.error'));
    } finally {
      setPreviewLoading(false);
    }
  }

  function field(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      if (key === 'currentPrice') setPreview(null);
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try { await onSave(form); }
    catch (err: any) { setError(err.response?.data?.message ?? t('common.error')); }
    finally { setSubmitting(false); }
  }

  const inputStyle = {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--bg-border)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 14,
    width: '100%',
    outline: 'none',
  };
  const labelStyle = { color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, marginBottom: 6, display: 'block' };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg px-4 py-2.5 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)' }}>
          {error}
        </div>
      )}
      <div>
        <label style={labelStyle}>{t('ingredients.form.name')}</label>
        <input style={inputStyle} required value={form.name} onChange={field('name')} placeholder={t('ingredients.form.namePlaceholder')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={labelStyle}>{t('ingredients.form.unit')}</label>
          <input style={inputStyle} required value={form.unit} onChange={field('unit')} placeholder={t('ingredients.form.unitPlaceholder')} />
        </div>
        <div>
          <label style={labelStyle}>{t('ingredients.form.price')}</label>
          <input style={inputStyle} required type="number" min="0" step="0.01" value={form.currentPrice} onChange={field('currentPrice')} placeholder={t('ingredients.form.pricePlaceholder')} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>{t('ingredients.form.category')}</label>
        <input style={inputStyle} value={form.category} onChange={field('category')} placeholder={t('ingredients.form.categoryPlaceholder')} />
      </div>
      {priceChanged && (
        <div className="rounded-lg p-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)' }}>
          {preview ? (
            <PriceImpactTable rows={preview} />
          ) : (
            <button
              type="button"
              onClick={loadPreview}
              disabled={previewLoading}
              className="text-sm font-medium disabled:opacity-60"
              style={{ color: 'var(--accent)' }}
            >
              {previewLoading ? t('common.loading') : `📊 ${t('impact.preview')}`}
            </button>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm transition-colors"
          style={{ border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ background: 'var(--accent)', color: '#000' }}
        >
          {submitting ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </form>
  );
}

// ── Price history modal ────────────────────────────────────────────────────

function PriceHistoryModal({ ingredient, onClose }: { ingredient: Ingredient; onClose: () => void }) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PriceHistory[]>(`/ingredients/${ingredient.id}/price-history`)
      .then((res) => setHistory(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ingredient.id]);

  const chrono = [...history].reverse();
  const prices = chrono.map((h) => Number(h.price));
  const W = 300, H = 60, pad = 6;
  const minP = Math.min(...prices), maxP = Math.max(...prices), rangeP = maxP - minP || 1;

  const svgPoints = prices.map((p, i) => {
    const x = pad + (i / Math.max(prices.length - 1, 1)) * (W - pad * 2);
    const y = pad + ((maxP - p) / rangeP) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <Modal title={t('ingredients.history.title', { name: ingredient.name })} onClose={onClose}>
      {loading ? (
        <div className="flex h-24 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : history.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('ingredients.history.empty')}</p>
      ) : (
        <div className="space-y-4">
          {prices.length > 1 && (
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)' }}>
              <p className="mb-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                {t('ingredients.history.chartLabel', { unit: ingredient.unit })}
              </p>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ color: 'var(--accent)' }}>
                <polyline points={svgPoints} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {chrono.map((_, i) => {
                  const parts = svgPoints.split(' ')[i]?.split(',') ?? [];
                  return <circle key={i} cx={parts[0]} cy={parts[1]} r="3" fill="currentColor" />;
                })}
              </svg>
              <div className="mt-1 flex justify-between text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <span>{fmt(minP)} €</span>
                <span>{fmt(maxP)} €</span>
              </div>
            </div>
          )}
          <ul className="max-h-56 divide-y overflow-y-auto rounded-xl" style={{ borderColor: 'var(--bg-border)', border: '1px solid var(--bg-border)' }}>
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--bg-border)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(Number(h.price))} €</span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-xs font-medium"
                    style={{
                      background: h.source === 'invoice' ? 'rgba(59,130,246,0.15)' : 'var(--bg-tertiary)',
                      color: h.source === 'invoice' ? '#60a5fa' : 'var(--text-secondary)',
                    }}
                  >
                    {h.source === 'invoice' ? t('ingredients.history.invoice') : t('ingredients.history.manual')}
                  </span>
                </div>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmtDateTime(h.recordedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

// ── Delete confirm modal ───────────────────────────────────────────────────

function DeleteModal({ ingredient, onConfirm, onCancel }: {
  ingredient: Ingredient;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try { await onConfirm(); }
    catch (err: any) { setError(err.response?.data?.message ?? t('common.error')); }
    finally { setLoading(false); }
  }

  return (
    <Modal title={t('common.confirmDelete')} onClose={onCancel}>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {t('ingredients.delete.message', { name: ingredient.name })}
      </p>
      {error && (
        <div className="mt-3 rounded-lg px-4 py-2.5 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)' }}>{error}</div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm transition-colors"
          style={{ border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ background: 'var(--red)', color: '#fff' }}
        >
          {loading ? t('common.deleting') : t('common.deleteForever')}
        </button>
      </div>
    </Modal>
  );
}

// ── Filter / sort types ────────────────────────────────────────────────────

type IngSortKey = 'name' | 'price' | 'updatedAt';
type SortDir    = 'asc' | 'desc';
const ING_CATEGORIES = ['all', 'viande', 'poisson', 'légume', 'laitier', 'épicerie', 'condiment', 'fruit', 'autre'] as const;
type IngCategory = typeof ING_CATEGORIES[number];
const KNOWN_CATS = ['viande', 'poisson', 'légume', 'laitier', 'épicerie', 'condiment', 'fruit', 'boisson'];

// ── Page ───────────────────────────────────────────────────────────────────

type ActiveModal =
  | { type: 'create' }
  | { type: 'edit'; ingredient: Ingredient }
  | { type: 'delete'; ingredient: Ingredient }
  | { type: 'history'; ingredient: Ingredient }
  | { type: 'impact'; name: string; rows: PriceImpactRow[] };

export function IngredientsPage() {
  const { t } = useTranslation();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ActiveModal | null>(null);
  const [showOrderSheet, setShowOrderSheet] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<IngCategory>('all');
  const [sortKey, setSortKey] = useState<IngSortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleSort(key: IngSortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  }

  async function load() {
    try {
      const res = await api.get<Ingredient[]>('/ingredients');
      setIngredients(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? t('ingredients.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(form: FormState) {
    await api.post('/ingredients', { name: form.name, unit: form.unit, currentPrice: parseFloat(form.currentPrice), category: form.category || undefined });
    setModal(null);
    await load();
  }

  async function handleEdit(ingredient: Ingredient, form: FormState) {
    const res = await api.put<{ impact?: PriceImpactRow[] }>(`/ingredients/${ingredient.id}`, { name: form.name, unit: form.unit, currentPrice: parseFloat(form.currentPrice), category: form.category || undefined });
    // Un changement de prix qui touche des plats : on montre l'effet tout de suite
    const impact = res.data.impact ?? [];
    setModal(impact.length > 0 ? { type: 'impact', name: form.name, rows: impact } : null);
    await load();
  }

  async function handleDelete(ingredient: Ingredient) {
    await api.delete(`/ingredients/${ingredient.id}`);
    setModal(null);
    await load();
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl px-6 py-5 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}>
        {error}
      </div>
    );
  }

  let displayed = ingredients;
  if (search.trim()) {
    const q = search.toLowerCase();
    displayed = displayed.filter((i) => i.name.toLowerCase().includes(q));
  }
  if (catFilter !== 'all') {
    displayed = displayed.filter((i) => {
      if (catFilter === 'autre') {
        if (!i.category) return true;
        const cat = i.category.toLowerCase();
        return !KNOWN_CATS.some((k) => cat.includes(k));
      }
      return i.category?.toLowerCase().includes(catFilter) ?? false;
    });
  }
  displayed = [...displayed].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name, 'fr');
    else if (sortKey === 'price') cmp = Number(a.currentPrice) - Number(b.currentPrice);
    else cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    return sortDir === 'asc' ? cmp : -cmp;
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
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('ingredients.title')}</h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('ingredients.subtitle', { count: ingredients.length })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowLibrary(true)}
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              style={{ border: '1px solid var(--bg-border)', color: 'var(--text-secondary)', background: 'transparent' }}
            >
              📚 {t('library.button')}
            </button>
            <button
              onClick={() => setShowOrderSheet(true)}
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              style={{ border: '1px solid var(--bg-border)', color: 'var(--text-secondary)', background: 'transparent' }}
            >
              🖨️ {t('orderSheet.button')}
            </button>
            <button
              onClick={() => setModal({ type: 'create' })}
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              <span className="text-base leading-none">+</span>
              {t('ingredients.add')}
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {ingredients.length > 0 && (
          <div
            className="flex flex-col gap-3 rounded-xl p-4"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}
          >
            <div className="flex flex-wrap gap-3">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('ingredients.filters.searchPlaceholder')}
                className="flex-1 min-w-[180px]"
                style={{ ...inputStyle }}
              />
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value as IngCategory)}
                style={{ ...inputStyle }}
              >
                <option value="all">{t('ingredients.filters.allCategories')}</option>
                {ING_CATEGORIES.filter((c) => c !== 'all').map((cat) => (
                  <option key={cat} value={cat}>{t(`ingredients.filters.categories.${cat}`)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['name', 'price', 'updatedAt'] as IngSortKey[]).map((key) => {
                const labels: Record<IngSortKey, string> = {
                  name: t('ingredients.filters.sort.name'),
                  price: t('ingredients.filters.sort.price'),
                  updatedAt: t('ingredients.filters.sort.date'),
                };
                const active = sortKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => toggleSort(key)}
                    className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                    style={{
                      background: active ? 'var(--accent)' : 'var(--bg-tertiary)',
                      color: active ? '#000' : 'var(--text-secondary)',
                    }}
                  >
                    {labels[key]} {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </button>
                );
              })}
              <span className="ml-auto text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('ingredients.filters.displayed', { count: displayed.length })}
              </span>
            </div>
          </div>
        )}

        {/* Empty states */}
        {ingredients.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-xl border-dashed py-16 text-center"
            style={{ border: '2px dashed var(--bg-border)', background: 'var(--bg-secondary)' }}
          >
            <span className="text-4xl">🥕</span>
            <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('ingredients.empty.title')}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('ingredients.empty.desc')}</p>
            <button
              onClick={() => setModal({ type: 'create' })}
              className="mt-4 rounded-lg px-4 py-2 text-sm transition-colors"
              style={{ border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}
            >
              {t('ingredients.add')}
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 rounded-xl border-dashed py-12 text-center"
            style={{ border: '2px dashed var(--bg-border)', background: 'var(--bg-secondary)' }}
          >
            <span className="text-3xl">🔍</span>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('ingredients.filters.noResults')}</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {displayed.map((ing) => (
                <button
                  key={ing.id}
                  onClick={() => setModal({ type: 'edit', ingredient: ing })}
                  className="flex w-full items-center gap-3 rounded-xl p-4 text-left transition-colors active:scale-[0.99]"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', minHeight: '72px' }}
                >
                  <span
                    className="flex-none flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                    style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
                  >
                    {categoryIcon(ing.category)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{ing.name}</p>
                    {ing.category ? (
                      <span
                        className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                      >
                        {ing.category}
                      </span>
                    ) : (
                      <span className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('ingredients.table.name')}</span>
                    )}
                  </div>
                  <div className="flex-none text-right">
                    <p className="text-base font-bold" style={{ color: 'var(--accent)' }}>
                      {fmt(Number(ing.currentPrice))} €
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>/{ing.unit}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop table */}
            <div
              className="hidden md:block rounded-xl"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--bg-border)' }}>
                      {[t('ingredients.table.name'), t('ingredients.table.category'), t('ingredients.table.unit'), t('ingredients.table.currentPrice'), t('ingredients.table.updatedAt'), ''].map((h, i) => (
                        <th
                          key={i}
                          className={`px-5 py-3 text-xs font-medium uppercase tracking-wide text-left${i === 3 || i === 4 ? ' text-right' : ''}`}
                          style={{ color: 'var(--text-tertiary)', background: 'var(--bg-secondary)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((ing) => (
                      <tr
                        key={ing.id}
                        className="group transition-colors"
                        style={{ borderBottom: '1px solid var(--bg-border)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setModal({ type: 'history', ingredient: ing })}
                            className="font-medium underline-offset-2 hover:underline"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {ing.name}
                          </button>
                        </td>
                        <td className="px-5 py-3">
                          {ing.category ? (
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                            >
                              {ing.category}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--bg-border)' }}>—</span>
                          )}
                        </td>
                        <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>{ing.unit}</td>
                        <td className="px-5 py-3 text-right font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {fmt(Number(ing.currentPrice))} €
                        </td>
                        <td className="px-5 py-3 text-right text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {fmtDate(ing.updatedAt)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setModal({ type: 'history', ingredient: ing })}
                              title={t('ingredients.history.title', { name: ing.name })}
                              className="rounded-md p-1.5 transition-colors"
                              style={{ color: 'var(--text-tertiary)' }}
                            >
                              📈
                            </button>
                            <button
                              onClick={() => setModal({ type: 'edit', ingredient: ing })}
                              className="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {t('common.edit')}
                            </button>
                            <button
                              onClick={() => setModal({ type: 'delete', ingredient: ing })}
                              className="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
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
          </>
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'create' && (
        <Modal title={t('ingredients.form.addTitle')} onClose={() => setModal(null)}>
          <IngredientForm initial={EMPTY_FORM} onSave={handleCreate} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title={t('ingredients.form.editTitle', { name: modal.ingredient.name })} wide onClose={() => setModal(null)}>
          <IngredientForm
            ingredientId={modal.ingredient.id}
            initial={{ name: modal.ingredient.name, unit: modal.ingredient.unit, currentPrice: String(Number(modal.ingredient.currentPrice)), category: modal.ingredient.category ?? '' }}
            onSave={(form) => handleEdit(modal.ingredient, form)}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === 'impact' && (
        <Modal title={t('impact.modalTitle', { name: modal.name })} wide onClose={() => setModal(null)}>
          <PriceImpactTable rows={modal.rows} />
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setModal(null)}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              {t('impact.ok')}
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <DeleteModal ingredient={modal.ingredient} onConfirm={() => handleDelete(modal.ingredient)} onCancel={() => setModal(null)} />
      )}
      {modal?.type === 'history' && (
        <PriceHistoryModal ingredient={modal.ingredient} onClose={() => setModal(null)} />
      )}
      {showOrderSheet && <OrderSheetModal onClose={() => setShowOrderSheet(false)} />}
      {showLibrary && <LibraryModal onClose={() => setShowLibrary(false)} onImported={() => { load(); }} />}
    </>
  );
}
