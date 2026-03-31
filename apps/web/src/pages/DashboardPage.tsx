import { useEffect, useState } from 'react';
import { api } from '../api/client';

// ── Types ──────────────────────────────────────────────────────────────────

interface RecipeSummary {
  id: number;
  name: string;
  category: string | null;
  sellingPrice: number;
  foodCostPercent: number;
  profitPerDish: number;
  status: string;
}

interface PriceEvolution {
  ingredientName: string;
  firstPrice: number;
  lastPrice: number;
  variationPercent: number;
}

interface DashboardData {
  summary: {
    totalRecipes: number;
    averageFoodCost: number;
    rentableCount: number;
    nonRentableCount: number;
    totalPotentialProfit: number;
  };
  topProfitable: RecipeSummary[];
  topExpensive: RecipeSummary[];
  alerts: string[];
  priceEvolution: PriceEvolution[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function foodCostColor(pct: number): string {
  if (pct <= 25) return 'text-emerald-600';
  if (pct <= 30) return 'text-amber-500';
  return 'text-red-500';
}

function foodCostBadge(pct: number): string {
  if (pct <= 25) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (pct <= 30) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  return 'bg-red-50 text-red-700 ring-1 ring-red-200';
}

function avgFoodCostBg(pct: number): string {
  if (pct <= 25) return 'bg-emerald-500';
  if (pct <= 30) return 'bg-amber-500';
  return 'bg-red-500';
}

function alertIcon(alert: string): string {
  if (alert.startsWith('⚠️')) return 'bg-red-50 border-red-100';
  if (alert.startsWith('📈')) return 'bg-amber-50 border-amber-100';
  return 'bg-blue-50 border-blue-100';
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals).replace('.', ',');
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tracking-tight ${accent ?? 'text-stone-900'}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-stone-500">{sub}</p>}
    </div>
  );
}

function RecipeTable({ rows, title }: { rows: RecipeSummary[]; title: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-stone-700">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
              <th className="px-5 py-3">Recette</th>
              <th className="px-5 py-3">Catégorie</th>
              <th className="px-5 py-3 text-right">Prix vente</th>
              <th className="px-5 py-3 text-right">Food cost</th>
              <th className="px-5 py-3 text-right">Marge / plat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-stone-50">
                <td className="px-5 py-3 font-medium text-stone-800">{r.name}</td>
                <td className="px-5 py-3 text-stone-500">{r.category ?? '—'}</td>
                <td className="px-5 py-3 text-right text-stone-700">{fmt(r.sellingPrice)} €</td>
                <td className="px-5 py-3 text-right">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${foodCostBadge(r.foodCostPercent)}`}>
                    {fmt(r.foodCostPercent, 1)} %
                  </span>
                </td>
                <td className={`px-5 py-3 text-right font-semibold ${foodCostColor(r.foodCostPercent)}`}>
                  {fmt(r.profitPerDish)} €
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardData>('/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error('[DashboardPage] GET /dashboard', err);
        setError(err.response?.data?.message ?? 'Impossible de charger le tableau de bord.');
      })
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
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { summary, alerts, topProfitable, topExpensive, priceEvolution } = data;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Tableau de bord</h1>
        <p className="mt-0.5 text-sm text-stone-500">
          Vue globale de la rentabilité de votre menu
        </p>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total recettes"
          value={String(summary.totalRecipes)}
          sub={`${summary.rentableCount} rentables · ${summary.nonRentableCount} à revoir`}
        />
        <KpiCard
          label="Food cost moyen"
          value={`${fmt(summary.averageFoodCost, 1)} %`}
          sub={
            summary.averageFoodCost <= 25
              ? 'Excellent'
              : summary.averageFoodCost <= 30
                ? 'Correct'
                : 'À améliorer'
          }
          accent={avgFoodCostBg(summary.averageFoodCost).replace('bg-', 'text-').replace('-500', '-600')}
        />
        <KpiCard
          label="Rentables vs non rentables"
          value={`${summary.rentableCount} / ${summary.totalRecipes}`}
          sub={
            summary.totalRecipes > 0
              ? `${Math.round((summary.rentableCount / summary.totalRecipes) * 100)} % du menu`
              : undefined
          }
        />
        <KpiCard
          label="Profit potentiel / service"
          value={`${fmt(summary.totalPotentialProfit)} €`}
          sub="Somme des marges brutes"
          accent="text-emerald-600"
        />
      </div>

      {/* ── Alertes ── */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-stone-700">
              Alertes intelligentes{' '}
              <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                {alerts.length}
              </span>
            </h2>
          </div>
          <ul className="divide-y divide-stone-100 p-2">
            {alerts.map((alert, i) => (
              <li
                key={i}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${alertIcon(alert)}`}
              >
                <span className="mt-px shrink-0 text-base leading-none">
                  {alert.slice(0, 2)}
                </span>
                <span className="text-stone-700">{alert.slice(3)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Tables côte à côte sur grand écran ── */}
      <div className="grid gap-6 xl:grid-cols-2">
        <RecipeTable title="Top 3 — Meilleures marges" rows={topProfitable} />
        <RecipeTable title="Top 3 — Food cost le plus élevé" rows={topExpensive} />
      </div>

      {/* ── Évolution des prix ── */}
      {priceEvolution.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-stone-700">Évolution des prix ingrédients</h2>
          </div>
          <ul className="divide-y divide-stone-100">
            {priceEvolution.map((item) => {
              const positive = item.variationPercent >= 0;
              return (
                <li key={item.ingredientName} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="flex-1 text-sm font-medium text-stone-800">
                    {item.ingredientName}
                  </span>
                  <span className="text-sm text-stone-400">
                    {fmt(item.firstPrice)} € → {fmt(item.lastPrice)} €
                  </span>
                  <span
                    className={`w-20 rounded-full px-2 py-0.5 text-right text-xs font-semibold ${
                      positive
                        ? 'bg-red-50 text-red-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {positive ? '+' : ''}
                    {fmt(item.variationPercent, 1)} %
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

    </div>
  );
}
