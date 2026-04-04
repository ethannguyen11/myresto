import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

// ── Weekly alert banner ────────────────────────────────────────────────────

type AlertSeverity = 'info' | 'warning' | 'critical';

interface WeeklyAlertData {
  alert: string;
  generatedAt: string;
  severity: AlertSeverity;
}

function WeeklyAlertBanner() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [data, setData] = useState<WeeklyAlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.get<WeeklyAlertData>('/advisor/weekly-alert')
      .then((res) => setData(res.data))
      .catch(() => { /* silently skip — non-critical */ })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data || dismissed) return null;

  const styles: Record<AlertSeverity, { wrapper: string; dot: string; label: string; btn: string }> = {
    info: {
      wrapper: 'border-emerald-200 bg-emerald-50',
      dot: 'bg-emerald-500',
      label: 'text-emerald-800',
      btn: 'border-emerald-300 text-emerald-700 hover:bg-emerald-100',
    },
    warning: {
      wrapper: 'border-amber-200 bg-amber-50',
      dot: 'bg-amber-500',
      label: 'text-amber-800',
      btn: 'border-amber-300 text-amber-700 hover:bg-amber-100',
    },
    critical: {
      wrapper: 'border-red-200 bg-red-50',
      dot: 'bg-red-500',
      label: 'text-red-800',
      btn: 'border-red-300 text-red-700 hover:bg-red-100',
    },
  };

  const s = styles[data.severity];
  const icon = data.severity === 'critical' ? '🚨' : data.severity === 'warning' ? '⚠️' : '📊';
  const severityLabel =
    data.severity === 'critical' ? t('dashboard.weekly.critical') :
    data.severity === 'warning' ? t('dashboard.weekly.warning') : t('dashboard.weekly.info');

  return (
    <div className={`rounded-xl border px-5 py-4 ${s.wrapper}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-xl leading-none">{icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-2 w-2 rounded-full ${s.dot}`} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${s.label}`}>
                {severityLabel}
              </span>
            </div>
            <p className={`mt-1.5 text-sm leading-relaxed ${s.label}`}>{data.alert}</p>
            <p className="mt-1 text-xs opacity-60" style={{ color: 'inherit' }}>
              {t('dashboard.weekly.generatedOn')}{' '}
              {new Date(data.generatedAt).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => navigate('/advisor')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${s.btn}`}
          >
            {t('dashboard.weekly.seeDetails')}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-black/5 hover:text-stone-600"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
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
  const { t } = useTranslation();
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
              <th className="px-5 py-3">{t('dashboard.tables.recipe')}</th>
              <th className="px-5 py-3">{t('dashboard.tables.category')}</th>
              <th className="px-5 py-3 text-right">{t('dashboard.tables.sellingPrice')}</th>
              <th className="px-5 py-3 text-right">{t('dashboard.tables.foodCost')}</th>
              <th className="px-5 py-3 text-right">{t('dashboard.tables.margin')}</th>
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
  const { t } = useTranslation();
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

  const fcSub =
    summary.averageFoodCost <= 25
      ? t('dashboard.kpi.fcExcellent')
      : summary.averageFoodCost <= 30
        ? t('dashboard.kpi.fcCorrect')
        : t('dashboard.kpi.fcImprove');

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-stone-900">{t('dashboard.title')}</h1>
        <p className="mt-0.5 text-sm text-stone-500">{t('dashboard.subtitle')}</p>
      </div>

      {/* ── Alerte hebdomadaire ── */}
      <WeeklyAlertBanner />

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label={t('dashboard.kpi.totalRecipes')}
          value={String(summary.totalRecipes)}
          sub={t('dashboard.kpi.rentableSub', { rentable: summary.rentableCount, nonRentable: summary.nonRentableCount })}
        />
        <KpiCard
          label={t('dashboard.kpi.avgFoodCost')}
          value={`${fmt(summary.averageFoodCost, 1)} %`}
          sub={fcSub}
          accent={avgFoodCostBg(summary.averageFoodCost).replace('bg-', 'text-').replace('-500', '-600')}
        />
        <KpiCard
          label={t('dashboard.kpi.rentableRatio')}
          value={`${summary.rentableCount} / ${summary.totalRecipes}`}
          sub={
            summary.totalRecipes > 0
              ? t('dashboard.kpi.ratioSub', { pct: Math.round((summary.rentableCount / summary.totalRecipes) * 100) })
              : undefined
          }
        />
        <KpiCard
          label={t('dashboard.kpi.profit')}
          value={`${fmt(summary.totalPotentialProfit)} €`}
          sub={t('dashboard.kpi.profitSub')}
          accent="text-emerald-600"
        />
      </div>

      {/* ── Alertes ── */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-stone-700">
              {t('dashboard.alerts.title')}{' '}
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
        <RecipeTable title={t('dashboard.tables.topProfitable')} rows={topProfitable} />
        <RecipeTable title={t('dashboard.tables.topExpensive')} rows={topExpensive} />
      </div>

      {/* ── Évolution des prix ── */}
      {priceEvolution.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-stone-700">{t('dashboard.priceEvolution.title')}</h2>
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
