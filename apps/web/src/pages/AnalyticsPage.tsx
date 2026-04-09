import { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { api } from '../api/client';

// ── Types ──────────────────────────────────────────────────────────────────

interface FoodCost {
  totalCost: number;
  sellingPrice: number;
  foodCostPercent: number;
  profitPerDish: number;
  isRentable: boolean;
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

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 2): string {
  return n.toFixed(dec).replace('.', ',');
}

function foodCostColor(pct: number): string {
  if (pct <= 25) return 'text-emerald-600 dark:text-emerald-400';
  if (pct <= 30) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function foodCostBarColor(pct: number): string {
  if (pct <= 25) return 'bg-emerald-500';
  if (pct <= 30) return 'bg-amber-500';
  return 'bg-red-500';
}

const PIE_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316',
];

const MEDALS = ['🥇', '🥈', '🥉'];

// ── Page ───────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('margin');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    api.get<Recipe[]>('/recipes')
      .then((r) => setRecipes(r.data))
      .catch(() => setError('Impossible de charger les recettes.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
        {error}
      </div>
    );
  }

  // Sort
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const sorted = [...recipes].sort((a, b) => {
    let va = 0, vb = 0;
    if (sortKey === 'name') return sortDir === 'asc'
      ? a.name.localeCompare(b.name)
      : b.name.localeCompare(a.name);
    if (sortKey === 'foodCost') { va = a.foodCost.foodCostPercent; vb = b.foodCost.foodCostPercent; }
    if (sortKey === 'margin') { va = a.foodCost.profitPerDish; vb = b.foodCost.profitPerDish; }
    if (sortKey === 'sellingPrice') { va = Number(a.sellingPrice); vb = Number(b.sellingPrice); }
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  // Top 3 by margin
  const top3 = [...recipes]
    .sort((a, b) => b.foodCost.profitPerDish - a.foodCost.profitPerDish)
    .slice(0, 3);

  // Pie: cost per category
  const catMap: Record<string, number> = {};
  for (const r of recipes) {
    const cat = r.category ?? 'Autre';
    catMap[cat] = (catMap[cat] ?? 0) + r.foodCost.totalCost;
  }
  const pieData = Object.entries(catMap).map(([name, value]) => ({
    name,
    value: Math.round(value * 100) / 100,
  }));

  const avgFC = recipes.length
    ? recipes.reduce((s, r) => s + r.foodCost.foodCostPercent, 0) / recipes.length
    : 0;

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-stone-300 dark:text-gray-600">↕</span>;
    return <span className="text-emerald-600">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const thCls = 'px-4 py-3 text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-gray-500 cursor-pointer select-none hover:text-stone-600 dark:hover:text-gray-300';

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-stone-900 dark:text-white">📊 Analytiques</h1>
        <p className="mt-0.5 text-sm text-stone-500 dark:text-gray-400">
          Analyse détaillée de la rentabilité de votre carte
        </p>
      </div>

      {/* ── Top 3 podium ── */}
      {top3.length > 0 && (
        <div>
          <h2 className="mb-4 text-sm font-semibold text-stone-500 uppercase tracking-wide dark:text-gray-400">
            Meilleures marges
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {top3.map((r, i) => (
              <div
                key={r.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{MEDALS[i]}</span>
                  <span className={`text-lg font-bold ${foodCostColor(r.foodCost.foodCostPercent)}`}>
                    {fmt(r.foodCost.profitPerDish)} €
                  </span>
                </div>
                <p className="mt-3 font-semibold text-stone-800 dark:text-white">{r.name}</p>
                {r.category && (
                  <p className="mt-0.5 text-xs text-stone-400 dark:text-gray-500">{r.category}</p>
                )}
                {/* Food cost bar */}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-stone-400 dark:text-gray-500">
                    <span>Food cost</span>
                    <span className={`font-semibold ${foodCostColor(r.foodCost.foodCostPercent)}`}>
                      {fmt(r.foodCost.foodCostPercent, 1)} %
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-stone-100 dark:bg-gray-700">
                    <div
                      className={`h-1.5 rounded-full transition-all ${foodCostBarColor(r.foodCost.foodCostPercent)}`}
                      style={{ width: `${Math.min(r.foodCost.foodCostPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pie chart + avg FC ── */}
      {pieData.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pie chart */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-sm font-semibold text-stone-700 dark:text-gray-200">
              Coût ingrédients par catégorie
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
                  formatter={(v: number) => [`${v.toFixed(2)} €`, 'Coût']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Summary stats */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-sm font-semibold text-stone-700 dark:text-gray-200">
              Résumé global
            </h2>
            <div className="space-y-4">
              {[
                { label: 'Food cost moyen', value: `${fmt(avgFC, 1)} %`, color: foodCostColor(avgFC) },
                {
                  label: 'Recettes rentables',
                  value: `${recipes.filter((r) => r.foodCost.isRentable).length} / ${recipes.length}`,
                  color: 'text-stone-800 dark:text-white',
                },
                {
                  label: 'Profit total / service',
                  value: `${fmt(recipes.reduce((s, r) => s + r.foodCost.profitPerDish, 0))} €`,
                  color: 'text-emerald-600 dark:text-emerald-400',
                },
                {
                  label: 'Recettes non rentables',
                  value: String(recipes.filter((r) => !r.foodCost.isRentable).length),
                  color: 'text-red-600 dark:text-red-400',
                },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between border-b border-stone-100 pb-3 last:border-0 last:pb-0 dark:border-gray-700">
                  <span className="text-sm text-stone-500 dark:text-gray-400">{label}</span>
                  <span className={`text-lg font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Full recipe table ── */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-stone-100 px-5 py-4 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-stone-700 dark:text-gray-200">
            Toutes les recettes
            <span className="ml-2 text-stone-400 dark:text-gray-500 font-normal">({recipes.length})</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50 text-left dark:border-gray-700 dark:bg-gray-900/50">
                <th className={thCls} onClick={() => toggleSort('name')}>
                  Recette <SortIcon k="name" />
                </th>
                <th className={`${thCls} hidden sm:table-cell`}>Catégorie</th>
                <th className={`${thCls} text-right`} onClick={() => toggleSort('sellingPrice')}>
                  Prix <SortIcon k="sellingPrice" />
                </th>
                <th className={`${thCls} text-right`} onClick={() => toggleSort('foodCost')}>
                  Food cost <SortIcon k="foodCost" />
                </th>
                <th className={`${thCls} text-right`} onClick={() => toggleSort('margin')}>
                  Marge <SortIcon k="margin" />
                </th>
                <th className={`${thCls} hidden md:table-cell`}>Progression FC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
              {sorted.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50 dark:hover:bg-gray-700/40">
                  <td className="px-4 py-3 font-medium text-stone-800 dark:text-gray-100">{r.name}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    {r.category ? (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 dark:bg-gray-700 dark:text-gray-300">
                        {r.category}
                      </span>
                    ) : <span className="text-stone-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-stone-600 dark:text-gray-300">
                    {fmt(Number(r.sellingPrice))} €
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${foodCostColor(r.foodCost.foodCostPercent)}`}>
                      {fmt(r.foodCost.foodCostPercent, 1)} %
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${foodCostColor(r.foodCost.foodCostPercent)}`}>
                    {fmt(r.foodCost.profitPerDish)} €
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-stone-100 dark:bg-gray-700">
                        <div
                          className={`h-1.5 rounded-full ${foodCostBarColor(r.foodCost.foodCostPercent)}`}
                          style={{ width: `${Math.min(r.foodCost.foodCostPercent, 100)}%` }}
                        />
                      </div>
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
