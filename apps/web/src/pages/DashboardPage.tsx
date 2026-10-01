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

function ragBorderColor(status: 'green' | 'amber' | 'red' | undefined): string {
  if (status === 'green') return 'var(--green)';
  if (status === 'amber') return 'var(--amber)';
  return 'var(--red)';
}

function ragFcColor(status: 'green' | 'amber' | 'red' | undefined): string {
  if (status === 'green') return 'var(--green)';
  if (status === 'amber') return 'var(--amber)';
  return 'var(--red)';
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

  const severityBorder =
    data.severity === 'critical' ? 'var(--red)' :
    data.severity === 'warning' ? 'var(--amber)' : 'var(--green)';
  const severityColor =
    data.severity === 'critical' ? 'var(--red)' :
    data.severity === 'warning' ? 'var(--amber)' : 'var(--green)';
  const icon = data.severity === 'critical' ? '🚨' : data.severity === 'warning' ? '⚠️' : '📊';
  const severityLabel =
    data.severity === 'critical' ? t('dashboard.weekly.critical') :
    data.severity === 'warning' ? t('dashboard.weekly.warning') : t('dashboard.weekly.info');

  return (
    <div
      className="rounded-xl px-5 py-4"
      style={{
        background: 'var(--bg-secondary)',
        border: `1px solid var(--bg-border)`,
        borderLeft: `3px solid ${severityBorder}`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-xl leading-none">{icon}</span>
          <div className="min-w-0 flex-1">
            <span
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: severityColor }}
            >
              {severityLabel}
            </span>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {data.alert}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => navigate('/advisor')}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              border: `1px solid ${severityBorder}`,
              color: severityColor,
              background: 'transparent',
            }}
          >
            {t('dashboard.weekly.seeDetails')}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
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
      className="group flex flex-col items-start rounded-xl p-5 text-left transition-colors"
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--bg-border)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bg-border)'; }}
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
        style={{ background: 'var(--accent-bg)' }}
      >
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
    </button>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) {
  return (
    <div
      className="rounded-xl p-5 transition-transform hover:scale-[1.02]"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-lg text-lg"
        style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
      >
        {icon}
      </span>
      <p
        className="mt-3 text-3xl font-bold tracking-tight"
        style={{ color: valueColor ?? 'var(--text-primary)' }}
      >
        {value}
      </p>
      <p
        className="mt-1 text-xs font-medium uppercase tracking-widest"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </p>
    </div>
  );
}

// ── RAG compact chips (mobile) ─────────────────────────────────────────────

function RagChips({ summary }: { summary: DashboardData['summary'] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const amberCount = Math.max(0, summary.totalRecipes - summary.rentableCount - summary.nonRentableCount);

  const chips = [
    { emoji: '🟢', count: summary.rentableCount, label: t('dashboard.rag.profitable'), color: 'var(--green)' },
    ...(amberCount > 0 ? [{ emoji: '🟡', count: amberCount, label: t('dashboard.rag.attention'), color: 'var(--amber)' }] : []),
    { emoji: '🔴', count: summary.nonRentableCount, label: t('dashboard.rag.danger'), color: 'var(--red)' },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 md:hidden" style={{ scrollbarWidth: 'none' }}>
      {chips.map((c) => (
        <button
          key={c.label}
          onClick={() => navigate('/recipes')}
          className="flex-none rounded-xl px-5 py-4 text-center"
          style={{
            minWidth: '100px',
            background: 'var(--bg-secondary)',
            border: `1px solid var(--bg-border)`,
            borderTop: `3px solid ${c.color}`,
          }}
        >
          <span className="text-2xl leading-none">{c.emoji}</span>
          <p className="mt-1 text-2xl font-bold" style={{ color: c.color }}>{c.count}</p>
          <p className="mt-0.5 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{c.label}</p>
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
    <div className="md:hidden" style={{ marginTop: 8 }}>
      <h3
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: 'var(--text-tertiary)', paddingLeft: 4, marginBottom: 12 }}
      >
        {t('dashboard.carousel.title')}
      </h3>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          overflowX: 'scroll',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x mandatory',
          paddingLeft: 4,
          paddingRight: 16,
          paddingBottom: 16,
          gap: 12,
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {recipes.map((r) => (
          <div
            key={r.id}
            onClick={() => navigate('/recipes')}
            style={{
              flexShrink: 0,
              width: '75vw',
              scrollSnapAlign: 'start',
              background: 'var(--bg-secondary)',
              borderRadius: 16,
              padding: 16,
              border: '1px solid var(--bg-border)',
              borderTop: `3px solid ${ragBorderColor(r.ragStatus)}`,
              cursor: 'pointer',
            }}
          >
            <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: 'var(--text-primary)' }}>
              {r.name}
            </p>
            {r.category && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                {r.category}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: ragFcColor(r.ragStatus) }}>
                {fmt(r.foodCostPercent, 1)} %
              </span>
              <span style={{ fontSize: 14, color: 'var(--green)', fontWeight: 600 }}>
                +{fmt(r.profitPerDish)} €
              </span>
            </div>
          </div>
        ))}
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl px-6 py-5 text-sm"
        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--red)' }}
      >
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { summary, priceEvolution } = data;
  const fc = summary.averageFoodCost;
  const fcOk = fc <= 30;
  const fcTrend = fcOk ? t('dashboard.hero.belowThreshold') : t('dashboard.hero.aboveThreshold');

  const chartData = priceEvolution.length > 0
    ? [
        { name: t('dashboard.chart.start'), ...Object.fromEntries(priceEvolution.map((p) => [p.ingredientName, p.firstPrice])) },
        { name: t('dashboard.chart.now'), ...Object.fromEntries(priceEvolution.map((p) => [p.ingredientName, p.lastPrice])) },
      ]
    : [];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('dashboard.title')}</h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.subtitle')}</p>
      </div>

      {/* Weekly alert — desktop */}
      <div className="hidden md:block">
        <WeeklyAlertBanner />
      </div>

      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden rounded-2xl p-8"
        style={{
          background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
          border: '1px solid var(--bg-border)',
        }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full"
          style={{ background: 'var(--accent-bg)' }}
        />
        <div className="relative">
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('dashboard.hero.label')}
          </p>
          <p className="mt-2 text-6xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {fmt(fc, 1)} %
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: fcOk ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: fcOk ? 'var(--green)' : 'var(--red)',
              }}
            >
              {fcTrend}
            </span>
          </div>
          <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('dashboard.hero.recipes', { count: summary.totalRecipes })} ·{' '}
            {t('dashboard.hero.profitable', { count: summary.rentableCount })}
          </p>
        </div>
      </div>

      {/* ── KPIs ── */}
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
          valueColor={fc <= 25 ? 'var(--green)' : fc <= 30 ? 'var(--amber)' : 'var(--red)'}
        />
        <KpiCard
          icon="✅"
          label={t('dashboard.kpi.profitableRecipes')}
          value={`${summary.rentableCount} / ${summary.totalRecipes}`}
        />
        <KpiCard
          icon="🔴"
          label={t('dashboard.kpi.redRecipes')}
          value={String(summary.nonRentableCount)}
          valueColor={summary.nonRentableCount > 0 ? 'var(--red)' : 'var(--green)'}
        />
      </div>

      {/* ── RAG chips — mobile ── */}
      <RagChips summary={summary} />

      {/* ── Recipe carousel — mobile ── */}
      <RecipeCarousel recipes={data.topProfitable} />

      {/* ── Quick actions — desktop ── */}
      <div className="hidden md:block">
        <h2
          className="mb-4 text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--text-tertiary)' }}
        >
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

      {/* ── Top recettes — desktop ── */}
      {data.topProfitable.length > 0 && (
        <div className="hidden md:block">
          <h2
            className="mb-4 text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('dashboard.tables.topProfitable')}
          </h2>
          <div
            className="rounded-2xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}
          >
            <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
              {data.topProfitable.slice(0, 3).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-5 py-3"
                  style={{ borderBottom: '1px solid var(--bg-border)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-2 w-2 rounded-full flex-none"
                      style={{ background: ragBorderColor(r.ragStatus) }}
                    />
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                      {r.category && (
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{r.category}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold" style={{ color: 'var(--green)' }}>
                      +{fmt(r.profitPerDish)} €
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      FC {fmt(r.foodCostPercent, 1)} %
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Price evolution — desktop ── */}
      {chartData.length > 0 && (
        <div
          className="hidden md:block rounded-2xl p-6"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}
        >
          <h2 className="mb-5 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('dashboard.priceEvolution.title')}
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} unit=" €" width={56} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                formatter={(v: number) => [`${v.toFixed(2)} €`]}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16, color: 'var(--text-secondary)' }} />
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
