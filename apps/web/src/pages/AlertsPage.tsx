import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

type AlertType = 'all' | 'food_cost' | 'price' | 'info';
type AlertSeverity = 'info' | 'warning' | 'critical';

interface ParsedAlert { id: number; raw: string; message: string; type: AlertType; severity: AlertSeverity; dismissed: boolean; }
interface WeeklyAlert { alert: string; generatedAt: string; severity: AlertSeverity; }

function parseAlert(raw: string, id: number): ParsedAlert {
  let start = 0;
  const chars = [...raw];
  while (start < chars.length && !/\p{L}/u.test(chars[start])) start++;
  const message = chars.slice(start).join('').trim();
  let type: AlertType = 'info';
  let severity: AlertSeverity = 'info';
  if (/food.?cost|rentab|marge/i.test(raw)) { type = 'food_cost'; severity = 'warning'; }
  else if (/prix|hausse|augment|inflation/i.test(raw)) { type = 'price'; severity = 'warning'; }
  if (raw.startsWith('⚠️') || raw.startsWith('🚨')) severity = 'critical';
  if (raw.startsWith('📈')) severity = 'warning';
  return { id, raw, message, type, severity, dismissed: false };
}

const SEVERITY_STYLE: Record<AlertSeverity, { borderColor: string; icon: string; badgeBg: string; badgeColor: string }> = {
  critical: { borderColor: 'var(--red)', icon: '🚨', badgeBg: 'rgba(239,68,68,0.15)', badgeColor: 'var(--red)' },
  warning:  { borderColor: 'var(--amber)', icon: '⚠️', badgeBg: 'rgba(245,158,11,0.15)', badgeColor: 'var(--amber)' },
  info:     { borderColor: '#60a5fa', icon: '💡', badgeBg: 'rgba(59,130,246,0.15)', badgeColor: '#60a5fa' },
};

const ALERT_TYPES: AlertType[] = ['all', 'food_cost', 'price', 'info'];

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
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('alerts.title')}</h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('alerts.subtitle', { count: activeCount })}
        </p>
      </div>

      {/* Weekly alert card */}
      {weekly && (
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--bg-border)',
            borderLeft: `3px solid ${SEVERITY_STYLE[weekly.severity].borderColor}`,
          }}
        >
          <div className="flex items-start gap-4">
            <span className="text-3xl">{SEVERITY_STYLE[weekly.severity].icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_STYLE[weekly.severity].borderColor }} />
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  {t('alerts.weeklyLabel')}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{weekly.alert}</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
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
            className="rounded-full px-4 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: filter === type ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: filter === type ? '#000' : 'var(--text-secondary)',
            }}
          >
            {t(`alerts.filter.${type}`)}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : visible.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 rounded-2xl border-dashed py-16 text-center"
          style={{ border: '2px dashed var(--bg-border)', background: 'var(--bg-secondary)' }}
        >
          <span className="text-4xl">✅</span>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('alerts.empty.title')}</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('alerts.empty.desc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((alert) => {
            const s = SEVERITY_STYLE[alert.severity];
            return (
              <div
                key={alert.id}
                className="rounded-2xl p-5 transition-all"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--bg-border)',
                  borderLeft: `3px solid ${s.borderColor}`,
                }}
              >
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 text-2xl leading-none">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: s.badgeBg, color: s.badgeColor }}>
                        {t(`alerts.severity.${alert.severity}`)}
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        {t(`alerts.filter.${alert.type}`)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{alert.message}</p>
                  </div>
                  <button
                    onClick={() => dismiss(alert.id)}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{ border: '1px solid var(--bg-border)', color: 'var(--text-secondary)', background: 'transparent' }}
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
