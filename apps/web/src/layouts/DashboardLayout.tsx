import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';

// ── Dark mode hook — dark by default ──────────────────────────────────────

function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved !== 'light' : true;
  });

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  }, []);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return [dark, () => setDark((d) => !d)];
}

// ── Bottom navigation items ────────────────────────────────────────────────

const BOTTOM_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/recipes', label: 'Recettes', icon: '🥗' },
  { to: '/ingredients', label: 'Ingrédients', icon: '📦' },
  { to: '/invoices', label: 'Factures', icon: '📄' },
  { to: '/advisor', label: 'Conseiller', icon: '🤖' },
];

// ── Layout ─────────────────────────────────────────────────────────────────

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, toggleDark] = useDarkMode();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    api.get<{ alerts: string[] }>('/dashboard')
      .then((r) => setAlertCount(r.data.alerts?.length ?? 0))
      .catch(() => {});
  }, []);

  const NAV_ITEMS = [
    { to: '/dashboard', label: t('nav.dashboard'), icon: '📊' },
    { to: '/ingredients', label: t('nav.ingredients'), icon: '🥕' },
    { to: '/recipes', label: t('nav.recipes'), icon: '👨‍🍳' },
    { to: '/invoices', label: t('nav.invoices'), icon: '🧾' },
    { to: '/advisor', label: t('nav.advisor'), icon: '🤖' },
    { to: '/alerts', label: 'Alertes', icon: '🔔', badge: alertCount },
    { to: '/analytics', label: 'Analytiques', icon: '📈' },
    { to: '/tech-sheets', label: t('nav.techSheets'), icon: '📋' },
  ];

  function toggleLang() {
    const next = i18n.language === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(next);
    localStorage.setItem('i18n_language', next);
  }

  function closeSidebar() { setSidebarOpen(false); }

  function isBottomNavActive(to: string) {
    if (to === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(to);
  }

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div
      className="flex"
      style={{ height: '100dvh', background: 'var(--bg-primary)' }}
    >
      {/* ─── Mobile overlay ─── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col transition-transform duration-200',
          'md:static md:translate-x-0 md:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{
          height: '100dvh',
          background: 'var(--bg-primary)',
          borderRight: '1px solid var(--bg-border)',
        }}
      >
        {/* Brand */}
        <div
          className="flex h-14 items-center gap-2.5 px-5"
          style={{ borderBottom: '1px solid var(--bg-border)' }}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-lg" style={{ background: 'var(--accent-bg)' }}>
            🍳
          </span>
          <span className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Chef IA
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              onClick={closeSidebar}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors relative',
                  isActive
                    ? 'border-l-[3px]'
                    : 'border-l-[3px] border-transparent',
                ].join(' ')
              }
              style={({ isActive }) => ({
                background: isActive ? 'var(--accent-bg)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                borderLeftColor: isActive ? 'var(--accent)' : 'transparent',
              })}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                if (!el.style.color.includes('var(--accent)')) {
                  el.style.background = 'var(--bg-tertiary)';
                  el.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                if (!el.style.color.includes('var(--accent)')) {
                  el.style.background = 'transparent';
                  el.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <span className="text-base leading-none">{icon}</span>
              <span className="flex-1">{label}</span>
              {badge != null && badge > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: 'var(--red)' }}>
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div
          className="space-y-3 p-4"
          style={{ borderTop: '1px solid var(--bg-border)' }}
        >
          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={toggleLang}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors"
              style={{
                border: '1px solid var(--bg-border)',
                color: 'var(--text-secondary)',
                background: 'transparent',
              }}
            >
              <span>{t('lang.flag')}</span>
              <span>{t('lang.switch')}</span>
            </button>
            <button
              onClick={toggleDark}
              title={dark ? 'Mode clair' : 'Mode sombre'}
              className="flex items-center justify-center rounded-lg px-3 py-1.5 text-sm transition-colors"
              style={{
                border: '1px solid var(--bg-border)',
                color: 'var(--text-secondary)',
                background: 'transparent',
              }}
            >
              {dark ? '☀️' : '🌙'}
            </button>
          </div>

          {/* User info */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-bold text-black"
              style={{ background: 'var(--accent)' }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user?.name}</p>
              <p className="truncate text-xs" style={{ color: 'var(--text-tertiary)' }}>{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="rounded-md px-2 py-1 text-xs transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">

        {/* Mobile top bar */}
        <div
          className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between px-4 md:hidden"
          style={{
            background: 'var(--bg-primary)',
            borderBottom: '1px solid var(--bg-border)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Menu"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" />
            </svg>
          </button>

          <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>🍳 Chef IA</span>

          <button
            onClick={toggleDark}
            className="rounded-lg p-2 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Page content */}
        <div
          className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-8 sm:py-8"
          style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
        >
          <Outlet />
        </div>
      </main>

      {/* ─── Bottom Navigation (mobile only) ─── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden"
        style={{
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--bg-border)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {BOTTOM_NAV.map(({ to, label, icon }) => {
          const active = isBottomNavActive(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2"
              style={{ minHeight: '56px' }}
            >
              <span className="text-xl leading-none">{icon}</span>
              <span
                className="text-[10px] font-medium leading-tight"
                style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)' }}
              >
                {label}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
