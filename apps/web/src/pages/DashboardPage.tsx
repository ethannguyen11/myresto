import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
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
  ragStatus?: 'green' | 'amber' | 'red';
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

type AlertSeverity = 'info' | 'warning' | 'critical';
interface WeeklyAlertData {
  alert: string;
  generatedAt: string;
  severity: AlertSeverity;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 2): string {
  return n.toFixed(dec).replace('.', ',');
}

function ragDot(pct: number): string {
  if (pct <= 30) return '🟢';
  if (pct <= 40) return '🟡';
  return '🔴';
}

function ragBorderColor(status: 'green' | 'amber' | 'red' | undefined): string {
  if (status === 'green') return '#16a34a';
  if (status === 'amber') return '#d97706';
  return '#dc2626';
}

const LINE_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

// ── Weekly alert banner ────────────────────────────────────────────────────

function WeeklyAlertBanner() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [data, setData] = useState<WeeklyAlertData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.get<WeeklyAlertData>('/advisor/weekly-alert')
      .then((res) => setData(res.data))
      .catch(() => {});
  }, []);

  if (!data || dismissed) return null;

  const styles: Record<AlertSeverity, { wrapper: string; dot: string; label: string; btn: string }> = {
    info: {
      wrapper: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20',
      dot: 'bg-emerald-500', label: 'text-emerald-800 dark:text-emerald-300',
      btn: 'border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30',
    },
    warning: {
      wrapper: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20',
      dot: 'bg-amber-500', label: 'text-amber-800 dark:text-amber-300',
      btn: 'border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/30',
    },
    critical: {
      wrapper: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
      dot: 'bg-red-500', label: 'text-red-800 dark:text-red-300',
      btn: 'border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30',
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
              <span className={`text-xs font-semibold uppercase tracking-wide ${s.label}`}>{severityLabel}</span>
            </div>
            <p className={`mt-1.5 text-sm leading-relaxed ${s.label}`}>{data.alert}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/advisor')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${s.btn}`}
          >
            {t('dashboard.weekly.seeDetails')}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-black/5 hover:text-stone-600 dark:hover:bg-white/5"
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

// ── Quick action card ──────────────────────────────────────────────────────

function QuickAction({
  icon, title, desc, onClick,
}: { icon: string; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start rounded-2xl border border-stone-200 bg-white p-6 text-left shadow-sm transition-all hover:scale-[1.02] hover:border-emerald-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-emerald-600"
    >
      <span className="text-4xl transition-transform group-hover:scale-110">{icon}</span>
      <p className="mt-4 text-sm font-semibold text-stone-800 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-stone-400 dark:text-gray-400">{desc}</p>
    </button>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, accent }: { icon: string; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-transform hover:scale-[1.02] dark:border-gray-600 dark:bg-gray-800">
      <span className="text-3xl">{icon}</span>
      <p className={`mt-3 text-2xl font-bold tracking-tight ${accent ?? 'text-stone-900 dark:text-white'}`}>
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-stone-400 dark:text-gray-400">{label}</p>
    </div>
  );
}

// ── RAG compact chips (mobile) ─────────────────────────────────────────────

function RagChips({ summary }: { summary: DashboardData['summary'] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const amberCount = Math.max(0, summary.totalRecipes - summary.rentableCount - summary.nonRentableCount);

  const chips = [
    {
      emoji: '🟢',
      count: summary.rentableCount,
      label: t('dashboard.rag.profitable'),
      border: 'border-emerald-200 dark:border-emerald-800',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-700 dark:text-emerald-400',
      sub: 'text-emerald-600 dark:text-emerald-500',
    },
    ...(amberCount > 0 ? [{
      emoji: '🟡',
      count: amberCount,
      label: t('dashboard.rag.attention'),
      border: 'border-amber-200 dark:border-amber-800',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-700 dark:text-amber-400',
      sub: 'text-amber-600 dark:text-amber-500',
    }] : []),
    {
      emoji: '🔴',
      count: summary.nonRentableCount,
      label: t('dashboard.rag.danger'),
      border: 'border-red-200 dark:border-red-800',
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-400',
      sub: 'text-red-600 dark:text-red-500',
    },
  ];

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-1 md:hidden"
      style={{ scrollbarWidth: 'none' }}
    >
      {chips.map((c) => (
        <button
          key={c.label}
          onClick={() => navigate('/recipes')}
          className={`flex-none rounded-2xl border px-5 py-4 text-center ${c.border} ${c.bg}`}
          style={{ minWidth: '100px' }}
        >
          <span className="text-2xl leading-none">{c.emoji}</span>
          <p className={`mt-1 text-2xl font-bold ${c.text}`}>{c.count}</p>
          <p className={`mt-0.5 text-xs font-medium ${c.sub}`}>{c.label}</p>
        </button>
      ))}
    </div>
  );
}

// ── Recipe carousel (mobile) ───────────────────────────────────────────────

function RecipeCarousel({ recipes }: { recipes: RecipeSummary[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (recipes.length === 0) return null;

  return (
    <div className="md:hidden">
      <h3 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-gray-400">
        {t('dashboard.carousel.title')}
      </h3>
      <div
        className="flex gap-3 overflow-x-auto pb-4 px-1"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {recipes.map((r) => {
          const ragColor =
            r.ragStatus === 'green' ? 'bg-emerald-500' :
            r.ragStatus === 'amber' ? 'bg-amber-500' :
            'bg-red-500';
          const fcColor =
            r.foodCostPercent <= 25 ? 'text-emerald-600 dark:text-emerald-400' :
            r.foodCostPercent <= 35 ? 'text-amber-600 dark:text-amber-400' :
            'text-red-600 dark:text-red-400';

          return (
            <div
              key={r.id}
              onClick={() => navigate('/recipes')}
              className="cursor-pointer rounded-2xl border border-stone-100 bg-white shadow-sm transition-transform active:scale-95 dark:border-gray-700 dark:bg-gray-800"
              style={{
                flex: '0 0 75vw',
                scrollSnapAlign: 'start',
              }}
            >
              <div className="p-4">
                {/* Barre top colorée RAG */}
                <div className={`mb-3 h-1 rounded-full ${ragColor}`} />

                {/* Nom */}
                <p className="mb-1 line-clamp-2 text-sm font-bold leading-snug text-stone-900 dark:text-white">
                  {r.name}
                </p>

                {/* Catégorie */}
                {r.category && (
                  <p className="mb-3 text-xs text-stone-400 dark:text-gray-500">{r.category}</p>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between">
                  <span className={`text-xl font-bold ${fcColor}`}>
                    {fmt(r.foodCostPercent, 1)} %
                  </span>
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    +{fmt(r.profitPerDish)} €
                  </span>
                </div>

                {/* CTA */}
                <div className="mt-3 border-t border-stone-100 pt-3 dark:border-gray-700">
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {t('dashboard.carousel.viewDetails')} →
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<DashboardData>('/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => {
        setError(err.response?.data?.message ?? t('dashboard.loadError'));
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
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { summary, priceEvolution } = data;
  const fc = summary.averageFoodCost;
  const fcTrend = fc <= 30 ? t('dashboard.hero.belowThreshold') : t('dashboard.hero.aboveThreshold');

  // Build LineChart data
  const chartData = priceEvolution.length > 0
    ? [
        {
          name: t('dashboard.chart.start'),
          ...Object.fromEntries(priceEvolution.map((p) => [p.ingredientName, p.firstPrice])),
        },
        {
          name: t('dashboard.chart.now'),
          ...Object.fromEntries(priceEvolution.map((p) => [p.ingredientName, p.lastPrice])),
        },
      ]
    : [];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-stone-900 dark:text-white">{t('dashboard.title')}</h1>
        <p className="mt-0.5 text-sm text-stone-500 dark:text-gray-400">{t('dashboard.subtitle')}</p>
      </div>

      {/* Weekly alert banner — desktop only */}
      <div className="hidden md:block">
        <WeeklyAlertBanner />
      </div>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 p-8 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 right-8 h-64 w-64 rounded-full bg-white/5" />

        <div className="relative">
          <p className="text-sm font-medium text-emerald-200">{t('dashboard.hero.label')}</p>
          <p className="mt-1 text-6xl font-black tracking-tight text-white">
            {fmt(fc, 1)} %
          </p>
          <p className="mt-2 text-sm text-emerald-200">{fcTrend}</p>
          <p className="mt-0.5 text-xs text-emerald-300">{t('dashboard.hero.subtitle')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
              {t('dashboard.hero.recipes', { count: summary.totalRecipes })}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
              {t('dashboard.hero.profitable', { count: summary.rentableCount })}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
              {fmt(summary.totalPotentialProfit)} {t('dashboard.hero.perService')}
            </span>
          </div>
        </div>
      </div>

      {/* ── KPIs 2×2 ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon="🍽️"
          label={t('dashboard.kpi.totalRecipes')}
          value={String(summary.totalRecipes)}
        />
        <KpiCard
          icon="💰"
          label={t('dashboard.kpi.avgFoodCost')}
          value={`${fmt(fc, 1)} %`}
          accent={fc <= 25 ? 'text-emerald-600 dark:text-emerald-400' : fc <= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}
        />
        <KpiCard
          icon="✅"
          label={t('dashboard.kpi.profitableRecipes')}
          value={`${summary.rentableCount} / ${summary.totalRecipes}`}
          accent="text-stone-900 dark:text-white"
        />
        <KpiCard
          icon="🔴"
          label={t('dashboard.kpi.redRecipes')}
          value={String(summary.nonRentableCount)}
          accent={summary.nonRentableCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}
        />
      </div>

      {/* ── RAG chips — mobile only ── */}
      <RagChips summary={summary} />

      {/* ── Recipe carousel — mobile only ── */}
      <RecipeCarousel recipes={data.topProfitable} />

      {/* ── Quick actions — desktop only ── */}
      <div className="hidden md:block">
        <h2 className="mb-4 text-sm font-semibold text-stone-500 uppercase tracking-wide dark:text-gray-400">
          {t('dashboard.actions.title')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <QuickAction
            icon="📸"
            title={t('dashboard.actions.scanTitle')}
            desc={t('dashboard.actions.scanDesc')}
            onClick={() => navigate('/invoices')}
          />
          <QuickAction
            icon="➕"
            title={t('dashboard.actions.recipeTitle')}
            desc={t('dashboard.actions.recipeDesc')}
            onClick={() => navigate('/recipes')}
          />
          <QuickAction
            icon="📚"
            title={t('dashboard.actions.libraryTitle')}
            desc={t('dashboard.actions.libraryDesc')}
            onClick={() => navigate('/ingredients')}
          />
        </div>
      </div>

      {/* ── Top recettes avec RAG — desktop only ── */}
      {data.topProfitable.length > 0 && (
        <div className="hidden md:block">
          <h2 className="mb-4 text-sm font-semibold text-stone-500 uppercase tracking-wide dark:text-gray-400">
            {t('dashboard.tables.topProfitable')}
          </h2>
          <div className="rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="divide-y divide-stone-100 dark:divide-gray-700">
              {data.topProfitable.slice(0, 3).map((r) => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{ragDot(r.foodCostPercent)}</span>
                    <div>
                      <p className="text-sm font-medium text-stone-800 dark:text-white">{r.name}</p>
                      {r.category && (
                        <p className="text-xs text-stone-400 dark:text-gray-500">{r.category}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      +{fmt(r.profitPerDish)} €
                    </p>
                    <p className="text-xs text-stone-400 dark:text-gray-500">
                      FC {fmt(r.foodCostPercent, 1)} %
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Price evolution LineChart — desktop only ── */}
      {chartData.length > 0 && (
        <div className="hidden md:block rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-5 text-sm font-semibold text-stone-700 dark:text-gray-200">
            {t('dashboard.priceEvolution.title')}
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#78716c' }} />
              <YAxis tick={{ fontSize: 12, fill: '#78716c' }} unit=" €" width={56} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e5e4' }}
                formatter={(v: number) => [`${v.toFixed(2)} €`]}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
              {priceEvolution.map((p, i) => (
                <Line
                  key={p.ingredientName}
                  type="monotone"
                  dataKey={p.ingredientName}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 5 }}
                  activeDot={{ r: 7 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
