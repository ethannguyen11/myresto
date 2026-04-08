import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

// ── Types ──────────────────────────────────────────────────────────────────

interface OrderIngredient {
  id: number;
  name: string;
  unit: string;
  currentPrice: number;
  category: string | null;
}

interface OrderCategory {
  name: string;
  ingredients: OrderIngredient[];
}

interface OrderSheet {
  categories: OrderCategory[];
  total: number;
}

// ── Category config ────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; printColor: string }> = {
  viande:          { icon: '🥩', color: 'text-red-700 bg-red-50 border-red-200',       printColor: '#b91c1c' },
  poisson:         { icon: '🐟', color: 'text-blue-700 bg-blue-50 border-blue-200',     printColor: '#1d4ed8' },
  légume:          { icon: '🥬', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', printColor: '#047857' },
  'produit laitier': { icon: '🧈', color: 'text-yellow-700 bg-yellow-50 border-yellow-200', printColor: '#a16207' },
  épicerie:        { icon: '🫙', color: 'text-orange-700 bg-orange-50 border-orange-200', printColor: '#c2410c' },
  condiment:       { icon: '🧂', color: 'text-stone-600 bg-stone-50 border-stone-200',  printColor: '#44403c' },
  fruit:           { icon: '🍎', color: 'text-pink-700 bg-pink-50 border-pink-200',     printColor: '#be185d' },
  boisson:         { icon: '🥤', color: 'text-cyan-700 bg-cyan-50 border-cyan-200',     printColor: '#0e7490' },
  autre:           { icon: '📦', color: 'text-violet-700 bg-violet-50 border-violet-200', printColor: '#6d28d9' },
};

function getCategoryConfig(name: string) {
  const key = Object.keys(CATEGORY_CONFIG).find((k) => name.toLowerCase().includes(k));
  return key ? CATEGORY_CONFIG[key] : CATEGORY_CONFIG.autre;
}

function todayStr() {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}

// ── Print styles ───────────────────────────────────────────────────────────

const PRINT_STYLES = `
@media print {
  body * { visibility: hidden !important; }
  #order-sheet-printable, #order-sheet-printable * { visibility: visible !important; }
  #order-sheet-printable { position: fixed; inset: 0; background: white; z-index: 99999; padding: 12mm 15mm; }
  .no-print { display: none !important; }
  .qty-input { border: none !important; border-bottom: 1.5px dotted #d6d3d1 !important; background: transparent !important; outline: none !important; -webkit-appearance: none; }
  @page { size: A4 portrait; margin: 0; }
}
`;

// ── Modal ──────────────────────────────────────────────────────────────────

export function OrderSheetModal({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [sheet, setSheet] = useState<OrderSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restaurant, setRestaurant] = useState('Mon Restaurant');
  const [date, setDate] = useState(todayStr());
  const [deadline, setDeadline] = useState('16h00');
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const overlayRef = useRef<HTMLDivElement>(null);

  // Inject print styles
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'order-sheet-print-css';
    style.textContent = PRINT_STYLES;
    document.head.appendChild(style);
    return () => document.getElementById('order-sheet-print-css')?.remove();
  }, []);

  useEffect(() => {
    api.get<OrderSheet>('/ingredients/order-sheet')
      .then((r) => setSheet(r.data))
      .catch(() => setError(t('orderSheet.loadError')))
      .finally(() => setLoading(false));
  }, []);

  const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-GB';
  const printDate = new Date().toLocaleDateString(locale, {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-8 backdrop-blur-sm no-print"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* ── Controls bar (hidden on print) ── */}
      <div className="no-print mb-4 flex w-full max-w-4xl items-center justify-between rounded-xl border border-stone-200 bg-white px-5 py-3 shadow-sm">
        <span className="text-sm font-semibold text-stone-800">{t('orderSheet.title')}</span>
        <div className="flex items-center gap-3">
          {/* Restaurant name */}
          <input
            type="text"
            value={restaurant}
            onChange={(e) => setRestaurant(e.target.value)}
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            placeholder={t('orderSheet.restaurantPlaceholder')}
          />
          {/* Date */}
          <input
            type="text"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-52 rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          {/* Deadline */}
          <input
            type="text"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-20 rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            placeholder="16h00"
          />
          {/* Print */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            🖨️ {t('orderSheet.print')}
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Printable content ── */}
      <div
        id="order-sheet-printable"
        className="w-full max-w-4xl rounded-2xl border border-stone-200 bg-white shadow-xl"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {/* Header */}
        <div className="border-b border-stone-200 px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-3xl">🍳</span>
                <div>
                  <h1 className="text-xl font-bold text-stone-900">Chef IA</h1>
                  <p className="text-sm text-stone-500">{restaurant}</p>
                </div>
              </div>
              <h2 className="mt-4 text-2xl font-bold text-stone-900">{t('orderSheet.heading')}</h2>
              <p className="mt-1 text-sm text-stone-500">
                {t('orderSheet.orderBefore', { time: deadline })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-stone-800">{date}</p>
              {sheet && (
                <p className="mt-1 text-sm text-stone-400">
                  {t('orderSheet.ingredientCount', { count: sheet.total })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-8">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          ) : sheet && sheet.categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-400">{t('orderSheet.empty')}</p>
          ) : sheet ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px',
              }}
            >
              {sheet.categories.map((cat) => {
                const cfg = getCategoryConfig(cat.name);
                return (
                  <div key={cat.name} className="break-inside-avoid">
                    {/* Category header */}
                    <div
                      className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 ${cfg.color}`}
                    >
                      <span className="text-lg">{cfg.icon}</span>
                      <span
                        className="text-sm font-bold uppercase tracking-wide"
                        style={{ color: cfg.printColor }}
                      >
                        {cat.name}
                      </span>
                      <span className="ml-auto text-xs opacity-60">
                        {cat.ingredients.length}
                      </span>
                    </div>

                    {/* Ingredient rows */}
                    <div className="space-y-1">
                      {cat.ingredients.map((ing) => (
                        <div key={ing.id} className="flex items-baseline gap-2 py-1">
                          {/* Checkbox */}
                          <span
                            className="inline-block flex-shrink-0 rounded border border-stone-300"
                            style={{ width: '14px', height: '14px', marginTop: '2px' }}
                          />
                          {/* Name + unit */}
                          <span className="flex-shrink-0 text-sm font-medium text-stone-800">
                            {ing.name}
                          </span>
                          <span className="text-xs text-stone-400">({ing.unit})</span>
                          {/* Dotted line */}
                          <span
                            className="flex-1"
                            style={{ borderBottom: '1.5px dotted #d6d3d1', minWidth: '24px' }}
                          />
                          {/* Editable quantity */}
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder="0"
                            value={quantities[ing.id] ?? ''}
                            onChange={(e) =>
                              setQuantities((q) => ({ ...q, [ing.id]: e.target.value }))
                            }
                            className="qty-input flex-shrink-0 text-right text-sm font-medium text-stone-800"
                            style={{
                              width: '60px',
                              borderBottom: '1.5px dotted #d6d3d1',
                              background: 'transparent',
                              outline: 'none',
                              WebkitAppearance: 'none',
                              MozAppearance: 'textfield',
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Notes */}
                    <div
                      className="mt-3 rounded-lg border border-dashed border-stone-200 px-3 py-2"
                      style={{ minHeight: '36px' }}
                    >
                      <p className="text-xs text-stone-300">{t('orderSheet.notes')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-stone-100 px-8 py-4">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Chef IA — chefai.fr</span>
            <span>{t('common.generatedOn')} {printDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
