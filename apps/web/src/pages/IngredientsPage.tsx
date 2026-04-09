import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { OrderSheetModal } from '../components/OrderSheetModal';
import { LibraryModal } from '../components/LibraryModal';

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

// ── Category badge colors ──────────────────────────────────────────────────

const CATEGORY_COLORS: [string, string][] = [
  ['viande',   'bg-red-50 text-red-700 ring-red-200'],
  ['poisson',  'bg-blue-50 text-blue-700 ring-blue-200'],
  ['légume',   'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  ['fruit',    'bg-orange-50 text-orange-700 ring-orange-200'],
  ['épicerie', 'bg-amber-50 text-amber-700 ring-amber-200'],
  ['laitier',  'bg-sky-50 text-sky-700 ring-sky-200'],
  ['boisson',  'bg-purple-50 text-purple-700 ring-purple-200'],
];

function categoryBadge(cat: string | null): string {
  if (!cat) return 'bg-stone-100 text-stone-500 ring-stone-200';
  const key = cat.toLowerCase();
  const match = CATEGORY_COLORS.find(([k]) => key.includes(k));
  return match ? match[1] : 'bg-stone-100 text-stone-600 ring-stone-200';
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

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white shadow-xl">
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

// ── Ingredient form ────────────────────────────────────────────────────────

function IngredientForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: FormState;
  onSave: (data: FormState) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function field(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onSave(form);
    } catch (err: any) {
      setError(err.response?.data?.message ?? t('common.error'));
    } finally {
      setSubmitting(false);
    }
  }

  const input =
    'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 ' +
    'placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';
  const label = 'mb-1.5 block text-xs font-medium text-stone-600';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}

      <div>
        <label className={label}>{t('ingredients.form.name')}</label>
        <input
          className={input}
          required
          value={form.name}
          onChange={field('name')}
          placeholder={t('ingredients.form.namePlaceholder')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t('ingredients.form.unit')}</label>
          <input
            className={input}
            required
            value={form.unit}
            onChange={field('unit')}
            placeholder={t('ingredients.form.unitPlaceholder')}
          />
        </div>
        <div>
          <label className={label}>{t('ingredients.form.price')}</label>
          <input
            className={input}
            required
            type="number"
            min="0"
            step="0.01"
            value={form.currentPrice}
            onChange={field('currentPrice')}
            placeholder={t('ingredients.form.pricePlaceholder')}
          />
        </div>
      </div>

      <div>
        <label className={label}>{t('ingredients.form.category')}</label>
        <input
          className={input}
          value={form.category}
          onChange={field('category')}
          placeholder={t('ingredients.form.categoryPlaceholder')}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-50"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </form>
  );
}

// ── Price history modal ────────────────────────────────────────────────────

function PriceHistoryModal({
  ingredient,
  onClose,
}: {
  ingredient: Ingredient;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<PriceHistory[]>(`/ingredients/${ingredient.id}/price-history`)
      .then((res) => setHistory(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ingredient.id]);

  // Chronological for sparkline
  const chrono = [...history].reverse();
  const prices = chrono.map((h) => Number(h.price));
  const W = 300;
  const H = 60;
  const pad = 6;
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const rangeP = maxP - minP || 1;

  const svgPoints = prices
    .map((p, i) => {
      const x = pad + (i / Math.max(prices.length - 1, 1)) * (W - pad * 2);
      const y = pad + ((maxP - p) / rangeP) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <Modal title={t('ingredients.history.title', { name: ingredient.name })} onClose={onClose}>
      {loading ? (
        <div className="flex h-24 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      ) : history.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-400">{t('ingredients.history.empty')}</p>
      ) : (
        <div className="space-y-4">
          {/* Sparkline */}
          {prices.length > 1 && (
            <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
              <p className="mb-2 text-xs font-medium text-stone-400">
                {t('ingredients.history.chartLabel', { unit: ingredient.unit })}
              </p>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-emerald-500">
                <polyline
                  points={svgPoints}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {chrono.map((_, i) => {
                  const parts = svgPoints.split(' ')[i]?.split(',') ?? [];
                  return (
                    <circle
                      key={i}
                      cx={parts[0]}
                      cy={parts[1]}
                      r="3"
                      fill="currentColor"
                    />
                  );
                })}
              </svg>
              <div className="mt-1 flex justify-between text-xs text-stone-400">
                <span>{fmt(minP)} €</span>
                <span>{fmt(maxP)} €</span>
              </div>
            </div>
          )}

          {/* Chronological list */}
          <ul className="max-h-56 divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-100">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-stone-800">
                    {fmt(Number(h.price))} €
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                      h.source === 'invoice'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {h.source === 'invoice' ? t('ingredients.history.invoice') : t('ingredients.history.manual')}
                  </span>
                </div>
                <span className="text-xs text-stone-400">{fmtDateTime(h.recordedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

// ── Delete confirm modal ───────────────────────────────────────────────────

function DeleteModal({
  ingredient,
  onConfirm,
  onCancel,
}: {
  ingredient: Ingredient;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={t('common.confirmDelete')} onClose={onCancel}>
      <p className="text-sm text-stone-600">
        {t('ingredients.delete.message', { name: ingredient.name })}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-50"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
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
  | { type: 'history'; ingredient: Ingredient };

export function IngredientsPage() {
  const { t } = useTranslation();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ActiveModal | null>(null);
  const [showOrderSheet, setShowOrderSheet] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  // ── Filter & sort state ──
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
      console.error('[IngredientsPage] GET /ingredients', err);
      setError(err.response?.data?.message ?? t('ingredients.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(form: FormState) {
    await api.post('/ingredients', {
      name: form.name,
      unit: form.unit,
      currentPrice: parseFloat(form.currentPrice),
      category: form.category || undefined,
    });
    setModal(null);
    await load();
  }

  async function handleEdit(ingredient: Ingredient, form: FormState) {
    await api.put(`/ingredients/${ingredient.id}`, {
      name: form.name,
      unit: form.unit,
      currentPrice: parseFloat(form.currentPrice),
      category: form.category || undefined,
    });
    setModal(null);
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

  // ── Filtered + sorted list ──
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

  const inputCls = 'rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white';

  return (
    <>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-stone-900 dark:text-white">{t('ingredients.title')}</h1>
            <p className="mt-0.5 text-sm text-stone-500 dark:text-gray-400">
              {t('ingredients.subtitle', { count: ingredients.length })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowLibrary(true)}
              className="flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              📚 {t('library.button')}
            </button>
            <button
              onClick={() => setShowOrderSheet(true)}
              className="flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              🖨️ {t('orderSheet.button')}
            </button>
            <button
              onClick={() => setModal({ type: 'create' })}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <span className="text-base leading-none">+</span>
              {t('ingredients.add')}
            </button>
          </div>
        </div>

        {/* ── Filter bar ── */}
        {ingredients.length > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            {/* Row 1: search + category */}
            <div className="flex flex-wrap gap-3">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('ingredients.filters.searchPlaceholder')}
                className={`flex-1 min-w-[180px] ${inputCls}`}
              />
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value as IngCategory)}
                className={inputCls}
              >
                <option value="all">{t('ingredients.filters.allCategories')}</option>
                {ING_CATEGORIES.filter((c) => c !== 'all').map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`ingredients.filters.categories.${cat}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 2: sort buttons + counter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-stone-400 dark:text-gray-500 mr-1">
                {t('ingredients.filters.sort.name')}
              </span>
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
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {labels[key]} {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </button>
                );
              })}
              <span className="ml-auto text-xs text-stone-400 dark:text-gray-500">
                {t('ingredients.filters.displayed', { count: displayed.length })}
              </span>
            </div>
          </div>
        )}

        {/* Empty state — no ingredients at all */}
        {ingredients.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white py-16 text-center dark:border-gray-700 dark:bg-gray-800">
            <span className="text-4xl">🥕</span>
            <p className="mt-3 text-sm font-medium text-stone-700 dark:text-gray-200">{t('ingredients.empty.title')}</p>
            <p className="mt-1 text-xs text-stone-400 dark:text-gray-500">{t('ingredients.empty.desc')}</p>
            <button
              onClick={() => setModal({ type: 'create' })}
              className="mt-4 rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-50"
            >
              {t('ingredients.add')}
            </button>
          </div>
        ) : displayed.length === 0 ? (
          /* No results for active filters */
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white py-12 text-center dark:border-gray-700 dark:bg-gray-800">
            <span className="text-3xl">🔍</span>
            <p className="text-sm text-stone-500 dark:text-gray-400">{t('ingredients.filters.noResults')}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-medium uppercase tracking-wide text-stone-400 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-500">
                    <th className="px-5 py-3">{t('ingredients.table.name')}</th>
                    <th className="px-5 py-3">{t('ingredients.table.category')}</th>
                    <th className="px-5 py-3">{t('ingredients.table.unit')}</th>
                    <th className="px-5 py-3 text-right">{t('ingredients.table.currentPrice')}</th>
                    <th className="px-5 py-3 text-right">{t('ingredients.table.updatedAt')}</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                  {displayed.map((ing) => (
                    <tr key={ing.id} className="group hover:bg-stone-50 dark:hover:bg-gray-700/40">
                      {/* Name — cliquable pour l'historique */}
                      <td className="px-5 py-3">
                        <button
                          onClick={() => setModal({ type: 'history', ingredient: ing })}
                          className="font-medium text-stone-800 underline-offset-2 hover:text-emerald-600 hover:underline dark:text-gray-100"
                        >
                          {ing.name}
                        </button>
                      </td>

                      {/* Category badge */}
                      <td className="px-5 py-3">
                        {ing.category ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${categoryBadge(ing.category)}`}
                          >
                            {ing.category}
                          </span>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3 text-stone-500 dark:text-gray-400">{ing.unit}</td>

                      <td className="px-5 py-3 text-right font-semibold text-stone-800 dark:text-gray-100">
                        {fmt(Number(ing.currentPrice))} €
                      </td>

                      <td className="px-5 py-3 text-right text-xs text-stone-400 dark:text-gray-500">
                        {fmtDate(ing.updatedAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                          <button
                            onClick={() => setModal({ type: 'history', ingredient: ing })}
                            title={t('ingredients.history.title', { name: ing.name })}
                            className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                          >
                            📈
                          </button>
                          <button
                            onClick={() => setModal({ type: 'edit', ingredient: ing })}
                            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => setModal({ type: 'delete', ingredient: ing })}
                            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50"
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
      {modal?.type === 'create' && (
        <Modal title={t('ingredients.form.addTitle')} onClose={() => setModal(null)}>
          <IngredientForm
            initial={EMPTY_FORM}
            onSave={handleCreate}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === 'edit' && (
        <Modal
          title={t('ingredients.form.editTitle', { name: modal.ingredient.name })}
          onClose={() => setModal(null)}
        >
          <IngredientForm
            initial={{
              name: modal.ingredient.name,
              unit: modal.ingredient.unit,
              currentPrice: String(Number(modal.ingredient.currentPrice)),
              category: modal.ingredient.category ?? '',
            }}
            onSave={(form) => handleEdit(modal.ingredient, form)}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === 'delete' && (
        <DeleteModal
          ingredient={modal.ingredient}
          onConfirm={() => handleDelete(modal.ingredient)}
          onCancel={() => setModal(null)}
        />
      )}

      {modal?.type === 'history' && (
        <PriceHistoryModal
          ingredient={modal.ingredient}
          onClose={() => setModal(null)}
        />
      )}

      {showOrderSheet && (
        <OrderSheetModal onClose={() => setShowOrderSheet(false)} />
      )}

      {showLibrary && (
        <LibraryModal
          onClose={() => setShowLibrary(false)}
          onImported={() => { load(); }}
        />
      )}
    </>
  );
}
