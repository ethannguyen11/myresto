import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { api } from '../api/client';

interface FoodCost {
  totalCost: number;
  ingredientCost: number;
  totalRealCost: number;
  sellingPrice: number;
  foodCostPercent: number;
  realCostPercent: number;
  profitPerDish: number;
  realProfitPerDish: number;
  isRentable: boolean;
  ragStatus: 'green' | 'amber' | 'red';
  status: string;
}

interface Recipe {
  id: number;
  name: string;
  category: string | null;
  sellingPrice: number;
  foodCost: FoodCost;
}

type SortKey = 'name' | 'foodCost' | 'margin' | 'sellingPrice';
type SortDir = 'asc' | 'desc';

function fmt(n: number, dec = 2): string {
  return n.toFixed(dec).replace('.', ',');
}

function ragColor(pct: number): string {
  if (pct <= 25) return 'var(--green)';
  if (pct <= 30) return 'var(--amber)';
  return 'var(--red)';
}

function ragBg(pct: number): string {
  if (pct <= 25) return 'rgba(16,185,129,0.12)';
  if (pct <= 30) return 'rgba(245,158,11,0.12)';
  return 'rgba(239,68,68,0.12)';
}

const PIE_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316',
];

const MEDALS = ['🥇', '🥈', '🥉'];

export function AnalyticsPage() {
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('margin');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    api.get<Recipe[]>('/recipes')
      .then((r) => setRecipes(r.data))
      .catch(() => setError(t('analytics.loadError')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl px-6 py-5 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red)' }}>
        {error}
      </div>
    );
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const sorted = [...recipes].sort((a, b) => {
    if (sortKey === 'name') return sortDir === 'asc'
      ? a.name.localeCompare(b.name)
      : b.name.localeCompare(a.name);
    let va = 0, vb = 0;
    if (sortKey === 'foodCost') { va = a.foodCost.foodCostPercent; vb = b.foodCost.foodCostPercent; }
    if (sortKey === 'margin') { va = a.foodCost.profitPerDish; vb = b.foodCost.profitPerDish; }
    if (sortKey === 'sellingPrice') { va = Number(a.sellingPrice); vb = Number(b.sellingPrice); }
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  const top3 = [...recipes]
    .sort((a, b) => b.foodCost.profitPerDish - a.foodCost.profitPerDish)
    .slice(0, 3);

  const ragGreen = recipes.filter((r) => r.foodCost.ragStatus === 'green').length;
  const ragAmber = recipes.filter((r) => r.foodCost.ragStatus === 'amber').length;
  const ragRed = recipes.filter((r) => r.foodCost.ragStatus === 'red').length;
  const redRecipes = recipes.filter((r) => r.foodCost.ragStatus === 'red');

  const catMap: Record<string, number> = {};
  for (const r of recipes) {
    const cat = r.category ?? t('analytics.otherCategory');
    catMap[cat] = (catMap[cat] ?? 0) + (r.foodCost.ingredientCost ?? r.foodCost.totalCost);
  }
  const pieData = Object.entries(catMap).map(([name, value]) => ({
    name,
    value: Math.round(value * 100) / 100,
  }));

  const avgFC = recipes.length
    ? recipes.reduce((s, r) => s + r.foodCost.foodCostPercent, 0) / recipes.length
    : 0;

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span style={{ color: 'var(--text-tertiary)' }}>↕</span>;
    return <span style={{ color: 'var(--accent)' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('analytics.title')}</h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('analytics.subtitle')}</p>
      </div>

      {/* Top 3 podium */}
      {top3.length > 0 && (
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
            {t('analytics.topMargins')}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {top3.map((r, i) => (
              <div
                key={r.id}
                className="rounded-2xl p-5"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}
              >
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{MEDALS[i]}</span>
                  <span className="text-lg font-bold" style={{ color: ragColor(r.foodCost.foodCostPercent) }}>
                    {fmt(r.foodCost.profitPerDish)} €
                  </span>
                </div>
                <p className="mt-3 font-semibold" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                {r.category && (
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>{r.category}</p>
                )}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <span>{t('analytics.foodCostLabel')}</span>
                    <span className="font-semibold" style={{ color: ragColor(r.foodCost.foodCostPercent) }}>
                      {fmt(r.foodCost.foodCostPercent, 1)} %
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--bg-tertiary)' }}>
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(r.foodCost.foodCostPercent, 100)}%`, background: ragColor(r.foodCost.foodCostPercent) }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RAG analysis */}
      {recipes.length > 0 && (
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
            {t('analytics.rag.title')}
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: t('analytics.rag.green'), count: ragGreen, color: 'var(--green)', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
              { label: t('analytics.rag.amber'), count: ragAmber, color: 'var(--amber)', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
              { label: t('analytics.rag.red'), count: ragRed, color: 'var(--red)', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' },
            ].map(({ label, count, color, bg, border }) => (
              <div key={label} className="rounded-2xl p-5" style={{ background: bg, border: `1px solid ${border}` }}>
                <p className="text-3xl font-bold" style={{ color }}>{count}</p>
                <p className="mt-1 text-sm font-medium" style={{ color }}>{label}</p>
              </div>
            ))}
          </div>

          {redRecipes.length > 0 && (
            <div className="rounded-2xl" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--red)' }}>{t('analytics.rag.redTitle')}</h3>
              </div>
              <div>
                {redRecipes.map((r, i) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between px-5 py-3"
                    style={{ borderTop: i > 0 ? '1px solid var(--bg-border)' : undefined }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('analytics.rag.suggestion')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: 'var(--red)' }}>
                        {fmt(r.foodCost.realCostPercent, 1)} % réel
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>FC {fmt(r.foodCost.foodCostPercent, 1)} %</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {redRecipes.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--green)' }}>{t('analytics.rag.noRed')}</p>
          )}
        </div>
      )}

      {/* Pie chart + summary */}
      {pieData.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
            <h2 className="mb-4 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('analytics.pieTitle')}
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(2)} €`, t('analytics.pieCostLabel')]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
            <h2 className="mb-4 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('analytics.summaryTitle')}
            </h2>
            <div className="space-y-4">
              {[
                { label: t('analytics.summary.avgFoodCost'), value: `${fmt(avgFC, 1)} %`, color: ragColor(avgFC) },
                { label: t('analytics.summary.profitable'), value: `${recipes.filter((r) => r.foodCost.isRentable).length} / ${recipes.length}`, color: 'var(--text-primary)' },
                { label: t('analytics.summary.totalProfit'), value: `${fmt(recipes.reduce((s, r) => s + r.foodCost.profitPerDish, 0))} €`, color: 'var(--green)' },
                { label: t('analytics.summary.nonProfitable'), value: String(recipes.filter((r) => !r.foodCost.isRentable).length), color: 'var(--red)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between pb-3 last:pb-0" style={{ borderBottom: '1px solid var(--bg-border)' }}>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span className="text-lg font-bold" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Full recipe table */}
      <div className="rounded-2xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--bg-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('analytics.tableTitle')}
            <span className="ml-2 font-normal" style={{ color: 'var(--text-tertiary)' }}>({recipes.length})</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-tertiary)' }}>
                {[
                  { key: 'name' as SortKey, label: t('analytics.col.recipe'), align: 'left' },
                  { key: null, label: t('analytics.col.category'), align: 'left', hidden: 'sm' },
                  { key: 'sellingPrice' as SortKey, label: t('analytics.col.price'), align: 'right' },
                  { key: 'foodCost' as SortKey, label: t('analytics.col.foodCost'), align: 'right' },
                  { key: 'margin' as SortKey, label: t('analytics.col.margin'), align: 'right' },
                  { key: null, label: t('analytics.col.fcProgress'), align: 'left', hidden: 'md' },
                ].map(({ key, label, align, hidden }) => (
                  <th
                    key={label}
                    onClick={() => key && toggleSort(key)}
                    className={`px-4 py-3 text-xs font-medium uppercase tracking-wide select-none${key ? ' cursor-pointer' : ''}${hidden === 'sm' ? ' hidden sm:table-cell' : hidden === 'md' ? ' hidden md:table-cell' : ''}`}
                    style={{ color: 'var(--text-tertiary)', textAlign: align as 'left' | 'right' }}
                  >
                    {label} {key && <SortIcon k={key} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, idx) => (
                <tr
                  key={r.id}
                  style={{ borderTop: idx > 0 ? '1px solid var(--bg-border)' : undefined }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    {r.category ? (
                      <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        {r.category}
                      </span>
                    ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {fmt(Number(r.sellingPrice))} €
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ background: ragBg(r.foodCost.foodCostPercent), color: ragColor(r.foodCost.foodCostPercent) }}
                    >
                      {fmt(r.foodCost.foodCostPercent, 1)} %
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: ragColor(r.foodCost.foodCostPercent) }}>
                    {fmt(r.foodCost.profitPerDish)} €
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--bg-tertiary)' }}>
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${Math.min(r.foodCost.foodCostPercent, 100)}%`, background: ragColor(r.foodCost.foodCostPercent) }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
