import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

// ── Types ──────────────────────────────────────────────────────────────────

type AlertType = 'all' | 'food_cost' | 'price' | 'info';
type AlertSeverity = 'info' | 'warning' | 'critical';

interface ParsedAlert {
  id: number;
  raw: string;
  message: string;
  type: AlertType;
  severity: AlertSeverity;
  dismissed: boolean;
}

interface WeeklyAlert {
  alert: string;
  generatedAt: string;
  severity: AlertSeverity;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseAlert(raw: string, id: number): ParsedAlert {
  // Strip leading emoji/symbols by advancing past non-letter characters
  let start = 0;
  const chars = [...raw];
  while (start < chars.length && !/\p{L}/u.test(chars[start])) start++;
  const message = chars.slice(start).join('').trim();

  let type: AlertType = 'info';
  let severity: AlertSeverity = 'info';

  if (/food.?cost|rentab|marge/i.test(raw)) {
    type = 'food_cost';
    severity = 'warning';
  } else if (/prix|hausse|augment|inflation/i.test(raw)) {
    type = 'price';
    severity = 'warning';
  }

  if (raw.startsWith('⚠️') || raw.startsWith('🚨')) severity = 'critical';
  if (raw.startsWith('📈')) severity = 'warning';

  return { id, raw, message, type, severity, dismissed: false };
}

const SEVERITY_STYLE: Record<AlertSeverity, { wrapper: string; icon: string; badge: string; dot: string }> = {
  critical: {
    wrapper: 'border-red-100 bg-red-50 dark:border-red-800/60 dark:bg-red-900/20',
    icon: '🚨',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    dot: 'bg-red-500',
  },
  warning: {
    wrapper: 'border-amber-100 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20',
    icon: '⚠️',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  info: {
    wrapper: 'border-blue-100 bg-blue-50 dark:border-blue-800/60 dark:bg-blue-900/20',
    icon: '💡',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
};

const ALERT_TYPES: AlertType[] = ['all', 'food_cost', 'price', 'info'];

// ── Page ───────────────────────────────────────────────────────────────────

export function AlertsPage() {
  const { t, i18n } = useTranslation();
  const [alerts, setAlerts] = useState<ParsedAlert[]>([]);
  const [weekly, setWeekly] = useState<WeeklyAlert | null>(null);
  const [filter, setFilter] = useState<AlertType>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ alerts: string[] }>('/dashboard'),
      api.get<WeeklyAlert>('/advisor/weekly-alert').catch(() => ({ data: null })),
    ]).then(([dashRes, weeklyRes]) => {
      const parsed = (dashRes.data.alerts ?? []).map((a, i) => parseAlert(a, i));
      setAlerts(parsed);
      setWeekly(weeklyRes.data as WeeklyAlert | null);
    }).finally(() => setLoading(false));
  }, []);

  function dismiss(id: number) {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, dismissed: true } : a));
  }

  const visible = alerts.filter((a) => !a.dismissed && (filter === 'all' || a.type === filter));
  const activeCount = alerts.filter((a) => !a.dismissed).length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-stone-900 dark:text-white">{t('alerts.title')}</h1>
        <p className="mt-0.5 text-sm text-stone-500 dark:text-gray-400">
          {t('alerts.subtitle', { count: activeCount })}
        </p>
      </div>

      {/* Weekly alert card */}
      {weekly && (
        <div className={`rounded-2xl border p-6 ${SEVERITY_STYLE[weekly.severity].wrapper}`}>
          <div className="flex items-start gap-4">
            <span className="text-3xl">{SEVERITY_STYLE[weekly.severity].icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${SEVERITY_STYLE[weekly.severity].dot}`} />
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-gray-400">
                  {t('alerts.weeklyLabel')}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-stone-700 dark:text-gray-200">
                {weekly.alert}
              </p>
              <p className="mt-1 text-xs text-stone-400 dark:text-gray-500">
                {new Date(weekly.generatedAt).toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'en-GB', {
                  day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {ALERT_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              filter === type
                ? 'bg-emerald-600 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {t(`alerts.filter.${type}`)}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center dark:border-gray-700 dark:bg-gray-800">
          <span className="text-4xl">✅</span>
          <p className="text-sm font-medium text-stone-700 dark:text-gray-200">{t('alerts.empty.title')}</p>
          <p className="text-xs text-stone-400 dark:text-gray-500">{t('alerts.empty.desc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((alert) => {
            const s = SEVERITY_STYLE[alert.severity];
            return (
              <div
                key={alert.id}
                className={`rounded-2xl border p-5 transition-all ${s.wrapper}`}
              >
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 text-2xl leading-none">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}>
                        {t(`alerts.severity.${alert.severity}`)}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}>
                        {t(`alerts.filter.${alert.type}`)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-stone-700 dark:text-gray-200">
                      {alert.message}
                    </p>
                  </div>
                  <button
                    onClick={() => dismiss(alert.id)}
                    className="shrink-0 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    {t('alerts.resolve')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
