import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

// ── Types ──────────────────────────────────────────────────────────────────

interface LibraryIngredient {
  idx: number;
  name: string;
  category: string;
  unit: string;
  avgPrice: number;
}

interface Category {
  name: string;
  count: number;
}

// ── Category config ────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  viande:            '🥩',
  poisson:           '🐟',
  légume:            '🥬',
  'produit laitier': '🧈',
  épicerie:          '🫙',
  condiment:         '🧂',
  fruit:             '🍎',
  boisson:           '🥤',
};

const CATEGORY_COLORS: Record<string, string> = {
  viande:            'bg-red-50 text-red-700 ring-red-200',
  poisson:           'bg-blue-50 text-blue-700 ring-blue-200',
  légume:            'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'produit laitier': 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  épicerie:          'bg-orange-50 text-orange-700 ring-orange-200',
  condiment:         'bg-stone-50 text-stone-600 ring-stone-200',
  fruit:             'bg-pink-50 text-pink-700 ring-pink-200',
  boisson:           'bg-cyan-50 text-cyan-700 ring-cyan-200',
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? 'bg-stone-100 text-stone-600 ring-stone-200';
}

function getCategoryIcon(cat: string) {
  return CATEGORY_ICONS[cat] ?? '📦';
}

// ── Modal ──────────────────────────────────────────────────────────────────

export function LibraryModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const { t } = useTranslation();
  const [ingredients, setIngredients] = useState<LibraryIngredient[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState('');

  // Load categories once
  useEffect(() => {
    api.get<Category[]>('/library/categories').then((r) => setCategories(r.data));
  }, []);

  // Search whenever search or category changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (activeCategory !== 'all') params.set('category', activeCategory);

    setLoading(true);
    api
      .get<LibraryIngredient[]>(`/library/ingredients?${params}`)
      .then((r) => setIngredients(r.data))
      .catch(() => setError(t('library.loadError')))
      .finally(() => setLoading(false));
  }, [search, activeCategory]);

  function toggleSelect(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === ingredients.length && ingredients.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(ingredients.map((i) => i.idx)));
    }
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);
    setError('');
    try {
      const res = await api.post<{ imported: number; skipped: number }>('/library/import', {
        indices: [...selected],
      });
      setImportResult(res.data);
      setSelected(new Set());
      onImported();
    } catch {
      setError(t('library.importError'));
    } finally {
      setImporting(false);
    }
  }

  const allSelected = ingredients.length > 0 && selected.size === ingredients.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-8 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-stone-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">📚 {t('library.title')}</h2>
            <p className="mt-0.5 text-sm text-stone-500">{t('library.subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            ✕
          </button>
        </div>

        {/* Search bar */}
        <div className="border-b border-stone-100 px-6 py-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('library.searchPlaceholder')}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto border-b border-stone-100 px-6 py-3">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {t('library.all')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === cat.name
                  ? 'bg-emerald-600 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {getCategoryIcon(cat.name)} {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        {/* Import result banner */}
        {importResult && (
          <div className="mx-6 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            ✅ {t('library.importSuccess', { imported: importResult.imported, skipped: importResult.skipped })}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Select all bar */}
        <div className="flex items-center justify-between px-6 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            {t('library.selectAll')} ({ingredients.length})
          </label>
          <span className="text-xs text-stone-400">
            {selected.size > 0 && t('library.selectedCount', { count: selected.size })}
          </span>
        </div>

        {/* Ingredient list */}
        <div className="max-h-96 overflow-y-auto px-6">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            </div>
          ) : ingredients.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-400">{t('library.empty')}</p>
          ) : (
            <div className="space-y-1 pb-4">
              {ingredients.map((ing) => (
                <label
                  key={ing.idx}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-stone-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(ing.idx)}
                    onChange={() => toggleSelect(ing.idx)}
                    className="h-4 w-4 flex-shrink-0 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="min-w-0 flex-1 text-sm font-medium text-stone-800">
                    {ing.name}
                  </span>
                  <span
                    className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${getCategoryColor(ing.category)}`}
                  >
                    {getCategoryIcon(ing.category)} {ing.category}
                  </span>
                  <span className="flex-shrink-0 text-xs text-stone-400">{ing.unit}</span>
                  <span className="flex-shrink-0 text-xs font-medium text-stone-600">
                    ~{ing.avgPrice.toFixed(2).replace('.', ',')} €
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleImport}
            disabled={selected.size === 0 || importing}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {importing ? t('library.importing') : t('library.import', { count: selected.size })}
          </button>
        </div>
      </div>
    </div>
  );
}
